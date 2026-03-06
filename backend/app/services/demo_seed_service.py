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
from app.models.knowledge_base import KnowledgeSource, Capability


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
            summary=theme_data["description"],  # Set summary field for ThemeSummary schema
            feedback_count=theme_data["feedback_count"],
            account_count=theme_data["account_count"],
            total_arr=theme_data["total_arr"],
            urgency_score=theme_data["urgency_score"],
            impact_score=theme_data["impact_score"],
        )
        db.add(theme)
        themes.append(theme)

    await db.flush()  # Get theme IDs
    await db.commit()  # Commit themes before linking

    # 4. Create Personas (3 personas with proper counts and metrics)
    personas_data = [
        {
            "name": "Product Manager Paula",
            "segment": "Product Management",
            "persona_summary": "Senior Product Manager with 5+ years experience leading cross-functional teams to deliver customer-focused products",
            "status": "advisor",
            "confidence_score": 0.85,  # 85% confidence
            "extra_data": {
                "revenue_contribution": 150000,  # $150K annual revenue
                "usage_frequency": "Daily",
            },
        },
        {
            "name": "Developer Dave",
            "segment": "Engineering",
            "persona_summary": "Senior Full-Stack Developer specializing in performance optimization and scalable architecture",
            "status": "advisor",
            "confidence_score": 0.78,  # 78% confidence
            "extra_data": {
                "revenue_contribution": 120000,  # $120K annual revenue
                "usage_frequency": "Weekly",
            },
        },
        {
            "name": "Designer Diana",
            "segment": "Design",
            "persona_summary": "Lead UX/UI Designer with expertise in user research and interaction design",
            "status": "advisor",
            "confidence_score": 0.72,  # 72% confidence
            "extra_data": {
                "revenue_contribution": 90000,  # $90K annual revenue
                "usage_frequency": "Weekly",
            },
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
            confidence_score=persona_data["confidence_score"],
            extra_data=persona_data["extra_data"],
        )
        db.add(persona)

    # 5. Create Initiatives (4 initiatives with strategic impact)
    initiatives_data = [
        {
            "title": "Implement Progressive Web App (PWA)",
            "description": "Convert mobile app to PWA for better offline support and performance",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.LARGE,
            "theme_index": 1,  # Mobile Experience
            "expected_retention_impact": 0.15,  # 15% retention lift -> RETENTION category
            "expected_arr_impact": 25000.0,
            "priority_score": 85.0,
        },
        {
            "title": "Optimize Database Queries",
            "description": "Improve query performance and reduce dashboard load times",
            "status": InitiativeStatus.IN_PROGRESS,
            "effort": InitiativeEffort.MEDIUM,
            "theme_index": 0,  # Performance Optimization
            "expected_retention_impact": 0.10,  # 10% retention lift -> RETENTION category
            "expected_arr_impact": 0.0,
            "priority_score": 75.0,
        },
        {
            "title": "Build Slack Integration",
            "description": "Enable team notifications and updates via Slack",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.MEDIUM,
            "theme_index": 2,  # Integrations
            "expected_retention_impact": 0.0,
            "expected_arr_impact": 75000.0,  # $75k ARR impact -> GROWTH category
            "priority_score": 65.0,
        },
        {
            "title": "Add Dark Mode Theme",
            "description": "Implement dark mode UI theme for better accessibility",
            "status": InitiativeStatus.PLANNED,
            "effort": InitiativeEffort.SMALL,
            "theme_index": None,  # No theme link
            "expected_retention_impact": 0.0,
            "expected_arr_impact": 0.0,  # No direct impact -> INFRASTRUCTURE category
            "priority_score": 45.0,
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
            expected_retention_impact=init_data["expected_retention_impact"],
            expected_arr_impact=init_data["expected_arr_impact"],
            priority_score=init_data["priority_score"],
        )
        db.add(initiative)
        initiatives.append(initiative)

    await db.flush()  # Get initiative IDs

    # Link themes to initiatives
    for i, init_data in enumerate(initiatives_data):
        if init_data["theme_index"] is not None:
            theme_idx = init_data["theme_index"]
            initiatives[i].themes.append(themes[theme_idx])

    await db.flush()  # Persist theme-initiative relationships
    await db.commit()  # Commit to ensure relationships are saved

    # 6. Create Projects (4 projects with priority scores for matrix)
    projects_data = [
        {
            "title": "PWA Service Worker Implementation",
            "description": "Implement service workers for offline caching and background sync",
            "initiative_index": 0,
            "effort": ProjectEffort.LARGE,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": True,
            "priority_score": 80.0,  # High priority (Y-axis on matrix)
        },
        {
            "title": "Query Performance Audit",
            "description": "Analyze and optimize slow database queries",
            "initiative_index": 1,
            "effort": ProjectEffort.MEDIUM,
            "status": ProjectStatus.IN_PROGRESS,
            "is_boulder": False,
            "priority_score": 90.0,  # Highest priority
        },
        {
            "title": "Slack OAuth Setup",
            "description": "Configure OAuth authentication for Slack workspace integration",
            "initiative_index": 2,
            "effort": ProjectEffort.MEDIUM,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": False,
            "priority_score": 60.0,  # Medium priority
        },
        {
            "title": "Dark Mode UI Design",
            "description": "Design dark color scheme for all UI components",
            "initiative_index": 3,
            "effort": ProjectEffort.SMALL,
            "status": ProjectStatus.BACKLOG,
            "is_boulder": False,
            "priority_score": 40.0,  # Lower priority
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
            priority_score=proj_data["priority_score"],
        )
        db.add(project)

    # 7. Create Knowledge Sources (2 sources)
    sources_data = [
        {
            "name": "Product Documentation",
            "type": "url",
            "description": "Official product documentation and user guides",
            "url": "https://docs.example.com",
            "status": "completed",
            "capabilities_extracted": 3,
        },
        {
            "name": "API Reference",
            "type": "url",
            "description": "REST API documentation and endpoints",
            "url": "https://api.example.com/docs",
            "status": "completed",
            "capabilities_extracted": 2,
        },
    ]

    sources = []
    for source_data in sources_data:
        source = KnowledgeSource(
            tenant_id=tenant_id,
            product_id=product_id,
            name=source_data["name"],
            type=source_data["type"],
            description=source_data["description"],
            url=source_data["url"],
            status=source_data["status"],
            capabilities_extracted=source_data["capabilities_extracted"],
        )
        db.add(source)
        sources.append(source)

    await db.flush()  # Get source IDs

    # 8. Create Capabilities (5 capabilities linked to sources)
    capabilities_data = [
        {
            "source_index": 0,  # Product Documentation
            "name": "User Authentication",
            "description": "OAuth 2.0 and JWT-based user authentication system with support for SSO",
            "category": "feature",
        },
        {
            "source_index": 0,  # Product Documentation
            "name": "Real-time Notifications",
            "description": "WebSocket-based notification system for instant updates",
            "category": "feature",
        },
        {
            "source_index": 0,  # Product Documentation
            "name": "Data Export Engine",
            "description": "Export data to CSV, Excel, PDF formats with customizable templates",
            "category": "feature",
        },
        {
            "source_index": 1,  # API Reference
            "name": "REST API v2",
            "description": "RESTful API endpoints for CRUD operations on all resources",
            "category": "api",
            "endpoints": ["/api/v2/users", "/api/v2/projects", "/api/v2/reports"],
        },
        {
            "source_index": 1,  # API Reference
            "name": "Webhook Events",
            "description": "Configurable webhooks for real-time event notifications",
            "category": "api",
            "endpoints": ["/api/v2/webhooks"],
        },
    ]

    for cap_data in capabilities_data:
        capability = Capability(
            tenant_id=tenant_id,
            product_id=product_id,
            source_id=sources[cap_data["source_index"]].id,
            name=cap_data["name"],
            description=cap_data["description"],
            category=cap_data["category"],
            endpoints=cap_data.get("endpoints"),
        )
        db.add(capability)

    # Commit all changes
    await db.commit()
    await db.refresh(demo_product)

    return demo_product
