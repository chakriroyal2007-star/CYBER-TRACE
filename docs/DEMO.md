# Five-Minute Investigation & Judge Walkthrough

Use the flagship case **CR-2026-00192** or file a new case live. In alignment with the **Honesty Principle**, all fiat bank segments are clearly labeled `SYNTHETIC_ILLUSTRATIVE` and on-chain hops indicate public explorer verifiability. Risk scores are probabilistic leads, not proof of guilt.

## Walkthrough Flow (5 Minutes)

| Time | Flow Stage | Action & Screen | What Judges See & Why It Matters |
| :--- | :--- | :--- | :--- |
| **0:00–0:45** | **1. Reporter Filing** | Citizen Portal (`/portal` or `/app/incoming`) | Citizen enters payment details (UPI VPA, UTR, loss amount ₹8,12,450) and uploads payment proof with SHA-256 integrity hash. Linkage detection pre-screens duplicate beneficiary accounts. |
| **0:45–1:30** | **2. Officer Inbox & Intake** | Officer Console (`/app/dashboard`, `/app/incoming`) | Investigating Officer claims case. Sequential Case ID `CR-2026-00192` assigned. SLA timer starts; officer requests proof or reviews uploaded attachments. |
| **1:30–2:30** | **3. Multi-Hop Chain Reconstruction** | Investigation Workspace (`/app/investigations/CR-2026-00192` & `/app/graph`) | Interactive horizontal staged graph: Victim → Beneficiary Mule (Hop 1) → Layering Mule (Hop 2) → Exchange/Bridge (Hop 3) → Terminal VASP-X Exit. GAPs explicitly highlight where legal records from Bank/Exchange are required. |
| **2:30–3:15** | **4. AI Forensic Risk & Explainability** | TRACE AI & Risk Engine (`/app/investigations/CR-2026-00192`) | Calibrated composite risk score (88/100) broken down into 5 factors: rapid velocity, layering depth, exchange exit proximity, syndicate clustering, and evidence completeness. TRACE AI answers with verifiable citations. |
| **3:15–4:00** | **5. DSA Explainability on Real Graph** | DSA Study Studio (`/app/dsa-studio`) | Visualizes the exact algorithm that solved each problem: Dijkstra weighted path, BFS hop expansion, Union-Find connected components, and Min-Heap Top-K ranking, complete with live distance tables and disjoint sets. |
| **4:00–4:30** | **6. Machine Learning Benchmark Lab** | ML Benchmark Lab (`/app/ml-lab`) | Holdout test evaluation (Steps 35–49) of Random Forest vs Logistic Regression on the Elliptic Bitcoin dataset: PR-AUC 0.7805, 1.4% false positive rate, confusion matrix, and feature importances. |
| **4:30–5:00** | **7. Sealed Report & Freeze Request** | Reports & Information Requests (`/app/reports`, `/app/requests`) | Generates tamper-resistant, SHA-256 sealed forensic PDF report and formal Section 91 Cr.P.C. / Section 94 BNSS Information Request & Section 102 Cr.P.C. Freeze Request package (marked "Draft for Legal Review"). |

---

## Technical Proof Points for Judges

1. **Zero Hallucination Guarantee:** If an algorithm or evidence cannot find a link, a visible GAP node appears requiring human nodal officer disclosure. The system never invents fake bank records.
2. **Data Structure Rigor:** Step-by-step state inspection demonstrates priority queues, disjoint set union, and sliding window burst detection on real case graphs.
3. **Provable Machine Learning:** Models are trained on a time-aware split to prevent data leakage, optimizing for PR-AUC on an extreme class imbalance (6.5% illicit base rate).
4. **Legal Compliance:** Output packages map legacy Cr.P.C. sections to BNSS 2023 equivalents with immutable SHA-256 hashes.

## Additional judge checks

- Use Ctrl/Cmd+K to open search or jump to a page.
- Search an address copied from a graph node, a case ID, or a transaction hash.
- Select graph edges, zoom, pan, and inspect the associated amount and timestamp.
- Change a case status and mark an alert Reviewed; refresh to confirm persistence.
- Create an investigation using a valid synthetic address. This creates a demonstration flow; it does **not** fetch that address's real history.
- Open the privacy-exposure case. It should lower tracing confidence rather than claim mixer deanonymization.
- Change attribution evidence weights in Settings, then retrace to see their effect.
- Check Data Sources. NCRP, SAHYOG, and VASP request components are integration adapters; no official API is connected.

## Questions to answer accurately

**Is this live blockchain monitoring?** No. The current build uses deterministic synthetic investigation data and a labeled demo event stream.

**Is 91% a verified probability that VASP-X owns a wallet?** No. It is an explainable weighted evidence score in the demonstration dataset; VASP-X is fictional.

**Does this identify a criminal or retrieve exchange KYC?** No. It supports investigation and evidence review. Identity and legal conclusions require authorized processes outside the application.

**Is TRACE AI an externally connected language model?** No. It is a deterministic, case-grounded answer service. It does not invent or retrieve external evidence.

**Can real complaints be uploaded to the public demo?** No. The public demo is a synthetic sandbox. Use fictional complaint details only.

**How is this differentiated?** By the proposed complaint-centered combination of trace, explainable attribution, cross-complaint correlation, actionable-exit prioritization, and a standardized investigation package. Individual blockchain analytics capabilities are established industry techniques.

**Is this an operational government system?** No. It is an SIH-style prototype with integration-ready boundaries, not an approved NCRP/SAHYOG deployment.
