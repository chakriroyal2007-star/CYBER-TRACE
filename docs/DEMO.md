# Three-minute SIH demonstration

Use the default fixture **CR-2026-00192**. All addresses, VASP labels, cases, flows, and scores in this demonstration are synthetic. Describe the product as an investigation intelligence layer, and describe attribution as a lead requiring verification.

## Before presenting

1. Open the application in a fresh browser session and enter Demo Mode. No government credentials are required or collected.
2. Check `/api/health`, then open the dashboard and default investigation.
3. Generate a PDF once to confirm the host's Python/ReportLab dependency works. If reports fail, use the deployment troubleshooting guide; do not substitute a screenshot for a PDF.
4. Leave the landing page open. Prepare a second tab with `/api/docs` for technical questions.

## Timed presentation

| Time | Action | Suggested explanation |
| --- | --- | --- |
| 0:00–0:20 | Landing page → Demo | “An investigator starts with a reported wallet. This system turns the complaint into an evidence graph, candidate VASP intelligence, and a reviewable evidence package.” |
| 0:20–0:40 | Dashboard → CR-2026-00192 | “This fictional investment-scam case reports ₹8,12,450. The dataset contains 47 transactions across 18 wallets and two chains.” |
| 0:40–1:05 | Run/replay trace; inspect the transaction graph | “TRACE follows the stored synthetic transfers. Select a wallet or transfer to inspect its evidence. The replay is labeled demo data.” |
| 1:05–1:25 | Inspect the bridge and destination wallet | “The graph connects Ethereum and Polygon through a synthetic bridge transfer. Cross-chain evidence is separately recorded.” |
| 1:25–1:45 | Open fingerprint and VASP attribution | “ATTRIBUTE ranks candidate endpoints. VASP-X receives 91% under the default weighted demo evidence model. Each contribution links back to evidence. This is not a calibrated probability or a legal finding.” |
| 1:45–2:05 | Review related complaints | “CORRELATE identifies shared network components across three other fictional complaints. Investigators can inspect the relationship and open each case.” |
| 2:05–2:25 | Ask TRACE AI why VASP-X is the strongest candidate | “The assistant answers from this case's stored evidence and cites its references. Unsupported questions return an insufficient-evidence response.” |
| 2:25–2:45 | Generate and open the PDF; prepare an information-request package | “ACT produces a timestamped report and a structured request package for authorized human review. The application sends nothing to a VASP.” |
| 2:45–3:00 | Review an alert; show new-investigation form | “The workflow includes alerts, case management, evidence review, and audit events. A judge can create a separate demo investigation and exercise the same pipeline.” |

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
