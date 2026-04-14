#!/bin/bash
# Evols AI Plugin Installer
# Sets up hooks + MCP server for Claude Code
# Usage: bash install.sh

set -e

EVOLS_DIR="$HOME/.evols"
PLUGIN_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
CLAUDE_MCP_CONFIG="$HOME/.claude/claude_desktop_config.json"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       Evols AI — Team Intelligence Setup     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Collect config ──────────────────────────────────────────────

read -p "  Evols API URL (e.g. https://evols-backend-kdqer5oyua-uc.a.run.app): " API_URL
read -p "  Evols API Key: " API_KEY
read -p "  Your Claude plan (pro/max/team/enterprise) [pro]: " PLAN_TYPE
PLAN_TYPE=${PLAN_TYPE:-pro}

if [ -z "$API_URL" ] || [ -z "$API_KEY" ]; then
  echo "Error: API URL and API Key are required."
  exit 1
fi

# ── 2. Create directory structure ─────────────────────────────────

mkdir -p "$EVOLS_DIR/hooks"
mkdir -p "$EVOLS_DIR/mcp_server"

# ── 3. Copy plugin files ───────────────────────────────────────────

cp "$PLUGIN_SOURCE/hooks/"*.py "$EVOLS_DIR/hooks/"
cp "$PLUGIN_SOURCE/mcp_server/server.py" "$EVOLS_DIR/mcp_server/"
cp "$PLUGIN_SOURCE/mcp_server/requirements.txt" "$EVOLS_DIR/mcp_server/"
chmod +x "$EVOLS_DIR/hooks/"*.py
chmod +x "$EVOLS_DIR/mcp_server/server.py"

# ── 4. Write config ────────────────────────────────────────────────

cat > "$EVOLS_DIR/config.json" << EOF
{
  "api_url": "$API_URL",
  "api_key": "$API_KEY",
  "plan_type": "$PLAN_TYPE"
}
EOF
chmod 600 "$EVOLS_DIR/config.json"

# ── 5. Install Python dependencies ────────────────────────────────

echo ""
echo "  Installing Python dependencies..."
pip3 install -q mcp requests 2>/dev/null || \
  pip install -q mcp requests 2>/dev/null || \
  echo "  Warning: could not auto-install dependencies. Run: pip3 install mcp requests"

# ── 6. Register hooks in Claude Code settings ─────────────────────

mkdir -p "$HOME/.claude"

# Read existing settings or start fresh
if [ -f "$CLAUDE_SETTINGS" ]; then
  EXISTING=$(cat "$CLAUDE_SETTINGS")
else
  EXISTING="{}"
fi

# Write hooks config using Python (handles JSON merge safely)
python3 - << PYEOF
import json, sys

with open("$CLAUDE_SETTINGS", "r") as f if __import__("os").path.exists("$CLAUDE_SETTINGS") else open("/dev/null") as f:
    try:
        settings = json.load(f) if __import__("os").path.exists("$CLAUDE_SETTINGS") else {}
    except:
        settings = {}

hook_commands = {
    "SessionStart": [{"hooks": [{"type": "command", "command": "python3 $EVOLS_DIR/hooks/session_start.py"}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "python3 $EVOLS_DIR/hooks/user_prompt_submit.py"}]}],
    "PostToolUse": [{"hooks": [{"type": "command", "command": "python3 $EVOLS_DIR/hooks/post_tool_use.py"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "python3 $EVOLS_DIR/hooks/stop.py"}]}],
    "StopFailure": [{"hooks": [{"type": "command", "command": "python3 $EVOLS_DIR/hooks/stop.py --failure"}]}],
}

if "hooks" not in settings:
    settings["hooks"] = {}

for event, config in hook_commands.items():
    existing_hooks = settings["hooks"].get(event, [])
    # Remove any existing evols hooks
    existing_hooks = [h for h in existing_hooks if "evols" not in str(h)]
    existing_hooks.extend(config)
    settings["hooks"][event] = existing_hooks

with open("$CLAUDE_SETTINGS", "w") as f:
    json.dump(settings, f, indent=2)

print("  Hooks registered in ~/.claude/settings.json")
PYEOF

# ── 7. Register MCP server ─────────────────────────────────────────

python3 - << PYEOF
import json, os

mcp_config_path = "$CLAUDE_MCP_CONFIG"

if os.path.exists(mcp_config_path):
    with open(mcp_config_path) as f:
        try:
            config = json.load(f)
        except:
            config = {}
else:
    config = {}

if "mcpServers" not in config:
    config["mcpServers"] = {}

config["mcpServers"]["evols"] = {
    "command": "python3",
    "args": ["$EVOLS_DIR/mcp_server/server.py"]
}

os.makedirs(os.path.dirname(mcp_config_path), exist_ok=True)
with open(mcp_config_path, "w") as f:
    json.dump(config, f, indent=2)

print("  MCP server registered in ~/.claude/claude_desktop_config.json")
PYEOF

# ── 8. Done ────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║              Installation complete           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  Hooks active:   SessionStart, UserPromptSubmit, PostToolUse, Stop"
echo "  MCP tools:      get_team_context, sync_session_context, get_quota_status"
echo ""
echo "  Start a new Claude Code session to activate."
echo "  First session: team context loads automatically."
echo "  End of session: use /sync or the Stop hook syncs automatically."
echo ""
