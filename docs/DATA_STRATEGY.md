# CLIMATRIX — Data Collection & Linkage Strategy

The single highest-leverage thing this prototype can do next is replace
synthetic entities and connections with sourced ones, one at a time, without
breaking the demo. This doc is the prioritized plan for that, written against
the connector interface and schema already in `backend/`.

## Where things stand after this pass

Six real connectors now live behind the same `DataConnector.fetch()` →
normalize → `ConnectorResult` (honest `ok`/`unconfigured`/`error`/`mock`
status) → persisted with `source` + `retrieved_at` → surfaced with a source
link pattern NASA POWER established:

| Connector | What it adds | Where it surfaces |
|---|---|---|
| NASA POWER | Historical daily precipitation/temperature | Evidence & Reports "Live Data Check" |
| Open-Meteo (archive) | Second independent historical reanalysis — automatic fallback if NASA POWER errors | Same endpoint, transparent fallback |
| Open-Meteo (flood/GloFAS) | **Real river discharge (m³/s)** for the Beas corridor — the first genuinely hydrological (not just meteorological) signal in the product | Digital Twin "BEAS RIVER DISCHARGE" badge |
| Tomorrow.io | Live current conditions (temp, humidity, rain intensity) — the "right now" complement to historical data | Digital Twin "NOW:" badge |
| NewsAPI + GNews | Region/hazard-scoped real news search, NewsAPI primary with automatic GNews fallback | Evidence & Reports "Recent Developments" |
| AlphaAI | Relevance-scored financial news search + reference-ticker SEC Form 4 insider summaries | Evidence & Reports "Market Intelligence" |
| OSM Overpass | Real road/bridge way geometry (centerline, not a survey) for each region's hazard corridor, replacing hand-placed infra points | Digital Twin "REAL ROAD DATA (OSM)" layer toggle |

Two things worth calling out from building these:

- **Every connector that accepts a server-side API key had its `source_url`
  checked for leaking that key back to the client** — Tomorrow.io, NewsAPI
  and GNews all put the key in the query string, and the first pass of each
  connector echoed `str(response.url)` straight back to the frontend.
  Fixed by constructing a redacted display URL instead. AlphaAI was never
  affected (it uses a Bearer header, not a query param) — worth noting as
  the safer pattern for any future connector.
- **Open-Meteo's flood API is forecast + a short recent window, not a deep
  historical archive** — useful to know before trying to pull a 2023
  discharge series the way the weather archive connectors can.
- Backend and frontend IDs match 1:1 (`co-hp-auto`, `hz-hp`, …) — this is the
  single decision that makes every future connector additive instead of
  requiring an ID-reconciliation layer.
- `Asset.geo_confidence` (`exact`/`approximate`/`centroid`) and
  `EvidenceRecord.evidence_class` (`sourced`/`modelled`/`assumption`/
  `synthetic`) already exist in the schema but are under-populated — most of
  the immediate value below comes from *filling these in*, not adding new
  columns.

## Next connectors, in order

1. ~~Open-Meteo Historical Weather API~~ — **done**, see table above.
2. ~~OSM Overpass API~~ — **done**, see table above.
   `GET /api/infra/osm?lat_min=&lng_min=&lat_max=&lng_max=` queries
   `highway=trunk|primary|secondary|tertiary` and `bridge=yes` ways inside a
   bounding box, caches every result per-bbox in `OsmWay` (Overpass is shared
   public infrastructure, not an SLA'd API — see the connector's docstring),
   and the Digital Twin's "REAL ROAD DATA (OSM)" toggle renders the returned
   way geometry as a map layer. Honest limitation worth recording: this
   project's own dev sandbox gets a `406` directly from `overpass-api.de`
   over Bash/Python `httpx` (verified live, and separately confirmed via a
   browser-pane `fetch()` from the same machine, which succeeded — pointing
   to IP-based anti-abuse blocking on Overpass's shared instance for this
   sandbox's outbound IP, not a query or code problem). The connector
   reports that as an honest `ConnectorStatus.ERROR` → `502`, exactly the
   "never fake success" pattern every other connector follows; a deployment
   on a different outbound IP may see it work live where this sandbox does
   not. `Asset.geo_confidence` is not yet bulk-upgraded from the OSM data —
   the endpoint exists and is wired into the UI, but nothing writes OSM way
   geometry back onto existing `Asset` rows yet.
3. **data.gov.in** district/sector datasets to replace the hand-assigned
   district risk scores (currently `assumption` class in
   `lib/districtRisk.ts`) with actual published indicators (rainfall
   deviation, agricultural statistics) — upgrades that evidence class to
   `sourced` for real.
4. **IMD (mausam.imd.gov.in)** nowcasts and warnings — investigate access
   terms before building; if usable, this is the connector that would let a
   "Live Data Check" become an actual early-warning signal during an active
   monsoon, not just a historical lookup.
5. **Company registry (MCA21 / BSE-NSE disclosures)** — only relevant if/when
   the product moves from synthetic demo companies toward real (even
   anonymized) ones. This is a bigger product decision, not a connector
   task: synthetic and real company data must never silently blend (brief's
   own requirement) — it would need a `Company.is_synthetic` gate (already
   in the schema) enforced at every read path, not just set at seed time.

## Better linkage, not just more sources

All four items below are now **done** — kept here as the record of why
they mattered, not as an open backlog:

- ~~Evidence-to-claim linking is currently loose~~ — **done.**
  `EvidenceRecord` now has a composite index on `(subject_type,
  subject_id)` and a `CheckConstraint` on the closed set of subject types,
  so "every evidence record about company X" is a real indexed query, not
  a string-match convention. See `backend/app/models/entities.py`.
- ~~Per-scenario data-quality score~~ — **done.** `ScenarioRun` now stores
  `data_quality_score` plus the full `sourced/modelled/assumption/
  synthetic` weight breakdown, computed once per run by
  `backend/app/services/data_quality.py` over the actual propagation path
  (edges reachable from the scenario's hazard, weighted by edge `weight`).
- ~~Geocoding confidence pipeline~~ — **done.** `POST /api/assets`
  (`backend/app/services/geocoding.py`) resolves a new asset through the
  free Nominatim API and stores whatever confidence tier its match
  quality actually supports, instead of defaulting to `approximate`.
- ~~A `data_quality` rollup on Portfolio~~ — **done.**
  `GET /api/portfolios/{id}/data-quality` returns the coverage percentage
  (share of positions whose company has ≥1 `sourced` evidence record).

### What else shipped in this pass

- **A real `Institution` table.** Banks, government finance bodies and
  insurers were previously only ever dangling string endpoints of a
  `DependencyEdge` — no backing row, nothing queryable about an insurer's
  reinsurance cession or a subsidized scheme's government-subsidy share.
  `Institution` plus `Company.insurer_id`/`sum_insured_cr`/
  `premium_rate_bps`/`deductible_pct` make the insurance graph a
  first-class, queryable part of the schema —
  `backend/app/services/insurance.py` ports the frontend's protection-gap
  and insurer-book math over it.
- **ML: a real weather anomaly detector**
  (`backend/app/services/ml_anomaly.py`) — rolling z-score + scikit-learn
  `IsolationForest` over a location's own NASA POWER/Open-Meteo history,
  requiring both methods to agree before flagging a day anomalous. This
  is the "Anomaly-triggered alerts" feature proposed below under
  "Features these unlock" — now built.
- **NLP: TF-IDF semantic search + gazetteer entity-linking**
  (`backend/app/services/nlp.py`) — news articles are now linked to the
  specific companies/regions they mention (`NewsEntityLink`), and
  `GET /api/search/semantic` ranks news/evidence by topical similarity,
  not just query-string match.
- **Alembic migrations, for real.** The schema was created via
  `Base.metadata.create_all()` with Alembic sitting unused in
  `requirements.txt` — now `alembic upgrade head` creates and evolves the
  schema, with every constraint explicitly named (SQLite's batch-rebuild
  mode requires it for ALTER operations).

## Features these unlock

- ~~Anomaly-triggered alerts~~ — **done**, including the background
  schedule: `app/services/scheduler.py` re-runs the detector for every
  region's hazard coordinates every `ANOMALY_SWEEP_INTERVAL_HOURS` (default
  6h) via a plain asyncio task started in `main.py`'s lifespan — no new
  dependency (Celery/APScheduler), which is all a single-instance
  prototype needs. `GET /api/weather/anomalies/sweep-status` reports
  whether it's running and what it last found. Disabled in tests via
  `ANOMALY_SWEEP_ENABLED=false` so the suite never makes live network
  calls on startup. A real multi-instance deployment would want this as
  an actual cron/worker process instead of an in-process loop.
- **Real landslide/flood susceptibility layers** (Bhuvan/ISRO, where terms
  allow) to replace the hand-drawn HP flood ribbon's severity-to-waterlevel
  assumption and the UK illustrative zone with sourced susceptibility
  classes, region by region — the DEM-ribbon computation already built this
  pass is the right shape for this; it just needs a sourced threshold
  instead of a disclosed assumption.
- **Historical replay validation**: now that real NASA POWER data for the
  documented HP (July 2023) and KL (Aug 2018) windows is one API call away,
  a "does the DEM flood ribbon's extent look plausible against the actual
  rainfall spike that week" sanity check becomes possible — worth doing
  before presenting the flood model as more than illustrative.

## Sequencing

Do the linkage tightening (evidence FK, data-quality rollup) before adding
the 3rd/4th connector — it's cheap, and every connector added after it
inherits a real quality signal for free instead of needing its own bespoke
"is this any good" logic.
