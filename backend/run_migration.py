#!/usr/bin/env python3
"""
Run Alembic migrations
"""
from alembic.config import Config
from alembic import command

# Create Alembic configuration
alembic_cfg = Config("alembic.ini")

# Run upgrade to head
command.upgrade(alembic_cfg, "head")

print("✅ Migrations completed successfully!")
