"""
Thin Evols backend client used by the sync engine.

Two responsibilities:
  1. Push extracted sessions (via /sessions/import when present, falling back
     to the existing /team-knowledge/entries endpoint hooks already use).
  2. Pull the user's existing entries to populate the local sync_state DB so
     `evols sync` doesn't re-ship sessions that hooks already shipped.

Everything uses urllib (no extra deps) to match the rest of the CLI.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Iterator, Optional


class ApiError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:200]}")
        self.status = status
        self.body = body


class EvolsClient:
    def __init__(self, api_url: str, api_key: str, *, timeout: float = 15.0):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._has_lookup_endpoint: Optional[bool] = None

    # ── HTTP plumbing ─────────────────────────────────────────────────────────

    def _req(self, method: str, path: str, *, payload: Optional[dict] = None,
             params: Optional[dict] = None) -> dict:
        url = f"{self.api_url}{path}"
        if params:
            url = f"{url}?{urllib.parse.urlencode(params)}"
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                body = resp.read()
                if not body:
                    return {}
                return json.loads(body)
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            raise ApiError(e.code, body) from e

    # ── Capability probing ───────────────────────────────────────────────────

    def supports_lookup(self) -> bool:
        """GET /entries?source_session_id=<id> — used as a per-session pre-flight."""
        if self._has_lookup_endpoint is not None:
            return self._has_lookup_endpoint
        try:
            self._req("GET", "/api/v1/team-knowledge/entries",
                      params={"source_session_id": "__evols_probe__", "limit": 1})
            self._has_lookup_endpoint = True
        except ApiError as e:
            # 200/400/422 = endpoint exists; 404 = absent
            self._has_lookup_endpoint = e.status not in (404,)
        except Exception:
            self._has_lookup_endpoint = False
        return self._has_lookup_endpoint

    # ── Push ─────────────────────────────────────────────────────────────────

    def import_session(self, payload: dict) -> tuple[Optional[int], bool]:
        """Returns (entry_id, deduped). entry_id may be None on failure."""
        auto_sync_payload = {
            "session_text": payload.get("transcript_text", "")[:8000],
            "source_session_id": payload.get("source_session_id"),
            "session_tokens_used": payload.get("tokens_used") or 0,
            "files_read": payload.get("files_read") or [],
            "files_modified": payload.get("files_modified") or [],
            "model": payload.get("model"),
            "tool_name": payload.get("source") or payload.get("agent") or "unknown",
        }
        resp = self._req("POST", "/api/v1/team-knowledge/auto-sync", payload=auto_sync_payload)
        entry_id = resp.get("entry_id")
        skipped = resp.get("skipped", False)
        return entry_id, skipped

    # ── Pull (seed + per-session pre-flight) ─────────────────────────────────

    def lookup_by_source_id(self, source_session_id: str) -> Optional[dict]:
        """Return the existing entry for this source_session_id, or None.

        Used as a per-session pre-flight before upload.
        """
        if not self.supports_lookup():
            return None
        try:
            resp = self._req(
                "GET", "/api/v1/team-knowledge/entries",
                params={"source_session_id": source_session_id, "limit": 1},
            )
        except ApiError:
            return None
        items = resp if isinstance(resp, list) else resp.get("items") or resp.get("entries") or []
        return items[0] if items else None

    def iter_existing_entries(self, page_size: int = 100) -> Iterator[dict]:
        """Paginate over the user's existing team knowledge entries.

        Used by seed_from_backend() to know what hooks already shipped.
        Tries cursor-style first, falls back to offset.
        """
        # Cursor-style
        cursor: Optional[str] = None
        for _ in range(10_000):  # hard cap, prevents accidental infinite loops
            params: dict = {"limit": page_size}
            if cursor:
                params["cursor"] = cursor
            try:
                resp = self._req("GET", "/api/v1/team-knowledge/entries", params=params)
            except ApiError as e:
                if e.status in (404, 405):
                    return
                raise
            items, next_cursor = self._extract_page(resp)
            if not items:
                return
            for item in items:
                yield item
            if not next_cursor or next_cursor == cursor:
                return
            cursor = next_cursor

    @staticmethod
    def _extract_page(resp) -> tuple[list[dict], Optional[str]]:
        if isinstance(resp, list):
            return resp, None
        items = resp.get("items") or resp.get("entries") or resp.get("results") or []
        next_cursor = resp.get("next_cursor") or resp.get("cursor") or resp.get("next")
        return items, next_cursor

    def post_with_retry(self, payload: dict, *, max_attempts: int = 4) -> tuple[Optional[int], bool]:
        """Wrap import_session with exponential backoff on 429/5xx."""
        delay = 1.0
        last_err: Optional[Exception] = None
        for attempt in range(1, max_attempts + 1):
            try:
                return self.import_session(payload)
            except ApiError as e:
                last_err = e
                if e.status == 429 or 500 <= e.status < 600:
                    time.sleep(delay)
                    delay = min(delay * 2, 30.0)
                    continue
                raise
            except Exception as e:
                last_err = e
                time.sleep(delay)
                delay = min(delay * 2, 30.0)
                continue
        if last_err:
            raise last_err
        return None, False
