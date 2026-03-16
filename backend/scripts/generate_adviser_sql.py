"""
Generate SQL insertion script from Python adviser definitions
This ensures consistency between validation and actual seeding
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from scripts.complete_advisers_suite import COMPLETE_ADVISERS
from scripts.remaining_advisers import REMAINING_ADVISERS

def escape_sql_string(s):
    """Escape single quotes and special characters for SQL"""
    if s is None:
        return ''
    # Replace single quote with two single quotes for SQL escaping
    s = s.replace("'", "''")
    # Replace backslashes
    s = s.replace("\\", "\\\\")
    return s

def generate_upsert_function():
    """Generate the upsert function SQL"""
    return """-- Upsert function for advisers
CREATE OR REPLACE FUNCTION upsert_adviser(
    p_name VARCHAR,
    p_description TEXT,
    p_icon VARCHAR,
    p_tools JSON,
    p_initial_questions JSON,
    p_task_definitions JSON,
    p_instructions TEXT,
    p_output_template TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE advisers
    SET
        description = p_description,
        icon = p_icon,
        tools = p_tools,
        initial_questions = p_initial_questions,
        task_definitions = p_task_definitions,
        instructions = p_instructions,
        output_template = p_output_template,
        updated_at = NOW()
    WHERE name = p_name;

    IF NOT FOUND THEN
        INSERT INTO advisers (name, description, icon, tools, initial_questions, task_definitions, instructions, output_template)
        VALUES (p_name, p_description, p_icon, p_tools, p_initial_questions, p_task_definitions, p_instructions, p_output_template);
    END IF;
END;
$$ LANGUAGE plpgsql;

"""

def generate_adviser_sql(adviser, index):
    """Generate SQL for a single adviser using dollar-quoted strings"""
    name = adviser['name']
    description = adviser['description']
    icon = adviser['icon']
    instructions = adviser['instructions']
    output_template = adviser['output_template']

    # Convert lists/dicts to JSON strings with proper escaping
    tools_json = json.dumps(adviser['tools']).replace("'", "''")
    questions_json = json.dumps(adviser['initial_questions']).replace("'", "''")
    tasks_json = json.dumps(adviser['task_definitions']).replace("'", "''")

    # Use dollar-quoted strings for large text fields to avoid escaping issues
    sql = f"""-- {index}. {name}
SELECT upsert_adviser(
    '{name.replace("'", "''")}',
    $desc${description}$desc$,
    '{icon}',
    '{tools_json}'::json,
    '{questions_json}'::json,
    '{tasks_json}'::json,
    $inst${instructions}$inst$,
    $tmpl${output_template}$tmpl$
);

SELECT 'Seeded: {name}' AS status;

"""
    return sql

def main():
    all_advisers = COMPLETE_ADVISERS + REMAINING_ADVISERS

    output_file = 'scripts/seed_all_advisers_generated.sql'

    with open(output_file, 'w') as f:
        # Header
        f.write("-- Auto-generated SQL script to seed all advisers\n")
        f.write(f"-- Generated from Python definitions\n")
        f.write(f"-- Total advisers: {len(all_advisers)}\n\n")

        # Upsert function
        f.write(generate_upsert_function())

        # Each adviser
        for i, adviser in enumerate(all_advisers, 1):
            f.write(generate_adviser_sql(adviser, i))

        # Footer
        f.write("""
-- Drop the helper function
DROP FUNCTION IF EXISTS upsert_adviser;

-- Final summary
SELECT
    'Seeding complete!' AS status,
    COUNT(*) AS total_advisers
FROM advisers;
""")

    print(f"✅ Generated SQL script: {output_file}")
    print(f"   Total advisers: {len(all_advisers)}")
    print(f"\nTo apply:")
    print(f"   PGPASSWORD=postgres psql -U postgres -d evols -h localhost -p 5432 -f {output_file}")

if __name__ == '__main__':
    main()
