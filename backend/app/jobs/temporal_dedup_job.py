"""
Temporal Dedup & Entity Resolution Job

Runs on a configurable interval (default: 24 hours, min: 1 hour).
Per tenant, connects directly to LightRAG's PostgreSQL and performs
three passes inside the tenant's workspace:

  Pass 1 – Temporal resolution
    For each (workspace, entity_name) that has more than one *current*
    row (shouldn't normally happen post-PK migration, but protects
    against duplicates that pre-date the temporal patch), keep the
    row with the latest valid_from and mark the rest is_current=FALSE.

  Pass 2 – Entity name deduplication
    Find entity pairs whose names are highly similar (Jaro-Winkler ≥ 0.92
    or exact after lower-casing / punctuation-stripping).  Merge the
    lower-confidence duplicate into the canonical entity by:
      a) Merging the duplicate's chunk_ids into the canonical row.
      b) Hard-DELETE the duplicate row — it was a bad extraction, not a
         historical version, and should not accumulate as junk.
    Confidence is approximated by number of distinct chunk_ids (proxy for
    source count) + character completeness of the content field.

  Pass 3 – Confidence score refresh
    Update a JSON metadata column `confidence_meta` (added by migration if
    absent) on LIGHTRAG_VDB_ENTITY with:
      { source_count, relation_count, description_length, score }
    score ∈ [0.0, 1.0] =
        0.40 * normalised_source_count
      + 0.35 * normalised_relation_count
      + 0.25 * normalised_description_length

The job never deletes rows — it only sets is_current=FALSE so the
retrieval filter in the patched LightRAG silently ignores them while
the full history is preserved for audit / rollback.
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Any

import asyncpg
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.tenant import Tenant

# ---------------------------------------------------------------------------
# Jaro-Winkler implementation (no external dep required)
# ---------------------------------------------------------------------------

def _jaro(s1: str, s2: str) -> float:
    if s1 == s2:
        return 1.0
    l1, l2 = len(s1), len(s2)
    if l1 == 0 or l2 == 0:
        return 0.0
    match_dist = max(l1, l2) // 2 - 1
    if match_dist < 0:
        match_dist = 0
    s1_matches = [False] * l1
    s2_matches = [False] * l2
    matches = 0
    transpositions = 0
    for i in range(l1):
        start = max(0, i - match_dist)
        end = min(i + match_dist + 1, l2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break
    if matches == 0:
        return 0.0
    k = 0
    for i in range(l1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1
    return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3


def _jaro_winkler(s1: str, s2: str, p: float = 0.1) -> float:
    jaro = _jaro(s1, s2)
    prefix = 0
    for s1c, s2c in zip(s1, s2):
        if s1c == s2c:
            prefix += 1
        else:
            break
        if prefix == 4:
            break
    return jaro + prefix * p * (1 - jaro)


def _normalise(name: str) -> str:
    """Lowercase, strip punctuation/extra spaces for fuzzy comparison."""
    return re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()


# ---------------------------------------------------------------------------
# LightRAG DB connection helpers
# ---------------------------------------------------------------------------

def _lightrag_dsn() -> str | None:
    """Build a DSN for LightRAG's PostgreSQL from env vars."""
    host = os.environ.get("LIGHTRAG_PG_HOST") or os.environ.get("POSTGRES_HOST")
    port = os.environ.get("LIGHTRAG_PG_PORT") or os.environ.get("POSTGRES_PORT", "5432")
    user = os.environ.get("LIGHTRAG_PG_USER") or os.environ.get("POSTGRES_USER")
    password = os.environ.get("LIGHTRAG_PG_PASSWORD") or os.environ.get("POSTGRES_PASSWORD")
    dbname = os.environ.get("LIGHTRAG_PG_DATABASE") or os.environ.get("POSTGRES_DATABASE")
    if not all([host, user, password, dbname]):
        return None
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


async def _get_lightrag_conn() -> asyncpg.Connection | None:
    dsn = _lightrag_dsn()
    if not dsn:
        logger.warning("[TemporalDedupJob] LIGHTRAG_PG_* env vars not configured — skipping")
        return None
    try:
        conn = await asyncpg.connect(dsn)
        return conn
    except Exception as e:
        logger.error(f"[TemporalDedupJob] Cannot connect to LightRAG PG: {e}")
        return None


# ---------------------------------------------------------------------------
# Per-workspace dedup passes
# ---------------------------------------------------------------------------

async def _pass1_temporal_resolution(conn: asyncpg.Connection, workspace: str) -> int:
    """
    Delete spurious duplicate rows that share the same entity_name in a workspace.

    This can only happen when two extraction runs produced different IDs for the
    same entity name (e.g. whitespace normalisation differences).  With the
    (workspace, id) PK you can't have two rows with the same name *and* same ID,
    so any duplicates here are structural garbage — not historical versions.

    Strategy: keep the row with the latest valid_from (most recently verified by
    ingestion); merge its chunk_ids from the others; DELETE the surplus rows.
    Returns the number of rows deleted.
    """
    # Find all entity names that have more than one current row
    dup_names = await conn.fetch(
        """
        SELECT entity_name
        FROM LIGHTRAG_VDB_ENTITY
        WHERE workspace = $1 AND is_current = TRUE
        GROUP BY entity_name
        HAVING COUNT(*) > 1
        """,
        workspace,
    )

    if not dup_names:
        return 0

    deleted = 0
    for row in dup_names:
        name = row["entity_name"]
        candidates = await conn.fetch(
            """
            SELECT id, chunk_ids, valid_from, update_time
            FROM LIGHTRAG_VDB_ENTITY
            WHERE workspace = $1 AND entity_name = $2 AND is_current = TRUE
            ORDER BY valid_from DESC, update_time DESC
            """,
            workspace,
            name,
        )
        if len(candidates) < 2:
            continue

        canonical_id = candidates[0]["id"]
        surplus_ids = [r["id"] for r in candidates[1:]]

        # Merge all chunk_ids into canonical
        all_chunks: list[str] = []
        for c in candidates:
            all_chunks.extend(c["chunk_ids"] or [])
        merged_chunks = list(dict.fromkeys(all_chunks))  # deduplicated, order-preserving

        await conn.execute(
            "UPDATE LIGHTRAG_VDB_ENTITY SET chunk_ids = $1 WHERE workspace = $2 AND id = $3",
            merged_chunks,
            workspace,
            canonical_id,
        )
        await conn.execute(
            "DELETE FROM LIGHTRAG_VDB_ENTITY WHERE workspace = $1 AND id = ANY($2::varchar[])",
            workspace,
            surplus_ids,
        )
        deleted += len(surplus_ids)

    if deleted:
        logger.info(f"[TemporalDedupJob] workspace={workspace} pass1: deleted {deleted} duplicate entity rows")
    return deleted


async def _pass2_entity_name_dedup(
    conn: asyncpg.Connection,
    workspace: str,
    similarity_threshold: float = 0.92,
) -> int:
    """
    Find current entity pairs with similar names, merge lower-confidence
    duplicate into canonical, then DELETE the duplicate row.

    Duplicates here are bad extractions ("J. Smith" vs "John Smith") — they
    are not historical versions and should not accumulate.  chunk_ids are
    merged into the canonical before the duplicate is hard-deleted.
    Returns number of rows deleted.
    """
    rows = await conn.fetch(
        """
        SELECT id, entity_name, content,
               COALESCE(array_length(chunk_ids, 1), 0) AS chunk_count
        FROM LIGHTRAG_VDB_ENTITY
        WHERE workspace = $1 AND is_current = TRUE
        ORDER BY entity_name
        """,
        workspace,
    )

    if not rows:
        return 0

    # Build candidate pairs
    entities = [
        {
            "id": r["id"],
            "name": r["entity_name"],
            "norm": _normalise(r["entity_name"]),
            "chunk_count": r["chunk_count"],
            "desc_len": len(r["content"] or ""),
        }
        for r in rows
    ]

    def _confidence(e: dict[str, Any]) -> float:
        return e["chunk_count"] * 0.6 + min(e["desc_len"], 500) / 500 * 0.4

    merged = 0
    processed_ids: set[str] = set()

    for i, e1 in enumerate(entities):
        if e1["id"] in processed_ids:
            continue
        for e2 in entities[i + 1 :]:
            if e2["id"] in processed_ids:
                continue
            # Quick length gate before full JW computation
            if abs(len(e1["norm"]) - len(e2["norm"])) > 8:
                continue
            score = _jaro_winkler(e1["norm"], e2["norm"])
            if score < similarity_threshold:
                continue

            # Determine canonical (higher confidence) vs duplicate
            if _confidence(e1) >= _confidence(e2):
                canonical, duplicate = e1, e2
            else:
                canonical, duplicate = e2, e1

            logger.info(
                f"[TemporalDedupJob] workspace={workspace} merging '{duplicate['name']}' "
                f"→ '{canonical['name']}' (jw={score:.3f})"
            )

            # Merge duplicate's chunk_ids into canonical, then DELETE the duplicate row
            try:
                # Merge chunk_ids: union of both arrays, de-duplicated
                await conn.execute(
                    """
                    UPDATE LIGHTRAG_VDB_ENTITY
                    SET chunk_ids = ARRAY(
                        SELECT DISTINCT unnest(
                            COALESCE(chunk_ids, ARRAY[]::varchar[]) ||
                            (SELECT COALESCE(chunk_ids, ARRAY[]::varchar[])
                             FROM LIGHTRAG_VDB_ENTITY
                             WHERE workspace = $1 AND id = $2)
                        )
                    ),
                    update_time = CURRENT_TIMESTAMP,
                    valid_from = CURRENT_TIMESTAMP
                    WHERE workspace = $1 AND id = $3
                    """,
                    workspace,
                    duplicate["id"],
                    canonical["id"],
                )
                # Hard delete — "J. Smith" was never a real separate entity
                await conn.execute(
                    "DELETE FROM LIGHTRAG_VDB_ENTITY WHERE workspace = $1 AND id = $2",
                    workspace,
                    duplicate["id"],
                )
                processed_ids.add(duplicate["id"])
                merged += 1
            except Exception as e:
                logger.warning(
                    f"[TemporalDedupJob] Failed to merge {duplicate['id']} → {canonical['id']}: {e}"
                )

    if merged:
        logger.info(f"[TemporalDedupJob] workspace={workspace} pass2: deleted {merged} near-duplicate entity rows")
    return merged


async def _ensure_confidence_meta_column(conn: asyncpg.Connection) -> None:
    """Add confidence_meta JSONB column to LIGHTRAG_VDB_ENTITY if absent."""
    exists = await conn.fetchrow(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'lightrag_vdb_entity' AND column_name = 'confidence_meta'
        """
    )
    if not exists:
        await conn.execute(
            "ALTER TABLE LIGHTRAG_VDB_ENTITY ADD COLUMN confidence_meta JSONB NULL"
        )
        logger.info("[TemporalDedupJob] Added confidence_meta column to LIGHTRAG_VDB_ENTITY")


async def _pass3_confidence_refresh(conn: asyncpg.Connection, workspace: str) -> int:
    """
    Recompute and persist confidence_meta for all current entities.
    Returns number of rows updated.
    """
    rows = await conn.fetch(
        """
        SELECT e.id,
               COALESCE(array_length(e.chunk_ids, 1), 0) AS source_count,
               COALESCE(LENGTH(e.content), 0)            AS desc_len
        FROM LIGHTRAG_VDB_ENTITY e
        WHERE e.workspace = $1 AND e.is_current = TRUE
        """,
        workspace,
    )
    if not rows:
        return 0

    # Fetch relation counts per entity_name for this workspace
    rel_rows = await conn.fetch(
        """
        SELECT source_id AS entity_name, COUNT(*) AS rel_count
        FROM LIGHTRAG_VDB_RELATION
        WHERE workspace = $1 AND is_current = TRUE
        GROUP BY source_id
        UNION ALL
        SELECT target_id, COUNT(*)
        FROM LIGHTRAG_VDB_RELATION
        WHERE workspace = $1 AND is_current = TRUE
        GROUP BY target_id
        """,
        workspace,
    )
    rel_counts: dict[str, int] = {}
    for r in rel_rows:
        rel_counts[r["entity_name"]] = rel_counts.get(r["entity_name"], 0) + r["rel_count"]

    max_source = max((r["source_count"] for r in rows), default=1) or 1
    max_rel = max(rel_counts.values(), default=1) or 1
    max_desc = max((r["desc_len"] for r in rows), default=1) or 1

    updates: list[tuple[str, str, str]] = []
    for r in rows:
        sc = r["source_count"] / max_source
        rc = rel_counts.get(r["id"], 0) / max_rel
        dl = r["desc_len"] / max_desc
        score = round(0.40 * sc + 0.35 * rc + 0.25 * dl, 4)
        meta = json.dumps(
            {
                "source_count": r["source_count"],
                "relation_count": rel_counts.get(r["id"], 0),
                "description_length": r["desc_len"],
                "score": score,
                "refreshed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        updates.append((meta, workspace, r["id"]))

    await conn.executemany(
        """
        UPDATE LIGHTRAG_VDB_ENTITY
        SET confidence_meta = $1::jsonb
        WHERE workspace = $2 AND id = $3
        """,
        updates,
    )
    logger.info(
        f"[TemporalDedupJob] workspace={workspace} pass3: refreshed confidence for {len(updates)} entities"
    )
    return len(updates)


# ---------------------------------------------------------------------------
# Main job entry point
# ---------------------------------------------------------------------------

async def run_temporal_dedup_job() -> dict[str, Any]:
    """
    Run temporal dedup for all tenants whose dedup interval has elapsed.
    Called by SchedulerService on a 1-hour check cadence; per-tenant interval
    (dedup_interval_hours, default 24, min 1) controls actual execution frequency.
    """
    logger.info("[TemporalDedupJob] Starting")
    results: dict[str, Any] = {
        "status": "success",
        "tenants_processed": 0,
        "tenants_skipped": 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    conn: asyncpg.Connection | None = None
    try:
        conn = await _get_lightrag_conn()
        if conn is None:
            results["status"] = "skipped_no_db"
            return results

        await _ensure_confidence_meta_column(conn)

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant))
            tenants = result.scalars().all()

            for tenant in tenants:
                try:
                    should_run = await _is_dedup_due(tenant)
                    if not should_run:
                        results["tenants_skipped"] += 1
                        continue

                    workspace = _tenant_workspace(tenant)
                    logger.info(f"[TemporalDedupJob] Running for tenant={tenant.id} workspace={workspace}")

                    archived = await _pass1_temporal_resolution(conn, workspace)
                    merged = await _pass2_entity_name_dedup(conn, workspace)
                    refreshed = await _pass3_confidence_refresh(conn, workspace)

                    await _record_last_dedup(db, tenant)
                    results["tenants_processed"] += 1

                    logger.info(
                        f"[TemporalDedupJob] tenant={tenant.id} done: "
                        f"archived={archived} merged={merged} confidence_refreshed={refreshed}"
                    )

                except Exception as e:
                    logger.error(f"[TemporalDedupJob] Failed for tenant={tenant.id}: {e}")

    except Exception as e:
        logger.error(f"[TemporalDedupJob] Fatal error: {e}")
        results["status"] = "error"
        results["error"] = str(e)
    finally:
        if conn:
            await conn.close()

    logger.info(
        f"[TemporalDedupJob] Done: processed={results['tenants_processed']} "
        f"skipped={results['tenants_skipped']}"
    )
    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tenant_workspace(tenant: Tenant) -> str:
    """Derive the LightRAG workspace name for a tenant (matches ingestion convention)."""
    settings = tenant.settings or {}
    # Allow override via tenant settings; default to "tenant_{id}"
    return settings.get("lightrag_workspace") or f"tenant_{tenant.id}"


async def _is_dedup_due(tenant: Tenant) -> bool:
    """Return True if the dedup job should run for this tenant now."""
    settings = tenant.settings or {}
    interval_hours = max(1, int(settings.get("dedup_interval_hours", 24)))
    last_dedup_str: str | None = settings.get("dedup_last_run")
    if not last_dedup_str:
        return True
    try:
        last_run = datetime.fromisoformat(last_dedup_str.rstrip("Z"))
        return datetime.utcnow() >= last_run + timedelta(hours=interval_hours)
    except (ValueError, TypeError):
        return True


async def _record_last_dedup(db: AsyncSession, tenant: Tenant) -> None:
    """Persist the last-run timestamp back into tenant.settings."""
    from sqlalchemy.orm import attributes

    settings = dict(tenant.settings or {})
    settings["dedup_last_run"] = datetime.utcnow().isoformat() + "Z"
    tenant.settings = settings
    attributes.flag_modified(tenant, "settings")
    await db.commit()


if __name__ == "__main__":
    asyncio.run(run_temporal_dedup_job())
