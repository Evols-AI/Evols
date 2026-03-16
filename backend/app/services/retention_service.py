"""
Retention Policy Service
Handles content retention, deletion scheduling, and encryption
"""

from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from loguru import logger

from app.models.context import ContextSource, ContentAccessLog
from app.services.encryption_service import encrypt_text, decrypt_text


class RetentionPolicyService:
    """Service for managing content retention policies"""

    RETENTION_POLICIES = {
        'delete_immediately': {
            'days': 0,
            'description': 'Delete original content immediately after extraction',
            'requires_encryption': False
        },
        '30_days': {
            'days': 30,
            'description': 'Keep original for 30 days, then auto-delete',
            'requires_encryption': False
        },
        '90_days': {
            'days': 90,
            'description': 'Keep original for 90 days, then auto-delete',
            'requires_encryption': False
        },
        'retain_encrypted': {
            'days': None,  # Indefinite
            'description': 'Keep original indefinitely, encrypted',
            'requires_encryption': True
        },
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def apply_retention_policy(
        self,
        source: ContextSource,
        policy: str = '30_days',
        encrypt_if_needed: bool = True
    ) -> None:
        """
        Apply retention policy to a context source

        Args:
            source: ContextSource to apply policy to
            policy: Retention policy name
            encrypt_if_needed: If True and policy requires encryption, encrypt the content

        Raises:
            ValueError: If policy is invalid or encryption fails
        """
        if policy not in self.RETENTION_POLICIES:
            raise ValueError(f"Invalid retention policy: {policy}")

        policy_config = self.RETENTION_POLICIES[policy]
        source.retention_policy = policy

        # Handle immediate deletion
        if policy == 'delete_immediately':
            await self._delete_content(source)
            return

        # Handle encryption for retain_encrypted policy
        if policy == 'retain_encrypted' and encrypt_if_needed:
            if source.content and not source.is_encrypted:
                await self._encrypt_content(source)
            return

        # Schedule deletion for time-based policies
        if policy_config['days'] is not None:
            deletion_date = datetime.utcnow() + timedelta(days=policy_config['days'])
            source.deletion_scheduled_for = deletion_date
            logger.info(f"[RetentionService] Scheduled deletion for source {source.id} on {deletion_date}")

        await self.db.commit()

    async def _delete_content(self, source: ContextSource) -> None:
        """
        Delete content from source and create summary

        Args:
            source: ContextSource to delete content from
        """
        # Create summary before deletion
        content_size_kb = len(source.content or '') / 1024 if source.content else 0
        entities_count = source.entities_extracted_count or 0

        summary = f"{entities_count} entities extracted"
        if content_size_kb > 0:
            summary += f", {content_size_kb:.1f}KB original content"
        if source.customer_name:
            summary += f", customer: {source.customer_name}"
        if source.source_date:
            summary += f", date: {source.source_date.isoformat()}"

        source.content_summary = summary

        # Delete content
        source.content = None
        source.raw_content = None
        source.content_deleted_at = datetime.utcnow()

        logger.info(f"[RetentionService] Deleted content from source {source.id}: {summary}")
        await self.db.commit()

    async def _encrypt_content(self, source: ContextSource) -> None:
        """
        Encrypt content for secure retention

        Args:
            source: ContextSource to encrypt

        Raises:
            ValueError: If encryption fails
        """
        if not source.content:
            logger.warning(f"[RetentionService] No content to encrypt for source {source.id}")
            return

        try:
            # Generate unique key ID
            key_id = f"context_{source.id}_{source.tenant_id}"

            # Encrypt content
            encrypted_blob = encrypt_text(source.content, key_id)

            # Store encrypted content
            source.encrypted_content = encrypted_blob
            source.encryption_key_id = key_id
            source.is_encrypted = True

            # Clear plaintext content
            source.content = None
            source.raw_content = None

            logger.info(f"[RetentionService] Encrypted content for source {source.id}")
            await self.db.commit()

        except Exception as e:
            logger.error(f"[RetentionService] Encryption failed for source {source.id}: {e}")
            raise ValueError(f"Content encryption failed: {e}")

    async def decrypt_content(self, source: ContextSource) -> str:
        """
        Decrypt encrypted content

        Args:
            source: ContextSource with encrypted content

        Returns:
            Decrypted content

        Raises:
            ValueError: If source is not encrypted or decryption fails
        """
        if not source.is_encrypted or not source.encrypted_content:
            raise ValueError("Source does not have encrypted content")

        if not source.encryption_key_id:
            raise ValueError("Missing encryption key ID")

        try:
            decrypted_content = decrypt_text(source.encrypted_content, source.encryption_key_id)

            # Update access tracking
            source.last_accessed_at = datetime.utcnow()
            source.access_count = (source.access_count or 0) + 1
            await self.db.commit()

            return decrypted_content

        except Exception as e:
            logger.error(f"[RetentionService] Decryption failed for source {source.id}: {e}")
            raise ValueError(f"Content decryption failed: {e}")

    async def log_content_access(
        self,
        source_id: int,
        user_id: int,
        tenant_id: int,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> None:
        """
        Log access to raw content for audit trail

        Args:
            source_id: Context source ID
            user_id: User accessing the content
            tenant_id: Tenant ID
            reason: Reason for access
            ip_address: User's IP address
            user_agent: User's user agent string
        """
        access_log = ContentAccessLog(
            tenant_id=tenant_id,
            context_source_id=source_id,
            user_id=user_id,
            access_reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
            accessed_at=datetime.utcnow()
        )

        self.db.add(access_log)
        await self.db.commit()

        logger.info(f"[RetentionService] Logged content access: source={source_id}, user={user_id}, reason={reason}")

    async def process_scheduled_deletions(self, batch_size: int = 100) -> int:
        """
        Process sources scheduled for deletion

        Args:
            batch_size: Maximum number of sources to process

        Returns:
            Number of sources processed
        """
        # Find sources scheduled for deletion that haven't been deleted yet
        query = select(ContextSource).where(
            and_(
                ContextSource.deletion_scheduled_for <= datetime.utcnow(),
                ContextSource.content_deleted_at.is_(None),
                ContextSource.content.isnot(None)
            )
        ).limit(batch_size)

        result = await self.db.execute(query)
        sources = result.scalars().all()

        count = 0
        for source in sources:
            try:
                await self._delete_content(source)
                count += 1
            except Exception as e:
                logger.error(f"[RetentionService] Failed to delete source {source.id}: {e}")

        if count > 0:
            logger.info(f"[RetentionService] Processed {count} scheduled deletions")

        return count

    async def get_retention_stats(self, tenant_id: int) -> dict:
        """
        Get retention statistics for a tenant

        Args:
            tenant_id: Tenant ID

        Returns:
            Dictionary with retention statistics
        """
        # Total sources
        total_query = select(ContextSource).where(ContextSource.tenant_id == tenant_id)
        total_result = await self.db.execute(total_query)
        total_sources = len(total_result.scalars().all())

        # Deleted sources
        deleted_query = select(ContextSource).where(
            and_(
                ContextSource.tenant_id == tenant_id,
                ContextSource.content_deleted_at.isnot(None)
            )
        )
        deleted_result = await self.db.execute(deleted_query)
        deleted_count = len(deleted_result.scalars().all())

        # Encrypted sources
        encrypted_query = select(ContextSource).where(
            and_(
                ContextSource.tenant_id == tenant_id,
                ContextSource.is_encrypted == True
            )
        )
        encrypted_result = await self.db.execute(encrypted_query)
        encrypted_count = len(encrypted_result.scalars().all())

        # Scheduled for deletion
        scheduled_query = select(ContextSource).where(
            and_(
                ContextSource.tenant_id == tenant_id,
                ContextSource.deletion_scheduled_for.isnot(None),
                ContextSource.content_deleted_at.is_(None)
            )
        )
        scheduled_result = await self.db.execute(scheduled_query)
        scheduled_count = len(scheduled_result.scalars().all())

        return {
            'total_sources': total_sources,
            'content_deleted': deleted_count,
            'encrypted': encrypted_count,
            'scheduled_for_deletion': scheduled_count,
            'active_content': total_sources - deleted_count
        }
