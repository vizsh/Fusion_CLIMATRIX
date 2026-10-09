# Getting started

Two independent pieces: the **frontend** (the interactive demo — works
completely standalone, no backend required) and the **backend** (optional,
powers the "live data" panels and exposes a typed API). Run just the
frontend for the fastest path to seeing the product; add the backend if you
want the real external-data connectors working.

## Prerequisites

- Node.js 20+ and npm (frontend)
- Python 3.11+ (backend, optional)

## 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5181` (see `vite.config.ts` for the port). This
is the entire interactive product — Digital Twin, Dependency Explorer,
Portfolio Impact, Mitigation Studio, Insurance & Protection Gap, Company
Investigation, Evidence & Reports, Presentation Mode — running entirely on
the bundled `src/lib/indiaGraphData.ts` dataset, no network calls required
except for public map tiles (Esri satellite, AWS elevation, OpenStreetMap).

Other commands:

```bash
npm run build     # tsc -b && vite build — production build
npm run lint      # oxlint
npx tsc --noEmit  # typecheck only, no build output
```

## 2. Backend (optional)

Powers: Evidence & Reports' live weather/news panels, the Digital Twin's
live conditions/river-discharge badges, the OSM real-road-data map layer,
and a typed REST API with its own independently seeded database.

```bash
cd backend
python -m venv .venv

# Windows
.venv/Scripts/python.exe -m pip install -r requirements.txt
# macOS/Linux
.venv/bin/python -m pip install -r requirements.txt

cp .env.example .env
```

### Connector API keys (optional — each connector degrades honestly without one)

Edit `.env` to add any of these. Every connector reports
`ConnectorStatus.UNCONFIGURED` (not a crash, not a fake success) if its key
is missing — the product works without any of them, just with fewer live
panels populated.

| Variable | Connector | Get a key |
|---|---|---|
| `TOMORROW_IO_API_KEY` | Live current conditions | [tomorrow.io](https://www.tomorrow.io/) |
| `NEWSAPI_KEY` | Region/hazard news search | [newsapi.org](https://newsapi.org/) |
| `GNEWS_API_KEY` | News search fallback | [gnews.io](https://gnews.io/) |
| `ALPHAI_API_KEY` | Financial news + insider summaries | AlphaAI |

NASA POWER, Open-Meteo (archive + flood) and OSM Overpass need no key.

### Seed the database

```bash
.venv/Scripts/python.exe -m app.db.seed
```

The seed data is a 1:1 export of the frontend's dataset — same company,
hazard and dependency-edge IDs — so the API and the UI describe the same
world. If you change `frontend/src/lib/indiaGraphData.ts`, regenerate it:

```bash
cd frontend
npx esbuild src/lib/indiaGraphData.ts --bundle --platform=node --format=cjs --outfile=../backend/_export_graph.cjs
node -e "const d=require('../backend/_export_graph.cjs'); require('fs').writeFileSync('../backend/seed_graph.json', JSON.stringify({NODES:d.NODES,EDGES:d.EDGES}))"
rm ../backend/_export_graph.cjs
cd ../backend && rm -f climatrix.db && .venv/Scripts/python.exe -m app.db.seed
```

### Run

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`. Health check: `GET /api/health`.
The frontend looks for the backend at `http://localhost:8000` by default —
override with `VITE_API_BASE_URL` in `frontend/.env` if you run it
elsewhere.

### Test

```bash
.venv/Scripts/python.exe -m pytest tests/ -v
```

15 tests: financial-formula parity with the frontend (monotonicity, the 95%
cap, per-company summation vs. blended averages, mitigation math), connector
honesty under missing/failed credentials, and the API surface (health,
company CRUD, scenario-run validation and persistence, infra/OSM endpoint).

## 3. A good first tour

1. Start the frontend only (step 1 above — no backend needed for this).
2. Open Command Centre, click **Launch a climate stress scenario**.
3. Go to **Digital Twin**, fly to the Kullu-Manali valley, toggle **REAL
   ROAD DATA (OSM)** (needs the backend running, step 2).
4. Go to **Dependency Explorer**, drag the severity slider — watch the graph
   re-highlight and the live Scenario Impact panel update with nothing
   clicked.
5. Go to **Mitigation Studio**, enable **Parametric severity-trigger
   cover**, then drag severity across the 70/100 threshold to see the
   TRIGGERED state flip and net benefit swing from positive to the cost of
   a sunk premium.
6. Go to **Insurance & Protection Gap** to see the same scenario's
   uninsured-exposure ranking.

See the root [`README.md`](../README.md) for screenshots of each of these.
