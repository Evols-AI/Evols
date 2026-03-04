"""
Script to update persona generation to use demographics/technographics
Run this to patch the personas.py file
"""

# Read the current file
with open('app/api/v1/endpoints/personas.py', 'r') as f:
    content = f.read()

# Find and replace the auto_generate_personas function
old_function_start = 'async def auto_generate_personas(tenant_id: int, db: AsyncSession):'
old_function_end = '    await db.commit()\n\n\n@router.post("/generate")'

new_function = '''async def auto_generate_personas(tenant_id: int, db: AsyncSession):
    """
    Automatically generate/update personas from feedback data
    Creates personas based on demographics and technographics (segment + industry/role)
    """
    from sqlalchemy import func
    from collections import Counter

    # First check if there's any feedback at all
    total_feedback = await db.execute(
        select(func.count(Feedback.id))
        .where(Feedback.tenant_id == tenant_id)
    )
    total_count = total_feedback.scalar()

    if total_count == 0:
        print(f"[Persona Generation] No feedback found for tenant {tenant_id}")
        return

    # Check how many have segments
    segmented_feedback = await db.execute(
        select(func.count(Feedback.id))
        .where(Feedback.tenant_id == tenant_id)
        .where(Feedback.customer_segment.isnot(None))
        .where(Feedback.customer_segment != '')
    )
    segmented_count = segmented_feedback.scalar()

    print(f"[Persona Generation] Tenant {tenant_id}: {segmented_count}/{total_count} feedback items have segments")

    if segmented_count == 0:
        print(f"[Persona Generation] Warning: No feedback with customer_segment field populated. Personas require segment data.")
        return

    # Get all feedback with demographics
    result = await db.execute(
        select(Feedback)
        .where(Feedback.tenant_id == tenant_id)
        .where(Feedback.customer_segment.isnot(None))
        .where(Feedback.customer_segment != '')
    )
    all_feedback = result.scalars().all()

    # Group feedback by segment and top industry/job_role
    persona_groups = {}

    for feedback in all_feedback:
        segment = feedback.customer_segment
        extra_data = feedback.extra_data or {}

        industry = extra_data.get('industry', '').strip()
        job_role = extra_data.get('job_role', '').strip()

        # Create persona key: segment_industry or segment_jobrole
        # Prioritize industry, fall back to job role category
        if industry:
            key = f"{segment}_{industry}"
            persona_type = industry
        elif job_role:
            # Categorize job roles
            role_category = _categorize_job_role(job_role)
            key = f"{segment}_{role_category}"
            persona_type = role_category
        else:
            # Fall back to segment only
            key = segment
            persona_type = None

        if key not in persona_groups:
            persona_groups[key] = {
                'segment': segment,
                'type': persona_type,
                'feedback': [],
                'customers': set()
            }

        persona_groups[key]['feedback'].append(feedback)
        if feedback.customer_name:
            persona_groups[key]['customers'].add(feedback.customer_name)

    print(f"[Persona Generation] Found {len(persona_groups)} unique persona groups")

    # Create or update personas
    for key, group in persona_groups.items():
        segment = group['segment']
        persona_type = group['type']
        feedback_count = len(group['feedback'])
        customer_count = len(group['customers'])

        # Skip if too few feedbacks (noise)
        if feedback_count < 3:
            continue

        # Generate persona name and description
        if persona_type:
            persona_name = f"{segment} {persona_type}"
            description = f"{persona_type} professionals at {segment} companies"
        else:
            persona_name = f"{segment} Customer"
            description = f"Customers at {segment} companies"

        # Aggregate demographics from feedback
        industries = Counter()
        job_roles = Counter()
        regions = Counter()
        plans = Counter()

        for fb in group['feedback']:
            extra = fb.extra_data or {}
            if extra.get('industry'):
                industries[extra['industry']] += 1
            if extra.get('job_role'):
                job_roles[extra['job_role']] += 1
            if extra.get('region'):
                regions[extra['region']] += 1
            if extra.get('subscription_plan'):
                plans[extra['subscription_plan']] += 1

        # Create rich persona summary
        summary_parts = [f"Based on {feedback_count} feedback items from {customer_count} customers."]
        if industries:
            top_industries = [ind for ind, _ in industries.most_common(3)]
            summary_parts.append(f"Primary industries: {', '.join(top_industries)}.")
        if job_roles:
            top_roles = [role for role, _ in job_roles.most_common(3)]
            summary_parts.append(f"Common roles: {', '.join(top_roles)}.")
        if regions:
            top_regions = [reg for reg, _ in regions.most_common(2)]
            summary_parts.append(f"Regions: {', '.join(top_regions)}.")

        persona_summary = " ".join(summary_parts)

        # Check if persona already exists
        existing_persona = await db.execute(
            select(Persona).where(
                and_(
                    Persona.tenant_id == tenant_id,
                    Persona.name == persona_name
                )
            )
        )
        persona = existing_persona.scalar_one_or_none()

        if persona:
            # Update existing persona
            persona.description = description
            persona.persona_summary = persona_summary
            persona.based_on_feedback_count = feedback_count
            persona.confidence_score = min(0.5 + (feedback_count / 50), 0.95)
        else:
            # Create new persona
            persona = Persona(
                tenant_id=tenant_id,
                name=persona_name,
                segment=segment,
                industry=industries.most_common(1)[0][0] if industries else None,
                description=description,
                persona_summary=persona_summary,
                based_on_feedback_count=feedback_count,
                confidence_score=min(0.5 + (feedback_count / 50), 0.95),
                key_pain_points=[],
                feature_priorities=[],
            )
            db.add(persona)

    await db.commit()


def _categorize_job_role(job_role: str) -> str:
    """Categorize job roles into broader groups"""
    role_lower = job_role.lower()

    if any(x in role_lower for x in ['cto', 'cio', 'vp', 'director', 'head', 'chief']):
        return 'Leadership'
    elif any(x in role_lower for x in ['engineer', 'developer', 'architect', 'technical']):
        return 'Engineering'
    elif any(x in role_lower for x in ['manager', 'lead', 'coordinator']):
        return 'Management'
    elif any(x in role_lower for x in ['operations', 'ops', 'admin']):
        return 'Operations'
    elif any(x in role_lower for x in ['founder', 'owner', 'ceo']):
        return 'Executive'
    else:
        return 'Professional'


@router.post("/generate")'''

# Find the start and end positions
start_idx = content.find(old_function_start)
end_idx = content.find(old_function_end)

if start_idx == -1 or end_idx == -1:
    print("❌ Could not find function to replace")
    exit(1)

# Replace the function
new_content = content[:start_idx] + new_function + content[end_idx+len(old_function_end)-len('@router.post("/generate")'):]

# Write the updated file
with open('app/api/v1/endpoints/personas.py', 'w') as f:
    f.write(new_content)

print("✅ Updated personas.py with dynamic persona generation")
print("   Personas will now be generated based on:")
print("   - Segment (SMB/Mid-Market/Enterprise)")
print("   - Industry")
print("   - Job Role Category")
