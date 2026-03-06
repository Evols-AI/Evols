"""
Demo Data Seed Service
Creates sample demo product with realistic data for new tenant onboarding
"""

from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date

from app.models.product import Product
from app.models.feedback import Feedback, FeedbackSource, FeedbackCategory
from app.models.theme import Theme
from app.models.persona import Persona
from app.models.initiative import Initiative, InitiativeStatus, InitiativeEffort
from app.models.project import Project, ProjectStatus, ProjectEffort


async def seed_demo_product(db: AsyncSession, tenant_id: int) -> Product:
    """
    Create a Demo Product with sample data for new tenants.
    Uses the exact data structure that was validated in production.

    Returns:
        Product: The created demo product with ID
    """

    # 1. Create Demo Product
    demo_product = Product(
        tenant_id=tenant_id,
        name="Demo Product",
        description="Demonstration product with sample data for onboarding and education",
        is_demo=True,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(demo_product)
    await db.flush()  # Get the product ID

    product_id = demo_product.id

    # 2. Create Feedback (6 items)
    feedback_items = [
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.MANUAL_UPLOAD,
            category=FeedbackCategory.FEATURE_REQUEST,
            content="The mobile app needs better offline support. Users often lose data when connectivity is poor.",
            feedback_date=date.today(),
        ),
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.ZENDESK,
            category=FeedbackCategory.BUG,
            content="Dashboard loading time is too slow. It takes over 5 seconds to display analytics.",
            feedback_date=date.today(),
        ),
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.INTERCOM,
            category=FeedbackCategory.PRAISE,
            content="Love the new search feature! It is much faster and more accurate than before.",
            feedback_date=date.today(),
        ),
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.MANUAL_UPLOAD,
            category=FeedbackCategory.FEATURE_REQUEST,
            content="Add dark mode support. My eyes hurt when using the app at night.",
            feedback_date=date.today(),
        ),
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.ZENDESK,
            category=FeedbackCategory.BUG,
            content="Export to CSV functionality is broken. Getting error messages when trying to download reports.",
            feedback_date=date.today(),
        ),
        Feedback(
            tenant_id=tenant_id,
            product_id=product_id,
            source=FeedbackSource.MANUAL_UPLOAD,
            category=FeedbackCategory.FEATURE_REQUEST,
            content="Integration with Slack would be amazing for team notifications.",
            feedback_date=date.today(),
        ),
    ]

    for item in feedback_items:
        db.add(item)

    # 3. Create Themes (3 themes with proper metrics)
    themes_data = [
        {
            "title": "Performance Optimization",
            "description": "Improving application speed and responsiveness",
            "feedback_count": 2,
            "account_count": 1,
            "total_arr": 50000.0,
            "urgency_score": 0.8,
            "impact_score": 0.7,
        },
        {
            "title": "Mobile Experience",
            "description": "Enhancing mobile app functionality and usability",
            "feedback_count": 2,
            "account_count": 1,
            "total_arr": 50000.0,
            "urgency_score": 0.6,
            "impact_score": 0.9,
        },
        {
            "title": "Integrations",
            "description": "Adding third-party integrations and API connectivity",
            "feedback_count": 2,
            "account_count": 1,
            "total_arr": 50000.0,
            "urgency_score": 0.5,
            "impact_score": 0.6,
        },
    ]

    themes = []
    for theme_data in themes_data:
        theme = Theme(
            tenant_id=tenant_id,
            product_id=product_id,
            title=theme_data["title"],
            description=theme_data["description"],
            feedback_count=theme_data["feedback_count"],
            account_count=theme_data["account_count"],
            total_arr=theme_data["total_arr"],
            urgency_score=theme_data["urgency_score"],
            impact_score=theme_data["impact_score"],
        )
        db.add(theme)
        themes.append(theme)

    await db.flush()  # Get theme IDs

    # 4. Create Personas (3 personas with proper counts)
    personas_data = [
        {
            "name": "Product Manager Paula",
            "segment": "Product Management",
            "persona_summary": "Senior Product Manager with 5+ years experience leading cross-functional teams to deliver customer-focused products",
            "status": "advisor",
        },
        {
            "name": "Developer Dave",
            "segment": "Engineering",
            "persona_summary": "Senior Full-Stack Developer specializing in performance optimization and scalable architecture",
            "status": "advisor",
        },
        {
            "name": "Designer Diana",
            "segment": "Design",
            "persona_summary": "Lead UX/UI Designer with expertise in user research and interaction design",
            "status": "advisor",
        },
    ]

    for persona_data in personas_data:
        persona = Persona(
            tenant_id=tenant_id,
            product_id=product_id,
            name=persona_data["name"],
            segment=persona_data["segment"],
            persona_summary=persona_data["persona_summary"],
            status=persona_data["status"],
            based_on_feedback_count=2,
            based_on_interview_count=0,
            based_on_deal_count=0,
        )
        db.add(persona)

    # 5. Create Initiatives (4 initiatives)
    initiatives_data = [
        {
            "title": "Implement Progressive Web App (PWA)",
            "description": "Convert mobile app to PWA for better offline support and performance",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.LARGE,
            "theme_index": 1,  # Mobile Experience
        },
        {
            "title": "Optimize Database Queries",
            "description": "Improve query performance and reduce dashboard load times",
            "status": InitiativeStatus.IN_PROGRESS,
            "effort": InitiativeEffort.MEDIUM,
            "theme_index": 0,  # Performance Optimization
        },
        {
            "title": "Build Slack Integration",
            "description": "Enable team notifications and updates via Slack",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.MEDIUM,
            "theme_index": 2,  # Integrations
        },
        {
            "title": "Add Dark Mode Theme",
            "description": "Implement dark mode UI theme for better accessibility",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.SMALL,
            "theme_index": None,  # No theme link
        },
    ]

    initiatives = []
    for init_data in initiatives_data:
        initiative = Initiative(
            tenant_id=tenant_id,
            product_id=product_id,
            title=init_data["title"],
            description=init_data["description"],
            status=init_data["status"],
            effort=init_data["effort"],
        )
        db.add(initiative)
        initiatives.append(initiative)

    await db.flush()  # Get initiative IDs

    # Link themes to initiatives
    for i, init_data in enumerate(initiatives_data):
        if init_data["theme_index"] is not None:
            theme_idx = init_data["theme_index"]
            initiatives[i].themes.append(themes[theme_idx])

    # 6. Create Projects (4 projects)
    projects_data = [
        {
            "title": "PWA Service Worker Implementation",
            "description": "Implement service workers for offline caching and background sync",
            "initiative_index": 0,
            "effort": ProjectEffort.LARGE,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": True,
        },
        {
            "title": "Query Performance Audit",
            "description": "Analyze and optimize slow database queries",
            "initiative_index": 1,
            "effort": ProjectEffort.MEDIUM,
            "status": ProjectStatus.IN_PROGRESS,
            "is_boulder": False,
        },
        {
            "title": "Slack OAuth Setup",
            "description": "Configure OAuth authentication for Slack workspace integration",
            "initiative_index": 2,
            "effort": ProjectEffort.MEDIUM,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": False,
        },
        {
            "title": "Dark Mode UI Design",
            "description": "Design dark color scheme for all UI components",
            "initiative_index": 3,
            "effort": ProjectEffort.SMALL,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": False,
        },
    ]

    for proj_data in projects_data:
        project = Project(
            tenant_id=tenant_id,
            product_id=product_id,
            initiative_id=initiatives[proj_data["initiative_index"]].id,
            title=proj_data["title"],
            description=proj_data["description"],
            effort=proj_data["effort"],
            status=proj_data["status"],
            is_boulder=proj_data["is_boulder"],
        )
        db.add(project)

    # Commit all changes
    await db.commit()
    await db.refresh(demo_product)

    return demo_product
