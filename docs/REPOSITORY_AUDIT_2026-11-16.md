# Repository audit and changes — November 16, 2026

The active application is Node/React/SQLite. It was not replaced with the unfinished
PostgreSQL implementation present in untracked files at the start of this task.

## Findings addressed

| Area | Finding | Change |
|---|---|---|
| Authentication | An invalid/expired token could create an officer session. Login could register an officer based on email text. Public registration accepted admin/supervisor roles. | Removed session revival and implicit registration; restricted public signup to citizen role; privileged accounts require local bootstrap or authenticated invitation. |
| Authentication persistence | Refresh tokens, lockouts and invitations were process-local. Rotated access tokens did not authenticate against SQLite. | SQLite-backed auth state; refresh updates the actual session token, rejects replay and revokes its family; invitation/TOTP workflow survives restart. |
| Scope | Complaint detail/actions were not consistently scoped; session revocation accepted other users' IDs. | Case permission check before each complaint action; session ownership check; reporter cannot import transfers or read internal runs. |
| Evidence | Citizen forms sent filenames/sizes without file bytes; hashes could be invented; metadata stripping changed originals. | Both forms upload bytes; intake rejects metadata-only attachments; SHA-256 covers original bytes; private storage and verified download. |
| Evidence claims | Antivirus and SMTP adapters reported success without doing scans/delivery. | Files explicitly NOT_SCANNED; production email delivery returns unavailable; in-app notifications remain real. |
| Investigation | Complaint analysis used generated tracing and LLM fallback findings. | Evidence-only persistent analysis using submitted transactions; unavailable ML remains unavailable. Legacy agent is gated to explicit demonstration mode. |
| DSA | Case-specific simulator built a generated graph unrelated to evidence. | Case analysis uses stored transfers; research/educational simulators remain separately available. |
| Risk | Research risk could be forced high/low from the known label; confidence intervals were invented. | Actual trained research outputs; no fitted calibration/CI claim; incident factors sum transparently and evidence limitations accompany the result. |
| ML UI | Embedded fallback metrics and confusion matrices could appear without any evaluation. | UI reads the actual reproducible evaluation and exposes all three trained models plus research prediction lookup. |
| Dashboard | Empty real workspaces displayed a static fictional priority case. | Production dashboard lists actual stored complaints; classroom scenarios have explicit fictional-input labels. |
| History | Analyses were not stored as immutable result snapshots. | Separate incident_analysis_runs table with UUID, actor, timestamp, input hash, edges, options-derived execution results; previous runs survive subsequent analysis. |
| Providers | Hard-coded Bitcoin confirmation count, inferred current timestamps, unconditional ONLINE health. | Missing confirmation count/timestamp stays unknown; provider reachability remains NOT_CHECKED until actually observed. |
| Recovery | New analysis foreign keys broke the legacy demo reset. | Demo-only reset removes dependent demo analysis rows; it is disabled outside explicit demo/test mode. |
| Deployment | Ephemeral serverless SQLite could be represented as permanent storage. | Reject Vercel startup without an explicit persistent DB_PATH; document durable storage requirements. |
| Repository hygiene | Local application secret and PostgreSQL data directory were unignored. | Ignore private service state; preserve all pre-existing untracked files. |

## DSA implementation and integration

`server/investigation/evidenceAnalysis.mjs` builds asset/network-isolated adjacency Maps
and visited Sets. It reuses the existing binary-heap PriorityQueue. BFS, multi-source
BFS, iterative DFS/cycle detection, weighted Dijkstra, Union-Find and timestamp sliding
windows execute on stored rows. Responses include visited node order/count, edge visits,
paths/distances, timing from performance.now(), time/space complexity, heap operation
counts and extracted transaction/graph/temporal/network features. UI replay uses those
recorded traversal orders. Costs default to 1; optional non-negative analyst costs
are explicitly identified and never presented as measured fees or probabilities.

## ML provenance and limitations

`server/ml/train_research.py` trains RF, scaled Logistic Regression and Isolation Forest
using the existing public Elliptic classes/edges, hashes both input files, excludes
157,205 unknown labels from supervised training, fixes seed 42, records train/test IDs,
and saves actual evaluation/models/predictions. Portable exported sklearn estimators execute live in JavaScript; a numerical parity test checks them against Python outputs. The six topology features require no
fabricated amounts or timestamps. The split is random/transductive: full graph topology
is visible, so this is not a time-disjoint or component-disjoint validation.

The full 165-feature Elliptic CSV is missing in this checkout. The older
`train_model.py` requires it and cannot reproduce the old static metrics without it.
Transaction, timestamp and network features are extracted from incident evidence;
there are no authentic UPI/account-takeover training labels here. BitcoinHeist was
reviewed as a ransomware-specific dataset and is not misrepresented as a UPI detector.

A score is triage, not a determination of guilt, ownership, statutory readiness or
calibrated confidence. Missing ML never becomes a made-up prediction. Classroom
examples are not used as ML training data. See `data/ml/evaluation.json` for the actual
limited performance, input hashes and reproducibility information.

## Preserved unfinished work

The initially untracked PostgreSQL draft tests imported nonexistent active-runtime
exports (`openDatabase`, `LiveProviders`, `createApplication`). Four failed import
before modifications. Those tests and their helper are preserved in
`tests/postgres-draft/`, outside the active SQLite suite. The other initially untracked
PostgreSQL sources, migrations, scripts and existing data remain available locally;
they were not silently turned into the active backend.

## Operational boundaries still requiring real infrastructure/data

No official NCRP/CBI/bank/UPI/VASP integration, ownership assertion, automatic statutory
notice dispatch, antivirus scan or SMTP delivery is claimed. Local durable storage
must be mounted/backed up in deployment. A local/classroom run is not a certification
of a law-enforcement production system. Dependency advisory retrieval was unreliable
in this environment; the install reported outstanding advisories, and a clean security
audit cannot be claimed. Live provider calls remain dependent on provider availability.
