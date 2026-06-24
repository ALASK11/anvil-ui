# Anvil UI — Codebase Context

This repo is the **Next.js 15 / React 19 frontend** for Anvil (government contract intelligence platform). It is read-only against the backend's Cloud SQL database and calls one upstream Cloud Run service for sourcing.

## Backend project location

The Python backend (SQLAlchemy ORM, scrapers, scoring, sourcing orchestrator, FastAPI service) lives at:

```
/home/angelo-laskaris/Desktop/spartan_software/anvil/anvil
```

When a question references a DB table, column, pipeline stage, or upstream service, **the backend repo is the canonical source of truth** — read it directly rather than relying on memory or this repo's stale artifacts.

### Where things live in the backend

| If the question is about... | Read from |
|---|---|
| DB schema (table + column definitions) | `backend/app/models/` — `opportunity.py`, `clin_item.py`, `sourcing_result.py`, `supplier.py`, `outcome.py`, `duplicate_link.py`, `fpds_market.py`, `opportunity_document.py` |
| Pipeline writer code (who sets which columns, when) | `backend/app/services/` — `discovery/`, `scoring/`, `sourcing/`, `storage/` |
| Migrations (real DB schema as deployed) | `backend/alembic/` |
| The Cloud Run sourcing service (`/api/source` upstream) | `production/server.py` and `backend/app/services/sourcing/orchestrator.py` |
| Pipeline architecture / design intent | `PHASE1_DISCOVERY_DESIGN.md`, `PHASE2_SCORING_DESIGN.md`, `PHASE3_SOURCING_DESIGN.md` |
| Source-specific scraper behavior | `PLANETBIDS_PRIMER.md`, `RFP_SOURCES.md`, `STATE_PROCUREMENT_PORTALS.md`, `MUNI_SCRAPER_ARCHITECTURE.md` |
| Project-wide overview | `PROJECT.md`, `OVERVIEW.html` |

## Stale artifacts in *this* repo — do not trust

- `schema.sql` — describes an older schema (`rfps`, `raw_rfps`, `scrape_sources` with SERIAL ids). The real schema is the SQLAlchemy models in the backend.
- `main.tf`, `pipeline.tf`, `variables.tf`, `terraform.tfstate.*.backup` — TF files for an instance named `anvil-pipeline-db` that does not exist. Real Cloud SQL instance is `anvil-intelligence-db`, real backend TF lives in the backend repo.

## Conventions in this UI

- **DB access is read-only except for human-input surfaces.** The Next.js Cloud Run SA has `SELECT` on everything, plus:
  - `UPDATE` on `opportunities.is_product`, `opportunities.commentary`, `opportunities.is_starred`, `opportunities.updated_at` (in-line label editing via [src/components/OpportunityLabels.tsx](src/components/OpportunityLabels.tsx) and the star toggle on the RFP list, both → `PATCH /api/opportunity/[id]/labels`).
  - `INSERT` on `clin_items_human` and `sourcing_results_human` (the human-review shadow tables — see `backend/app/models/clin_item_human.py` and `sourcing_result_human.py`). Wired via `POST /api/clins/approve` from the CLIN approval form. These tables are explicitly invisible to backend pipeline code by design — keep that constraint when adding new write paths.
  - Everything else is pipeline-owned; new write surfaces should either go through a backend endpoint (see `/api/source` for the pattern) or get an explicit column-level grant added here and in [gcloud_actions.txt](gcloud_actions.txt).
- **All money is integer cents** in the DB. Always divide by 100 for display.
- **`fit_score` is 0–100** (higher = better). `pct_small_business` and `yoy_change` in `fpds_market` are stored as fractions (0.05 = 5%).
- **JSONB columns may be double-encoded** in some rows (e.g. `suppliers.category_focus`, possibly others). Use defensive parsing — try `JSON.parse` if value comes back as a string. See `src/lib/opportunity-links.ts:toRecord` for the pattern.
- **Document streaming** uses the `/api/doc?id=<uuid>` proxy, not signed URLs. The proxy looks up the doc by UUID and streams from GCS using the server-side identity.
- **Source-specific outbound links** live in `src/lib/opportunity-links.ts` — add a new `*Links()` function alongside `planetbidsLinks()` when adding sam.gov / bidnet / etc.

## GCP infra (production, as deployed)

- Project: `anvil-private`, region: `us-central1`
- Cloud SQL instance: **`anvil-intelligence-db`** (Postgres), database: `govcon`
- Next.js Cloud Run service: `private-nextjs-site` (IAP-protected)
- Sourcing Cloud Run service: `anvil-sourcing` (`https://anvil-sourcing-169801273048.us-central1.run.app`)
- Compute SA used by Next.js (currently default): `169801273048-compute@developer.gserviceaccount.com`
- Cloud SQL IAM Postgres username for that SA: `169801273048-compute@developer`
