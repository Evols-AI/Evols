"""
Demo Data Seeding Service
Seeds demonstration data for new Demo products to help onboard users
"""

from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import random

from app.models.persona import Persona
from app.models.feedback import Feedback, FeedbackSource, FeedbackCategory
from app.models.theme import Theme
from app.models.initiative import Initiative, InitiativeStatus, InitiativeEffort
from app.models.project import Project, ProjectStatus, ProjectEffort


class DemoSeedService:
    """Service for seeding demonstration data for onboarding"""

    @staticmethod
    async def seed_demo_data(
        db: AsyncSession,
        tenant_id: int,
        product_id: int
    ) -> dict:
        """
        Seed complete demo data set for a tenant's demo product.

        Args:
            db: Database session
            tenant_id: Tenant ID
            product_id: Demo product ID

        Returns:
            Dictionary with counts of created items
        """
        # 1. Create demo personas
        personas = await DemoSeedService._seed_personas(db, tenant_id, product_id)

        # 2. Create demo feedback
        feedback_items = await DemoSeedService._seed_feedback(db, tenant_id, product_id)

        # 3. Create demo themes
        themes = await DemoSeedService._seed_themes(db, tenant_id, product_id)

        # 4. Link feedback to themes
        for i, feedback in enumerate(feedback_items):
            feedback.theme_id = themes[i % len(themes)].id

        # 5. Create demo initiatives
        initiatives = await DemoSeedService._seed_initiatives(db, tenant_id, product_id, themes)

        # 6. Create demo projects
        projects = await DemoSeedService._seed_projects(db, tenant_id, product_id, initiatives)

        await db.commit()

        return {
            "personas_created": len(personas),
            "feedback_created": len(feedback_items),
            "themes_created": len(themes),
            "initiatives_created": len(initiatives),
            "projects_created": len(projects),
        }

    @staticmethod
    async def _seed_personas(
        db: AsyncSession,
        tenant_id: int,
        product_id: int
    ) -> List[Persona]:
        """Create demo personas"""
        personas_data = [
            {
                "name": "Product Manager Paula",
                "segment": "Enterprise",
                "description": "Senior PM at large SaaS company, focused on user engagement and retention",
                "persona_summary": "Paula is a Senior Product Manager at an enterprise SaaS company managing a team of 5 PMs. She values data-driven decisions, user feedback loops, and shipping iteratively. Budget authority: $100K-500K. Decision speed: 1-2 months.",
                "key_pain_points": ["Manual feedback analysis", "Prioritization without data", "Aligning stakeholders", "Long product cycles"],
                "buying_triggers": ["SOC2 requirement", "Board pressure for faster shipping", "Competitive pressure"],
                "feature_priorities": ["AI-powered insights", "Integration with existing tools", "Real-time dashboards"],
                "budget_authority_min": 100000,
                "budget_authority_max": 500000,
                "status": "advisor",
            },
            {
                "name": "Startup Founder Fred",
                "segment": "Startup",
                "description": "Technical founder at seed-stage startup, wearing multiple hats",
                "persona_summary": "Fred is a technical co-founder at a seed-stage startup with 10 employees. He values speed, simplicity, and cost-effectiveness. Budget authority: $5K-20K. Decision speed: < 1 week.",
                "key_pain_points": ["Limited resources", "Competing priorities", "Technical debt", "Finding product-market fit"],
                "buying_triggers": ["Raising Series A", "Hitting growth plateau", "Team growing too fast"],
                "feature_priorities": ["Easy onboarding", "Fast time-to-value", "Affordable pricing"],
                "budget_authority_min": 5000,
                "budget_authority_max": 20000,
                "status": "advisor",
            },
            {
                "name": "Customer Success Manager Carol",
                "segment": "Mid-Market",
                "description": "CSM focused on customer retention and expansion",
                "persona_summary": "Carol manages 30 mid-market accounts, focused on renewals and upsells. She values customer insights, churn prevention tools, and product adoption metrics. Budget influence but not decision maker.",
                "key_pain_points": ["Scattered customer feedback", "Manual reporting", "Reactive support", "Missing expansion signals"],
                "buying_triggers": ["High churn quarter", "Executive mandate", "New CS leader"],
                "feature_priorities": ["Customer health scoring", "Feedback centralization", "Integration with CRM"],
                "budget_authority_min": 10000,
                "budget_authority_max": 50000,
                "status": "advisor",
            },
        ]

        personas = []
        for data in personas_data:
            persona = Persona(
                tenant_id=tenant_id,
                product_id=product_id,
                **data
            )
            db.add(persona)
            personas.append(persona)

        await db.flush()
        return personas

    @staticmethod
    async def _seed_feedback(
        db: AsyncSession,
        tenant_id: int,
        product_id: int
    ) -> List[Feedback]:
        """Create demo feedback items"""
        feedback_data = [
            {
                "title": "Dashboard loads too slowly",
                "content": "The main dashboard takes 5-10 seconds to load with more than 100 feedback items. This makes it frustrating to use daily.",
                "category": FeedbackCategory.IMPROVEMENT,
                "source": FeedbackSource.INTERCOM,
                "customer_name": "Acme Corp",
                "customer_segment": "Enterprise",
                "urgency_score": 0.8,
                "impact_score": 0.7,
            },
            {
                "title": "Add Slack integration",
                "content": "Would love to get notifications in Slack when new themes are identified or when initiatives change status.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "source": FeedbackSource.PRODUCTBOARD,
                "customer_name": "StartupXYZ",
                "customer_segment": "Startup",
                "urgency_score": 0.6,
                "impact_score": 0.9,
            },
            {
                "title": "Bulk import from CSV is missing",
                "content": "We have hundreds of feedback items in spreadsheets. Need a way to bulk import them.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "source": FeedbackSource.ZENDESK,
                "customer_name": "MidCo Inc",
                "customer_segment": "Mid-Market",
                "urgency_score": 0.7,
                "impact_score": 0.8,
            },
            {
                "title": "Export roadmap to PDF",
                "content": "Need to share roadmap with exec team who aren't in the tool. PDF export would be great.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "source": FeedbackSource.INTERCOM,
                "customer_name": "BigEnterprise LLC",
                "customer_segment": "Enterprise",
                "urgency_score": 0.5,
                "impact_score": 0.6,
            },
            {
                "title": "Persona simulation is amazing!",
                "content": "The digital twin personas helped us make a tough prioritization decision. Saved us months of debate.",
                "category": FeedbackCategory.PRAISE,
                "source": FeedbackSource.INTERCOM,
                "customer_name": "Happy Customer Co",
                "customer_segment": "Mid-Market",
                "urgency_score": 0.2,
                "impact_score": 0.3,
            },
            {
                "title": "Add SSO support",
                "content": "Security team requires SSO for all SaaS tools. This is a blocker for us.",
                "category": FeedbackCategory.FEATURE_REQUEST,
                "source": FeedbackSource.SALESFORCE,
                "customer_name": "SecureBank Corp",
                "customer_segment": "Enterprise",
                "urgency_score": 0.95,
                "impact_score": 0.85,
            },
        ]

        feedback_items = []
        base_date = datetime.utcnow() - timedelta(days=30)

        for i, data in enumerate(feedback_data):
            feedback = Feedback(
                tenant_id=tenant_id,
                product_id=product_id,
                feedback_date=base_date + timedelta(days=i * 5),
                **data
            )
            db.add(feedback)
            feedback_items.append(feedback)

        await db.flush()
        return feedback_items

    @staticmethod
    async def _seed_themes(
        db: AsyncSession,
        tenant_id: int,
        product_id: int
    ) -> List[Theme]:
        """Create demo themes"""
        themes_data = [
            {
                "title": "Performance Optimization",
                "description": "Users experiencing slow load times and performance issues",
                "summary": "Multiple customers report dashboard performance issues, especially with large datasets. This affects daily usage and satisfaction.",
                "primary_category": "improvement",
                "feedback_count": 3,
                "account_count": 3,
                "total_arr": 145000,
                "urgency_score": 0.8,
                "impact_score": 0.75,
                "confidence_score": 0.9,
                "trend": "increasing",
            },
            {
                "title": "Integration Ecosystem",
                "description": "Requests for integrations with popular tools (Slack, Jira, etc.)",
                "summary": "Customers want seamless integration with their existing toolchain, particularly Slack for notifications and Jira for project management.",
                "primary_category": "feature_request",
                "feedback_count": 2,
                "account_count": 2,
                "total_arr": 95000,
                "urgency_score": 0.65,
                "impact_score": 0.85,
                "confidence_score": 0.85,
                "trend": "stable",
            },
            {
                "title": "Enterprise Security & Compliance",
                "description": "SSO, RBAC, audit logs, and compliance features",
                "summary": "Enterprise customers require SSO, granular permissions, and audit trails for compliance. This is a common blocker for larger deals.",
                "primary_category": "feature_request",
                "feedback_count": 2,
                "account_count": 2,
                "total_arr": 250000,
                "urgency_score": 0.9,
                "impact_score": 0.9,
                "confidence_score": 0.95,
                "trend": "increasing",
            },
        ]

        themes = []
        for data in themes_data:
            theme = Theme(
                tenant_id=tenant_id,
                product_id=product_id,
                **data
            )
            db.add(theme)
            themes.append(theme)

        await db.flush()
        return themes

    @staticmethod
    async def _seed_initiatives(
        db: AsyncSession,
        tenant_id: int,
        product_id: int,
        themes: List[Theme]
    ) -> List[Initiative]:
        """Create demo initiatives"""
        initiatives_data = [
            {
                "title": "Dashboard Performance Overhaul",
                "description": "Re-architect dashboard loading to support 1000+ items with <1s load time",
                "status": InitiativeStatus.IN_PROGRESS,
                "effort": InitiativeEffort.LARGE,
                "estimated_impact_score": 0.8,
                "expected_arr_impact": 50000,
                "priority_score": 85,
            },
            {
                "title": "Slack & Jira Integrations",
                "description": "Build native integrations with Slack and Jira",
                "status": InitiativeStatus.PLANNED,
                "effort": InitiativeEffort.MEDIUM,
                "estimated_impact_score": 0.75,
                "expected_arr_impact": 75000,
                "priority_score": 78,
            },
            {
                "title": "Enterprise Security Suite",
                "description": "Implement SSO (SAML, OAuth), RBAC, audit logs, and SOC2 compliance",
                "status": InitiativeStatus.PLANNED,
                "effort": InitiativeEffort.XLARGE,
                "estimated_impact_score": 0.9,
                "expected_arr_impact": 200000,
                "priority_score": 92,
            },
            {
                "title": "Bulk Import/Export",
                "description": "CSV import for feedback, PDF export for roadmaps",
                "status": InitiativeStatus.BACKLOG,
                "effort": InitiativeEffort.SMALL,
                "estimated_impact_score": 0.6,
                "expected_arr_impact": 30000,
                "priority_score": 65,
            },
        ]

        initiatives = []
        for i, data in enumerate(initiatives_data):
            initiative = Initiative(
                tenant_id=tenant_id,
                product_id=product_id,
                **data
            )
            db.add(initiative)

            # Link themes to initiatives
            if i < len(themes):
                initiative.themes.append(themes[i])

            initiatives.append(initiative)

        await db.flush()
        return initiatives

    @staticmethod
    async def _seed_projects(
        db: AsyncSession,
        tenant_id: int,
        product_id: int,
        initiatives: List[Initiative]
    ) -> List[Project]:
        """Create demo projects"""
        projects_data = [
            # Projects for Dashboard Performance initiative
            {
                "initiative_idx": 0,
                "title": "Implement virtual scrolling",
                "description": "Add virtual scrolling to feedback list to handle large datasets",
                "effort": ProjectEffort.SMALL,
                "is_boulder": False,
                "status": ProjectStatus.IN_PROGRESS,
                "reach": 50,
                "confidence": 0.9,
                "priority_score": 82,
            },
            {
                "initiative_idx": 0,
                "title": "Optimize database queries",
                "description": "Add indexes and query optimization for dashboard endpoints",
                "effort": ProjectEffort.MEDIUM,
                "is_boulder": True,
                "status": ProjectStatus.PLANNED,
                "reach": 50,
                "confidence": 0.85,
                "priority_score": 78,
            },
            # Projects for Integrations initiative
            {
                "initiative_idx": 1,
                "title": "Slack notification system",
                "description": "Build Slack app for theme and initiative notifications",
                "effort": ProjectEffort.MEDIUM,
                "is_boulder": True,
                "status": ProjectStatus.BACKLOG,
                "reach": 35,
                "confidence": 0.8,
                "priority_score": 70,
            },
            # Projects for Security initiative
            {
                "initiative_idx": 2,
                "title": "SAML SSO implementation",
                "description": "Implement SAML 2.0 SSO with major providers (Okta, Azure AD)",
                "effort": ProjectEffort.LARGE,
                "is_boulder": True,
                "status": ProjectStatus.BACKLOG,
                "reach": 15,
                "confidence": 0.9,
                "priority_score": 88,
            },
        ]

        projects = []
        for data in projects_data:
            initiative_idx = data.pop("initiative_idx")
            project = Project(
                tenant_id=tenant_id,
                product_id=product_id,
                initiative_id=initiatives[initiative_idx].id,
                **data
            )
            db.add(project)
            projects.append(project)

        await db.flush()
        return projects
