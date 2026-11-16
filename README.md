# CYBER-TRACE

An existing React/Node application extended with persistent citizen complaints,
evidence storage, real graph algorithm execution and reproducible Elliptic research
models. The current runtime uses SQLite. It is an educational investigation project,
not an official CBI service or a certified production law-enforcement system.

## Present the project

```sh
npm ci
npm run presentation
```

Open **http://localhost:8000/login** in Chrome. Use the isolated classroom account
printed in the terminal. Five fictional scenarios are prepared in a separate database:
UPI phishing/mules, crypto investment fraud, account takeover/rapid transfers,
layering/peeling, and connected complaints. They contain explicitly fictional inputs;
the graph algorithms actually execute and results/history are stored.

See [the presentation and viva guide](docs/PRESENTATION_GUIDE.md).

## Run with real submitted evidence

```sh
npm run build
ADMIN_EMAIL=your-admin@example.org ADMIN_PASSWORD='choose-a-strong-unique-password' node scripts/create-admin.mjs
NODE_ENV=production npm start
```

Use the citizen portal to register and submit complaints with actual file bytes.
Administrators invite investigators; open `/login?invite=TOKEN` to enroll with TOTP.
The investigator dashboard shows stored complaints. Open a dossier, import transaction
JSON, run analysis, inspect paths/visited nodes/complexity/timing, record findings,
update status, verify/download evidence, and download the latest analysis PDF.
Each analysis remains available in investigation history after reruns and restarts.

Transactions require `from`, `to`, `amount` (positive decimal string), `asset`,
`network`, `timestamp` (ISO) and `reference`. Optional non-negative `cost` supplies
Dijkstra's analyst-defined weight; default cost is one. Networks/assets are isolated.
Submitted records remain unverified until corroborated by independent evidence.

## Algorithms

The incident engine integrates BFS, DFS, directed cycle detection, Dijkstra,
Union-Find, a binary min-heap/priority queue, Map/Set indexes, sliding windows and
multi-source BFS. Responses show actual paths, visited order, node/edge counts,
heap operations, execution time and time/space complexity. Graph replay uses the
recorded traversal, and connected complaints are found by submitted identifiers.

## Machine learning

Pre-trained, compressed research outputs and portable sklearn model parameters are
included for offline use. The ML lab displays measured Random Forest, Logistic
Regression and Isolation Forest evaluation and can inspect research transaction
predictions through live portable inference. A parity test matches the portable computations to sklearn. No synthetic classroom input is used for training.

```sh
python3 -m venv .venv-ml
.venv-ml/bin/pip install -r server/ml/requirements.txt
.venv-ml/bin/python server/ml/train_research.py
```

The pipeline hashes the existing public Elliptic class/edge files, excludes unknown
labels from supervised training, uses seed 42, saves split IDs and records actual
metrics. The topology-only baseline uses a random transductive split; it is not a
future-time validation or a validated UPI fraud model. The complete original feature
CSV is absent. Missing amounts/timestamps/labels are never manufactured. Isolation
Forest scores are anomalies, not fraud probabilities. No accuracy or calibrated
confidence is assumed. See [actual evaluation](data/ml/evaluation.json).

## Verification and audit

```sh
npm test
npm run build
node scripts/check-doc-consistency.mjs
```

See [verification results](docs/TEST_RESULTS.md) and the
[repository audit](docs/REPOSITORY_AUDIT_2026-11-16.md). The suite includes five full
production-mode API workflows, evidence bytes/hash recovery, scoped investigator
access, saved findings/history, PDF downloads, model parity, refresh rotation,
lockouts, invitations and server restarts. Initially untracked PostgreSQL draft
tests are preserved separately in `tests/postgres-draft/`; they are not active-runtime
coverage.

## Storage and deployment

Set `DB_PATH` to SQLite on durable storage and `EVIDENCE_DIR` to a private persistent
directory. Back up both. Default local paths are `data/cryptotrace.sqlite` and
`data/evidence`. The classroom instance uses `data/presentation.sqlite` and never
replaces the main database. Do not deploy ephemeral serverless SQLite as permanent
storage. Demo authentication and generated legacy workflows require explicit
`DEMO_MODE=true` (or the isolated automated test environment).

No bank/UPI/NCRP/VASP integration, ownership conclusion, antivirus scan, SMTP delivery,
automatic legal notice or guaranteed fraud detection is claimed. In-app notifications
are real; provider outages and absent evidence must remain visible.

Sources: [Elliptic dataset paper](https://arxiv.org/abs/1908.02591),
[Elliptic dataset](https://www.kaggle.com/datasets/ellipticco/elliptic-data-set),
[UCI BitcoinHeist](https://archive.ics.uci.edu/dataset/526/bitcoinheist+ransomware+address+dataset).
BitcoinHeist is ransomware-specific and was not substituted for missing UPI labels.
Older design/demo documents describe historical work; the dated audit and verification
report define the current implementation and its limits.
