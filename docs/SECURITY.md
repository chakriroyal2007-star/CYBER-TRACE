# Security & Key Management Policy

## 1. Principles

1. **Zero Committed Secrets:** No production private keys, RPC provider tokens, database credentials, or third-party API tokens may be committed to version control.
2. **Graceful Credential-Gated Degradation:** If optional external keys (`BLOCKCHAIN_API_KEY`, `OPENROUTER_API_KEY`) are omitted from `.env`, the system must never crash; it must degrade honestly into deterministic analytical and fallback mode.
3. **Session & Token Scoping:** Session tokens are cryptographically randomized opaque strings, stored as SHA-256 hashes in SQLite/PostgreSQL, and sent over secure HttpOnly cookies or Authorization headers.

---

## 2. Environment Variables & Secret Handling

| Secret / Config | Purpose | Default Behavior When Missing |
| :--- | :--- | :--- |
| `BLOCKCHAIN_API_KEY` | Real Ethereum Alchemy RPC access | Falls back to public RPC (`cloudflare-eth.com`) or simulated on-chain fixtures |
| `OPENROUTER_API_KEY` | Frontier LLM access (LLaMA 3.3 70B) | Degrades to deterministic mathematical risk evaluation & grounded case fallbacks |
| `DB_PATH` | Local persistent SQLite file path | Defaults to `./data/cryptotrace.sqlite` |
| `SESSION_SECRET` | Cookie signing and session isolation | In-memory entropy per container execution |

---

## 3. Key Rotation Procedures

If any external API token or service key is suspected of compromise, execute the following rotation workflow immediately:

### Step 1: Revoke Compromised Keys
- **OpenRouter:** Navigate to [OpenRouter Keys Dashboard](https://openrouter.ai/keys), click `Delete` on the active key.
- **Alchemy / Ethereum RPC:** Access [Alchemy Dashboard](https://dashboard.alchemy.com/), rotate the app's API Key and update IP/Origin allowlists.

### Step 2: Generate New Credentials
- Create a new token with least-privilege access and appropriate rate/budget limits.

### Step 3: Update Production Environment
- **Vercel / Cloud Provider:** Update the environment variable directly in the platform dashboard (or `vercel env add OPENROUTER_API_KEY production`).
- **Local / Docker:** Update `.env` (never commit `.env` to Git; `.gitignore` strictly blocks all `.env*` files except `.env.example`).

### Step 4: Verify Deployment Integrity
- Execute `npm test` to verify local and CI integration.
- Run `curl -I https://<deployment-url>/api/health` to confirm healthy startup.

---

## 4. Continuous Integration Security Checks

The CI workflow (`.github/workflows/ci.yml`) enforces the following gates on every pull request and push:
1. **Dependency Audit (`npm audit`):** Fails builds on high/critical security vulnerabilities in package dependencies.
2. **Secret Leak Detection:** Scans the codebase for exposed token formats and API keys.
3. **Doc-Consistency Check (`scripts/check-doc-consistency.mjs`):** Fails builds if test counts, badges, or documented file trees drift from actual code.

