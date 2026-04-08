#!/bin/bash

set -euo pipefail

TIMESTAMP="2026-03-25T11:00:00.976Z"
SIGNATURE="AkgwRQIhALxoUhnC/l73plPl90OUWxNGROOh2KQZ/qNONpeqfD9hAiAGVnCJJMDBG4/Jn+05Ji0yVldB0WSeTuqsUsomSj3jygEhAzkVQnlF6/V+HueVK6WmjJLDLRNhhsRrZt4YW/KPEwQv"
BTC_ADDRESS="bc1qlxufq0nuakyz53ac4e7yqsqtmzpscrlc6xtg0d"

curl -sS -X POST https://aibtc.com/api/heartbeat \
  -H "Content-Type: application/json" \
  --data-binary @- <<EOF
{"signature":"${SIGNATURE}","timestamp":"${TIMESTAMP}","btcAddress":"${BTC_ADDRESS}"}
EOF
