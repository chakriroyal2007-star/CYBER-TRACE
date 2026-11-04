# 🛡️ CYBER-TRACE (CRYPTO-TRACE INDIA)

> **From Reported Wallet to Actionable Intelligence: Trace · Attribute · Correlate · Act**

[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-37%2F37%20Passing-brightgreen?logo=checkmarx&logoColor=white)](./tests)

**CYBER-TRACE** is a full-stack, enterprise-grade cryptocurrency forensics and intelligence analysis platform tailored for Law Enforcement Agencies (LEAs), cybercrime investigators, and compliance units. Designed around the investigative framework **TRACE · ATTRIBUTE · CORRELATE · ACT**, it combines an end-to-end investigative UI with a **dataset-driven graph analytics engine** powered by the **Elliptic Bitcoin Transaction Dataset (203,769 nodes, 234,355 directed edges)**, supervised machine learning (Random Forest & Logistic Regression), rigorous Data Structures & Algorithms (Dijkstra, BFS, DFS, Union-Find, Priority Queue, Sliding Window), and explainable risk scoring.

> ⚠️ **Dataset & Investigative Disclosure:** Real dataset analysis is powered by the benchmark Elliptic Bitcoin Transaction Dataset. Transaction nodes represent transaction hashes across 49 discrete time steps (not wallet addresses or live exchange accounts). Risk scores and supervised predictions are probabilistic investigative leads and do not constitute definitive legal proof of criminal liability. Synthetic cases (e.g. CR-2026-00192) demonstrate victim complaint intake workflows.

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🏗️ System Architecture & Tech Stack](#️-system-architecture--tech-stack)
- [🚀 Quick Start (How to Run Everything)](#-quick-start-how-to-run-everything)
  - [Prerequisites](#prerequisites)
  - [Method 1: Local Full-Stack Setup (Recommended)](#method-1-local-full-stack-setup-recommended)
  - [Method 2: Development with Vite Hot-Module Replacement (HMR)](#method-2-development-with-vite-hot-module-replacement-hmr)
  - [Method 3: Docker & Docker Compose](#method-3-docker--docker-compose)
- [🧪 Running Automated Tests](#-running-automated-tests)
- [📡 REST API & Documentation](#-rest-api--documentation)
- [📂 Project Directory Structure](#-project-directory-structure)
- [⚙️ Environment Configuration](#️-environment-configuration)
- [🔍 Flagship Demonstration Case](#-flagship-demonstration-case)
- [🛡️ Security & Synthetic Disclosures](#️-security--synthetic-disclosures)

---

## ✨ Key Features

- **🕸️ Interactive Transaction Visualizer & Trace Analysis**
  - Custom SVG graph visualization mapping multi-hop fund flows across Ethereum, Polygon, BNB Chain, TRON, and Bitcoin.
  - Path-highlighting, hop inspection, cluster filtering, and visual transaction flow conservation (terminal candidate receipts + residual balances = reported victim loss).
- **🎯 Configurable 7-Factor Attribution Engine**
  - Explainable scoring algorithm attributing terminal exit addresses to candidate VASPs based on deposit patterns, temporal proximity, cluster metadata, and historical risk flags.
- **🔗 Cross-Complaint Syndicate Correlation**
  - Uncovers hidden money-laundering networks and shared intermediary money-mule clusters connecting distinct complaints (e.g. investment scams linked to phishing operations).
- **🤖 TRACE AI: Deterministic Case-Grounded Assistant**
  - In-app investigative assistant that references verified on-chain evidence with internal citations and strictly rejects hallucinated details with insufficient-evidence fallbacks.
- **📄 Forensic PDF Dossiers & Information Request Packages**
  - Generates versioned, court-ready PDF investigative summaries stored with SHA-256 verification hashes.
  - Automatically compiles structured JSON Information Request packages for legal outreach to identified VASPs.
- **🚨 Real-Time Demonstration Feed & Investigator Console**
  - Command palette (`Cmd+K`), dark-mode UI with high-contrast data visualization, mock server-sent event (SSE) stream, and tamper-resistant audit logs.

---

## 🏗️ System Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                   CYBER-TRACE FRONTEND                      │
│   React 19 · TypeScript · Vite · Recharts · Lucide Icons    │
│              Interactive SVG Graph Visualizer               │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE (/api/*)
┌──────────────────────────────▼──────────────────────────────┐
│                    NODE 24 HTTP BACKEND                     │
│   Validated REST APIs · Rate Limiter · CSP Security Headers │
├──────────────────────────────┬──────────────────────────────┤
│      ANALYTICS ENGINE        │      STORAGE & REPORTS       │
│  - Deterministic Tracing     │  - SQLite (node:sqlite, WAL) │
│  - 7-Factor VASP Attribution │  - SHA-256 Audit Log         │
│  - Case Correlation Engine   │  - Node/Python PDF Generator │
└──────────────────────────────┴──────────────────────────────┘
```

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5.9, Vite 8, Recharts, Lucide Icons, Pure Modular CSS |
| **Backend Service** | Node.js 24 (`node:sqlite`, native crypto, HTTP streaming) |
| **Database** | Embedded SQLite with WAL mode, foreign keys, prepared statements, and transactional indexes |
| **Forensic PDF Engine**| Node.js / ReportLab Python 3 fallback with DejaVu Sans font support |
| **Containerization** | Multi-stage Docker build with health-check monitoring |

---

## 🚀 Quick Start (How to Run Everything)

### Prerequisites

- **Node.js**: `v24.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm**: `v10.0.0` or higher
- **Python 3** *(Optional for PDF fallback)*: Python 3 with `reportlab` (`pip install reportlab`)
- **Docker** *(Optional)*: If running via containers

---

### Method 1: Local Full-Stack Setup (Recommended)

Run the unified single-service build where Node serves both the static React production bundle and the REST API on port `8000`:

1. **Clone repository and enter project directory:**
   ```bash
   git clone https://github.com/chakriroyal2007-star/CYBER-TRACE.git
   cd CYBER-TRACE
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Build the production frontend bundle:**
   ```bash
   npm run build
   ```

5. **Start the server:**
   ```bash
   node --env-file=.env server/index.mjs
   ```
   *(Alternatively, run `npm start`)*

6. **Open in your browser:**
   ```
   http://localhost:8000
   ```
   - Click **Enter Demo Console** or log in with any investigator credentials.
   - Access the API documentation at `http://localhost:8000/api/docs`.

---

### Method 2: Development with Vite Hot-Module Replacement (HMR)

For rapid UI development with instant hot reloading:

1. **Terminal 1: Start the backend server on port 8000:**
   ```bash
   node --env-file=.env server/index.mjs
   ```

2. **Terminal 2: Start the Vite development server:**
   ```bash
   npm run dev
   ```

3. **Open Vite in your browser:**
   ```
   http://localhost:5173
   ```
   *Vite automatically proxies all `/api` requests to `http://localhost:8000`.*

---

### Method 3: Docker & Docker Compose

Run the entire application in an isolated, production-grade Linux container:

1. **Build and start container in detached mode:**
   ```bash
   docker compose up --build -d
   ```

2. **Check container logs:**
   ```bash
   docker compose logs -f
   ```

3. **Open application:**
   Navigate to `http://localhost:8000` in your browser.

4. **Stop the container:**
   ```bash
   docker compose down
   ```

---

## 🧪 Running Automated Tests

CYBER-TRACE includes a comprehensive test suite across unit, graph DSA, machine learning evaluation, dataset ingestion, and REST API integration tests:

### 1. Unit & REST Integration Tests
Validates the Elliptic dataset ingestion, Priority Queue, BFS, DFS, Dijkstra with configurable weights, Union-Find with rank and path compression, Top-K heap selection, Sliding Window analysis, calibrated risk scoring, TRACE AI assistant, SQLite persistence, and all REST endpoints:

```bash
npm test
```
*Expected: 37 passed tests across 7 test suites (100% passing).*

### 2. Production Build Verification
Verifies TypeScript compilation and production bundle tree-shaking:

```bash
npm run build
```

---

## 📊 Elliptic Bitcoin Dataset Integration

The platform is integrated with the benchmark **Elliptic Bitcoin Transaction Dataset** (Weber et al., 2019):

| Dimension | Measured Statistic |
| :--- | :--- |
| **Transaction Nodes ($V$)** | `203,769` transaction IDs |
| **Directed Edges ($E$)** | `234,355` transaction-to-transaction flow edges |
| **Feature Dimensions** | `165` features per transaction node |
| **Discrete Time Steps** | `49` time steps (~2-week intervals) |
| **Known Illicit Class (`'1'`)** | `4,545` transactions (ground truth fraudulent/malicious) |
| **Known Licit Class (`'2'`)** | `42,019` transactions (ground truth legitimate exchanges/miners/wallets) |
| **Unknown Class (`'unknown'`)** | `157,205` transactions (unlabeled; never treated as licit) |

### High-Performance Ingestion & Random Feature Access
1. **Streaming Ingestion (`server/dataset/ingestion.mjs`)**:
   - Parses `elliptic_txs_classes.csv` and `elliptic_txs_edgelist.csv` using native Node streams in ~1.6 seconds.
   - Accurately maps raw labels: `'1'` → `illicit`, `'2'` → `licit`, `'unknown'` → `unknown`.
   - Constructs in-memory index of time steps, labels, and pre-computed model scores.
2. **O(1) Feature Seeker via Byte Offsets (`data/elliptic/features_offsets.json`)**:
   - Reads 165 float features for any arbitrary transaction directly from the 658 MB `elliptic_txs_features.csv` in **<0.1 ms** without loading the entire CSV into V8 memory.

---

## 🧠 Graph Analytics Engine & Data Structures & Algorithms

The system treats transactions as directed transaction-to-transaction dependencies $G = (V, E)$. Graph analysis runs in-memory with adjacency lists, reverse adjacency lists, and dedicated data structure implementations:

| Algorithm | Implementation File | Time Complexity | Space Complexity | Practical Purpose in Forensics |
| :--- | :--- | :--- | :--- | :--- |
| **Priority Queue** | `server/graph/algorithms.mjs` | $O(\log N)$ push/pop, $O(1)$ peek | $O(N)$ | Powers Dijkstra's shortest path and Top-K suspicious transaction ranking. |
| **Breadth-First Search (BFS)** | `server/graph/algorithms.mjs` | $O(V + E)$ | $O(V)$ | Traces shortest-hop downstream fund propagation and reachable transactions with depth bounding. |
| **Depth-First Search (DFS)** | `server/graph/algorithms.mjs` | $O(V + E)$ | $O(V)$ | Subgraph traversal, deep cluster exploration, and cycle detection. |
| **Dijkstra's Algorithm** | `server/graph/algorithms.mjs` | $O((V + E) \log V)$ | $O(V)$ | Weighted shortest path with configurable cost metrics (`hop`, `time`, `risk`); validates non-negative weights. |
| **Union-Find (DSU)** | `server/graph/algorithms.mjs` | $O(\alpha(N))$ amortized | $O(N)$ | Disjoint Set Union with path compression and union by rank to extract connected laundering components. |
| **Top-K Suspicious Heap** | `server/graph/algorithms.mjs` | $O(N \log K)$ | $O(K)$ | Min-heap selection of the most suspicious transactions by risk score across large transaction sets. |
| **Sliding Window Temporal** | `server/graph/algorithms.mjs` | $O(W + T)$ | $O(T)$ | Sliding window analysis over 49 timesteps detecting transaction volume bursts and rapid forwarding spikes. |
| **Degree & Neighborhood** | `server/graph/algorithms.mjs` | $O(\text{deg}(u))$ | $O(\text{deg}(u))$ | Calculates in-degree, out-degree, and counterparty illicit exposure percentage for any transaction node. |

---

## 🤖 Supervised Machine Learning & Explainable Risk Scoring

### Time-Aware Validation Split (No Data Leakage)
To prevent temporal leakage in financial transaction graphs, the supervised models were trained strictly on **Time Steps 1 to 34** (29,894 labeled transactions) and evaluated on holdout **Time Steps 35 to 49** (16,670 labeled transactions). The 157,205 unlabeled (`unknown`) transactions were strictly excluded from model training.

### Model Evaluation Benchmark (Holdout Time Steps 35–49)

| Metric | Random Forest (Selected Model) | Logistic Regression (Baseline) | Interpretation |
| :--- | :--- | :--- | :--- |
| **PR-AUC** (Primary) | **0.7805** | 0.2932 | High precision on minority illicit class ($6.5\%$ base rate). |
| **ROC-AUC** | **0.9254** | 0.8819 | High separability between licit and illicit distributions. |
| **F1-Score** | **0.7538** | 0.3039 | Harmonic mean of precision and recall. |
| **Precision** | **78.31%** ($787 / 1,005$) | 23.33% ($470 / 2,015$) | Minimizes false positive investigation burdens on officers. |
| **Recall** | **72.67%** ($787 / 1,083$) | 43.40% ($470 / 1,083$) | Successfully flags $>72\%$ of true illicit transactions. |
| **False Positive Rate** | **1.40%** ($218 / 15,587$) | 9.91% ($1,545 / 15,587$) | Less than $1.5\%$ false accusation rate on legitimate activity. |
| **False Negative Rate** | **27.33%** ($296 / 1,083$) | 56.60% ($613 / 1,083$) | Missing minority edge-cases handled by graph indicators. |
| **Confusion Matrix** | **TN: 15,369, FP: 218, FN: 296, TP: 787** | TN: 14,042, FP: 1,545, FN: 613, TP: 470 | Evaluated on total 16,670 holdout samples. |

### Calibrated Risk Score & Multi-Factor Explainability
The composite risk engine (`server/ml/riskEngine.mjs`) replaces arbitrary risk formulas with a 0–100 calibrated score:
- **HIGH ($\ge 70$)**: Requires immediate forensic freeze/dossier generation.
- **MEDIUM ($40 - 69$)**: Suspicious intermediate hop or unverified counterparty cluster.
- **LOW ($< 40$)**: Predominantly licit flow through known exchanges or mining pools.

Every risk score returns structured evidence indicators detailing:
1. Supervised model prediction and probability confidence.
2. Ground truth Elliptic dataset label when known.
3. Graph counterparty risk: illicit neighbor ratio and downstream exposure.
4. Structural degree profile: fan-in / fan-out ratios indicative of peel chains or mixers.

---

## 📡 REST API & Documentation

Interactive Swagger-style API documentation is available at `/api/docs`, and the machine-readable OpenAPI schema is served at `/api/openapi.json`.

### Dataset & Investigation Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dataset/stats` | Ingestion status, total nodes, edges, labels, and timesteps |
| `POST` | `/api/dataset/ingest` | Trigger or verify streaming dataset ingestion |
| `GET` | `/api/transactions/:id` | Lookup transaction features, ground truth label, ML score, neighbors |
| `POST` | `/api/transactions/:id/investigate` | Execute full multi-hop graph analysis and save investigation |
| `GET` | `/api/transactions/investigations` | List persisted transaction investigations from SQLite |

### Graph Analytics Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/analytics/bfs` | BFS shortest-hop path between source and target (`?source=&target=&maxDepth=`) |
| `GET` | `/api/analytics/dfs` | DFS traversal subgraph (`?source=&maxDepth=`) |
| `GET` | `/api/analytics/dijkstra` | Weighted shortest path with configurable weights (`?source=&target=&weightType=hop\|time\|risk`) |
| `POST` | `/api/analytics/components` | Union-Find connected components analysis across a transaction set |
| `GET` | `/api/analytics/top-suspicious` | Top-K highest-risk transactions via min-heap (`?limit=20`) |
| `GET` | `/api/analytics/temporal` | Sliding window temporal rate analysis across 49 timesteps (`?windowSize=3`) |
| `GET` | `/api/analytics/model-eval` | Model evaluation metrics (Random Forest vs Logistic Regression) |
| `GET` | `/api/analytics/neighborhood` | In-degree, out-degree, and counterparty risk profile (`?id=`) |

### Core Case & Session Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check, engine status, and database connectivity |
| `GET` | `/api/docs` | Interactive Swagger/OpenAPI documentation page |
| `POST` | `/api/auth/demo` | Initialize an isolated demo investigator session |
| `GET` | `/api/dashboard` | Case metrics, risk distributions, and chain volume statistics |
| `GET` | `/api/cases` | List and filter active criminal investigations |
| `GET` | `/api/cases/:id` | Retrieve comprehensive case record |
| `POST` | `/api/investigations` | Run deterministic graph analysis on a suspect case |
| `GET` | `/api/graph/:caseId` | Transaction nodes and edges for graph rendering |
| `POST` | `/api/assistant/:caseId` | Grounded TRACE AI query against case evidence or dataset transactions |
| `POST` | `/api/reports/:caseId/generate` | Generate court-ready SHA-256 hashed PDF report |
| `GET` | `/api/reports/:id` | Stream and download generated PDF report |

---

## 📂 Project Directory Structure

```
CYBER-TRACE/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI validation pipeline
├── api/
│   └── index.js               # Serverless entrypoint (Vercel deployment)
├── docs/                      # Architectural & demonstration documentation
│   ├── ARCHITECTURE.md        # Data models, graph algorithms & boundaries
│   ├── CONTRACT.md            # Frontend-backend interface specifications
│   ├── DEMO.md                # 3-minute hackathon/investigator walkthrough
│   └── DEPLOYMENT.md          # Production cloud hosting & persistence guide
├── migrations/
│   └── 001_initial.sql        # SQLite schema & transactional indexes
├── server/                    # Node.js backend & analytical services
│   ├── adapters.mjs           # Blockchain & external system boundary adapters
│   ├── analytics.mjs          # Graph analysis, attribution & correlation algorithms
│   ├── assistant.mjs          # Grounded TRACE AI assistant logic
│   ├── db.mjs                 # SQLite database connection & CRUD methods
│   ├── index.mjs              # Main HTTP server, routing, rate limiter & static file server
│   ├── openapi.mjs            # OpenAPI 3.0 documentation spec
│   ├── pdf.mjs                # PDF generation service
│   ├── report.py              # ReportLab Python PDF rendering worker
│   └── validation.mjs         # Input validation schemas & sanitization
├── src/                       # React 19 Frontend application
│   ├── components/            # Reusable UI components & modals
│   ├── pages/                 # Investigation Console, Dashboard, Reports, Analytics
│   ├── index.css              # Styling system & dark-mode theme
│   ├── main.tsx               # Client bootstrap
│   └── App.tsx                # App routing & context state
├── tests/                     # Automated test suites
│   ├── api.test.mjs           # REST API integration tests
│   ├── analytics.test.mjs     # Deterministic graph & attribution unit tests
│   └── e2e.mjs                # Playwright end-to-end browser test runner
├── compose.yaml               # Docker Compose specification
├── Dockerfile                 # Multi-stage production container build
├── package.json               # Node.js dependencies and run scripts
├── tsconfig.json              # TypeScript compilation configuration
└── vite.config.ts             # Vite build & proxy settings
```

---

## ⚙️ Environment Configuration

Configuration variables can be customized in `.env`:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Environment mode (`production` or `development`) |
| `PORT` | `8000` | Port for the backend HTTP server |
| `HOST` | `0.0.0.0` | Network binding address |
| `DB_PATH` | `./data/cryptotrace.sqlite` | SQLite database file location |
| `PYTHON_BIN` | `python3` | Path to Python 3 binary for fallback PDF worker |
| `FRONTEND_ORIGIN` | `""` | Allowed external frontend origins (CORS) |
| `SESSION_TTL_HOURS` | `168` | Session duration before expiration (7 days) |
| `RATE_LIMIT_PER_MINUTE`| `180` | Max API requests per minute per IP address |
| `MAX_DEMO_SESSIONS` | `1000` | Storage threshold for active synthetic sessions |

---

## 🔍 Flagship Demonstration Case

CYBER-TRACE comes pre-seeded with 6 realistic cybercrime scenarios, headlined by **CR-2026-00192**:

| Parameter | Value |
| :--- | :--- |
| **Case ID** | `CR-2026-00192` |
| **Fraud Typology** | Investment Scam (Crypto Ponzi / Liquidity Trap) |
| **Reported Victim Loss** | **₹8,12,450** |
| **Traced Terminal Receipts**| **₹6,42,000** |
| **Residual Wallet Value** | **₹1,70,450** |
| **Conservation Formula** | ₹6,42,000 (Exit) + ₹1,70,450 (Residual) = ₹8,12,450 (100% accounted for) |
| **Cross-Chain Pathway** | Ethereum Mainnet → DemoBridge → Polygon |
| **Candidate VASP Target** | **VASP-X** (Deposit wallet cluster) |
| **Attribution Confidence**| **91%** under the 7-factor weighted evidence model |
| **Correlated Complaints** | Linked to `CR-2026-00193`, `CR-2026-00194`, and `CR-2026-00196` |

---

## 🛡️ Security & Synthetic Disclosures

- **Session Isolation:** Each visitor is assigned an isolated session workspace with private SQLite case tables and report caches.
- **Security Headers:** Strict Content Security Policy (`CSP`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and rate-limiting enabled by default.
- **Simulated Fixtures:** No real victim PII, real blockchain transactions, live private keys, or actual exchange outreach mechanisms are invoked.

---

## ⚖️ Ethical Considerations, Operational Boundaries & Limitations

1. **Transaction-to-Transaction vs Wallet Graph:**
   - The Elliptic Bitcoin Transaction Dataset models transactions as discrete nodes and transaction inputs/outputs as directed edges ($Tx_A \to Tx_B$).
   - Nodes represent Bitcoin transaction identifiers, **not persistent wallet addresses or real-world user identities**. Tracing hops between nodes models fund flow across Bitcoin transaction trees (e.g. UTXO spending), not address-level balance accumulation.
2. **Probabilistic Risk Leads vs Legal Guilt:**
   - Machine learning risk predictions and risk scores ($0 - 100$) provide quantitative prioritization and investigative leads for intelligence analysts.
   - A high risk score ($\ge 70$) indicates topological and feature similarity to known illicit transactions (e.g. darknet markets, ransomware, extortion); it does **not** constitute definitive legal proof of criminal intent or judicial culpability.
3. **Handling of Unknown Transactions:**
   - Unlabeled transactions (`unknown`, 157,205 nodes) are treated strictly as unverified entities. They are **never** treated as licit or legitimate by default, nor were they included in the supervised training set.
4. **Temporal Discrete Steps:**
   - Time steps in the Elliptic dataset represent 49 discrete, sequential intervals of roughly two weeks. They do not encode exact wall-clock second/minute timestamps or holding durations; sliding-window temporal analysis operates on interval burst volume rather than real-time latency.
5. **Data Privacy & Law Enforcement Compliance:**
   - Forensic PDF dossiers and VASP Information Request packages contain cryptographically signed (SHA-256) analytical summaries designed for formal judicial subpoena and MLAT (Mutual Legal Assistance Treaty) procedures under applicable jurisdiction.

---

## 👨‍💻 Author & Contributions

Built for modern cyber forensics and cybercrime investigations. Contributions, issues, and feature proposals are welcome!

```bash
# Push your contributions
git checkout -b feature/new-capability
git commit -m "feat: add new capability"
git push origin feature/new-capability
```
