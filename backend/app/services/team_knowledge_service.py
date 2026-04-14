"""
Team Knowledge Graph Service
Core logic: add entries, semantic search, quota tracking
"""

import math
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from loguru import logger

from app.models.team_knowledge import (
    KnowledgeEntry, KnowledgeEdge, QuotaEvent,
    EntryRole, SessionType, EntryType, EdgeType, QuotaEventType
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
        llm_config: Optional[Dict] = None,
    ) -> KnowledgeEntry:
        """
        Add a new knowledge entry to the team graph.
        - Embeds the content
        - Stores the entry
        - Auto-creates semantic edges to similar existing entries
        """
        token_count = _estimate_tokens(content)

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
        )
        db.add(entry)
        await db.flush()  # get entry.id

        # Auto-create semantic edges to similar existing entries
        if embedding is not None:
            await self._create_semantic_edges(db, tenant_id, entry, embedding)

        await db.commit()
        await db.refresh(entry)
        logger.info(f"Knowledge entry added: id={entry.id}, tenant={tenant_id}, title='{title}'")
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
        existing = result.scalars().all()
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
        all_entries = result.scalars().all()

        if not all_entries:
            return self._empty_context_response()

        # Embed the query
        query_embedding = None
        try:
            svc = get_embedding_service(tenant_config=llm_config or {})
            query_embedding = await svc.embed_text(query)
        except Exception as e:
            logger.warning(f"Query embedding failed, falling back to recent entries: {e}")

        if query_embedding is not None:
            embeddings = [e.embedding for e in all_entries]
            top_indices = find_most_similar(query_embedding, embeddings, top_k=top_k)
            selected = [all_entries[i] for i, score in top_indices if score > 0.5]
        else:
            # Fallback: most recent entries
            selected = sorted(all_entries, key=lambda e: e.created_at, reverse=True)[:top_k]

        if not selected:
            return self._empty_context_response()

        # Update retrieval counts
        now = datetime.utcnow()
        for entry in selected:
            entry.retrieval_count += 1
            entry.last_retrieved_at = now
        await db.commit()

        # Compile context text
        context_lines = ["## Team Knowledge Context\n"]
        total_retrieved_tokens = 0
        entries_meta = []

        for entry in selected:
            tc = entry.token_count or _estimate_tokens(entry.content)
            total_retrieved_tokens += tc
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
                "tags": entry.tags or [],
            })

        context_text = "\n".join(context_lines)
        tokens_to_compile_fresh = total_retrieved_tokens * COMPRESSION_RATIO
        tokens_saved = int(tokens_to_compile_fresh - total_retrieved_tokens)

        return {
            "context_text": context_text,
            "entries": entries_meta,
            "tokens_retrieved": total_retrieved_tokens,
            "tokens_to_compile_fresh": int(tokens_to_compile_fresh),
            "tokens_saved_estimate": tokens_saved,
            "compression_ratio": COMPRESSION_RATIO,
            "entry_count": len(selected),
        }

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
        event_type: str = "session_end",
        tool_name: str = "claude-code",
        plan_type: Optional[str] = None,
        cwd: Optional[str] = None,
    ) -> QuotaEvent:
        tokens_saved = int(tokens_retrieved * (COMPRESSION_RATIO - 1))
        event = QuotaEvent(
            tenant_id=tenant_id,
            user_id=user_id,
            session_id=session_id,
            event_type=QuotaEventType(event_type) if event_type in QuotaEventType._value2member_map_ else QuotaEventType.SESSION_END,
            tokens_used=tokens_used,
            tokens_retrieved=tokens_retrieved,
            tokens_saved_estimate=tokens_saved,
            tool_name=tool_name,
            plan_type=plan_type,
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
        """Weekly team token savings summary."""
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
        total_saved = sum(e.tokens_saved_estimate for e in events)
        session_count = len(events)
        rate_limit_hits = sum(1 for e in events if e.event_type == QuotaEventType.RATE_LIMIT_HIT)

        quota_extended_pct = round((total_saved / (total_used + total_saved)) * 100, 1) if (total_used + total_saved) > 0 else 0.0

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
            "tokens_saved_estimate": total_saved,
            "quota_extended_pct": quota_extended_pct,
            "rate_limit_hits": rate_limit_hits,
            "knowledge_entries_total": total_entries,
            "knowledge_entries_new": new_entries_this_period,
        }


team_knowledge_service = TeamKnowledgeService()
