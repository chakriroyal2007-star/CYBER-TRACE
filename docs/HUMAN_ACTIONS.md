# Human Actions & External Dependencies Register

In strict alignment with the **Honesty Principle**, CYBER-TRACE never fabricates institutional authority, legal execution, or live operational access. The following items require formal human intervention, legal review, or organizational agreements before operational field deployment.

---

## 1. Legal & Statutory Review

| Action | Current Prototype Status | Required Human / Authority Action |
| :--- | :--- | :--- |
| **Section 91 Cr.P.C. / Section 94 BNSS Notice Package** | System generates structured draft PDF & JSON packages with statutory notice templates. | **Legal review required:** An authorized public prosecutor or legal officer must review and sign draft notices before formal dispatch to banks or VASPs. Marked **"Draft for Legal Review"**. |
| **Section 102 Cr.P.C. / Section 106 BNSS Freeze & Lien Requests** | Platform prepares structured requisition and tracks status (Draft → Approved → Sent → Response). | **Judicial / Police mandate:** Only an authorized Investigating Officer (IO) or Magistrate can order account freezing. Platform never claims automatic freezing. |
| **PMLA 2002 & IT Act 2000 Statutory Citations** | Cited in risk reasoning and investigative summaries as legal references. | **Judicial appreciation:** Legal counsel must confirm applicable sections for formal charge-sheeting. |

---

## 2. Institutional Interfaces & Integration Agreements

| Institution / Service | Current Prototype Status | Required Human / Authority Action |
| :--- | :--- | :--- |
| **National Cybercrime Reporting Portal (NCRP)** | NCRP adapter interface defined; no live API connected. | Formal Memorandum of Understanding (MoU) with Indian Cybercrime Coordination Centre (I4C) / MHA to obtain official API credentials. |
| **CFCFRMS / Citizen Financial Cyber Fraud Reporting Management System** | Mock interface boundary defined. | Official integration provisioning with NPCI / state cyber cells. |
| **Bank Nodal Officers & UPI Gateways** | Accepts manual or uploaded statement responses (marked `INSTITUTION_RESPONSE`). | Direct liaison with nodal officers across public/private banks. |
| **Virtual Asset Service Providers (VASPs)** | Prepares standard LEA disclosure packages (FIU-IND compliant). | Registration with FIU-IND and designated Law Enforcement liaison channels for Binance, CoinDCX, WazirX, etc. |

---

## 3. Operations, Infrastructure & Security

| Area | Current Prototype Status | Required Human / Authority Action |
| :--- | :--- | :--- |
| **Penetration Testing & Red Teaming** | Standard secure headers, input sanitization, CSRF, and SQL escaping in place. | Independent third-party CERT-In empaneled security audit and penetration test prior to production law-enforcement deployment. |
| **Blockchain RPC Node Operations** | Connects to public providers (Alchemy, mempool.space, TronGrid) with rate limits. | Enterprise dedicated archival node provisioning (e.g., self-hosted Erigon / Geth nodes) for unlimited throughput and forensic finality. |
| **Model Re-Training & Drift Monitoring** | Random Forest model trained on Elliptic Benchmark dataset. | Periodic model retraining with verified operational ground-truth cases under human analyst supervision. |
| **API Key & Secret Rotation** | Configurable via `.env` without hardcoded secrets. | Periodic rotation of provider keys per `docs/SECURITY.md`. |
