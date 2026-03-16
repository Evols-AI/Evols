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
from app.models.context import ContextSource, ContextSourceType, ContextProcessingStatus, ExtractedEntity, EntityType


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

    await db.flush()  # Get theme IDs but keep them in session

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

    # Link themes to initiatives - reload with eager loading to avoid lazy-load issues in async
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select as sql_select

    # Reload initiatives with themes relationship eagerly loaded
    initiative_ids = [init.id for init in initiatives]
    result = await db.execute(
        sql_select(Initiative)
        .where(Initiative.id.in_(initiative_ids))
        .options(selectinload(Initiative.themes))
    )
    reloaded_initiatives = result.scalars().all()

    # Create a mapping of initiative ID to initiative object
    initiative_map = {init.id: init for init in reloaded_initiatives}

    # Link themes to initiatives
    for i, init_data in enumerate(initiatives_data):
        if init_data["theme_index"] is not None:
            theme_idx = init_data["theme_index"]
            initiative_map[initiatives[i].id].themes.append(themes[theme_idx])

    await db.flush()  # Flush to persist theme-initiative relationships

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

    await db.flush()  # Flush to persist projects

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

    # 9. Create Context Sources (3 sources showcasing the unified context system)
    context_sources_data = [
        {
            "source_type": ContextSourceType.MEETING_TRANSCRIPT,
            "name": "Customer Discovery Call - Enterprise Prospect",
            "content": "Discussed with Sarah from TechCorp (500+ employees). Key insights: They need faster dashboard performance (current load time: 8 seconds). Their team struggles with mobile offline access during client visits. They mentioned switching to competitors if we don't improve mobile experience. Revenue potential: $85K ARR. Quote: 'If you had better mobile support and faster dashboards, we'd upgrade immediately.'",
            "status": ContextProcessingStatus.COMPLETED,
            "entities_extracted_count": 4,
            "metadata": {
                "participant": "Sarah Johnson, VP Engineering",
                "company": "TechCorp",
                "duration_minutes": 45,
                "call_type": "discovery"
            }
        },
        {
            "source_type": ContextSourceType.CSV_SURVEY,
            "name": "Q1 2026 User Satisfaction Survey",
            "content": "Survey of 250 users. Key findings: 68% want dark mode, 55% report slow dashboard performance, 42% need better Slack integration. Power users specifically mentioned: 'Dashboard takes too long with large datasets.' Most requested features: dark mode (68%), performance improvements (55%), integrations (42%).",
            "status": ContextProcessingStatus.COMPLETED,
            "entities_extracted_count": 5,
            "metadata": {
                "response_count": 250,
                "completion_rate": 0.72,
                "survey_period": "Q1 2026"
            }
        },
        {
            "source_type": ContextSourceType.DOCUMENT_PDF,
            "name": "Win/Loss Analysis - Lost Deal to Competitor",
            "content": "Lost $120K deal to Competitor X. Primary reasons: (1) Better mobile offline support, (2) Faster dashboard loading, (3) Native mobile apps. Customer quote from final call: 'We love your product's feature set, but our field team needs reliable mobile access without internet. Competitor X has this solved with native apps.' Takeaway: Mobile experience is critical for enterprise deals.",
            "status": ContextProcessingStatus.COMPLETED,
            "entities_extracted_count": 3,
            "metadata": {
                "deal_size": "$120K ARR",
                "competitor": "Competitor X",
                "lost_date": "2026-02-15"
            }
        }
    ]

    context_sources = []
    for cs_data in context_sources_data:
        context_source = ContextSource(
            tenant_id=tenant_id,
            product_id=product_id,
            source_type=cs_data["source_type"],
            name=cs_data["name"],
            content=cs_data["content"],
            status=cs_data["status"],
            entities_extracted_count=cs_data["entities_extracted_count"],
            metadata=cs_data["metadata"],
            created_at=datetime.utcnow(),
        )
        db.add(context_source)
        context_sources.append(context_source)

    await db.flush()  # Get context source IDs

    # 10. Create Extracted Entities (AI-discovered insights from context sources)
    extracted_entities_data = [
        {
            "source_index": 0,  # Customer Discovery Call
            "entity_type": EntityType.PERSONA,
            "name": "Enterprise VP Engineering",
            "description": "VPs of Engineering at enterprise companies (500+ employees) focused on performance, scalability, and team productivity",
            "confidence_score": 0.90,
            "metadata": {
                "company_size": "500+",
                "department": "Engineering",
                "key_concerns": ["Performance", "Mobile access", "Team productivity"],
                "revenue_potential": "high"
            }
        },
        {
            "source_index": 0,  # Customer Discovery Call
            "entity_type": EntityType.PAIN_POINT,
            "name": "Slow dashboard performance",
            "description": "Dashboard takes 8+ seconds to load, causing frustration and lost productivity",
            "confidence_score": 0.92,
            "metadata": {
                "severity": "high",
                "affected_personas": ["Enterprise VP Engineering", "Product Manager Paula"],
                "source_count": 2
            }
        },
        {
            "source_index": 0,  # Customer Discovery Call
            "entity_type": EntityType.PAIN_POINT,
            "name": "No mobile offline access",
            "description": "Field teams cannot work without internet connectivity, causing data loss and workflow interruptions",
            "confidence_score": 0.88,
            "metadata": {
                "severity": "high",
                "affected_personas": ["Enterprise VP Engineering"],
                "use_case": "Field team client visits"
            }
        },
        {
            "source_index": 1,  # Survey
            "entity_type": EntityType.USE_CASE,
            "name": "Dark mode for night work",
            "description": "Users need dark mode UI to reduce eye strain during evening/night work sessions",
            "confidence_score": 0.85,
            "metadata": {
                "demand_percentage": 68,
                "related_persona": "Developer Dave"
            }
        },
        {
            "source_index": 1,  # Survey
            "entity_type": EntityType.USE_CASE,
            "name": "Slack integration for team notifications",
            "description": "Teams want automated notifications and updates pushed to their Slack channels",
            "confidence_score": 0.78,
            "metadata": {
                "demand_percentage": 42,
                "related_persona": "Product Manager Paula"
            }
        },
        {
            "source_index": 2,  # Win/Loss Document
            "entity_type": EntityType.COMPETITOR,
            "name": "Competitor X",
            "description": "Primary competitor with strong mobile-first approach and native apps for iOS/Android",
            "confidence_score": 0.87,
            "metadata": {
                "strengths": ["Native mobile apps", "Offline support", "Faster performance"],
                "lost_deals": 1,
                "deal_value": "$120K ARR"
            }
        },
        {
            "source_index": 2,  # Win/Loss Document
            "entity_type": EntityType.PRODUCT_CAPABILITY,
            "name": "Native mobile apps with offline mode",
            "description": "iOS and Android native applications with full offline functionality and background sync",
            "confidence_score": 0.83,
            "metadata": {
                "priority": "high",
                "competitive_advantage": "Critical for enterprise deals"
            }
        }
    ]

    for entity_data in extracted_entities_data:
        extracted_entity = ExtractedEntity(
            tenant_id=tenant_id,
            product_id=product_id,
            source_id=context_sources[entity_data["source_index"]].id,
            entity_type=entity_data["entity_type"],
            name=entity_data["name"],
            description=entity_data["description"],
            confidence_score=entity_data["confidence_score"],
            attributes=entity_data["metadata"],
            created_at=datetime.utcnow(),
        )
        db.add(extracted_entity)

    # Commit all changes
    await db.commit()
    await db.refresh(demo_product)

    return demo_product
