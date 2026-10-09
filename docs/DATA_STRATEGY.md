# CLIMATRIX — Data Collection & Linkage Strategy

The single highest-leverage thing this prototype can do next is replace
synthetic entities and connections with sourced ones, one at a time, without
breaking the demo. This doc is the prioritized plan for that, written against
the connector interface and schema already in `backend/`.

## Where things stand after this pass

- One real connector (NASA POWER) proves the pattern: `DataConnector.fetch()`
  → normalize → `ConnectorResult` with an honest status
  (`ok`/`unconfigured`/`error`/`mock`) → persisted with `source` +
  `retrieved_at` → surfaced to the user with a source link, never a fake
  "live" badge.
- Backend and frontend IDs match 1:1 (`co-hp-auto`, `hz-hp`, …) — this is the
  single decision that makes every future connector additive instead of
  requiring an ID-reconciliation layer.
- `Asset.geo_confidence` (`exact`/`approximate`/`centroid`) and
  `EvidenceRecord.evidence_class` (`sourced`/`modelled`/`assumption`/
  `synthetic`) already exist in the schema but are under-populated — most of
  the immediate value below comes from *filling these in*, not adding new
  columns.

## Next connectors, in order

1. **Open-Meteo Historical Weather API** (free, no key, higher resolution
   than NASA POWER for India, already referenced in the project's own FIN-04
   doc). Implement as a second `DataConnector` alongside NASA POWER and let
   the weather endpoint fall back between them — the first genuinely
   multi-source connector, which is also the first real test of the
   provider-adapter pattern actually paying off.
2. **OSM Overpass API** for real road/bridge/facility geometry. Right now
   every `infra`/`supplier` coordinate in the graph is a hand-placed point
   (`geo_confidence` would honestly be `centroid` for almost all of them).
   Overpass queries for `highway=*`, `bridge=yes`, `man_made=works` near each
   hazard's bounding box would let us replace hand-placed points with real
   OSM way geometry and flip `geo_confidence` to `approximate` or `exact`
   honestly, not by assertion. Cache aggressively — Overpass is shared
   public infrastructure, not an SLA'd API.
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
