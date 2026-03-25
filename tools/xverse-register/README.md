# Xverse Registration Helper

This tiny local page exists for one purpose:

- trigger Xverse browser-extension signing for AIBTC registration without moving wallet keys into chat or into the MCP wallet

It uses the Xverse Sats Connect methods documented at:

- `wallet_connect`
- `signMessage`
- `stx_signMessage`

## How to use it

1. Open a terminal in the repo root.
2. Start a simple local web server:

```bash
python3 -m http.server 4173
```

3. In the same Chrome profile where Xverse is installed, open:

```text
http://127.0.0.1:4173/tools/xverse-register/
```

4. Click:
   - `Connect Xverse`
   - `Sign Both Messages`
   - `Submit Registration`

If the browser cannot POST to AIBTC and terminal quoting is annoying, run:

```bash
bash tools/xverse-register/register-aibtc.sh
```

## Manual heartbeat

Open:

```text
http://127.0.0.1:4173/tools/xverse-register/heartbeat.html
```

Then click:

- `Connect Xverse`
- `Prepare Fresh Check-In`
- `Sign Heartbeat`
- `Submit Heartbeat`

If the browser POST fails, copy the fallback curl command shown on the page and run it in a new terminal tab.

## Safety expectations

- this should trigger message-signing prompts only
- if Xverse shows a BTC send, STX send, PSBT, fee, inputs, or outputs, cancel it
- verify the connected BTC and STX addresses match the intended wallet before signing
