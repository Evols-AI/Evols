"""
Install endpoint — serves the evols CLI for download.
No auth required.

GET /api/v1/install/cli
  Downloads the evols Python CLI script (includes mcp-server subcommand).

GET /api/v1/install/script
  Returns the install.sh bootstrap script.
  Usage: curl -fsSL https://api.evols.ai/api/v1/install/script | sh
"""

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, PlainTextResponse

router = APIRouter()

CLI_DIR = Path("/app/cli")


@router.get("/cli", tags=["Install"])
async def download_cli():
    """Download the evols CLI script. No authentication required."""
    path = CLI_DIR / "evols"
    if not path.exists():
        raise HTTPException(status_code=503, detail="CLI not available in this deployment.")
    return Response(
        content=path.read_bytes(),
        media_type="text/x-python",
        headers={"Content-Disposition": 'attachment; filename="evols"'},
    )


@router.get("/script", response_class=PlainTextResponse, tags=["Install"])
async def install_script():
    """
    Bootstrap install script.
    Usage: curl -fsSL https://api.evols.ai/api/v1/install/script | sh
    """
    return r"""#!/bin/sh
set -e

EVOLS_DIR="$HOME/.evols"
BIN_DIR="$EVOLS_DIR/bin"
API_BASE="https://api.evols.ai/api/v1/install"

mkdir -p "$BIN_DIR"

echo "Downloading evols CLI..."
curl -fsSL "$API_BASE/cli" -o "$BIN_DIR/evols"
chmod +x "$BIN_DIR/evols"

# Add ~/.evols/bin to PATH if not already present
SHELL_RC=""
if [ "$(basename "$SHELL")" = "zsh" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ "$(basename "$SHELL")" = "bash" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
  if ! grep -q '\.evols/bin' "$SHELL_RC"; then
    printf '\n# Evols CLI\nexport PATH="$HOME/.evols/bin:$PATH"\n' >> "$SHELL_RC"
  fi
fi

export PATH="$BIN_DIR:$PATH"

echo ""
echo "evols installed successfully."
echo ""
echo "Next steps:"
echo "  evols login     — authenticate with your API key"
echo "  evols install   — wire MCP + hooks into all detected coding agents"
echo "  evols init      — inject team context into the current project"
echo ""
echo "Reload your shell or run: export PATH=\"\$HOME/.evols/bin:\$PATH\""
"""
