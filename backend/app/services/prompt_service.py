"""
Prompt Service
Centralized management of versioned prompts
"""

import re
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from loguru import logger

from app.models.prompt import Prompt, PromptExecution


class PromptService:
    """
    Centralized prompt management with versioning, A/B testing, and analytics
    """

    def __init__(self, db: AsyncSession, tenant_id: Optional[int] = None):
        self.db = db
        self.tenant_id = tenant_id

    async def get_prompt(
        self,
        key: str,
        version: Optional[str] = None,
        variant_name: Optional[str] = None,
    ) -> Optional[Prompt]:
        """
        Get a prompt by key, optionally specifying version or variant

        Args:
            key: Prompt key (e.g., "project_generation_system")
            version: Specific version to fetch (if None, gets default/latest)
            variant_name: A/B test variant name

        Returns:
            Prompt object or None if not found
        """
        query = select(Prompt).where(
            Prompt.key == key,
            Prompt.is_active == True,
        )

        # Tenant-specific or global prompts
        if self.tenant_id:
            query = query.where(
                or_(
                    Prompt.tenant_id == self.tenant_id,
                    Prompt.tenant_id.is_(None)
                )
            )
        else:
            query = query.where(Prompt.tenant_id.is_(None))

        # Version filtering
        if version:
            query = query.where(Prompt.version == version)
        else:
            # Get default version
            query = query.where(Prompt.is_default == True)

        # Variant filtering (for A/B testing)
        if variant_name:
            query = query.where(Prompt.variant_name == variant_name)

        # Prefer tenant-specific prompts over global
        query = query.order_by(Prompt.tenant_id.desc().nullslast(), Prompt.created_at.desc())

        result = await self.db.execute(query)
        prompt = result.scalar_one_or_none()

        if not prompt:
            logger.warning(
                f"[PromptService] Prompt not found: key='{key}', version={version}, "
                f"variant={variant_name}, tenant_id={self.tenant_id}"
            )

        return prompt

    async def render_prompt(
        self,
        key: str,
        variables: Dict[str, Any],
        version: Optional[str] = None,
        variant_name: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Render a prompt template with variables

        Args:
            key: Prompt key
            variables: Dictionary of variables to substitute
            version: Specific version (optional)
            variant_name: A/B test variant (optional)

        Returns:
            Dict with "system_prompt" and "user_prompt" keys

        Raises:
            ValueError if prompt not found or variables missing
        """
        prompt = await self.get_prompt(key, version, variant_name)

        if not prompt:
            raise ValueError(f"Prompt not found: {key}")

        # Render system prompt
        system_prompt = self._render_template(prompt.system_prompt, variables) if prompt.system_prompt else ""

        # Render user prompt
        user_prompt = self._render_template(prompt.user_template, variables) if prompt.user_template else ""

        logger.debug(f"[PromptService] Rendered prompt '{key}' (v{prompt.version})")

        return {
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
            "prompt_id": prompt.id,
            "version": prompt.version,
        }

    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """
        Render a template string with variables

        Supports {variable_name} syntax
        """
        if not template:
            return ""

        # Find all variables in template
        pattern = r"\{(\w+)\}"
        required_vars = set(re.findall(pattern, template))

        # Check for missing variables
        missing = required_vars - set(variables.keys())
        if missing:
            logger.warning(f"[PromptService] Missing variables: {missing}")

        # Replace variables
        rendered = template
        for var_name, var_value in variables.items():
            placeholder = f"{{{var_name}}}"
            rendered = rendered.replace(placeholder, str(var_value))

        return rendered

    async def track_execution(
        self,
        prompt_id: int,
        prompt_key: str,
        prompt_version: str,
        input_variables: Dict[str, Any],
        rendered_prompt: str,
        response_content: Optional[str] = None,
        response_tokens: Optional[int] = None,
        response_time_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        model_name: Optional[str] = None,
        provider: Optional[str] = None,
        user_id: Optional[int] = None,
    ):
        """
        Track a prompt execution for analytics

        This enables:
        - Performance monitoring
        - A/B test analysis
        - Prompt optimization
        - Debugging
        """
        execution = PromptExecution(
            tenant_id=self.tenant_id,
            prompt_id=prompt_id,
            prompt_key=prompt_key,
            prompt_version=prompt_version,
            input_variables=input_variables,
            rendered_prompt=rendered_prompt,
            response_content=response_content,
            response_tokens=response_tokens,
            response_time_ms=response_time_ms,
            success=success,
            error_message=error_message,
            model_name=model_name,
            provider=provider,
            user_id=user_id,
        )

        self.db.add(execution)

        # Update prompt usage stats
        prompt = await self.db.get(Prompt, prompt_id)
        if prompt:
            prompt.usage_count = (prompt.usage_count or 0) + 1

            # Update avg response time (running average)
            if response_time_ms and success:
                if prompt.avg_response_time:
                    # Running average: new_avg = (old_avg * (n-1) + new_value) / n
                    prompt.avg_response_time = int(
                        (prompt.avg_response_time * (prompt.usage_count - 1) + response_time_ms)
                        / prompt.usage_count
                    )
                else:
                    prompt.avg_response_time = response_time_ms

        await self.db.commit()

        logger.debug(
            f"[PromptService] Tracked execution: {prompt_key} v{prompt_version} "
            f"({'success' if success else 'failure'})"
        )

    async def create_prompt(
        self,
        key: str,
        system_prompt: Optional[str] = None,
        user_template: Optional[str] = None,
        version: str = "1.0",
        description: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        variables: Optional[List[str]] = None,
        is_default: bool = True,
        variant_name: Optional[str] = None,
        experiment_id: Optional[str] = None,
        created_by: Optional[int] = None,
    ) -> Prompt:
        """
        Create a new prompt version

        Args:
            key: Unique prompt key
            system_prompt: System message
            user_template: User message template
            version: Semantic version
            description: What this prompt does
            category: Prompt category
            tags: List of tags
            variables: List of variable names in template
            is_default: Make this the default version
            variant_name: A/B test variant name
            experiment_id: A/B test experiment ID
            created_by: User ID who created this

        Returns:
            Created Prompt object
        """
        # If setting as default, unset other defaults for this key
        if is_default:
            query = select(Prompt).where(
                Prompt.key == key,
                Prompt.is_default == True,
            )
            if self.tenant_id:
                query = query.where(Prompt.tenant_id == self.tenant_id)
            else:
                query = query.where(Prompt.tenant_id.is_(None))

            result = await self.db.execute(query)
            existing_defaults = result.scalars().all()

            for existing in existing_defaults:
                existing.is_default = False

        # Create new prompt
        prompt = Prompt(
            tenant_id=self.tenant_id,
            key=key,
            version=version,
            system_prompt=system_prompt,
            user_template=user_template,
            description=description,
            category=category,
            tags=tags,
            variables=variables,
            is_active=True,
            is_default=is_default,
            variant_name=variant_name,
            experiment_id=experiment_id,
            created_by=created_by,
        )

        self.db.add(prompt)
        await self.db.commit()
        await self.db.refresh(prompt)

        logger.info(
            f"[PromptService] Created prompt: key='{key}', version='{version}', "
            f"default={is_default}, tenant_id={self.tenant_id}"
        )

        return prompt

    async def list_prompts(
        self,
        category: Optional[str] = None,
        active_only: bool = True,
    ) -> List[Prompt]:
        """
        List all prompts, optionally filtered by category
        """
        query = select(Prompt)

        if self.tenant_id:
            query = query.where(
                or_(
                    Prompt.tenant_id == self.tenant_id,
                    Prompt.tenant_id.is_(None)
                )
            )
        else:
            query = query.where(Prompt.tenant_id.is_(None))

        if active_only:
            query = query.where(Prompt.is_active == True)

        if category:
            query = query.where(Prompt.category == category)

        query = query.order_by(Prompt.key, Prompt.version.desc())

        result = await self.db.execute(query)
        return result.scalars().all()


# Helper function for backwards compatibility
async def get_prompt_text(
    db: AsyncSession,
    key: str,
    variables: Optional[Dict[str, Any]] = None,
    tenant_id: Optional[int] = None,
    version: Optional[str] = None,
) -> str:
    """
    Quick helper to get rendered prompt text

    For backwards compatibility with existing code that uses hardcoded prompts
    """
    service = PromptService(db, tenant_id)

    if variables:
        rendered = await service.render_prompt(key, variables, version)
        return rendered["system_prompt"] or rendered["user_prompt"]
    else:
        prompt = await service.get_prompt(key, version)
        if not prompt:
            raise ValueError(f"Prompt not found: {key}")
        return prompt.system_prompt or prompt.user_template or ""
