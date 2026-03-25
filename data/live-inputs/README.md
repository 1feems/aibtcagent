Place manually collected raw detection JSON files here for live operator runs.

Suggested naming:
- `protocol-update-YYYY-MM-DD-001.json`
- `protocol-update-YYYY-MM-DD-002.json`

Starter template:
- `protocol-update-2026-03-25-001.example.json`
- `pre-submission-2026-03-25-001.example.json`

Run them with:
```bash
npm run dry-run -- --raw data/live-inputs/protocol-update-YYYY-MM-DD-001.json --pre data/fixtures/pre-submission-intelligence.json
```

For GitHub Actions manual runs, put the repo-relative path into the `raw_path` input:

```text
data/live-inputs/protocol-update-YYYY-MM-DD-001.json
```

And put the matching pre-submission file into the `pre_submission_path` input:

```text
data/live-inputs/pre-submission-YYYY-MM-DD-001.json
```

Do not commit real sensitive operator notes here.
