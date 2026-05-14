"""
evols_sync — historical session backfill + hook reconciliation for Evols CLI.

Public entry points used by the main `evols` CLI:
  - run_sync(opts)      — `evols sync` one-shot
  - daemon_install(...) / daemon_uninstall(...) / daemon_run(...) / daemon_status(...)
  - doctor()            — diagnostics for `evols status` / `evols daemon doctor`

See evols/cli/DAEMON_DESIGN.md for the full design.
"""

from .runner import run_sync, SyncOptions  # noqa: F401
from .daemon import (  # noqa: F401
    daemon_install,
    daemon_uninstall,
    daemon_run,
    daemon_status,
    daemon_logs,
)
from .doctor import doctor  # noqa: F401
