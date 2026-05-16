"""
Session knowledge extraction utilities — single source of truth.

Used by:
  - hooks/stop.py    (imported at runtime via sys.path)
  - evols CLI        (inlined verbatim in the single-file script)

Both code paths must stay identical. Edit this file first, then sync
the inlined copy in evols/cli/evols (search for "# ── Knowledge extraction").
"""

import json
import os
from typing import Optional

EVOLS_MCP_NAMES = {
    "mcp__evols__check_redundancy", "mcp__evols__get_relevant_context",
    "mcp__evols__sync_subtask_context", "mcp__evols__sync_session_context",
    "mcp__evols__get_team_context", "mcp__evols__get_work_context_summary",
    "mcp__evols__get_skill_details", "mcp__evols__simulate_persona_votes",
    "mcp__evols__get_personas", "mcp__evols__get_features",
    "mcp__evols__get_pain_points", "mcp__evols__get_metrics",
    "mcp__evols__link_to_product",
}


def is_worthwhile_transcript(transcript_text: str, total_tokens: int) -> bool:
    """
    Quick non-LLM filter to skip noise before paying for LLM extraction.

    Rejects:
    - Sessions under 800 tokens (nothing happened)
    - No real user prompt (all one-word commands)
    - Sessions consisting entirely of Evols MCP overhead calls
    - Total assistant output under 300 chars (trivial Q&A)
    """
    if total_tokens < 800:
        return False

    lines = transcript_text.split("\n")
    user_lines = [l for l in lines if l.startswith("User:")]
    tool_lines = [l for l in lines if l.startswith("Tool:")]
    assistant_lines = [l for l in lines if l.startswith("Assistant:")]

    has_real_prompt = any(len(l) > 20 for l in user_lines)
    if not has_real_prompt:
        return False

    # Sessions that only called Evols MCP tools are overhead, not real work
    if tool_lines:
        non_evols = [
            l for l in tool_lines
            if not any(name in l for name in EVOLS_MCP_NAMES)
        ]
        if not non_evols:
            return False

    # Require at least 300 chars of substantive assistant output
    assistant_output_chars = sum(
        max(0, len(l) - len("Assistant: ")) for l in assistant_lines
    )
    if assistant_output_chars < 300:
        return False

    return True


_EXTRACTION_PROMPT = """You are extracting team knowledge from an AI session transcript.

Given the session below, extract a knowledge entry with:
- title: one-line description of what was accomplished (max 80 chars)
- content: problem statement, approach taken, key decisions, outcome (3-8 sentences)
- entry_type: one of: insight, decision, artifact, research_finding, pattern, context
- tags: 2-5 comma-separated keywords
- product_area: the product/code area affected (or empty string)

If the session is trivial (e.g. just questions, no real work done), respond with: SKIP

Session:
{transcript}

Respond ONLY with a JSON object with keys: title, content, entry_type, tags, product_area"""


def _parse_extraction_response(raw: str) -> Optional[dict]:
    """Parse LLM JSON response into extraction dict, stripping code fences."""
    try:
        text = raw.strip()
        if text == "SKIP" or not text:
            return None
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1].lstrip("json").strip() if len(parts) >= 2 else text
        return json.loads(text)
    except Exception:
        return None


def _try_apple_foundation_models(prompt: str) -> Optional[dict]:
    """
    Extract using Apple Intelligence Foundation Models (macOS 26+ / Darwin 25+).
    Requires Apple Silicon + Apple Intelligence enabled.
    Uses a temp Swift file with prompt passed via env var to avoid escaping issues.
    """
    import platform
    import subprocess
    import tempfile

    if platform.system() != "Darwin":
        return None

    # Foundation Models requires Darwin 25+ (macOS 26)
    try:
        major = int(platform.release().split(".")[0])
        if major < 25:
            return None
    except Exception:
        return None

    swift_code = """
import FoundationModels
import Foundation

let promptText = ProcessInfo.processInfo.environment["EVOLS_PROMPT"] ?? ""
guard !promptText.isEmpty else { exit(0) }

let session = LanguageModelSession()
guard await session.availability == .available else { exit(0) }

do {
    let response = try await session.respond(to: promptText)
    print(response.content)
} catch {
    exit(1)
}
"""
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".swift", mode="w", delete=False) as f:
            f.write(swift_code)
            tmp = f.name
        env = os.environ.copy()
        env["EVOLS_PROMPT"] = prompt
        result = subprocess.run(
            ["swift", tmp],
            capture_output=True, text=True, timeout=20, env=env,
        )
        raw = result.stdout.strip()
        if not raw:
            return None
        return _parse_extraction_response(raw)
    except Exception:
        return None
    finally:
        if tmp:
            try:
                os.unlink(tmp)
            except Exception:
                pass


def _try_phi_silica(prompt: str) -> Optional[dict]:
    """
    Extract using Phi Silica — the stock on-device LLM on Windows 11 Copilot+ PCs.
    Phi Silica is built into Windows 11 (NPU-accelerated, no install required).
    Requires: Windows 11 Build 26100+ with Windows App SDK 1.6+.
    Uses a temp C# script to call the WinRT Microsoft.Windows.AI.Generative API.
    """
    import platform
    import subprocess
    import tempfile

    if platform.system() != "Windows":
        return None

    csharp_code = r"""
using System;
using System.Threading.Tasks;
using Microsoft.Windows.AI.Generative;

class EvolsExtract {
    static async Task Main() {
        string promptText = Environment.GetEnvironmentVariable("EVOLS_PROMPT") ?? "";
        if (string.IsNullOrEmpty(promptText)) return;

        if (!LanguageModel.IsAvailable()) return;

        using var model = await LanguageModel.CreateAsync();
        var result = await model.GenerateResponseAsync(promptText);
        Console.Write(result.Response);
    }
}
"""
    tmp_cs = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".cs", mode="w", delete=False, encoding="utf-8") as f:
            f.write(csharp_code)
            tmp_cs = f.name

        env = os.environ.copy()
        env["EVOLS_PROMPT"] = prompt

        # dotnet-script allows running a .cs file directly if installed;
        # fall back to compiling with csc if not available.
        result = subprocess.run(
            ["dotnet-script", tmp_cs],
            capture_output=True, text=True, timeout=30, env=env,
        )
        if result.returncode != 0:
            # Try csc (ships with .NET SDK / Visual Studio)
            exe = tmp_cs.replace(".cs", ".exe")
            compile_result = subprocess.run(
                ["csc", f"/out:{exe}", tmp_cs],
                capture_output=True, text=True, timeout=15,
            )
            if compile_result.returncode != 0:
                return None
            result = subprocess.run(
                [exe], capture_output=True, text=True, timeout=30, env=env,
            )

        raw = result.stdout.strip()
        if not raw:
            return None
        return _parse_extraction_response(raw)
    except Exception:
        return None
    finally:
        if tmp_cs:
            try:
                os.unlink(tmp_cs)
            except Exception:
                pass


def build_structured_payload(
    extracted: dict,
    *,
    source_session_id: str,
    session_tokens_used: int = 0,
    files_read: Optional[list] = None,
    files_modified: Optional[list] = None,
    model: Optional[str] = None,
    source: str = "unknown",
    discovery_tokens: Optional[int] = None,
) -> dict:
    """
    Convert an extracted knowledge dict into a POST-ready payload for
    /api/v1/team-knowledge/entries.

    Pure data transformation — no I/O. The caller decides whether and how to POST.
    """
    tags_raw = extracted.get("tags", "")
    tags = (
        [t.strip() for t in tags_raw.split(",") if t.strip()]
        if isinstance(tags_raw, str)
        else (tags_raw or [])
    )
    payload: dict = {
        "title": extracted.get("title") or "Untitled session",
        "content": extracted.get("content", ""),
        "role": "other",
        "session_type": "code",
        "entry_type": extracted.get("entry_type") or "insight",
        "tags": tags,
        "product_area": extracted.get("product_area") or None,
        "source_session_id": source_session_id,
        "session_tokens_used": session_tokens_used,
        "files_read": files_read or [],
        "files_modified": files_modified or [],
        "model": model or None,
        "source": source,
    }
    if discovery_tokens:
        payload["discovery_tokens"] = discovery_tokens
    return payload


def try_local_llm_extraction(transcript_text: str) -> Optional[dict]:
    """
    Try to extract knowledge using a stock on-device LLM, in priority order:
    1. Apple Intelligence Foundation Models (macOS 26+ / Darwin 25+, Apple Silicon)
    2. Phi Silica (Windows 11 Copilot+ PCs, no install required)
    Returns extracted dict or None if nothing is available locally;
    caller falls back to server-side extraction.
    """
    prompt = _EXTRACTION_PROMPT.format(transcript=transcript_text[:4000])

    result = _try_apple_foundation_models(prompt)
    if result:
        return result

    return _try_phi_silica(prompt)
