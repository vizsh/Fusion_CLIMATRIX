# CLIMATRIX backend

FastAPI + SQLAlchemy backend for the CLIMATRIX India prototype. See
`../docs/IMPLEMENTATION_AUDIT.md` for what this is and isn't, and
`../docs/DATA_STRATEGY.md` for the data-collection roadmap.

## Why SQLite instead of Postgres/PostGIS

The original brief asks for Postgres/PostGIS. This prototype uses SQLite by
default instead — deliberately, not as a shortcut:

- Zero setup: no Docker, no running database service, `pip install` and go.
- The schema stores point coordinates (lat/lng floats) for companies, assets
  and hazards — there are no polygon/route geospatial queries in this pass
  that would need PostGIS's actual spatial indexing.
- `DATABASE_URL` is the only thing that changes to move to Postgres
  (`postgresql+psycopg://user:pass@host:5432/climatrix`) — SQLAlchemy's
  ORM layer doesn't care which engine is underneath. A `docker-compose.yml`
  for local Postgres/PostGIS is a reasonable next step once something in
  the product actually needs spatial queries (see DATA_STRATEGY.md).

## Setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# .venv/bin/python -m pip install -r requirements.txt          # macOS/Linux
cp .env.example .env
```

## Migrate the database

The schema is **migration-managed** (Alembic) — there is no
`Base.metadata.create_all()` anywhere in the app anymore. A fresh checkout
(or any time the models change) needs one command:

```bash
.venv/Scripts/python.exe -m alembic upgrade head
```

To generate a new migration after changing a model in `app/models/entities.py`:

```bash
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "describe the change"
.venv/Scripts/python.exe -m alembic upgrade head
```

SQLite can't run most `ALTER TABLE` statements directly — `alembic/env.py`
sets `render_as_batch=True` so Alembic rebuilds the table instead, but any
`CheckConstraint`/`ForeignKey` added this way must be explicitly named
(SQLite's batch-rebuild requires it) or the migration will fail with
`Constraint must have a name`. All constraints in `entities.py` are named
for exactly this reason.

## Seed the database

The seed data is a 1:1 export of the frontend's dataset
(`frontend/src/lib/indiaGraphData.ts`), so the API and the UI describe the
same companies, hazards, institutions (banks/insurers) and dependency
edges — run `alembic upgrade head` first.

```bash
.venv/Scripts/python.exe -m app.db.seed
```

### Regenerating the seed data

If `indiaGraphData.ts` changes, re-export it:

```bash
cd frontend
npx esbuild src/lib/indiaGraphData.ts --bundle --platform=node --format=cjs --outfile=../backend/_export_graph.cjs
node -e "const d=require('../backend/_export_graph.cjs'); require('fs').writeFileSync('../backend/seed_graph.json', JSON.stringify({NODES:d.NODES,EDGES:d.EDGES}))"
rm ../backend/_export_graph.cjs
cd ../backend && rm -f climatrix.db && .venv/Scripts/python.exe -m app.db.seed
```

## Run

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`. Health check at `/api/health`.

The frontend looks for the backend at `http://localhost:8000` by default
(override with `VITE_API_BASE_URL` in `frontend/.env`). Only one page
currently calls the backend — Evidence & Reports' "Live Data Check" panel —
see `docs/IMPLEMENTATION_AUDIT.md` for why the rest of the app still runs on
the bundled dataset.

## Test

```bash
.venv/Scripts/python.exe -m pytest tests/ -v
```

48 tests: 6 on the financial formula (parity with the frontend's
`stressPdLgd`/`computeImpact`, monotonicity, the 95% cap, per-company
summation vs. blended averages, mitigation math), the API surface (health,
company CRUD + 404, scenario-run validation and persistence, infra/OSM),
connector honesty under missing/failed credentials, and
`test_ml_nlp_dbms.py`'s coverage of the ML anomaly detector, NLP semantic
search/entity-linking, the data-quality rollups, and the insurance/
institution service.

## ML, NLP and data-quality layer

- **`app/services/ml_anomaly.py`** — real scikit-learn anomaly detection
  (rolling z-score + `IsolationForest`) over a location's own weather
  history, exposed at `GET /api/weather/anomalies`. Flags a day only when
  both methods agree.
- **`app/services/nlp.py`** — TF-IDF + cosine-similarity semantic search
  (`GET /api/search/semantic`) and gazetteer-based entity-linking, wired
  into both news endpoints so a fetched article is linked to the specific
  companies/regions it mentions (`NewsEntityLink`), not just tagged with
  its search query.
- **`app/services/data_quality.py`** — per-scenario-run and per-portfolio
  evidence-weighted data-quality rollups (`ScenarioRun.data_quality_score`,
  `GET /api/portfolios/{id}/data-quality`).
- **`app/services/geocoding.py`** — real geocoding via the free Nominatim
  API, used by `POST /api/assets` instead of defaulting every new asset's
  `geo_confidence` to `'approximate'`.
- **`app/services/insurance.py`** — the protection-gap and insurer-book
  calculations ported from the frontend's `lib/insurance.ts`, now that
  `Institution` (banks/insurers) and `Company.insurer_id` are real,
  queryable columns instead of dangling edge-endpoint strings. Exposed at
  `GET /api/institutions` and `GET /api/institutions/{id}/book`.
- **`app/services/cache.py`** — a small in-process TTL cache applied to
  the connector-backed weather endpoints, so a free/shared API isn't
  re-hit on every request for the same arguments.

## What's real vs. not in this backend

- **Real**: the migration-managed schema (see above), the seeded graph
  including financial institutions (matches the frontend exactly), the
  ECL/scenario calculation (numerically verified identical to the frontend
  — see `tests/test_financial.py`), 7 live external connectors, the ML
  anomaly detector and NLP search/linking above (all genuine computations
  over real or realistic data, not hardcoded).
- **Not implemented**: auth, multi-tenant org boundaries beyond the schema
  column, the full portfolio dashboard, review-task tracking, CSV import
  endpoints. See `docs/DATA_STRATEGY.md` for the prioritized plan.
