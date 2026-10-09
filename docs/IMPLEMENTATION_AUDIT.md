# CLIMATRIX India — Implementation Audit

Written against commit `de5d779` (main), before the backend work in this pass.

## 1. Current architecture

**Frontend only.** `frontend/` is a Vite + React 19 + TypeScript SPA. There is no
backend, no database, no API layer, and no `.env`/connector config anywhere in
the repository prior to this change.

- **Routing**: `react-router` `HashRouter`, pages under `src/pages/*Page.tsx`,
  shell in `src/layout/AppShell.tsx`.
- **State**: a single Zustand store (`src/store/useScenarioStore.ts`) holds
  the entire scenario (region, hazard, severity, duration, substitutability,
  interventions, selected entity, run state, user mode, saved scenarios) and
  the financial calculation functions (`computeImpact`, `stressPdLgd`,
  `computeEquityImpact`). This is the application's one source of truth —
  every page reads it, so cross-module consistency (brief's "map, graph,
  company profile and financial metrics must reflect the same scenario
  state") already holds today, entirely client-side.
- **Graph/dataset**: `src/lib/indiaGraphData.ts` is a hardcoded TypeScript
  array of ~50 nodes and ~75 edges (hazards, infrastructure, suppliers,
  companies, banks/NBFCs/govt/insurer) with coordinates, sectors, EAD/PD/LGD.
  This is the *only* data source in the app — there is no fetch, no CSV
  import, no persistence beyond `localStorage` (used only for saved scenario
  configs, in `useScenarioStore`'s `savedScenarios`).
- **Geospatial**: MapLibre GL JS (`react-map-gl/maplibre`), native 3D terrain
  via free AWS Terrarium elevation tiles + Esri satellite imagery (no Cesium,
  no API keys). Real India district boundaries (HP/KL/MH) bundled as static
  GeoJSON in `frontend/public/geo/`, fetched client-side.
- **Graph visualization**: `@xyflow/react` (React Flow) + `dagre` for
  auto-layout in Dependency Explorer; a separate 3D R3F force-graph that
  existed in an earlier iteration was removed during the digital-twin
  redesign.
- **Charts**: `echarts-for-react`.

## 2. Feature status (what's real vs. decorative)

| Feature | Status |
|---|---|
| Scenario state sync across pages | **Real** — one Zustand store, every page subscribes |
| ECL calc (EAD×PD×LGD, per-borrower, sector-weighted) | **Real calculation**, synthetic inputs |
| Equity/revenue-at-risk calc | **Real calculation**, synthetic inputs, disclosed assumption ratios |
| Dependency graph traversal (ancestors/descendants/bottlenecks) | **Real** — actual BFS over the static edge list |
| DEM-derived flood ribbon (HP) | **Real computation** over real elevation tiles; hazard-to-waterlevel mapping is a disclosed assumption |
| District risk choropleth | Real boundaries, **assumption-labeled** risk scores (not sourced) |
| Mitigation Studio recompute | **Real** — toggling an intervention changes the actual formula inputs |
| Saved scenarios | Real, but `localStorage` only — lost on browser data clear, not shared across devices/users |
| Presentation Mode | Real, scripted step sequence (calls real store actions, not a video) |
| Evidence & Reports export | Real text-file generation from live computed state |
| Company/portfolio/EAD figures | **Synthetic** — fabricated for the demo, clearly labeled throughout |
| Live weather/hazard feeds | **None** prior to this pass |
| Backend/API/database | **None** prior to this pass |
| Auth/multi-tenant/orgs | **None** |
| Chatbot | **None** |

No dead code, nonfunctional buttons, or duplicated calculation logic were
found as of this audit — the prior redesign passes already consolidated the
financial formula into one function (`computeImpact`/`stressPdLgd`) used
consistently by Portfolio Impact, Mitigation Studio, Company Investigation
and the graph inspector.

## 3. Data classification (as displayed to the user today)

The app already carries a four-way evidence taxonomy (`src/lib/evidence.ts`):
`sourced` / `modelled` / `assumption` / `synthetic`, applied per-edge in the
graph and surfaced in Evidence & Reports. This pass extends it with actually
**sourced** records (a real external API call), rather than adding a new
taxonomy.

## 4. What's missing against the brief

Everything in Stages 4–7 of the brief (institutional portfolio dashboard,
full connector suite, evidence/review-task persistence, chatbot) is **not
implemented** in this pass — see `docs/DATA_STRATEGY.md` for the prioritized
plan. What *is* implemented this pass is the foundation those stages need:
a real backend, a real schema, one real external data connector with
provenance, and typed API endpoints the frontend can call.

## 5. Implementation sequence followed in this pass

1. FastAPI + SQLAlchemy backend, SQLite by default (`DATABASE_URL` env-
   configurable — swapping to Postgres/PostGIS is a connection-string change,
   not a rewrite; see trade-off note in `backend/README.md`).
2. Schema: organizations, portfolios, positions, companies, assets, hazard
   events, evidence records, scenario runs — normalized, seeded from the
   existing `indiaGraphData.ts` so API and frontend describe the same world.
3. One real connector: NASA POWER (free, no key, documented historical
   meteorological API) — fetches real daily precipitation/temperature for a
   given lat/lon + date range, stores the response with full provenance
   (source URL, retrieved-at timestamp, resolution).
4. Typed REST endpoints + pytest coverage for the ECL formula and the
   connector.
5. One frontend integration point proving the pipe works end-to-end (see
   Evidence & Reports — "Live Weather Check").

## 6. Risks and assumptions

- SQLite is not PostGIS — geometry is stored as plain lat/lng floats, not
  PostGIS geometry columns. Fine for point assets at this scale; would need
  a real migration (not just a connection-string swap) if polygon/route
  geospatial queries become load-bearing.
- NASA POWER has no SLA guarantee and can be slow/unavailable; the frontend
  integration handles timeout/error states explicitly rather than assuming
  success.
- The backend is NOT wired to replace the frontend's primary dataset in this
  pass — `indiaGraphData.ts` remains the live source for the interactive
  demo (fast, reliable, offline-safe). The backend is additive: a real,
  running, tested API surface alongside the existing synthetic frontend
  dataset, with one proven live-data integration. Migrating the frontend to
  be backend-authoritative for all entities is the largest remaining
  project and is sequenced in `docs/DATA_STRATEGY.md`.
