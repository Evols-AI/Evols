-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create initial database schema
-- (Alembic migrations will handle the full schema)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE evols TO postgres;
