"""
Quick table creation script - runs synchronously using psycopg3
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/productos")

# Convert async URL to sync for this script
# Support asyncpg, psycopg2, and psycopg3 formats
sync_url = (DATABASE_URL
    .replace("postgresql+asyncpg://", "postgresql://")
    .replace("postgresql+psycopg2://", "postgresql://")
    .replace("postgresql+psycopg://", "postgresql://"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base

# Import all models so metadata is populated
from app.core.database import Base
import app.models  # noqa - registers all models

engine = create_engine(sync_url, echo=True)

# Try to create pgvector extension (needed for embeddings)
with engine.connect() as conn:
    try:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
        print("✅ pgvector extension created/exists")
    except Exception as e:
        print(f"⚠️  pgvector not available (embeddings won't work): {e}")
        conn.rollback()

# Create all tables
Base.metadata.create_all(bind=engine)
print("✅ All database tables created successfully")
