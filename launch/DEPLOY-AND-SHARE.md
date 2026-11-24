# DPPKit — $0 Deployment & Ethical Launch Guide

> **Mandatory Legal Disclaimer:** DPPKit is an engineering schema validator, JSON-LD & GS1 Digital Link builder, and Annex XIII readiness studio aligned with Regulation `(EU) 2023/1542` and `DIN DKE SPEC 99100`. It is NOT legal counsel, NOT an EU Notified Body, NOT an accredited ISO 14067 / LCA carbon-footprint verifier, NOT a GS1 registrar, and does NOT submit live passports to the EU Commission registry or customs systems.

## 1. Zero-Budget Static Hosting (`Cloudflare Workers Static Assets — $0`)
Because `src/core/` shares identical browser + Node 22 logic, the compiled static bundle runs cleanly without any backend server using `window.localStorage`:

```bash
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

Configuration is pre-defined in `wrangler.jsonc` (`assets.directory = "./dist"`, SPA routing enabled).

## 2. Self-Hosted Server (`Node 22 + node:sqlite WAL`)
When multi-user persistence, atomic `DPP-YYYY-0001` numbering, public share counters (`/r/:slugOrCode`), or direct `/api/dossiers/:id/qr.svg` endpoints are desired:

### Option A: Docker Compose
```bash
docker compose up -d --build
```
Maps `127.0.0.1:4201:4201` backed by persistent volume `dppkit_data`.

### Option B: Bare Metal Node 22 + systemd + Caddy
1. Copy `deploy/.env.example` -> `.env` and adjust `PORT=4201` and `DPPKIT_DATA_DIR`.
2. Enable `deploy/dppkit.service` and schedule `deploy/backup-sqlite.sh` daily (online `VACUUM INTO` snapshot, 14-day retention).
3. Terminate TLS cleanly via `deploy/Caddyfile`.

## 3. Ethical Community & Developer Launch (`$0`, No Spam)
- **Target Builders**: Battery pack assemblers, LMT (e-bike / scooter) EU importers, stationary BESS integrators, and sustainability engineers racing toward the **18 February 2027** EU Battery Passport deadline.
- **Value-First Channels**: Share engineering lessons on enforcing **DIN DKE SPEC 99100** `Public / PLI / Authority` access isolation, Mod-10 `GTIN-14` GS1 Digital Link validation, and XSS-safe JSON-LD packaging. Always include the mandatory legal disclaimer.
