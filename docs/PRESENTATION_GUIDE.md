# CYBER-TRACE classroom presentation — November 17, 2026

Start with `npm run presentation`. Keep the terminal open. Open http://localhost:8000/login
in Chrome and use the classroom account printed in the terminal. Its private credentials
are also in `data/presentation-access.json` (ignored by Git). This uses a separate SQLite
database and never replaces the main case database. Re-running preserves findings and
analysis history. Changed classroom transaction definitions append a new analysis run.

## A 10-minute demonstration

1. **Dashboard (one minute).** Show five scenario cards, persistent complaint IDs, and
   stored analysis counts. Explain: classroom transactions are fictional inputs;
   algorithms really execute. Elliptic model outputs come from actual training.
2. **UPI phishing (one minute).** Open the case. Show victim → mule-a → mule-b → collector.
   Explain BFS's queue, HashSet for visited accounts and HashMap for adjacency/parents.
   Replay each visited node using **Next node**. Expand **Multi-hop path**.
3. **Crypto investment (one minute).** Compare BFS's 2-hop shortcut with Dijkstra's
   3-hop route. The shortcut has an explicitly assigned classroom cost of 10; other
   edges cost 1. Dijkstra minimizes non-negative cost, BFS minimizes hops. Show actual
   heap push/pop counts in execution details. These costs are teaching inputs, not
   estimated fraud probabilities or transaction fees.
4. **Account takeover (one minute).** Show branching/convergence and five transfers in
   the five-minute sliding window. Explain that transaction patterns cannot establish
   account takeover without authentication/device evidence.
5. **Layering/peeling (one minute).** Show the four-hop path, small peeled outputs, DFS
   traversal and directed cycle detection. Show Union-Find connected components.
6. **Connected complaints (one minute).** Expand connected complaints. The account
   takeover and common-network examples share submitted identifiers. Show multi-source
   BFS from two victims, merging at a common mule. Shared identifiers are leads, not
   legal proof of a common criminal owner.
7. **ML Benchmark Lab (two minutes).** Show Random Forest, Logistic Regression and
   Isolation Forest evaluation. Click **Inspect model prediction** on research node
   `232629023`, then `232438397`. Show live exported RF/LR model outputs and Isolation Forest anomaly
   score. Explain that an anomaly score is not a probability; dataset labels do not
   override predictions. This is a topology-only research baseline with limited
   performance, not a validated UPI fraud detector. Do not claim the old 78% PR-AUC.
8. **Persistence and report (two minutes).** Add an internal finding, run another
   analysis, select the older run, download a PDF, reload the page and show retained
   history. A citizen's case tracking page excludes internal findings. The automated
   tests additionally stop/restart the server and verify database/evidence recovery.

## Likely viva questions

| Question | Answer |
|---|---|
| Why both BFS and Dijkstra? | BFS gives fewest hops; Dijkstra gives minimum non-negative weighted cost. |
| What powers the priority queue? | A binary min-heap: O(log n) insertion/removal, O(1) peek. |
| How does cycle detection work? | Iterative DFS tracks unvisited, active and finished nodes; an edge to an active node indicates a directed cycle. |
| Why Union-Find? | It groups weakly connected components with path compression and union by rank; connectivity is not ownership. |
| Why HashMap and HashSet? | Adjacency/parent lookup and duplicate/visited membership use expected O(1) operations. |
| Sliding-window complexity? | O(E log E) to sort timestamps plus an O(E) two-pointer scan. |
| What is multi-source BFS? | Enqueue several sources at distance zero and visit the nearest reachable layer from any source. |
| How is risk explained? | Sum the displayed graph contributions, optionally plus an explicitly associated research prediction. Missing ML stays unavailable. The score is uncalibrated triage. |
| What prevents lost complaints? | SQLite WAL, atomic complaint/evidence metadata creation, durable file bytes, persistent sessions and append-only analysis runs. Backups still require operational setup. |
| Why not apply Elliptic to any UPI ID? | Elliptic nodes are anonymized Bitcoin transactions; bank/UPI identities and training labels are different data domains. |

## Commands

```sh
npm run presentation       # builds, prepares isolated classroom cases, starts localhost server
npm test                   # active SQLite regression suite (includes five production API workflows)
npm run build              # TypeScript + production bundle
python3 -m venv .venv-ml
.venv-ml/bin/pip install -r server/ml/requirements.txt
.venv-ml/bin/python server/ml/train_research.py
```

The saved compressed research predictions are included so the presentation works offline.
Training can be repeated; input SHA-256 hashes, split IDs, seed and measured evaluation
are saved under `data/ml`. Do not rely on live blockchain providers or external AI
services for the classroom presentation. No marks or model accuracy are guaranteed.
