"""
Mock data fixtures for adviser testing
Provides realistic data that tools would return
"""

# ===================================
# CONTEXT SYSTEM MOCK DATA
# ===================================

# Mock context sources (meeting transcripts, surveys, documents)
MOCK_CONTEXT_SOURCES = [
    {
        "id": 1,
        "source_type": "meeting_transcript",
        "name": "Customer Discovery Call - Acme Corp",
        "content": "We spoke with John from Acme Corp (500 employees). Main pain points: 1) Their IT admin spends 3 hours/week manually inviting new users. 2) No SSO integration means security issues. 3) They're evaluating competitors with better admin tools. Quote: 'If you had SSO and bulk user import, we'd upgrade to Enterprise tier immediately.'",
        "status": "completed",
        "entities_extracted_count": 5,
        "created_at": "2026-02-01T10:30:00Z",
        "metadata": {
            "participant_count": 2,
            "duration_minutes": 45,
            "call_type": "discovery"
        }
    },
    {
        "id": 2,
        "source_type": "survey_response",
        "name": "Q1 2026 User Survey - Performance Feedback",
        "content": "Survey responses from 150 users. Key findings: 67% report slow load times on mobile. 45% say the app takes >10 seconds to open. Power users specifically mention: 'The dashboard is painfully slow with large datasets.' Most requested: faster page loads, caching, performance improvements.",
        "status": "completed",
        "entities_extracted_count": 8,
        "created_at": "2026-01-28T14:20:00Z",
        "metadata": {
            "response_count": 150,
            "completion_rate": 0.68
        }
    },
    {
        "id": 3,
        "source_type": "document",
        "name": "Win/Loss Analysis - Lost Deal to Competitor X",
        "content": "Lost deal to Competitor X. Primary reason: Better mobile experience. Sales notes: 'Customer said our mobile app is too slow and lacks offline support. Competitor X has native mobile apps for iOS/Android with offline mode. Customer quote: We need our field team to work without internet connectivity.'",
        "status": "completed",
        "entities_extracted_count": 4,
        "created_at": "2026-02-10T09:15:00Z",
        "metadata": {
            "deal_size": "$120K ARR",
            "competitor": "Competitor X"
        }
    },
    {
        "id": 4,
        "source_type": "meeting_transcript",
        "name": "Enterprise Customer Quarterly Review - TechStart Inc",
        "content": "QBR with TechStart Inc (200 users, $80K ARR). Feedback: Love the core product but search functionality is frustrating. Quote: 'We search for documents we know exist, but they never show up in results. Our team has to browse manually.' They mentioned considering alternatives if search doesn't improve. Also requested better mobile access for remote teams.",
        "status": "completed",
        "entities_extracted_count": 6,
        "created_at": "2026-02-05T15:00:00Z",
        "metadata": {
            "account_tier": "enterprise",
            "renewal_date": "2026-06-01"
        }
    }
]

# Mock extracted entities (AI-discovered from context sources)
MOCK_EXTRACTED_ENTITIES = [
    {
        "id": 1,
        "entity_type": "persona",
        "name": "Enterprise IT Administrator",
        "description": "IT administrators at large companies (500+ employees) managing user access, security, and integrations",
        "confidence_score": 0.92,
        "source_count": 2,
        "first_seen": "2026-02-01",
        "last_seen": "2026-02-10",
        "metadata": {
            "company_sizes": ["500+"],
            "pain_points": ["Manual user management", "No SSO", "Security compliance"],
            "revenue_potential": "high"
        }
    },
    {
        "id": 2,
        "entity_type": "persona",
        "name": "Field Sales Rep",
        "description": "Sales representatives working remotely who need mobile access without internet connectivity",
        "confidence_score": 0.85,
        "source_count": 1,
        "first_seen": "2026-02-10",
        "last_seen": "2026-02-10",
        "metadata": {
            "work_environment": "remote, offline",
            "primary_device": "mobile"
        }
    },
    {
        "id": 3,
        "entity_type": "pain_point",
        "name": "Slow mobile performance",
        "description": "Mobile app takes >10 seconds to load, especially on dashboard with large datasets",
        "confidence_score": 0.95,
        "source_count": 3,
        "affected_personas": ["Power User", "End User", "Field Sales Rep"],
        "severity": "high",
        "first_seen": "2026-01-28",
        "metadata": {
            "load_time": ">10 seconds",
            "specific_pages": ["dashboard", "document viewer"]
        }
    },
    {
        "id": 4,
        "entity_type": "pain_point",
        "name": "Manual user provisioning",
        "description": "IT admins waste 3+ hours per week manually inviting users one by one",
        "confidence_score": 0.88,
        "source_count": 1,
        "affected_personas": ["Enterprise IT Administrator"],
        "severity": "medium",
        "first_seen": "2026-02-01",
        "metadata": {
            "time_wasted": "3 hours/week"
        }
    },
    {
        "id": 5,
        "entity_type": "pain_point",
        "name": "Poor search results",
        "description": "Users can't find documents they know exist, have to browse manually instead of searching",
        "confidence_score": 0.90,
        "source_count": 2,
        "affected_personas": ["Power User", "End User"],
        "severity": "medium",
        "first_seen": "2026-01-28"
    },
    {
        "id": 6,
        "entity_type": "use_case",
        "name": "Bulk user import for enterprises",
        "description": "Enterprise admins need to import hundreds of users at once via CSV or directory sync",
        "confidence_score": 0.87,
        "source_count": 1,
        "related_personas": ["Enterprise IT Administrator"],
        "first_seen": "2026-02-01"
    },
    {
        "id": 7,
        "entity_type": "use_case",
        "name": "Offline mobile access",
        "description": "Field teams need to work without internet connectivity, sync when back online",
        "confidence_score": 0.83,
        "source_count": 1,
        "related_personas": ["Field Sales Rep"],
        "first_seen": "2026-02-10"
    },
    {
        "id": 8,
        "entity_type": "capability",
        "name": "SSO/SAML integration",
        "description": "Single sign-on authentication for enterprise customers to improve security and compliance",
        "confidence_score": 0.91,
        "source_count": 1,
        "requested_by": ["Enterprise IT Administrator"],
        "priority": "high",
        "first_seen": "2026-02-01"
    },
    {
        "id": 9,
        "entity_type": "competitor",
        "name": "Competitor X",
        "description": "Competitor with better mobile experience and offline support",
        "confidence_score": 0.85,
        "source_count": 1,
        "strengths": ["Native mobile apps", "Offline mode", "Better performance"],
        "first_seen": "2026-02-10",
        "metadata": {
            "lost_deals": 1,
            "deal_value": "$120K ARR"
        }
    }
]

# Mock entity summary (aggregated statistics)
MOCK_ENTITY_SUMMARY = {
    "total_entities": 9,
    "by_type": {
        "persona": 2,
        "pain_point": 3,
        "use_case": 2,
        "capability": 1,
        "competitor": 1
    },
    "high_confidence_count": 7,
    "sources_analyzed": 4,
    "last_extraction": "2026-02-10T09:15:00Z"
}

# ===================================
# LEGACY SYSTEM MOCK DATA (kept for backwards compatibility)
# ===================================

# Mock themes data
MOCK_THEMES = [
    {
        "id": 1,
        "name": "Performance Issues",
        "description": "App is slow, pages take too long to load",
        "vote_count": 234,
        "feedback_count": 45,
        "personas": ["Enterprise Admin", "Power User"],
        "urgency": "high",
        "trend": "increasing"
    },
    {
        "id": 2,
        "name": "Better Search",
        "description": "Search doesn't find relevant results",
        "vote_count": 156,
        "feedback_count": 28,
        "personas": ["Enterprise Admin", "End User"],
        "urgency": "medium",
        "trend": "stable"
    },
    {
        "id": 3,
        "name": "Mobile Support",
        "description": "Need mobile app or responsive design",
        "vote_count": 189,
        "feedback_count": 34,
        "personas": ["End User", "Power User"],
        "urgency": "medium",
        "trend": "increasing"
    },
    {
        "id": 4,
        "name": "SSO/Authentication",
        "description": "Need single sign-on for enterprise",
        "vote_count": 198,
        "feedback_count": 22,
        "personas": ["Enterprise Admin"],
        "urgency": "high",
        "trend": "stable"
    }
]

# Mock personas data
MOCK_PERSONAS = [
    {
        "id": 1,
        "name": "Enterprise Admin",
        "description": "IT administrators managing enterprise accounts",
        "total_votes": 450,
        "feedback_count": 67,
        "revenue_contribution": "$500K ARR",
        "top_pain_points": [
            "Security and compliance requirements",
            "User management at scale",
            "Integration with existing tools"
        ]
    },
    {
        "id": 2,
        "name": "Power User",
        "description": "Daily active users with advanced needs",
        "total_votes": 320,
        "feedback_count": 89,
        "revenue_contribution": "$200K ARR",
        "top_pain_points": [
            "Performance and speed",
            "Advanced features and customization",
            "Keyboard shortcuts"
        ]
    },
    {
        "id": 3,
        "name": "End User",
        "description": "Occasional users with basic needs",
        "total_votes": 180,
        "feedback_count": 45,
        "revenue_contribution": "$100K ARR",
        "top_pain_points": [
            "Ease of use",
            "Mobile access",
            "Clear documentation"
        ]
    }
]

# Mock features data
MOCK_FEATURES = [
    {
        "id": 1,
        "name": "Dashboard Analytics",
        "description": "Real-time analytics dashboard",
        "status": "launched",
        "launch_date": "2025-12-01",
        "adoption_rate": 0.45,
        "rice_score": 850,
        "rice_breakdown": {
            "reach": 5000,
            "impact": 2.0,
            "confidence": 0.85,
            "effort": 10
        }
    },
    {
        "id": 2,
        "name": "Team Collaboration",
        "description": "Real-time collaboration features",
        "status": "in_development",
        "launch_date": "2026-02-15",
        "adoption_rate": None,
        "rice_score": 720,
        "rice_breakdown": {
            "reach": 3000,
            "impact": 2.0,
            "confidence": 0.80,
            "effort": 8
        }
    }
]

# Mock feedback items
MOCK_FEEDBACK_ITEMS = [
    {
        "id": 1,
        "title": "App is too slow on mobile",
        "description": "When I open the app on my phone, it takes 10+ seconds to load",
        "persona": "End User",
        "theme": "Performance Issues",
        "votes": 23,
        "created_at": "2026-01-15",
        "sentiment": "negative",
        "priority": "high"
    },
    {
        "id": 2,
        "title": "Need SSO for our enterprise",
        "description": "We have 500 employees and managing individual logins is a nightmare. Need SAML/SSO integration.",
        "persona": "Enterprise Admin",
        "theme": "SSO/Authentication",
        "votes": 45,
        "created_at": "2026-01-20",
        "sentiment": "negative",
        "priority": "high"
    },
    {
        "id": 3,
        "title": "Search doesn't work well",
        "description": "I search for things I know exist but they don't show up in results",
        "persona": "Power User",
        "theme": "Better Search",
        "votes": 34,
        "created_at": "2026-02-01",
        "sentiment": "negative",
        "priority": "medium"
    }
]

# Mock feedback summary
MOCK_FEEDBACK_SUMMARY = {
    "total_feedback_items": 123,
    "total_votes": 950,
    "average_sentiment": -0.3,  # Slightly negative
    "top_themes": [
        {"name": "Performance Issues", "votes": 234, "percentage": 24.6},
        {"name": "SSO/Authentication", "votes": 198, "percentage": 20.8},
        {"name": "Mobile Support", "votes": 189, "percentage": 19.9}
    ],
    "sentiment_breakdown": {
        "positive": 0.15,
        "neutral": 0.45,
        "negative": 0.40
    },
    "trends": {
        "increasing": ["Performance Issues", "Mobile Support"],
        "stable": ["SSO/Authentication", "Better Search"],
        "decreasing": []
    }
}

# Mock RICE calculation
def mock_calculate_rice_score(reach, impact, confidence, effort):
    """Calculate RICE score"""
    if effort == 0:
        return 0
    return (reach * impact * confidence) / effort


# Tool response simulator
class MockToolResponses:
    """Simulates tool responses for testing"""

    # ===================================
    # CONTEXT SYSTEM TOOLS
    # ===================================

    @staticmethod
    def get_context_sources(source_type=None, limit=10):
        """Get context sources (meeting transcripts, surveys, documents)"""
        sources = MOCK_CONTEXT_SOURCES
        if source_type:
            sources = [s for s in sources if s["source_type"] == source_type]
        return {
            "sources": sources[:limit],
            "total": len(sources),
            "types_available": ["meeting_transcript", "survey_response", "document"]
        }

    @staticmethod
    def get_extracted_entities(entity_type=None, limit=10):
        """Get AI-extracted entities from context sources"""
        entities = MOCK_EXTRACTED_ENTITIES
        if entity_type and entity_type != "all":
            entities = [e for e in entities if e["entity_type"] == entity_type]
        return {
            "entities": entities[:limit],
            "total": len(entities),
            "types_available": ["persona", "pain_point", "use_case", "capability", "competitor"]
        }

    @staticmethod
    def get_entity_summary():
        """Get summary statistics of extracted entities"""
        return MOCK_ENTITY_SUMMARY

    # ===================================
    # LEGACY SYSTEM TOOLS
    # ===================================

    @staticmethod
    def get_themes():
        return {"themes": MOCK_THEMES, "total": len(MOCK_THEMES)}

    @staticmethod
    def get_personas():
        return {"personas": MOCK_PERSONAS, "total": len(MOCK_PERSONAS)}

    @staticmethod
    def get_features():
        return {"features": MOCK_FEATURES, "total": len(MOCK_FEATURES)}

    @staticmethod
    def get_feedback_items(limit=10, theme=None, persona=None):
        items = MOCK_FEEDBACK_ITEMS
        if theme:
            items = [i for i in items if i["theme"] == theme]
        if persona:
            items = [i for i in items if i["persona"] == persona]
        return {"feedback_items": items[:limit], "total": len(items)}

    @staticmethod
    def get_feedback_summary():
        return MOCK_FEEDBACK_SUMMARY

    @staticmethod
    def calculate_rice_score(reach, impact, confidence, effort):
        score = mock_calculate_rice_score(reach, impact, confidence, effort)
        return {
            "score": score,
            "breakdown": {
                "reach": reach,
                "impact": impact,
                "confidence": confidence,
                "effort": effort
            }
        }


# Test scenarios
TEST_SCENARIOS = {
    "insights_miner": {
        "user_input": {
            "analysis_goal": "Feature adoption",
            "time_period": "Last 30 days",
            "specific_question": "Why did adoption of the search feature drop by 15% last month?"
        },
        "mock_tools": {
            # Context system tools (new - priority data)
            "get_context_sources": MockToolResponses.get_context_sources(),
            "get_extracted_entities": MockToolResponses.get_extracted_entities(),
            "get_entity_summary": MockToolResponses.get_entity_summary(),
            # Legacy tools (for backwards compatibility)
            "get_feedback_summary": MockToolResponses.get_feedback_summary(),
            "get_themes": MockToolResponses.get_themes(),
            "get_personas": MockToolResponses.get_personas(),
            "get_features": MockToolResponses.get_features(),
            "get_feedback_items": MockToolResponses.get_feedback_items()
        }
    },
    "prioritization_engine": {
        "user_input": {
            "items_to_prioritize": "SSO login\nMobile app\nAdvanced search\nPerformance optimization",
            "strategic_context": "Focus on enterprise market expansion and retention",
            "team_capacity": 10
        },
        "mock_tools": {
            # Context system tools
            "get_context_sources": MockToolResponses.get_context_sources(),
            "get_extracted_entities": MockToolResponses.get_extracted_entities(),
            "get_entity_summary": MockToolResponses.get_entity_summary(),
            # Legacy tools
            "get_themes": MockToolResponses.get_themes(),
            "get_personas": MockToolResponses.get_personas(),
            "get_features": MockToolResponses.get_features()
        }
    },
    "prd_writer": {
        "user_input": {
            "feature_name": "Bulk user import",
            "problem": "Enterprise admins waste hours inviting users one by one",
            "target_personas": "Enterprise Admin"
        },
        "mock_tools": {
            # Context system tools
            "get_context_sources": MockToolResponses.get_context_sources(),
            "get_extracted_entities": MockToolResponses.get_extracted_entities(entity_type="use_case"),
            # Legacy tools
            "get_personas": MockToolResponses.get_personas(),
            "get_themes": MockToolResponses.get_themes(),
            "get_feedback_items": MockToolResponses.get_feedback_items(theme="SSO/Authentication"),
            "get_features": MockToolResponses.get_features()
        }
    },
    "persona_analyzer": {
        "user_input": {
            "analysis_type": "persona_discovery",
            "focus_area": "Enterprise customers"
        },
        "mock_tools": {
            # Context system tools (primary data source)
            "get_extracted_entities": MockToolResponses.get_extracted_entities(entity_type="persona"),
            "get_context_sources": MockToolResponses.get_context_sources(),
            # Legacy tools
            "get_personas": MockToolResponses.get_personas(),
            "get_themes": MockToolResponses.get_themes(),
            "get_feedback_items": MockToolResponses.get_feedback_items()
        }
    },
    "decision_workbench": {
        "user_input": {
            "decision": "Should we build offline mobile support or SSO integration first?",
            "context": "Limited engineering resources, need to prioritize enterprise growth"
        },
        "mock_tools": {
            # Context system tools
            "get_context_sources": MockToolResponses.get_context_sources(),
            "get_extracted_entities": MockToolResponses.get_extracted_entities(),
            "get_entity_summary": MockToolResponses.get_entity_summary(),
            # Legacy tools
            "get_themes": MockToolResponses.get_themes(),
            "get_personas": MockToolResponses.get_personas(),
            "get_feedback_items": MockToolResponses.get_feedback_items(),
            "get_features": MockToolResponses.get_features()
        }
    },
    "competitive_analyst": {
        "user_input": {
            "competitor": "Competitor X",
            "analysis_type": "win_loss"
        },
        "mock_tools": {
            # Context system tools (primary for competitive intel)
            "get_extracted_entities": MockToolResponses.get_extracted_entities(entity_type="competitor"),
            "get_context_sources": MockToolResponses.get_context_sources(source_type="document"),
            # Legacy tools
            "get_themes": MockToolResponses.get_themes(),
            "get_feedback_items": MockToolResponses.get_feedback_items()
        }
    }
}
