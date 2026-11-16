# Verification results — November 16, 2026

**Total Tests:** 165
**Passed:** 165
**Failed:** 0
**Skipped:** 0

Command: `npm test` (`node --test tests/*.test.mjs`). Final recorded full-suite run:
24 top-level test groups, 8 suites, 165 tests, 7.274 seconds. Node v22.23.2, macOS arm64.
These are software correctness tests, not a measurement of fraud-detection accuracy.

Additional checks:

- `npm run build`: TypeScript and Vite production build passed.
- `node scripts/check-doc-consistency.mjs`: documentation paths, input dataset hashes,
  model/evaluation run identity and measured confusion-matrix sample counts passed.
- Production-only workflow test: 8/8 tests, including all five scenario subtests,
  exact evidence bytes/SHA-256, access boundaries, investigator queue/dashboard,
  notifications, connected complaints, immutable analysis runs, private findings,
  PDF responses and server restart recovery.
- Authentication recovery: invitation/TOTP enrollment, lockouts and refresh-token
  rotation survive restart; reused refresh tokens revoke the token family.
- Model parity: portable RF, Logistic Regression and Isolation Forest inference
  matches sklearn outputs to absolute tolerance 1e-10 on 205 deterministically
  sampled Elliptic nodes. No model score is forced from its known dataset label.
- Weighted path test: BFS takes a 2-edge shortcut; Dijkstra selects a cheaper 3-edge
  route. Negative costs, unknown sources/targets, duplicate rows and invalid amounts
  are rejected. Directed cycles, multi-source distances and asset boundaries are tested.

## Live Chrome verification

The project was started on localhost using a separate classroom database. Verified:

1. Normal investigator sign-in and persistence across server restart.
2. Dashboard displays five separately selectable classroom scenarios.
3. Layering case shows the four-hop BFS path and actual algorithm timings/complexities.
4. **Next node** updates traversal replay from 0/7 to 1/7 recorded visits.
5. ML lab executes all three exported models. For research node `232629023`, the live
   run displayed RF probability 52.73%, LR probability 50.31%, Isolation Forest anomaly
   score -0.0731, and live inference timing. Values are research outputs, not incident
   accuracy or proof of wrongdoing.
6. Generated PDF was opened/rendered in Chrome. A Greek-font problem in Union-Find
   complexity text was fixed to readable `alpha(V)` and the PDF was rendered again.
   Paths, input hash, risk factors, limitations and exact transaction amounts fit on
   the inspected page without clipping. Historical run selection now selects the
   corresponding report instead of silently downloading a different run.

Proof screenshots: [dashboard](screenshots/live-dashboard.png),
[DSA execution](screenshots/live-dsa.png), [model inference](screenshots/live-ml.png),
[rendered PDF](screenshots/live-pdf.png).

## ML evaluation

See `data/ml/evaluation.json` for exact measured metrics, split IDs/hashes and run ID.
The topology-only Random Forest holdout F1 is approximately 0.244 and PR-AUC 0.156.
These limited results are reported honestly. This is a random/transductive graph
baseline; it is not a reproduction of the historical full-feature time-split benchmark.
No validated UPI/account-takeover classifier is available. Unknown labels were excluded
from supervised training, and classroom scenarios were never used as training data.

## Exclusions and remaining limits

Four initially untracked PostgreSQL draft test modules failed import in the baseline
because their expected backend exports do not exist. They and their helper are
preserved locally in `tests/postgres-draft/`, outside active SQLite coverage. They are
not counted as passing or as verified PostgreSQL support. Existing historical browser
scripts target older demo UI and are not the basis of the current Chrome claims.

The first dependency install attempt reported npm advisories; a later advisory query
failed with a network/socket error. No clean dependency-security audit is claimed.
No production deployment, official bank/UPI/CBI integration, antivirus scan, SMTP
notification or real ownership attribution was verified. In-app notification delivery
and local durable storage/restart behavior were verified.
