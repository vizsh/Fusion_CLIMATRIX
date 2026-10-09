# CLIMATRIX India — Architecture

System design and the reasoning behind the choices that aren't obvious from
reading the code in isolation. See [`FEATURES.md`](FEATURES.md) for what
each piece does, and the root [`README.md`](../README.md) for the overview.

## 1. The core design decision: one graph, one state, every view derives from it

`frontend/src/lib/indiaGraphData.ts` is a single TypeScript array of ~51
nodes (hazards, infrastructure, suppliers, companies, banks/NBFCs/govt/
insurer) and ~74 typed, directed edges
(`AFFECTED_BY | DEPENDS_ON | SUPPLIES | TRANSPORTS_VIA | FINANCED_BY |
INSURED_BY`). It is the only data source for the interactive demo — no
fetch, no CSV import, nothing hidden behind a loading state.

`frontend/src/store/useScenarioStore.ts` (a single Zustand store) holds the
entire scenario — region, hazard, severity, duration, substitutability,
active interventions, selected entity, run state, bank/investor mode — plus
the financial calculation functions themselves (`stressPdLgd`,
`computeImpact`, `computeEquityImpact`). Every page subscribes to this one
store. There is no per-page duplicated state and no possibility of the map,
the graph, the financial figures and the narrative text disagreeing with
each other, because they're all reading the same object.

Everything downstream — `lib/graphAnalytics.ts` (BFS traversal: ancestors,
descendants, bottlenecks, hazard reach), `lib/insurance.ts` (protection gap,
insurer book stress), `lib/interventions.ts` (mitigation and parametric
payout) — is a **pure function** over this graph and this state. No class
instances, no hidden caches, no React context beyond the one store. This is
what makes the scenario-reactive behavior (e.g. Dependency Explorer
re-highlighting the graph the instant severity changes) a one-line
consequence of the architecture rather than a feature that had to be wired
up page by page.

## 2. Why a bug looked like "nothing reacts to the scenario" and how the architecture made the fix a few lines

Before a recent pass, Dependency Explorer's graph view and side panels only
changed when a node was clicked or searched — `chain` was `null` otherwise,
and the dimming logic fell back to "show everything," so the scenario
console's own dials had no visible effect until the user drilled into
something. The fix was not a rewrite: `getDescendants(REGION_HAZARD[region])`
was already available from `graphAnalytics.ts`; the only change was using it
as the fallback "what's in scope" set instead of "everything," and adding one
`useMemo(() => computeImpact(scenario), [...])` panel that was already
callable from existing exported functions. That the fix was small is the
architecture working as intended — every analytical building block already
existed and was already pure, so making a new corner of the UI reactive to
the shared state didn't require touching the state model at all.

## 3. The financial engine

### Credit (bank) lens
```
ECL = EAD × PD × LGD
```
computed **per company and summed** — never a blended portfolio average.
Stress is applied via one function (`stressPdLgd`), shared by every
caller (Portfolio Impact, Mitigation Studio, Company Investigation, the
graph inspector) so there is exactly one place the formula could diverge,
and it doesn't:

```
subMultiplier = { Limited: 1.25, Moderate: 1.0, Strong: 0.75 }[substitutability]
severityFactor = (severity / 100) × vulnerability
stressedPd = min(baselinePd × (1 + severityFactor × 4 × subMultiplier × (0.5 + durationFactor)), 0.95)
stressedLgd = min(baselineLgd + severityFactor × 0.15 × subMultiplier, 0.95)
```

`vulnerability` is a per-sector multiplier (`lib/sectorVulnerability.ts`,
Tourism 1.45× down to IT/BPO 0.5×) — a disclosed assumption, not a
calibrated empirical result, stated as such everywhere it's shown.

### Equity (investor) lens
A deliberately separate calculation (`computeEquityImpact`), not the credit
formula repackaged:
```
revenueAtRiskCr = annualRevenueCr × 0.55 (assumed exposed-revenue share) × disruptionFraction × monthsFraction
marginImpactCr = revenueAtRiskCr × 0.16 (assumed operating margin)
```

### Insurance lens
`lib/insurance.ts` reuses the same disruption-fraction mechanic as the
equity lens (consistency across lenses was a deliberate choice) to estimate
a claim:
```
disruptionFraction = min((severity / 100) × vulnerability × monthsFraction, 1)
grossClaimCr = sumInsuredCr × disruptionFraction
netClaimCr = grossClaimCr × (1 − deductiblePct)
```
and folds the insured portion back into the credit view as an
**insurance-adjusted LGD**:
```
insuranceOffsetCr = min(netClaimCr, eadCr × stressedLgd)
effectiveLgd = max(0, (eadCr × stressedLgd − insuranceOffsetCr) / eadCr)
```
This is the one place in the product where the insurance graph changes a
*bank's* number, not just an insurer's — a lender's effective tail risk is
lower for a covered borrower, and the model says so explicitly instead of
treating credit and insurance as unrelated silos.

### Parametric mitigation (basis risk, modeled honestly)
Every other mitigation lever is a smooth loss-reduction percentage
(`combinedReductionShare`, interventions compound multiplicatively). A
parametric trigger is fundamentally not that: real index/parametric
insurance pays a **fixed** amount the instant an agreed index crosses a
threshold, and pays **nothing** if it doesn't — no claims adjustment, no
partial credit for "almost." `parametricPayout()` is intentionally a step
function, not interpolated:
```
payout = severity >= triggerThreshold ? fixedPayoutCr : 0
mitigatedEl = max(baselineEl, baselineEl + incrementalEl × (1 − reduction) − payout)
```
The UI shows a live TRIGGERED/NOT TRIGGERED state so the cliff is visible,
not smoothed into the kind of chart that would misrepresent how parametric
products actually behave.

## 4. Backend: additive, not yet authoritative

`backend/` is a real, independently testable FastAPI + SQLAlchemy service —
not a mock. Three design decisions matter:

1. **ID parity.** `Company`/`Asset`/`HazardEvent`/`DependencyEdge` primary
   keys are byte-identical to the frontend's `indiaGraphData.ts` IDs
   (`co-hp-auto`, `hz-hp`, …), seeded via `backend/seed_graph.json` (a JSON
   export of the same TS file, regenerated with `esbuild` — see
   `backend/README.md`). This is the single decision that makes a future
   "frontend fetches from the API instead of its bundled file" migration a
   data-source swap, not an ID-reconciliation project.
2. **Formula parity, verified, not assumed.** `backend/app/services/
   financial.py` ports `stressPdLgd`/`computeImpact` line for line;
   `backend/tests/test_financial.py` checks the Python and TypeScript
   outputs are numerically identical on the same inputs, not just
   "structurally similar."
3. **Connector honesty.** Every connector (`backend/app/connectors/*.py`)
   returns a `ConnectorResult` with an explicit `ConnectorStatus` —
   `ok | unconfigured | error | mock` — and never fakes a successful empty
   response when a key is missing or a request fails. This was enforced
   under test (`tests/test_connectors.py`) after being established as a
   hard rule during the Overpass connector's build (see §5).

SQLite was chosen over the brief's requested Postgres/PostGIS deliberately:
there are no polygon/route geospatial queries in this pass that would need
real spatial indexing (every stored coordinate is a point), and
`DATABASE_URL` is the only thing that changes to move to Postgres later —
see `backend/README.md` for the full tradeoff note.

## 5. A worked example of the project's "verify before building" pattern: OSM Overpass

Every connector in this codebase was live-tested before its integration
code was written, and the Overpass connector is the clearest example of why
that discipline matters. Overpass is a free, shared, keyless public
instance with explicit anti-abuse protection. Requests from this project's
own development sandbox's outbound IP got a hard `406` from `curl` and from
Python `httpx` alike — but the identical query, sent via a real browser's
`fetch()` from the same machine, succeeded and returned real OSM way
geometry. That ruled out a syntax or timeout-directive problem and pointed
specifically at IP-based rate-limiting on the shared instance. The connector
was built to match: a plain query with no `[timeout:N]` directive, relying
on the HTTP client's own timeout, and an honest `ConnectorStatus.ERROR` →
`502` on failure rather than masking the problem. A deployment running from
a different outbound IP may see this connector succeed live where this
sandbox's own tests do not — documented plainly in
[`DATA_STRATEGY.md`](DATA_STRATEGY.md) rather than overstating what was
actually verified.

## 6. Evidence integrity as an architectural constraint, not a disclaimer

`lib/evidence.ts`'s four-way taxonomy (`sourced | modelled | assumption |
synthetic`) is attached per-edge in the graph (`GEdge.evidence`), per-record
in the backend (`EvidenceRecord.evidence_class`), and per-connector
(`DataConnector.evidence_class`) — it's a type that flows through the data
model, not a label applied only on the Evidence & Reports page. This is why
new features (insurance, the parametric trigger) extend the same taxonomy
instead of inventing a new disclosure pattern each time: a feature isn't
"done" in this codebase until its evidence class is assigned and its
formula is stated in the UI, not just in a docstring.
