# Quantitative Claims & Verification Evidence Map

In compliance with the **Honesty Principle**, every quantitative claim made across CYBER-TRACE documentation, presentations, and UI displays is mapped below to the exact command, automated test, or dataset artifact that establishes it.

| Claim | Claimed Value | Evidence / Command / Artifact | Location in Codebase |
| :--- | :--- | :--- | :--- |
| **Automated Test Count** | 102 passing tests across 8 suites | Command: `npm test`<br>Verified run output logged in `docs/TEST_RESULTS.md` | `tests/*.test.mjs` |
| **Elliptic Dataset Total Nodes ($V$)** | 203,769 transactions | File: `data/elliptic/elliptic_txs_classes.csv`<br>Verified by `tests/elliptic_api.test.mjs` | `server/dataset/ingestion.mjs` |
| **Elliptic Dataset Total Edges ($E$)** | 234,355 directed edges | File: `data/elliptic/elliptic_txs_edgelist.csv`<br>Verified by `tests/elliptic_api.test.mjs` | `server/dataset/ingestion.mjs` |
| **Elliptic Feature Dimensions** | 165 floating-point features | File: `data/elliptic/elliptic_txs_features.csv`<br>Verified by offset seeker in `server/dataset/ingestion.mjs` | `data/elliptic/features_offsets.json` |
| **Elliptic Time Steps** | 49 discrete steps | Verified by `tests/elliptic_api.test.mjs` | `server/dataset/ingestion.mjs` |
| **Known Illicit Count** | 4,545 ground-truth class '1' | Label count in `elliptic_txs_classes.csv`<br>Verified by `tests/elliptic_api.test.mjs` | `server/dataset/ingestion.mjs` |
| **Known Licit Count** | 42,019 ground-truth class '2' | Label count in `elliptic_txs_classes.csv`<br>Verified by `tests/elliptic_api.test.mjs` | `server/dataset/ingestion.mjs` |
| **Unlabeled Transaction Count** | 157,205 transactions | Label count in `elliptic_txs_classes.csv`<br>Treated strictly as unverified (never licit) | `server/dataset/ingestion.mjs` |
| **Train/Test Temporal Split** | Train: Steps 1–34 (29,894 samples)<br>Test: Steps 35–49 (16,670 samples) | Time-aware split avoiding temporal leakage<br>Verified by `tests/elliptic_api.test.mjs` | `server/ml/riskEngine.mjs` |
| **Random Forest PR-AUC** | 0.7805 on holdout steps 35–49 | Benchmark evaluation against minority class ($6.5\%$ base rate)<br>Verified by `GET /api/analytics/model-eval` | `server/ml/riskEngine.mjs` |
| **Random Forest ROC-AUC** | 0.9254 on holdout steps 35–49 | Verified by `GET /api/analytics/model-eval` and `tests/elliptic_api.test.mjs` | `server/ml/riskEngine.mjs` |
| **Random Forest F1-Score** | 0.7538 on holdout steps 35–49 | Verified by `GET /api/analytics/model-eval` | `server/ml/riskEngine.mjs` |
| **Random Forest Precision** | 78.31% (787 TP / 1,005 predicted illicit) | Verified by `GET /api/analytics/model-eval` | `server/ml/riskEngine.mjs` |
| **Random Forest Recall** | 72.67% (787 TP / 1,083 actual illicit) | Verified by `GET /api/analytics/model-eval` | `server/ml/riskEngine.mjs` |
| **Random Forest FPR** | 1.40% (218 FP / 15,587 actual licit) | Verified by `GET /api/analytics/model-eval` | `server/ml/riskEngine.mjs` |
| **Flagship Case CR-2026-00192 Loss** | ₹8,12,450 reported loss | Verified by `tests/api.test.mjs` | `server/db.mjs` (`SEED_CASES`) |
| **Flagship Traced Exit Value** | ₹6,42,000 terminal exit | Verified by `tests/analytics.test.mjs` and `tests/api.test.mjs` | `server/db.mjs` (`SEED_CASES`) |
| **Flagship Residual Balance** | ₹1,70,450 | Verified: ₹6,42,000 + ₹1,70,450 = ₹8,12,450 (100% money conservation) | `server/analytics.mjs` |
| **Attribution Weights Sum** | 100% (25+20+15+15+10+10+5) | Verified by `tests/analytics.test.mjs` | `server/analytics.mjs` |
| **Flagship Attribution Score** | 91% candidate association (VASP-X) | Verified by `tests/analytics.test.mjs`<br>*Marked as synthetic illustrative lead, not guilt* | `server/analytics.mjs` |
| **DSA Traversal Complexity** | BFS/DFS: $O(V+E)$<br>Dijkstra: $O((V+E)\log V)$<br>Union-Find: $O(\alpha(V))$ | Algorithmic implementation verified by `tests/elliptic_graph.test.mjs` | `server/graph/algorithms.mjs` |
| **Address Interning Mapping** | 32-bit integer IDs with bidirectional lookup | Verified by `tests/real_tracer.test.mjs` | `server/graph/tracingCore.mjs` |
| **Bloom Filter False Negative Rate** | 0.00% empirical false negatives | Verified by `tests/real_tracer.test.mjs` | `server/graph/tracingCore.mjs` |

---

## Verifiability Protocol
To independently verify all quantitative claims on any workstation:
1. Run `npm test` to verify all 102 test cases pass.
2. Query `curl -s http://localhost:8000/api/dataset/stats` to verify node, edge, and label counts.
3. Query `curl -s http://localhost:8000/api/analytics/model-eval` to inspect the exact confusion matrix and evaluation metrics.
