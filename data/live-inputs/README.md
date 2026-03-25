Place manually collected raw detection JSON files here for live operator runs.

Suggested naming:
- `protocol-update-YYYY-MM-DD-001.json`
- `protocol-update-YYYY-MM-DD-002.json`

Run them with:
```bash
npm run dry-run -- --raw data/live-inputs/protocol-update-YYYY-MM-DD-001.json --pre data/fixtures/pre-submission-intelligence.json
```

Do not commit real sensitive operator notes here.
