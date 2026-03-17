"""
Endpoint to add to advisers.py

Insert this after list_custom_skills (line 737) and before create_custom_skill (line 739)
"""

# Add this endpoint code:

"""
@router.get("/admin/default/{adviser_id}")
async def get_default_skill_details(
    adviser_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tenant_admin),
):
    \"\"\"
    Get full details of a default adviser
    Allows tenant admins to view before cloning/editing
    \"\"\"
    # Get the default adviser
    result = await db.execute(
        select(Adviser).where(Adviser.id == adviser_id)
    )
    adviser = result.scalar_one_or_none()

    if not adviser:
        raise HTTPException(status_code=404, detail="Default adviser not found")

    return {
        "id": adviser.id,
        "name": adviser.name,
        "description": adviser.description,
        "icon": adviser.icon,
        "tools": adviser.tools,
        "initial_questions": adviser.initial_questions,
        "task_definitions": adviser.task_definitions,
        "instructions": adviser.instructions,
        "output_template": adviser.output_template,
        "is_active": adviser.is_active,
        "created_at": adviser.created_at.isoformat(),
        "updated_at": adviser.updated_at.isoformat()
    }


"""

# COPY THE ABOVE CODE AND INSERT IT INTO advisers.py AT LINE 738
