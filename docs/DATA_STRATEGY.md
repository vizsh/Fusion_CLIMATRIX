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

These matter more than raw connector count:

- **Evidence-to-claim linking is currently loose.** `EvidenceRecord.subject_id`
  is a free-text convention ("this evidence is about X"), not an enforced
  relationship. Before adding many more evidence rows, tighten this to a
  real foreign key (or a small polymorphic join table keyed on
  `subject_type` + `subject_id`) so a company's page can query "give me
  every evidence record that supports a claim about me" reliably instead of
  by string match.
- **Per-scenario data-quality score.** `ScenarioRun` already records which
  companies were in scope; it doesn't yet record what fraction of the edges
  in that scenario's propagation path were `sourced` vs `assumption` vs
  `synthetic`. Computing that (weighted by edge `weight`, already a column)
  gives a single honest "how much of this result is really evidence-backed"
  number per run — the evidence-quality indicator the brief's dashboard
  section asks for, without needing the full dashboard to show it.
- **Geocoding confidence pipeline.** When a new asset is added (manually or
  via a future CSV import), run it through a real geocoder and store
  whatever confidence tier it actually resolves to, rather than defaulting
  every new row to `approximate`. Even a free/open geocoder (Nominatim,
  rate-limited but usable for a prototype's volume) is enough to make this
  honest rather than asserted.
- **A `data_quality` rollup on Portfolio.** Once evidence linking is real,
  `GET /api/portfolios/{id}` can return a coverage percentage (how many of
  its positions' companies have at least one `sourced` evidence record) —
  the "data coverage indicator" from the dashboard brief, derivable from
  data already in the schema once the linkage above exists.

## Features these unlock

- **Anomaly-triggered alerts**: a scheduled job re-running NASA POWER/
  Open-Meteo for each hazard's coordinates and flagging when recent
  precipitation crosses a threshold — a genuine, non-fabricated "something
  changed" signal, distinct from the scenario severity dial (which stays a
  user input, never conflated with an observed anomaly).
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
