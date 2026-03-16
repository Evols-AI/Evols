#!/usr/bin/env python3
"""
Standalone script to run context system migration
This script directly executes the migration SQL without requiring alembic
"""

import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, '/Users/akshay/Desktop/workspace/evols/backend')

from app.core.config import settings


async def run_migration():
    print("=" * 70)
    print("Running Context System Migration (015)")
    print("=" * 70)

    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        print("\n1️⃣ Creating enum types...")

        # Create enum types
        await conn.execute_raw("""
            DO $$ BEGIN
                CREATE TYPE contextsourcetype AS ENUM (
                    'csv_survey', 'usage_data', 'nps_csat', 'analytics_export',
                    'meeting_transcript', 'email', 'slack_conversation', 'document_pdf',
                    'document_word', 'document_notion', 'web_page',
                    'support_ticket', 'intercom', 'zendesk', 'productboard',
                    'competitor_research', 'market_research',
                    'slack_integration', 'google_meet', 'confluence', 'gmail_api',
                    'github_repo', 'api_docs', 'mcp_server',
                    'manual_upload', 'api'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        await conn.execute_raw("""
            DO $$ BEGIN
                CREATE TYPE contextprocessingstatus AS ENUM (
                    'pending', 'processing', 'completed', 'failed', 'partially_completed'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        await conn.execute_raw("""
            DO $$ BEGIN
                CREATE TYPE entitytype AS ENUM (
                    'persona', 'pain_point', 'use_case', 'feature_request', 'product_capability',
                    'stakeholder', 'competitor', 'technical_requirement', 'business_goal',
                    'metric', 'quote'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)

        print("✅ Enum types created\n")

        print("2️⃣ Creating context_sources table...")

        # Create context_sources table
        await conn.execute_raw("""
            CREATE TABLE IF NOT EXISTS context_sources (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                product_id INTEGER REFERENCES products(id),
                source_type contextsourcetype NOT NULL,
                name VARCHAR(500) NOT NULL,
                description TEXT,
                source_id VARCHAR(255),
                source_url VARCHAR(1000),
                title VARCHAR(500),
                content TEXT,
                raw_content TEXT,
                file_path VARCHAR(500),
                mcp_endpoint VARCHAR(500),
                github_repo VARCHAR(255),
                api_config JSON,
                account_id INTEGER REFERENCES account(id),
                customer_name VARCHAR(255),
                customer_email VARCHAR(255),
                customer_segment VARCHAR(100),
                source_date DATE,
                last_synced_at TIMESTAMP,
                status contextprocessingstatus NOT NULL DEFAULT 'pending',
                error_message TEXT,
                entities_extracted_count INTEGER DEFAULT 0,
                embedding vector(1536),
                sentiment_score FLOAT,
                urgency_score FLOAT,
                impact_score FLOAT,
                theme_id INTEGER REFERENCES theme(id),
                theme_confidence FLOAT,
                tags VARCHAR[],
                extra_data JSON
            );
        """)

        print("✅ context_sources table created\n")

        print("3️⃣ Creating indexes on context_sources...")

        # Create indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_context_sources_tenant ON context_sources(tenant_id)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_product ON context_sources(product_id)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_type ON context_sources(source_type)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_account ON context_sources(account_id)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_segment ON context_sources(customer_segment)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_date ON context_sources(source_date)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_status ON context_sources(status)",
            "CREATE INDEX IF NOT EXISTS idx_context_sources_theme ON context_sources(theme_id)",
        ]

        for idx_sql in indexes:
            await conn.execute_raw(idx_sql)

        print("✅ Indexes created\n")

        print("4️⃣ Creating extracted_entities table...")

        # Create extracted_entities table
        await conn.execute_raw("""
            CREATE TABLE IF NOT EXISTS extracted_entities (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                product_id INTEGER REFERENCES products(id),
                source_id INTEGER NOT NULL REFERENCES context_sources(id),
                entity_type entitytype NOT NULL,
                name VARCHAR(500) NOT NULL,
                description TEXT NOT NULL,
                context_snippet TEXT,
                confidence_score FLOAT,
                category VARCHAR(100),
                subcategory VARCHAR(100),
                related_persona_id INTEGER REFERENCES persona(id),
                related_capability_id INTEGER REFERENCES capabilities(id),
                attributes JSON,
                source_url VARCHAR(1000),
                source_section VARCHAR(500),
                embedding vector(1536),
                extra_data JSON
            );
        """)

        print("✅ extracted_entities table created\n")

        print("5️⃣ Creating indexes on extracted_entities...")

        # Create indexes
        entity_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_tenant ON extracted_entities(tenant_id)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_product ON extracted_entities(product_id)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_source ON extracted_entities(source_id)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON extracted_entities(entity_type)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_name ON extracted_entities(name)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_category ON extracted_entities(category)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_persona ON extracted_entities(related_persona_id)",
            "CREATE INDEX IF NOT EXISTS idx_extracted_entities_capability ON extracted_entities(related_capability_id)",
        ]

        for idx_sql in entity_indexes:
            await conn.execute_raw(idx_sql)

        print("✅ Indexes created\n")

        print("6️⃣ Updating alembic version...")

        # Update alembic_version table
        await conn.execute_raw("""
            INSERT INTO alembic_version (version_num) VALUES ('015')
            ON CONFLICT (version_num) DO NOTHING;
        """)

        print("✅ Alembic version updated\n")

    await engine.dispose()

    print("=" * 70)
    print("✅ Migration completed successfully!")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Run: python scripts/migrate_to_context_system.py")
    print("  2. Start the backend and test the /context page")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_migration())
