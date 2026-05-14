"""Per-agent transcript extractors. Each module implements the `Extractor` protocol."""

from .base import Extractor, SessionRef, ExtractedSession  # noqa: F401
from . import claude, codex, antigravity, cline, copilot  # noqa: F401

ALL_EXTRACTORS: dict[str, Extractor] = {
    "claude":       claude.ClaudeExtractor(),
    "codex":        codex.CodexExtractor(),
    "antigravity":  antigravity.AntigravityExtractor(),
    "cline":        cline.ClineExtractor(),
    "copilot":      copilot.CopilotExtractor(),
}
