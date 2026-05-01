"""
Team Knowledge Graph Service
Core logic: add entries, semantic search, quota tracking
"""

import math
import hashlib
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from loguru import logger

from app.models.team_knowledge import (
    KnowledgeEntry, KnowledgeEdge, QuotaEvent,
    EntryRole, SessionType, EntryType, EdgeType, QuotaEventType, EventCategory
)
from app.services.embedding_service import get_embedding_service, cosine_similarity, find_most_similar

# Token compression ratio: pre-compiled knowledge vs compiling fresh
# Based on Karpathy knowledge compilation insight — empirically ~8x
COMPRESSION_RATIO = 8.0
EDGE_SIMILARITY_THRESHOLD = 0.75  # Auto-create edge if similarity >= this
TOP_K_DEFAULT = 5


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token (Claude approximation)."""
    return max(1, len(text) // 4)


class TeamKnowledgeService:

    # ------------------------------------------------------------------ #
    # Knowledge Entry Management
    # ------------------------------------------------------------------ #

    async def add_entry(
        self,
        db: AsyncSession,
        tenant_id: int,
        user_id: Optional[int],
        title: str,
        content: str,
        role: str = "other",
        session_type: str = "other",
        entry_type: str = "insight",
        tags: Optional[List[str]] = None,
        product_area: Optional[str] = None,
        source_session_id: Optional[str] = None,
        session_tokens_used: Optional[int] = None,
        discovery_tokens: Optional[int] = None,
        files_read: Optional[List[str]] = None,
        files_modified: Optional[List[str]] = None,
        model: Optional[str] = None,
        llm_config: Optional[Dict] = None,
    ) -> KnowledgeEntry:
        """
        Add a new knowledge entry to the team graph.
        - Deduplicates via SHA256 content hash (silent no-op on duplicate)
        - Embeds the content
        - Stores the entry with granular capture fields
        - Auto-creates semantic edges to similar existing entries

        token_count = compressed entry size (session_tokens_used or content estimate)
        discovery_tokens = raw tool output size before compression (honest savings basis)
        """
        # Dedup: compute 16-char SHA256 of content and check for existing entry
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        dup_result = await db.execute(
            select(KnowledgeEntry).where(
                and_(
                    KnowledgeEntry.tenant_id == tenant_id,
                    KnowledgeEntry.content_hash == content_hash,
                )
            )
        )
        existing_entry = dup_result.scalar_one_or_none()
        if existing_entry is not None:
            logger.info(f"Duplicate content hash {content_hash} for tenant {tenant_id} — skipping insert")
            return existing_entry

        # Use exact session cost if provided; fall back to content-length estimate
        token_count = session_tokens_used if session_tokens_used else _estimate_tokens(content)

        # Generate embedding
        embedding = None
        try:
            svc = get_embedding_service(tenant_config=llm_config or {})
            text_to_embed = f"{title}\n\n{content}"
            embedding = await svc.embed_text(text_to_embed)
        except Exception as e:
            logger.warning(f"Embedding failed for knowledge entry (storing without embedding): {e}")

        entry = KnowledgeEntry(
            tenant_id=tenant_id,
            user_id=user_id,
            role=EntryRole(role) if role in EntryRole._value2member_map_ else EntryRole.OTHER,
            session_type=SessionType(session_type) if session_type in SessionType._value2member_map_ else SessionType.OTHER,
            entry_type=EntryType(entry_type) if entry_type in EntryType._value2member_map_ else EntryType.INSIGHT,
            title=title,
            content=content,
            tags=tags or [],
            product_area=product_area,
            source_session_id=source_session_id,
            embedding=embedding,
            token_count=token_count,
            content_hash=content_hash,
            discovery_tokens=discovery_tokens,
            files_read=files_read or [],
            files_modified=files_modified or [],
            model=model,
        )
        db.add(entry)
        await db.flush()  # get entry.id

        # Auto-create semantic edges to similar existing entries
        if embedding is not None:
            await self._create_semantic_edges(db, tenant_id, entry, embedding)

        await db.commit()
        await db.refresh(entry)
        logger.info(f"Knowledge entry added: id={entry.id}, tenant={tenant_id}, title='{title}'")

        # Push raw content to LightRAG for graph extraction (single pass, no double LLM cost)
        try:
            from app.services.lightrag_ingestion_service import _insert_texts
            text = f"# {title}\n\n{content}"
            await _insert_texts([text], [f"knowledge_entry:{entry.id}"])
        except Exception as e:
            logger.warning(f"LightRAG push skipped for knowledge entry {entry.id}: {e}")

        return entry

    async def _create_semantic_edges(
        self,
        db: AsyncSession,
        tenant_id: int,
        new_entry: KnowledgeEntry,
        new_embedding: List[float],
    ) -> None:
        """Find similar existing entries and create edges."""
        result = await db.execute(
            select(KnowledgeEntry).where(
                and_(
                    KnowledgeEntry.tenant_id == tenant_id,
                    KnowledgeEntry.id != new_entry.id,
                    KnowledgeEntry.embedding.isnot(None),
                )
            )
        )
        all_existing = result.scalars().all()
        # Skip entries whose embedding is JSON-null (stored before embedding was working)
        existing = [e for e in all_existing if isinstance(e.embedding, list) and len(e.embedding) > 0]
        if not existing:
            return

        embeddings = [e.embedding for e in existing]
        similarities = find_most_similar(new_embedding, embeddings, top_k=10)

        for idx, score in similarities:
            if score < EDGE_SIMILARITY_THRESHOLD:
                break
            target = existing[idx]
            edge = KnowledgeEdge(
                tenant_id=tenant_id,
                source_entry_id=new_entry.id,
                target_entry_id=target.id,
                edge_type=EdgeType.SEMANTIC,
                weight=round(score, 4),
            )
            db.add(edge)

    # ------------------------------------------------------------------ #
    # Retrieval (the core value prop)
    # ------------------------------------------------------------------ #

    async def get_relevant_context(
        self,
        db: AsyncSession,
        tenant_id: int,
        query: str,
        role: Optional[str] = None,
        session_type: Optional[str] = None,
        top_k: int = TOP_K_DEFAULT,
        llm_config: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve the most relevant knowledge entries for a query.
        Returns pre-compiled context text + token savings estimates.
        """
        # Load all entries for this tenant (with embeddings)
        stmt = select(KnowledgeEntry).where(
            and_(
                KnowledgeEntry.tenant_id == tenant_id,
                KnowledgeEntry.embedding.isnot(None),
            )
        )
        result = await db.execute(stmt)
        raw_entries = result.scalars().all()

        # Guard against JSON-null embeddings that pass IS NOT NULL but have no vector data
        all_entries = [e for e in raw_entries if isinstance(e.embedding, list) and len(e.embedding) > 0]

        if not all_entries:
            return self._empty_context_response()

        # Embed the query
        query_embedding = None
        try:
            svc = get_embedding_service(tenant_config=llm_config or {})
            query_embedding = await svc.embed_text(query)
        except Exception as e:
            logger.warning(f"Query embedding failed, falling back to recent entries: {e}")

        selected_with_scores: List[tuple]  # (entry, similarity_score)
        if query_embedding is not None:
            embeddings = [e.embedding for e in all_entries]
            top_indices = find_most_similar(query_embedding, embeddings, top_k=top_k)
            selected_with_scores = [(all_entries[i], score) for i, score in top_indices if score > 0.5]
        else:
            # Fallback: most recent entries, no similarity score available — use 1.0
            recent = sorted(all_entries, key=lambda e: e.created_at, reverse=True)[:top_k]
            selected_with_scores = [(e, 1.0) for e in recent]

        if not selected_with_scores:
            return self._empty_context_response()

        selected = [e for e, _ in selected_with_scores]

        # Update retrieval counts
        now = datetime.utcnow()
        for entry in selected:
            entry.retrieval_count += 1
            entry.last_retrieved_at = now
        await db.commit()

        # Compile context text and compute similarity-weighted savings.
        # Flat calculation (tokens_retrieved * 7) overstates for partial-overlap retrievals.
        # Weight each entry's contribution by its similarity score so a 0.6-match entry
        # only claims 60% of its theoretical saving.
        context_lines = ["## Team Knowledge Context\n"]
        total_retrieved_tokens = 0
        weighted_actual_savings = 0.0
        entries_meta = []

        for entry, similarity in selected_with_scores:
            tc = entry.token_count or _estimate_tokens(entry.content)
            total_retrieved_tokens += tc

            # Honest savings: use measured compression ratio when discovery_tokens is known.
            # discovery_tokens = raw tool output cost before Haiku compression.
            # compression_ratio = discovery_tokens / token_count (measured per entry, not speculative).
            # Fall back to COMPRESSION_RATIO constant only when discovery_tokens is unavailable.
            if entry.discovery_tokens and entry.discovery_tokens > tc:
                measured_ratio = entry.discovery_tokens / tc
                entry_savings = (entry.discovery_tokens - tc) * similarity
            else:
                measured_ratio = COMPRESSION_RATIO
                entry_savings = tc * (COMPRESSION_RATIO - 1) * similarity

            weighted_actual_savings += entry_savings
            context_lines.append(
                f"### {entry.title}\n"
                f"*{entry.role} · {entry.entry_type} · {entry.created_at.strftime('%Y-%m-%d')}*\n\n"
                f"{entry.content}\n"
            )
            entries_meta.append({
                "id": entry.id,
                "title": entry.title,
                "role": entry.role,
                "entry_type": entry.entry_type,
                "token_count": tc,
                "discovery_tokens": entry.discovery_tokens,
                "compression_ratio": round(measured_ratio, 2),
                "tags": entry.tags or [],
                "similarity_score": round(similarity, 3),
                "files_modified": entry.files_modified or [],
            })

        context_text = "\n".join(context_lines)
        tokens_to_compile_fresh = total_retrieved_tokens * COMPRESSION_RATIO
        actual_savings_now = int(weighted_actual_savings)

        return {
            "context_text": context_text,
            "entries": entries_meta,
            "tokens_retrieved": total_retrieved_tokens,
            "tokens_to_compile_fresh": int(tokens_to_compile_fresh),
            "tokens_saved_estimate": actual_savings_now,  # kept for API compat
            "actual_savings": actual_savings_now,
            "compression_ratio": COMPRESSION_RATIO,
            "entry_count": len(selected),
        }

    # ------------------------------------------------------------------ #
    # Redundancy Check (core ROI demo moment)
    # ------------------------------------------------------------------ #

    async def check_redundancy(
        self,
        db: AsyncSession,
        tenant_id: int,
        query: str,
        lookback_hours: int = 48,
        similarity_threshold: float = 0.75,
        llm_config: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Check whether a teammate already solved a similar problem recently.
        Returns matching entries with their exact session token costs.
        """
        since = datetime.utcnow() - timedelta(hours=lookback_hours)

        stmt = select(KnowledgeEntry).where(
            and_(
                KnowledgeEntry.tenant_id == tenant_id,
                KnowledgeEntry.created_at >= since,
                KnowledgeEntry.embedding.isnot(None),
            )
        )
        result = await db.execute(stmt)
        all_recent = result.scalars().all()

        # Guard against JSON-null embeddings that pass IS NOT NULL but have no vector data
        recent_entries = [e for e in all_recent if isinstance(e.embedding, list) and len(e.embedding) > 0]

        if not recent_entries:
            return {"found": False, "similar_entries": [], "message": ""}

        query_embedding = None
        try:
            svc = get_embedding_service(tenant_config=llm_config or {})
            query_embedding = await svc.embed_text(query)
        except Exception as e:
            logger.warning(f"Redundancy check embedding failed: {e}")
            return {"found": False, "similar_entries": [], "message": ""}

        if query_embedding is None:
            return {"found": False, "similar_entries": [], "message": ""}

        embeddings = [e.embedding for e in recent_entries]
        ranked = find_most_similar(query_embedding, embeddings, top_k=5)

        matches = []
        for idx, score in ranked:
            if score < similarity_threshold:
                break
            entry = recent_entries[idx]
            hours_ago = (datetime.utcnow() - entry.created_at).total_seconds() / 3600
            matches.append({
                "id": entry.id,
                "title": entry.title,
                "role": entry.role.value if hasattr(entry.role, "value") else entry.role,
                "entry_type": entry.entry_type.value if hasattr(entry.entry_type, "value") else entry.entry_type,
                "token_count": entry.token_count or 0,
                "content_preview": entry.content[:400] + ("..." if len(entry.content) > 400 else ""),
                "similarity": round(score, 3),
                "created_at": entry.created_at.isoformat(),
                "hours_ago": round(hours_ago, 1),
                "user_id": entry.user_id,
            })

        if not matches:
            return {"found": False, "similar_entries": [], "message": ""}

        best = matches[0]
        retrieval_cost = 140  # approximate tokens to retrieve this entry
        saving = max(0, best["token_count"] - retrieval_cost)
        message = (
            f"Similar work found: \"{best['title']}\" "
            f"({best['hours_ago']:.0f}h ago, ~{best['token_count']:,} tokens). "
            f"Retrieval saves ~{saving:,} tokens."
        )

        return {
            "found": True,
            "similar_entries": matches,
            "message": message,
            "best_match_token_count": best["token_count"],
            "estimated_saving": saving,
        }

    async def list_entries(
        self,
        db: AsyncSession,
        tenant_id: int,
        limit: int = 20,
        offset: int = 0,
    ) -> List[KnowledgeEntry]:
        """Paginated list of entries for the dashboard — no embeddings returned."""
        result = await db.execute(
            select(KnowledgeEntry)
            .where(KnowledgeEntry.tenant_id == tenant_id)
            .order_by(KnowledgeEntry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def get_entry(
        self,
        db: AsyncSession,
        tenant_id: int,
        entry_id: int,
    ) -> Optional[KnowledgeEntry]:
        """Single entry — tenant-scoped for safety."""
        result = await db.execute(
            select(KnowledgeEntry).where(
                and_(
                    KnowledgeEntry.id == entry_id,
                    KnowledgeEntry.tenant_id == tenant_id,
                )
            )
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------ #
    # Three-Layer Search (progressive disclosure — minimises token cost)
    # ------------------------------------------------------------------ #

    async def search_layer1(
        self,
        db: AsyncSession,
        tenant_id: int,
        query: str,
        top_k: int = 10,
        llm_config: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Layer 1 — compact index.
        Returns title + tags + date + entry_id only (~50 tokens per result).
        Call this first to let the user/AI narrow down before fetching full content.
        """
        stmt = select(KnowledgeEntry).where(
            and_(KnowledgeEntry.tenant_id == tenant_id, KnowledgeEntry.embedding.isnot(None))
        )
        result = await db.execute(stmt)
        raw = result.scalars().all()
        all_entries = [e for e in raw if isinstance(e.embedding, list) and len(e.embedding) > 0]

        if not all_entries:
            return {"layer": 1, "results": [], "hint": "No knowledge entries yet."}

        query_embedding = None
        try:
            svc = get_embedding_service(tenant_config=llm_config or {})
            query_embedding = await svc.embed_text(query)
        except Exception:
            pass

        if query_embedding is not None:
            embeddings = [e.embedding for e in all_entries]
            top_indices = find_most_similar(query_embedding, embeddings, top_k=top_k)
            ranked = [(all_entries[i], score) for i, score in top_indices if score > 0.3]
        else:
            recent = sorted(all_entries, key=lambda e: e.created_at, reverse=True)[:top_k]
            ranked = [(e, 1.0) for e in recent]

        results = []
        for entry, score in ranked:
            results.append({
                "id": entry.id,
                "title": entry.title,
                "entry_type": entry.entry_type.value if hasattr(entry.entry_type, "value") else entry.entry_type,
                "role": entry.role.value if hasattr(entry.role, "value") else entry.role,
                "tags": entry.tags or [],
                "date": entry.created_at.strftime("%Y-%m-%d"),
                "similarity": round(score, 3),
                "token_count": entry.token_count,
            })

        return {
            "layer": 1,
            "results": results,
            "hint": "Call search_layer2 with entry IDs to get file context and timeline, or search_layer3 for full content.",
        }

    async def search_layer2(
        self,
        db: AsyncSession,
        tenant_id: int,
        entry_ids: List[int],
    ) -> Dict[str, Any]:
        """
        Layer 2 — timeline + file context.
        Returns content preview (first 400 chars), files_read, files_modified, retrieval stats.
        Use to identify which entries are worth loading in full.
        """
        result = await db.execute(
            select(KnowledgeEntry).where(
                and_(
                    KnowledgeEntry.tenant_id == tenant_id,
                    KnowledgeEntry.id.in_(entry_ids),
                )
            )
        )
        entries = result.scalars().all()

        results = []
        for entry in entries:
            tc = entry.token_count or 0
            dt = entry.discovery_tokens
            compression = round(dt / tc, 1) if dt and tc > 0 else None
            results.append({
                "id": entry.id,
                "title": entry.title,
                "content_preview": entry.content[:400] + ("…" if len(entry.content) > 400 else ""),
                "files_read": entry.files_read or [],
                "files_modified": entry.files_modified or [],
                "token_count": tc,
                "discovery_tokens": dt,
                "measured_compression": compression,
                "retrieval_count": entry.retrieval_count,
                "last_retrieved_at": entry.last_retrieved_at.isoformat() if entry.last_retrieved_at else None,
                "created_at": entry.created_at.isoformat(),
                "model": entry.model,
            })

        return {
            "layer": 2,
            "results": results,
            "hint": "Call search_layer3 with specific entry IDs for full content.",
        }

    async def search_layer3(
        self,
        db: AsyncSession,
        tenant_id: int,
        entry_ids: List[int],
    ) -> Dict[str, Any]:
        """
        Layer 3 — full content.
        Only fetch this after Layer 1/2 confirmed the entries are relevant.
        """
        result = await db.execute(
            select(KnowledgeEntry).where(
                and_(
                    KnowledgeEntry.tenant_id == tenant_id,
                    KnowledgeEntry.id.in_(entry_ids),
                )
            )
        )
        entries = result.scalars().all()

        # Update retrieval counts
        now = datetime.utcnow()
        for entry in entries:
            entry.retrieval_count += 1
            entry.last_retrieved_at = now
        await db.commit()

        results = []
        for entry in entries:
            results.append({
                "id": entry.id,
                "title": entry.title,
                "content": entry.content,
                "role": entry.role.value if hasattr(entry.role, "value") else entry.role,
                "entry_type": entry.entry_type.value if hasattr(entry.entry_type, "value") else entry.entry_type,
                "tags": entry.tags or [],
                "product_area": entry.product_area,
                "files_read": entry.files_read or [],
                "files_modified": entry.files_modified or [],
                "token_count": entry.token_count,
                "discovery_tokens": entry.discovery_tokens,
                "model": entry.model,
                "created_at": entry.created_at.isoformat(),
            })

        return {"layer": 3, "results": results}

    def _empty_context_response(self) -> Dict:
        return {
            "context_text": "",
            "entries": [],
            "tokens_retrieved": 0,
            "tokens_to_compile_fresh": 0,
            "tokens_saved_estimate": 0,
            "compression_ratio": COMPRESSION_RATIO,
            "entry_count": 0,
        }

    # ------------------------------------------------------------------ #
    # Quota / Token Tracking
    # ------------------------------------------------------------------ #

    async def record_quota_event(
        self,
        db: AsyncSession,
        tenant_id: int,
        user_id: Optional[int],
        session_id: str,
        tokens_used: int,
        tokens_retrieved: int = 0,
        tokens_created: int = 0,
        actual_savings_override: Optional[int] = None,
        event_type: str = "session_end",
        tool_name: str = "claude-code",
        plan_type: Optional[str] = None,
        model: Optional[str] = None,
        cost_usd: Optional[float] = None,
        cwd: Optional[str] = None,
    ) -> QuotaEvent:
        # Determine category and honest accounting
        if tokens_retrieved > 0 and tokens_created > 0:
            category = EventCategory.MIXED
        elif tokens_retrieved > 0:
            category = EventCategory.RETRIEVAL
        else:
            category = EventCategory.CREATION

        # Prefer similarity-weighted override from the plugin (computed at retrieval time).
        # Fall back to flat calculation only when no override is provided.
        if actual_savings_override is not None:
            actual_savings = actual_savings_override
        else:
            actual_savings = int(tokens_retrieved * (COMPRESSION_RATIO - 1)) if tokens_retrieved > 0 else 0

        # tokens_invested = tokens spent creating new knowledge this session
        tokens_invested = tokens_created if tokens_created > 0 else (tokens_used if tokens_retrieved == 0 else 0)

        # Legacy field: keep populated for any existing queries/dashboards that still read it
        tokens_saved_legacy = actual_savings

        event = QuotaEvent(
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            event_type=QuotaEventType(event_type) if event_type in QuotaEventType._value2member_map_ else QuotaEventType.SESSION_END,
            tokens_used=tokens_used,
            tokens_retrieved=tokens_retrieved,
            tokens_saved_estimate=tokens_saved_legacy,
            event_category=category,
            tokens_invested=tokens_invested,
            actual_savings=actual_savings,
            tool_name=tool_name,
            plan_type=plan_type,
            model=model,
            cost_usd=cost_usd,
            session_date=datetime.utcnow(),
            cwd=cwd,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event

    async def get_quota_summary(
        self,
        db: AsyncSession,
        tenant_id: int,
        days: int = 7,
    ) -> Dict[str, Any]:
        """Team token savings summary — split into investment vs. realized savings."""
        since = datetime.utcnow() - timedelta(days=days)

        result = await db.execute(
            select(QuotaEvent).where(
                and_(
                    QuotaEvent.tenant_id == tenant_id,
                    QuotaEvent.session_date >= since,
                )
            )
        )
        events = result.scalars().all()

        total_used = sum(e.tokens_used for e in events)
        total_retrieved = sum(e.tokens_retrieved for e in events)
        session_count = len(events)
        rate_limit_hits = sum(1 for e in events if e.event_type == QuotaEventType.RATE_LIMIT_HIT)

        # Investment: tokens spent creating knowledge (creation + mixed events)
        tokens_invested = sum(e.tokens_invested or 0 for e in events)
        creation_sessions = sum(1 for e in events if e.event_category == EventCategory.CREATION)

        # Realized savings: only from retrieval events
        actual_savings = sum(e.actual_savings or 0 for e in events)
        retrieval_sessions = sum(1 for e in events if e.event_category in (EventCategory.RETRIEVAL, EventCategory.MIXED))

        # Net impact and ROI
        net_impact = actual_savings - tokens_invested
        roi_pct = round((net_impact / tokens_invested) * 100, 1) if tokens_invested > 0 else 0.0

        # Potential future value: entries created this period × compression ratio
        potential_future_value = int(tokens_invested * (COMPRESSION_RATIO - 1)) if tokens_invested > 0 else 0

        # Legacy field: keep for backwards-compat
        total_saved_legacy = sum(e.tokens_saved_estimate for e in events)
        quota_extended_pct = round((total_saved_legacy / (total_used + total_saved_legacy)) * 100, 1) if (total_used + total_saved_legacy) > 0 else 0.0

        # Knowledge graph stats
        kg_result = await db.execute(
            select(func.count(KnowledgeEntry.id)).where(KnowledgeEntry.tenant_id == tenant_id)
        )
        total_entries = kg_result.scalar() or 0

        recent_kg_result = await db.execute(
            select(func.count(KnowledgeEntry.id)).where(
                and_(KnowledgeEntry.tenant_id == tenant_id, KnowledgeEntry.created_at >= since)
            )
        )
        new_entries_this_period = recent_kg_result.scalar() or 0

        return {
            "period_days": days,
            "sessions": session_count,
            "tokens_used": total_used,
            "tokens_retrieved": total_retrieved,
            "tokens_saved_estimate": total_saved_legacy,  # legacy
            "quota_extended_pct": quota_extended_pct,
            "rate_limit_hits": rate_limit_hits,
            "knowledge_entries_total": total_entries,
            "knowledge_entries_new": new_entries_this_period,
            # Honest investment/reuse split
            "tokens_invested": tokens_invested,
            "creation_sessions": creation_sessions,
            "potential_future_value": potential_future_value,
            "actual_savings": actual_savings,
            "retrieval_sessions": retrieval_sessions,
            "net_impact": net_impact,
            "roi_pct": roi_pct,
        }


team_knowledge_service = TeamKnowledgeService()
