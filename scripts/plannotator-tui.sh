#!/usr/bin/env bash
# Run the bundled plannotator-tui, or say clearly why it cannot run. Herdr invokes this for
# the review pane and actions with cwd = plugin root.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -x bin/plannotator-tui ]; then
  exec bin/plannotator-tui "$@"
fi
msg="plannotator-tui is not installed. Reinstall the plugin: herdr plugin install plannotator/herdr-annotate"
echo "$msg" >&2
if [ -n "${HERDR_BIN_PATH:-}" ]; then
  "$HERDR_BIN_PATH" notification show "Annotate: review pane unavailable" --body "$msg" >/dev/null 2>&1 || true
fi
exit 1
