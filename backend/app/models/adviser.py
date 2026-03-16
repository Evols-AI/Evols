"""
Adviser Models - DEPRECATED
This file is kept for backward compatibility.
All adviser models have been renamed to skill models.
Import from app.models.skill or app.models instead.
"""

# Import all from skill module
from app.models.skill import (
    # Enums
    SkillPhase as AdviserPhase,
    SkillType as AdviserType,
    ExperimentStatus,
    OptimizationStrategy,
    SentimentLabel,

    # Main models
    Skill as Adviser,
    CustomSkill as CustomAdviser,
    CustomSkillVersion as CustomAdviserVersion,
    SkillConversation as AdviserConversation,
    SkillMessage as AdviserMessage,
    SkillSessionEvaluation as AdviserSessionEvaluation,
    SkillMessageSentiment as AdviserMessageSentiment,
    SkillExperiment as AdviserExperiment,
    SkillExperimentVariant as AdviserExperimentVariant,
    SkillSessionVariant as AdviserSessionVariant,
    SkillExperimentBanditState as AdviserExperimentBanditState,
    SkillBanditAllocationHistory as AdviserBanditAllocationHistory,
)

# Backward compatibility alias
AdviserSession = AdviserConversation

__all__ = [
    'AdviserPhase',
    'AdviserType',
    'ExperimentStatus',
    'OptimizationStrategy',
    'SentimentLabel',
    'Adviser',
    'CustomAdviser',
    'CustomAdviserVersion',
    'AdviserConversation',
    'AdviserSession',
    'AdviserMessage',
    'AdviserSessionEvaluation',
    'AdviserMessageSentiment',
    'AdviserExperiment',
    'AdviserExperimentVariant',
    'AdviserSessionVariant',
    'AdviserExperimentBanditState',
    'AdviserBanditAllocationHistory',
]
