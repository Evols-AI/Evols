"""
Extractor base types.

Each agent gets one Extractor whose two jobs are:
  - discover()   →  iterate over (lightweight) SessionRef objects
  - extract(ref) →  produce a normalised ExtractedSession ready to ship

Extractors must be cheap during discover() (no heavy parsing, no decompression).
The runner uses discover()'s mtime to skip unchanged sessions before paying
the parse cost.

Privacy / safety contract:
  - Extractors never write to vendor databases.
  - When opening sqlite, use `?mode=ro&immutable=1` URI to avoid touching WAL.
  - On parse failure, return None — never crash the daemon.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Optional, Protocol


@dataclass
class SessionRef:
    """Lightweight reference returned from discover(). Just enough to dedupe."""
    agent: str
    source_id: str          # agent-native session id (matches what hooks set as source_session_id)
    source_path: str        # human-readable, used for logs and lock-key
    source_mtime: int       # unix epoch
    source_size: int = 0
    cwd: Optional[str] = None  # project path if known at discovery time


@dataclass
class ExtractedSession:
    """Normalised transcript ready to POST to the backend."""
    agent: str
    source_session_id: str
    transcript_text: str
    started_at: Optional[str] = None     # ISO 8601
    ended_at: Optional[str] = None
    cwd: Optional[str] = None
    model: Optional[str] = None
    tokens_used: Optional[int] = None
    files_read: list[str] = field(default_factory=list)
    files_modified: list[str] = field(default_factory=list)
    partial_transcript: bool = False
    schema_version: str = "v1"

    def to_payload(self) -> dict:
        return {
            "agent": self.agent,
            "source": self.agent,
            "source_session_id": self.source_session_id,
            "transcript_text": self.transcript_text,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "cwd": self.cwd,
            "model": self.model,
            "tokens_used": self.tokens_used,
            "files_read": self.files_read,
            "files_modified": self.files_modified,
            "partial_transcript": self.partial_transcript,
            "schema_version": self.schema_version,
        }


class Extractor(Protocol):
    name: str
    schema_version: str
    experimental: bool

    def is_present(self) -> bool: ...
    def discover(self) -> Iterable[SessionRef]: ...
    def extract(self, ref: SessionRef) -> Optional[ExtractedSession]: ...
