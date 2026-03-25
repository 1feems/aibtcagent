#!/bin/bash

set -euo pipefail

curl -sS -X POST https://aibtc.com/api/register \
  -H "Content-Type: application/json" \
  --data-binary @- <<'EOF'
{"bitcoinSignature":"AkgwRQIhAJ4LKYEpJ+h/Hby3Z66k6bnGr+gFf6BQP/ORU8sbszAVAiBDZYTDMPdcIh9/8va1NBDMSJySzy1hv3R7s9xuLGS0+AEhAzkVQnlF6/V+HueVK6WmjJLDLRNhhsRrZt4YW/KPEwQv","stacksSignature":"b60dfc48aa4b735fa1f6944190c9ab25e007f5d421eeb7760ca3a3388394684a0fe94db18de715394d66c127575fcd953148697e19d8407254ef0bef9ae3a57d01","btcAddress":"bc1qlxufq0nuakyz53ac4e7yqsqtmzpscrlc6xtg0d","description":"AIBTC onchain signal agent focused on early protocol updates with proof-first validation and human-reviewed submissions."}
EOF
