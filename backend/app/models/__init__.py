"""Database Models"""

from app.models.tenant import Tenant
from app.models.tenant_invite import TenantInvite
from app.models.user_tenant import UserTenant
from app.models.email_verification import EmailVerification
from app.models.product import Product
from app.models.feedback import Feedback, FeedbackCategory
from app.models.theme import Theme
from app.models.initiative import Initiative
from app.models.account import Account
from app.models.persona import Persona
from app.models.decision import Decision, DecisionOption
# Removed: app.models.conversation - merged into adviser conversations
from app.models.job import Job, JobStatus, JobType
from app.models.preference import UserPreference
from app.models.knowledge_base import KnowledgeSource, Capability
from app.models.project import Project, ProjectEffort, ProjectStatus
from app.models.prompt import Prompt, PromptExecution
from app.models.support import SupportTicket
from app.models.context import (
    ContextSource, ExtractedEntity, ContentAccessLog,
    InitiativeEvidence, EntityInitiativeLink, SourceGroup, EntityDuplicate,
    ContextSourceType, ContextProcessingStatus, EntityType
)
from app.models.skill import (
    Skill, CustomSkill, CustomSkillVersion,
    SkillConversation, SkillMessage, SkillSessionEvaluation,
    SkillMessageSentiment, SkillExperiment, SkillExperimentVariant,
    SkillSessionVariant, SkillExperimentBanditState, SkillBanditAllocationHistory,
    SkillPhase, SkillType
)
from app.models.product_knowledge import ProductKnowledge
from app.models.skill_memory import SkillMemory
from app.models.work_context import (
    WorkContext, ActiveProject, KeyRelationship,
    PMDecision, Task, WeeklyFocus, MeetingNote,
    CapacityStatus, ProjectStatus, ProjectRole,
    TaskPriority, TaskStatus, DecisionCategory, MeetingType
)
from app.models.user_skill_customization import UserSkillCustomization
from app.models.team_knowledge import (
    KnowledgeEntry, KnowledgeEdge, QuotaEvent,
    EntryRole, SessionType, EntryType, EdgeType, QuotaEventType
)

# Backward compatibility aliases
Adviser = Skill
CustomAdviser = CustomSkill
CustomAdviserVersion = CustomSkillVersion
AdviserConversation = SkillConversation
AdviserMessage = SkillMessage
AdviserSession = SkillConversation  # Additional alias
AdviserSessionEvaluation = SkillSessionEvaluation
AdviserMessageSentiment = SkillMessageSentiment
AdviserExperiment = SkillExperiment
AdviserExperimentVariant = SkillExperimentVariant
AdviserSessionVariant = SkillSessionVariant
AdviserExperimentBanditState = SkillExperimentBanditState
AdviserBanditAllocationHistory = SkillBanditAllocationHistory
AdviserPhase = SkillPhase
AdviserType = SkillType

# Import User AFTER skill aliases are defined so AdviserConversation relationship resolves
from app.models.user import User
from app.models.api_key import ApiKey

__all__ = [
    "Tenant",
    "TenantInvite",
    "UserTenant",
    "EmailVerification",
    "User",
    "Product",
    "Feedback",
    "FeedbackCategory",
    "Theme",
    "Initiative",
    "Account",
    "Persona",
    "Decision",
    "DecisionOption",
    "Job",
    "JobStatus",
    "JobType",
    "UserPreference",
    "KnowledgeSource",
    "Capability",
    "Project",
    "ProjectEffort",
    "ProjectStatus",
    "Prompt",
    "PromptExecution",
    "SupportTicket",
    # Context system
    "ContextSource",
    "ExtractedEntity",
    "ContentAccessLog",
    "InitiativeEvidence",
    "EntityInitiativeLink",
    "SourceGroup",
    "EntityDuplicate",
    "ContextSourceType",
    "ContextProcessingStatus",
    "EntityType",
    # Skills (new names)
    "Skill",
    "CustomSkill",
    "CustomSkillVersion",
    "SkillConversation",
    "SkillMessage",
    "SkillSessionEvaluation",
    "SkillMessageSentiment",
    "SkillExperiment",
    "SkillExperimentVariant",
    "SkillSessionVariant",
    "SkillExperimentBanditState",
    "SkillBanditAllocationHistory",
    "SkillPhase",
    "SkillType",
    # Backward compatibility (old names point to new classes)
    "Adviser",
    "CustomAdviser",
    "CustomAdviserVersion",
    "AdviserConversation",
    "AdviserMessage",
    "AdviserSessionEvaluation",
    "AdviserMessageSentiment",
    "AdviserExperiment",
    "AdviserExperimentVariant",
    "AdviserSessionVariant",
    "AdviserExperimentBanditState",
    "AdviserBanditAllocationHistory",
    "AdviserPhase",
    "AdviserType",
    # Unified PM OS
    "ProductKnowledge",
    "SkillMemory",
    # Work Context
    "WorkContext",
    "ActiveProject",
    "KeyRelationship",
    "PMDecision",
    "Task",
    "WeeklyFocus",
    "MeetingNote",
    "CapacityStatus",
    "ProjectStatus",
    "ProjectRole",
    "TaskPriority",
    "TaskStatus",
    "DecisionCategory",
    "MeetingType",
    # User Customizations
    "UserSkillCustomization",
    # Team Knowledge Graph
    "KnowledgeEntry",
    "KnowledgeEdge",
    "QuotaEvent",
    # API Keys
    "ApiKey",
]
