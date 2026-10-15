# 🛡️ CYBER-TRACE (CRYPTO-TRACE INDIA)

> **From Reported Wallet to Actionable Intelligence: Trace · Attribute · Correlate · Act**

[![Node.js](https://img.shields.io/badge/Node.js-24%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-20%2F20%20Passing-brightgreen?logo=checkmarx&logoColor=white)](./tests)

**CYBER-TRACE** is a full-stack, enterprise-grade cryptocurrency forensics and intelligence analysis platform tailored for Law Enforcement Agencies (LEAs), cybercrime investigators, and compliance units. Designed around the investigative framework **TRACE · ATTRIBUTE · CORRELATE · ACT**, it transforms victim wallet complaints into interactive multi-chain transaction graphs, provides explainable 7-factor Virtual Asset Service Provider (VASP) attribution, cross-correlates syndicate wallets across complaints, and generates cryptographically signed (SHA-256) forensic evidence dossiers.

> ⚠️ **Synthetic Demonstration Environment:** All seeded complaints, addresses, VASP names, fund movements, and classifications are synthetic and fictional. Attribution represents investigative analytical leads and analytical confidence, not definitive legal ownership or judicial findings of criminal conduct.

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

CYBER-TRACE includes a suite of automated unit, integration, and end-to-end tests:

### 1. Unit & REST Integration Tests
Validates the deterministic analytical engine, 7-factor attribution calculations, fund-flow conservation, database persistence, session isolation, and report generation:

```bash
npm test
```
*Expected: 20 passed tests across 2 test suites.*

### 2. Production Build Verification
Verifies TypeScript compilation and production bundle tree-shaking:

```bash
npm run build
```

### 3. End-to-End Browser Workflow Tests
Executes browser verification workflows covering case creation, graph exploration, and report downloads:

```bash
npm run test:e2e
```

---

## 📡 REST API & Documentation

Interactive Swagger-style API documentation is available at `/api/docs`, and the machine-readable OpenAPI schema is served at `/api/openapi.json`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check, engine status, and database connectivity |
| `GET` | `/api/docs` | Interactive Swagger/OpenAPI documentation page |
| `GET` | `/api/openapi.json` | OpenAPI 3.0 specification |
| `POST` | `/api/auth/demo` | Initialize an isolated demo investigator session |
| `POST` | `/api/auth/login` | Officer / Investigator session login |
| `GET` | `/api/auth/me` | Fetch active session profile and role permissions |
| `POST` | `/api/auth/logout` | Terminate session and invalidate auth cookies |
| `GET` | `/api/dashboard` | Case metrics, risk distributions, and chain volume statistics |
| `GET` | `/api/cases` | List and filter active criminal investigations |
| `POST` | `/api/cases` | Register a new complaint and reported suspect wallet |
| `GET` | `/api/cases/:id` | Retrieve comprehensive case record |
| `GET` | `/api/cases/:id/related` | Retrieve correlated cases sharing intermediary clusters |
| `POST` | `/api/investigations` | Run deterministic graph analysis on a suspect case |
| `GET` | `/api/investigations/:id` | Full investigation workspace data (graph nodes, edges, attributions) |
| `GET` | `/api/graph/:caseId` | Transaction nodes and edges for graph rendering |
| `GET` | `/api/attribution/:caseId` | 7-factor candidate VASP attribution scores and evidence |
| `GET` | `/api/wallets/:address` | Wallet intelligence and associated cases |
| `POST` | `/api/assistant/:caseId` | Grounded TRACE AI query against case evidence |
| `POST` | `/api/reports/:caseId/generate` | Generate court-ready SHA-256 hashed PDF report |
| `GET` | `/api/reports/:id` | Stream and download generated PDF report |
| `POST` | `/api/requests/:caseId/generate` | Generate VASP Information Request JSON package |
| `GET` | `/api/events` | Server-Sent Events (SSE) replaying simulated investigation stream |
| `GET` | `/api/audit` | Session audit log trail |

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

## 👨‍💻 Author & Contributions

Built for modern cyber forensics and cybercrime investigations. Contributions, issues, and feature proposals are welcome!

```bash
# Push your contributions
git checkout -b feature/new-capability
git commit -m "feat: add new capability"
git push origin feature/new-capability
```
