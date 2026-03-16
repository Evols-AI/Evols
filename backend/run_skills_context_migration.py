#!/usr/bin/env python3
"""
Run skills context migration
Updates all skills to use the new context system tools
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings


def main():
    """Execute the skills context migration SQL script"""

    print("=" * 80)
    print("SKILLS CONTEXT MIGRATION")
    print("=" * 80)
    print("\nThis will update all skills to use the new context system tools.")
    print("The script will:")
    print("  1. Add context tools to 7 key skills with detailed workflows")
    print("  2. Add basic context tools to all remaining skills")
    print("  3. Verify the updates")
    print()

    # Get database URL and ensure it uses psycopg3 (not psycopg2)
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

    # Create synchronous engine for running SQL script
    engine = create_engine(db_url, echo=False)

    # Read SQL script
    sql_file = Path(__file__).parent / "scripts" / "update_skills_with_context_tools.sql"

    if not sql_file.exists():
        print(f"❌ SQL script not found at: {sql_file}")
        return 1

    print(f"📄 Reading SQL script from: {sql_file}")
    with open(sql_file, 'r') as f:
        sql_content = f.read()

    # Split into individual statements (separated by UPDATE commands)
    # We'll execute the entire script as one transaction

    try:
        print("\n🚀 Executing migration...")

        with engine.connect() as conn:
            # Begin transaction
            with conn.begin():
                # Execute the SQL script
                conn.execute(text(sql_content))

            print("✅ Migration completed successfully!")

            # Now run verification query
            print("\n📊 Verification Results:")
            print("-" * 80)

            verification_query = """
                SELECT
                    name,
                    jsonb_array_length(tools::jsonb) as tool_count,
                    CASE
                        WHEN tools::text LIKE '%get_context_sources%' THEN '✓'
                        ELSE '✗'
                    END as has_context_tools,
                    updated_at
                FROM skills
                ORDER BY name;
            """

            result = conn.execute(text(verification_query))
            rows = result.fetchall()

            print(f"{'Skill Name':<40} {'Tools':<10} {'Context':<10} {'Updated'}")
            print("-" * 80)

            skills_with_context = 0
            total_skills = 0

            for row in rows:
                name, tool_count, has_context, updated_at = row
                total_skills += 1
                if has_context == '✓':
                    skills_with_context += 1

                # Format updated_at
                updated_str = updated_at.strftime('%Y-%m-%d %H:%M') if updated_at else 'N/A'
                print(f"{name:<40} {tool_count:<10} {has_context:<10} {updated_str}")

            print("-" * 80)
            print(f"\nSummary: {skills_with_context}/{total_skills} skills now have context tools")

            if skills_with_context == total_skills:
                print("✅ All skills successfully updated!")
            else:
                print(f"⚠️  {total_skills - skills_with_context} skills still need updating")

        print("\n" + "=" * 80)
        print("MIGRATION COMPLETE")
        print("=" * 80)
        print("\nNext steps:")
        print("  1. Test skills in workbench (e.g., @insights_miner)")
        print("  2. Add context sources at /context")
        print("  3. Skills will automatically extract entities from context")
        print("  4. Review MIGRATION_GUIDE.md for full details")
        print()

        return 0

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\nThe transaction was rolled back. No changes were made.")
        print("\nTroubleshooting:")
        print("  1. Check that database is running")
        print("  2. Verify DATABASE_URL in .env")
        print("  3. Ensure skills table exists")
        print("  4. Check backend logs for details")
        return 1


if __name__ == "__main__":
    sys.exit(main())
