#!/bin/bash
set -euo pipefail

HELPER_URL="http://127.0.0.1:4173/tools/xverse-register/heartbeat.html"
TITLE="AIBTC heartbeat reminder"
MESSAGE="Keep the streak alive. Open the heartbeat helper and check in today."

if command -v osascript >/dev/null 2>&1; then
  /usr/bin/osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\"" || true
fi

echo "$TITLE"
echo "$MESSAGE"
echo "$HELPER_URL"
