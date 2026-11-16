# Verification

Run `npm test` and `npm run build`. Tests use isolated SQLite databases; HTTP tests
bind only to localhost. `tests/evidence_workflow.test.mjs` runs all five controlled
scenarios against production authentication, verifies exact evidence bytes/hashes,
role boundaries, notifications, PDF responses and database recovery after restart.
It also verifies persistent refresh rotation/replay revocation, TOTP invitations and
login lockouts. The input scenarios are fictional software fixtures, not real fraud
labels or model training records.

`tests/ml_inference.test.mjs` compares portable live model inference with actual sklearn
predictions over a deterministic sample of the public Elliptic graph. It checks Random
Forest, Logistic Regression and Isolation Forest numerically.

The pre-existing PostgreSQL draft tests in `tests/postgres-draft/` require an unfinished
separate backend and are not part of active SQLite coverage. Their module import
failures were recorded in the audit. The original `tests/e2e.mjs` browser script targets
historical seeded UI and is not evidence for the current production workflow. Live
Chrome verification is recorded separately in `docs/TEST_RESULTS.md`.
