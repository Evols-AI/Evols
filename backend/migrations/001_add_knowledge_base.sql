-- Migration: Add Knowledge Base Tables
-- Created: 2025-03-01
-- Description: Creates tables for knowledge sources and capabilities

-- Create knowledge_sources table
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    url VARCHAR(1000),
    file_path VARCHAR(500),
    mcp_endpoint VARCHAR(500),
    github_repo VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    capabilities_extracted INTEGER DEFAULT 0,
    extra_data JSONB,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for knowledge_sources
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_tenant_id ON knowledge_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(type);

-- Create capabilities table
CREATE TABLE IF NOT EXISTS capabilities (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    endpoints JSONB,
    dependencies JSONB,
    dependents JSONB,
    source_url VARCHAR(1000),
    source_section VARCHAR(500),
    extra_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for capabilities
CREATE INDEX IF NOT EXISTS idx_capabilities_tenant_id ON capabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_source_id ON capabilities(source_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_name ON capabilities(name);
CREATE INDEX IF NOT EXISTS idx_capabilities_category ON capabilities(category);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_sources_updated_at BEFORE UPDATE ON knowledge_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capabilities_updated_at BEFORE UPDATE ON capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
