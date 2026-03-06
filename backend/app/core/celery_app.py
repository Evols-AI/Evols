"""
Celery Application Configuration
Durable task queue for background jobs
"""

import os
from celery import Celery
from celery.signals import task_prerun, task_postrun, task_failure
from loguru import logger

# Get Redis URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "evols",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "app.workers.theme_tasks",
        "app.workers.project_tasks",
        "app.workers.persona_tasks",
        "app.workers.feedback_tasks",
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task execution
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.workers.theme_tasks.*": {"queue": "theme-tasks"},
        "app.workers.project_tasks.*": {"queue": "project-tasks"},
        "app.workers.persona_tasks.*": {"queue": "persona-tasks"},
        "app.workers.feedback_tasks.*": {"queue": "feedback-tasks"},
    },

    # Result backend
    result_expires=3600,  # 1 hour
    result_backend_transport_options={
        "master_name": "mymaster",
    },

    # Worker configuration
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks (prevent memory leaks)

    # Task execution limits
    task_time_limit=1800,  # 30 minutes hard limit
    task_soft_time_limit=1500,  # 25 minutes soft limit

    # Retry configuration
    task_acks_late=True,  # Acknowledge task after completion (enables retries on crash)
    task_reject_on_worker_lost=True,  # Requeue task if worker dies

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)


# Task lifecycle hooks for logging
@task_prerun.connect
def task_prerun_handler(task_id, task, *args, **kwargs):
    """Log when task starts"""
    logger.info(f"[Celery] Task {task.name} ({task_id}) started")


@task_postrun.connect
def task_postrun_handler(task_id, task, *args, **kwargs):
    """Log when task completes"""
    logger.info(f"[Celery] Task {task.name} ({task_id}) completed")


@task_failure.connect
def task_failure_handler(task_id, exception, *args, **kwargs):
    """Log when task fails"""
    logger.error(f"[Celery] Task {task_id} failed: {exception}")


if __name__ == "__main__":
    celery_app.start()
