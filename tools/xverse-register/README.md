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

## Safety expectations

- this should trigger message-signing prompts only
- if Xverse shows a BTC send, STX send, PSBT, fee, inputs, or outputs, cancel it
- verify the connected BTC and STX addresses match the intended wallet before signing
