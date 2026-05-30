"""
Job dispatch registry
─────────────────────
Maps a JobType to the function that dispatches it to the right execution path —
Celery in production (durable, survives restarts) or asyncio in development.

Both the async "start job" endpoints and the job *retry* endpoint go through
`dispatch_job(...)` so they share identical dispatch logic. To make a job type
retryable, register a dispatcher for it in `_DISPATCHERS` below.

Today only PROJECT_GENERATION has a real worker (`project_worker` /
`project_tasks`); the theme/persona/feedback task modules referenced in the
Celery config are not implemented yet. `is_retryable()` reflects that honestly
so callers can surface a clear "not supported yet" message instead of silently
creating a job that never runs.
"""

import logging
from typing import Any, Callable, Dict, Optional

from app.core.config import settings
from app.models.job import JobType
from app.services.background_task_service import BackgroundTaskService

logger = logging.getLogger(__name__)

# A dispatcher takes (job_uuid, tenant_id, input_params) and enqueues the work.
Dispatcher = Callable[[str, int, Optional[Dict[str, Any]]], None]


def _dispatch_project_generation(
    job_uuid: str, tenant_id: int, input_params: Optional[Dict[str, Any]]
) -> None:
    """Dispatch a PROJECT_GENERATION job (Celery in prod, asyncio in dev)."""
    initiative_ids = (input_params or {}).get("initiative_ids")

    if settings.USE_CELERY:
        # Imported lazily to avoid importing Celery/worker modules at startup.
        from app.workers.project_tasks import generate_projects_task

        generate_projects_task.delay(job_uuid, tenant_id, initiative_ids)
        logger.info(f"[dispatch] PROJECT_GENERATION → Celery: {job_uuid}")
    else:
        from app.workers.project_worker import generate_projects_background

        BackgroundTaskService.run_in_background(
            generate_projects_background(job_uuid, tenant_id, initiative_ids)
        )
        logger.info(f"[dispatch] PROJECT_GENERATION → asyncio (dev): {job_uuid}")


# Registry of job types that can actually be dispatched / retried.
_DISPATCHERS: Dict[JobType, Dispatcher] = {
    JobType.PROJECT_GENERATION: _dispatch_project_generation,
}


def is_retryable(job_type: JobType) -> bool:
    """True if this job type has a registered dispatcher (i.e. can be retried)."""
    return job_type in _DISPATCHERS


def dispatch_job(
    job_type: JobType,
    job_uuid: str,
    tenant_id: int,
    input_params: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Dispatch a job to its worker. Raises ValueError if the job type has no
    registered dispatcher (callers should translate that into a 400).
    """
    dispatcher = _DISPATCHERS.get(job_type)
    if dispatcher is None:
        raise ValueError(f"No dispatcher registered for job type {job_type.value}")
    dispatcher(job_uuid, tenant_id, input_params)
