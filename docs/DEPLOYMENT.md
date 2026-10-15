# Deployment and operations

## Delivery status

**No public deployment has been created or verified from this workspace.** The available hosting integrations are disabled by the workspace administrator, and there are no authorized hosting credentials. No public URL or GitHub repository URL should be inferred from this project name. The source includes a container definition, persistent-volume configuration, and a Render Blueprint for an authorized deployment.

Docker is not installed in the build workspace. The container build and hosted deployment remain unverified; application-level checks are separate and are described in the test results.

## Deployment model

Run one Node 24 application process. It serves the compiled React application, REST API, API documentation, event stream, and PDF downloads under one HTTPS origin. The Python/ReportLab subprocess generates reports. SQLite stores data and generated PDF bytes in the directory containing `DB_PATH`.

This model deliberately avoids a cross-origin frontend/backend split. A static-only Vercel-style deployment does not run this backend, cannot provide durable SQLite, and will not deliver the complete application. Do not upload only `dist/` and describe it as the full product.

## Container deployment

Prerequisites: Docker with Compose, network access for npm and Debian packages during build, and an HTTPS reverse proxy or managed HTTPS host.

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 crypto-trace
```

The Compose configuration binds to `127.0.0.1:8000` for an HTTPS reverse proxy. Its named volume persists data across container replacement. Do not run `docker compose down -v` unless deliberate deletion of all sessions, investigations, PDFs, and audit history is intended.

For a managed Docker host:

1. Set the repository root to this directory and use `Dockerfile`.
2. Expose the configured `PORT` (8000 by default), and enable managed HTTPS.
3. Attach a persistent, writable disk at `/app/data`. The container runs as user `node` (UID 1000). Verify the mounted directory is writable by that user.
4. Set `DB_PATH=/app/data/cryptotrace.sqlite`, `NODE_ENV=production`, and the environment variables below.
5. Use `/api/health` as the health check.
6. Deploy one instance. SQLite is not configured for multiple application replicas or a shared network filesystem.
7. Complete the clean-browser acceptance checklist before sharing a judge-facing URL.

The deployment requires no blockchain, AI, VASP, government, or JWT credentials. All investigation data remains synthetic.

## Render Blueprint

Import `render.yaml` from an authorized Git repository. It specifies a Docker web service in Singapore, a persistent disk, a health check, and manual deploy triggering. The configured compute plan and disk incur hosting charges; review the provider's confirmation before provisioning. The Blueprint keys follow the [Render Blueprint specification](https://render.com/docs/blueprint-spec).

After provisioning, copy the actual HTTPS address displayed by the host. Verify that address in a fresh browser and on a second device; do not construct a URL from the service name or claim the configuration file itself is a deployment.

A disk-backed Render service runs as one instance and briefly stops during redeployment; this configuration does not provide zero-downtime releases. Only files beneath the mount path persist. See [Render persistent-disk limitations](https://render.com/docs/disks).

## Environment

| Variable | Default / example | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Production runtime behavior. |
| `HOST` | `0.0.0.0` | Listen interface. |
| `PORT` | `8000` in deployment files | HTTP port; must match the host/proxy target. |
| `DB_PATH` | `./data/cryptotrace.sqlite` | Durable SQLite file; its directory must be writable. |
| `PYTHON_BIN` | `python3` | Interpreter containing ReportLab. Docker uses `/usr/bin/python3`. |
| `FRONTEND_ORIGIN` | Empty | Optional exact alternate frontend origin. Same-origin hosting needs no value. |
| `SESSION_TTL_HOURS` | `168` | Lifetime of a synthetic demo session. |
| `RATE_LIMIT_PER_MINUTE` | `180` | Request-rate ceiling configured by the server. |
| `MAX_DEMO_SESSIONS` | `1000` | Bound on stored demo sessions. |

`.env.example` contains no secrets. `npm start` does not automatically load an `.env` file; use host-managed variables or `node --env-file=.env server/index.mjs`. Unimplemented integrations cannot be enabled by adding `DATABASE_URL`, `BLOCKCHAIN_API_KEY`, `AI_API_KEY`, or `NEO4J_*`.

## Local source verification

Requirements: Node 24+, npm, Python 3 with ReportLab; the PDF-content tests also use Poppler's `pdftotext`. The container supplies the application's Python dependency; on a development machine, install ReportLab in your chosen Python environment and set `PYTHON_BIN` to that interpreter.

```sh
npm ci
npm run build
npm test
node --env-file=.env server/index.mjs
```

Copy `.env.example` to `.env` before the last command. The application will be available at `http://localhost:8000`. For client development, start the backend with `PORT=8000` and run `npm run dev` in a separate terminal; Vite proxies `/api` to that port.

## Persistence and recovery

- Preserve the whole SQLite database. Reports are database BLOBs, not separate files in `dist/`.
- Back up with a SQLite-aware backup process or stop the application before copying the database and any associated write-ahead-log files. Do not assume copying an actively written main file alone gives a consistent snapshot.
- Restore a backup into the persistent data directory with correct ownership, then start one instance and verify `/api/health`, a saved investigation, and a generated PDF.
- The startup migration creates the current relational schema. Review and back up before applying future schema changes.
- Session expiry limits access duration; this is a demo retention mechanism, not a legally compliant evidence-retention policy.

## Public acceptance checklist

Record the actual URL, deployment timestamp, commit/source revision, and test result. The checklist below is a release gate, not a claim that public verification has occurred.

- [ ] HTTPS landing page loads without a local process or VPN.
- [ ] Fresh Demo Mode session opens the dashboard without credentials.
- [ ] Default case opens; trace/replay, graph, node and edge selection work.
- [ ] Attribution evidence, cross-chain transfer, fingerprint, and related cases are inspectable.
- [ ] TRACE AI answers a supported question with case references and rejects unsupported evidence requests.
- [ ] Search finds a copied wallet address and transaction hash.
- [ ] Creating a fictional case persists after refresh and server restart.
- [ ] A second independent session cannot see the first session's custom case or report.
- [ ] Alerts can be reviewed or dismissed and preserve status after refresh.
- [ ] PDF generation returns a readable PDF with audit metadata and disclaimer.
- [ ] Information-request preparation downloads a package without sending it externally.
- [ ] `/api/health`, `/api/docs`, and `/api/openapi.json` load.
- [ ] Demo data and DEMO STREAM labels are visible; integrations are not labeled connected.
- [ ] Desktop and mobile views work; no blocking console errors occur.
- [ ] A second device/browser can open the public URL.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Node cannot load `node:sqlite` | Use Node 24 or the provided Docker image. |
| PDF generation fails | Verify `PYTHON_BIN` and `python3 -c "import reportlab"`; the process must use the same interpreter. |
| SQLite cannot be opened | Verify the parent directory exists, mount ownership, free disk space, and `DB_PATH`. |
| Data disappears on redeploy | Attach persistent storage and point `DB_PATH` into it. |
| `/app/...` returns 404 | Run the Node server after `npm run build`; preserve its SPA route fallback. |
| API returns session required | Enter Demo Mode, allow same-origin cookies, and verify HTTPS proxy headers and origin configuration. |
| Event stream stops behind a proxy | Disable response buffering for `/api/events`; allow streaming connections. |
| Requests receive 429 | Respect the retry response, investigate traffic volume, and tune rate limits for the deployment. |

## Operational boundary

This build is deployable as a **synthetic demonstration sandbox**, not a production evidence repository. Do not enter real victim information or actual confidential case material. Before an operational deployment, implement verified organizational authentication, roles and access review, suitable data residency, encrypted and independently verifiable evidence storage, managed backups, abuse controls, external-source provenance, and human-approved integration procedures. PostgreSQL/Neo4j backends and live blockchain integrations are not implemented in the current runtime.
