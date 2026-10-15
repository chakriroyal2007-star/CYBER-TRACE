# Verification

`npm test` runs real HTTP integration tests against a separately spawned server and an isolated temporary SQLite database. It verifies demo consistency, normalized case creation, session isolation, graph references, ingestion/idempotency, evidence scoring, grounded assistant citations, audit events, actual PDF contents, disclosed demo streaming, and persistence after process restart. The temporary database is removed when the suite finishes. `pdftotext` must be installed for PDF text verification.

`npm run build && npm run test:e2e` runs the browser workflow against an isolated local server. To test a deployment, set `TEST_BASE_URL=https://your-host.example` before running `npm run test:e2e`. This creates one clearly marked synthetic test investigation in its isolated demo session and verifies the complete judge workflow. Screenshots and the run summary are written to `tests/artifacts/`.

Browser tests use an installed `playwright` package, with the Codex runtime package location as a fallback. Install Playwright and Chromium in an ordinary checkout using `npm install --no-save playwright && npx playwright install chromium`.

The application exposes fictional data and deterministic inference. These tests validate software behavior and evidence consistency, not the accuracy of real-world blockchain attribution.
