# Changelog — DPPKit

All notable changes to **DPPKit** (`EU Battery Regulation (EU) 2023/1542` & `DIN DKE SPEC 99100` Battery Passport Studio) are documented in this file.

## [0.5.0] - 2026-11-24 — Public MIT Open-Source Release (`v0.5.0`)
### Added
- MIT open-source license (`LICENSE`), automated Node 22 `.github/workflows/ci.yml`, 6 verified desktop/mobile UI screenshots (`docs/screenshots/01..06.png`), and sanitized GitHub export script (`deploy/export-public-github.sh`).

## [0.4.0] - 2026-11-24
### Added
- Full Playwright Chrome E2E test suite (`tests/e2e/dppkit.spec.ts` on `:4202`) covering `1280×800` desktop & `390×844` mobile in `EN LTR / Voltaic Ivory` and `AR RTL / Graphite Cell Dark` (**3/3** passing, zero console/page errors, genuine horizontal containment verified).
- Persistence for `locale` and `theme` in `window.localStorage`, 1-click `auto-fix-gtin-btn` E2E verification, public share view counter (`public-view-count`), mobile `min-w-0` grid/header wrapping fixes, and duplicate dossier legal banner suppression on interactive desktop view.
- `$0` deployment & ethical launch kit: `.gitignore`, `.dockerignore`, `wrangler.jsonc`, `Dockerfile`, `docker-compose.yml`, `deploy/.env.example`, `deploy/Caddyfile`, `deploy/dppkit.service`, `deploy/backup-sqlite.sh`, , `README.md`, and `launch/DEPLOY-AND-SHARE.md`.

## [0.3.0] - 2026-11-24
### Added
- Bilingual Web UI (`EN LTR` default + `AR RTL` toggle) in `index.html`, `public/favicon.svg`, `src/index.css`, `src/main.tsx`, `src/lib/{basePath,i18n,api}.ts`, `src/components/{PassportEditorPanel,TiersAndQrPanel,BatchCsvPanel,DossierPreviewAndPrint}.tsx`, and `src/App.tsx`.
- Dual theme palette: **Voltaic Ivory & Nordic Cobalt** (`#F9FAF8` / `#0F4C81` / `#0D9488`) light mode and **Graphite Cell Dark** (`#0B1117` / `#38BDF8` / `#2DD4BF`) dark mode.
- Client-side **ISO/IEC 18004 GS1 Digital Link QR** rendering (`QRCode.toString` -> safe `data:image/svg+xml` `<img>`), **DIN DKE SPEC 99100 3-Tier JSON-LD Access Explorer** (`Public / PLI / Authority`), XSS-safe HTML+JSON-LD label snippet viewer, quote-aware **Batch CSV Auditor**, interactive **12-point Annex XIII Checklist**, `/r/:slugOrCode` share view, and **A4 PDF Print View** supporting both `Node 22 + SQLite WAL` server mode and `$0 localStorage` browser mode.

## [0.2.0] - 2026-11-24
### Added
- Optional `Node 22 + node:sqlite WAL` HTTP server (`server/db.mjs`, `server/app.mjs`, `server/app.d.mts`, `server/index.mjs`) listening on `:4201` with `BASE_PATH=/dppkit` prefixing, `window.__DPPKIT_BASE__` SPA injection, `5 MB` JSON body limit, security headers, and sliding-window write rate limiting (`429`).
- Atomic UTC-yearly dossier sealing (`DPP-YYYY-0001`), canonical `SHA-256` integrity matching `src/core/dossierDigest.ts`, `409` mutation/delete locks (`DOSSIER_LOCKED`, `ALREADY_LOCKED`), draft duplication, operator profiles CRUD, and public share view counters (`/api/public/reports/:slugOrCode`).
- Real ISO/IEC 18004 GS1 Digital Link QR SVG generation (`/api/qr-preview` and `/api/dossiers/:id/qr.svg`), partitioned JSON-LD downloads (`/passport-public.jsonld`, `/passport-pli.jsonld`, `/passport-authority.jsonld`), XSS-safe HTML+JSON-LD label (`/qr-label.html`), bilingual Markdown (`/annex-xiii.md`), UTF-8 BOM CSV (`/export.csv`), and executive summary (`/summary`).
- Integration test suite (`tests/unit/dppkitServer.test.ts` — **6/6** passing alongside **10/10** unit core tests, **16/16** total).

## [0.1.0] - 2026-11-24
### Added
- Architectural & regulatory specification (`research/16-dppkit-spec-and-architecture.md`) with mandatory legal disclaimer covering the **18 February 2027** Article 77 & Annex XIII deadline for EV, LMT, and industrial (> 2 kWh) batteries.
- Zero-dependency shared `src/core/` domain engine (`types.ts`, `dppRules.ts`, `gs1DigitalLink.ts`, `passportAuditor.ts`, `dossierDigest.ts`, `presets.ts`) runnable identically in the browser and directly in Node 22:
  - Scope classifier (`ev`, `lmt`, `industrial_gt_2kwh`, `industrial_lte_2kwh`, `portable`) and countdown to **2027-02-18**.
  - GTIN-14 Mod-10 check digit calculator/validator, `GS1 Digital Link` URI builder & parser, and XSS-safe HTML + JSON-LD label snippet generator.
  - Chemistry-aware Article 8 recycled content evaluator (**2031**: Co 16% / Pb 85% / Li 6% / Ni 6%; **2036**: Co 26% / Pb 85% / Li 12% / Ni 15%), Article 7 carbon footprint validator, and strict 3-tier `public / pli / authority` Annex XIII JSON-LD partitioner.
  - Quote-aware catalog batch CSV auditor and formula-injection-neutralized `UTF-8 BOM` exporter.
  - Canonical `SHA-256` passport sealing (`DPP-YYYY-0001`), integrity verification, and bilingual (`EN / AR`) Annex XIII Markdown dossier export.
- Unit test suite (`tests/unit/dppkitCore.test.ts`).
