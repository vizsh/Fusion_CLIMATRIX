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

## Seed the database

The seed data is a 1:1 export of the frontend's dataset
(`frontend/src/lib/indiaGraphData.ts`), so the API and the UI describe the
same companies, hazards and dependency edges.

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

10 tests: 6 on the financial formula (parity with the frontend's
`stressPdLgd`/`computeImpact`, monotonicity, the 95% cap, per-company
summation vs. blended averages, mitigation math), 4 on the API (health,
company CRUD + 404, scenario-run validation, scenario persistence).

## What's real vs. not in this backend

- **Real**: the schema, the seeded graph (matches the frontend exactly), the
  ECL/scenario calculation (numerically verified identical to the frontend
  — see `tests/test_financial.py`), the NASA POWER connector (a genuine live
  external HTTP call with caching and honest error states).
- **Not implemented**: auth, multi-tenant org boundaries beyond the schema
  column, Alembic migrations (schema is created via `create_all` — fine for
  a prototype, not for production), the chatbot, the full portfolio
  dashboard, review-task tracking, CSV import endpoints. See
  `docs/DATA_STRATEGY.md` for the prioritized plan.
