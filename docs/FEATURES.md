# CLIMATRIX India — Feature catalog

Every feature in the product, grouped by module, with the function/file that
implements it and an honest **Real / Modeled / Assumption / Synthetic** tag
per the evidence taxonomy in [`lib/evidence.ts`](../frontend/src/lib/evidence.ts).
This is the detailed companion to the feature list in the root
[`README.md`](../README.md) — read that first for the overview and
screenshots.

---

## 1. Command Centre (`/`)

| Feature | Implementation | Tag |
|---|---|---|
| One-click flagship scenario launch | `CommandCentrePage.tsx` → `useScenarioStore.run()` | Real action |
| Real-world grounding (RBI 2024 climate stress-test pilot figures) | Static citation, sourced to RBI Bulletin, 18 Jan 2024 | Sourced |
| Quick links into every module | — | Real |

## 1a. Portfolio Dashboard (`/dashboard`)

| Feature | Implementation | Tag |
|---|---|---|
| KPI strip: total EAD, climate-exposed value, revenue at risk, ECL, protection gap | `lib/portfolioDashboard.ts` → `computeDashboardKPIs()` | Modeled |
| Physical vs. transition risk, independent axes | `lib/transitionRisk.ts` — disclosed sector transition-sensitivity table + policy-stringency dial | Assumption (disclosed) |
| Sector sensitivity vs. contribution, shown together | `computeSectorRisk()` | Modeled |
| Near/medium/long horizon comparison | `computeHorizonComparison()`, reuses existing severity/duration dial shape | Modeled |
| Derived alerts (region concentration, bottleneck exposure) | `computeDashboardAlerts()` — recomputed live, no persisted timestamps | Modeled |
| Named portfolios (custom holding subsets) | `useScenarioStore` — `portfolios`/`activePortfolioId`, localStorage-backed | Real |

## 1b. Governance & Proposals (`/governance`)

| Feature | Implementation | Tag |
|---|---|---|
| Propose a change to a disclosed assumption with a rationale | `backend/app/api/proposals.py`, `ProposedUpdate` table | Real (review-workflow prototype, no auth) |
| Approve/reject with reviewer + note, audit-trailed | Same table, `status`/`reviewer`/`reviewed_at` | Real |
| **Griid Bridge** — copy/download the live scenario as a fingerprinted text or JSON bundle | `buildContextBundle`/`buildContextPayload` in `lib/copilot/contextExport.ts` | Real |
| Shareable link restores an exact scenario, no backend call | `buildShareableLink`/`decodeShareParam`; auto-applied on load or mid-session by `AppShell.tsx`'s `griid` param watcher | Real |
| Paste-back import — accepts this tool's JSON, a teammate's, or a pasted markdown bundle | `parseImportedContext()` (JSON path + regex fallback over the human-readable export) | Real |
| Approved-only assumption ledger export, separate from pending proposals | `buildGovernanceBundle()` — so another AI workspace only cites reviewed, institutional figures | Real |
| Fingerprint recomputed on import to flag drift | `fingerprint()` (FNV-1a over the scenario fields), compared client-side, never trusted blindly | Real |

## 2. Digital Twin (`/twin`)

| Feature | Implementation | Tag |
|---|---|---|
| Native 3D terrain | MapLibre `raster-dem` source, free AWS Terrarium tiles | Sourced (real elevation data) |
| Satellite imagery | Esri World Imagery raster tiles, no API key | Sourced |
| Real India district boundaries (HP/KL/MH, reused for MB) | Bundled GeoJSON, `frontend/public/geo/` | Sourced |
| Satellite location thumbnails on every node inspector | `lib/satelliteThumbnail.ts` — Esri World Imagery `MapServer/export` REST call at the node's own coordinate; also in Company Investigation | Sourced (real coordinate, real imagery) |
| Kerala 2018 before/after satellite comparison | `lib/historicalImagery.ts` + `HistoricalComparison.tsx` — NASA GIBS Snapshot API, 6 Feb vs. 22 Aug 2018 (same dates NASA Earth Observatory's own published comparison uses) | Sourced |
| Supply-chain movement layer (one route per region: hazard → infra → company, labeled "demo simulation") | `lib/supplyChainRoutes.ts` + `RouteInspector.tsx` — real node coordinates, hand-authored illustrative polyline, click opens live financial sensitivity | Modeled (illustrative route geometry, real financial formula) |
| DEM-derived flood extent ribbon | `lib/floodModel.ts` — decodes real Terrarium elevation client-side (`createImageBitmap` + `OffscreenCanvas`), grows a ribbon from the river/road corridor until real terrain exceeds a severity-scaled water level | Modeled (real elevation input, disclosed hazard-to-waterlevel assumption) |
| Real OSM road/bridge geometry layer | `components/OsmRoadsLayer.tsx` → `GET /api/infra/osm` → OSM Overpass, cached per bbox | Sourced |
| Causal replay panel | `graphStages()` — BFS by hop over the **actual graph**, not a scripted sequence | Modeled |
| Live "current conditions" badge | Tomorrow.io connector | Sourced |
| Live river discharge badge | Open-Meteo/GloFAS connector | Sourced |
| Animated supply-chain marker along the active region's route | `pointAlong()` interpolation, driven by `runState`, truck/ship icon by movement mode | Illustrative, clearly labeled "demo simulation" |
| Click-to-inspect any asset | `EntityInspector`, shared with Dependency Explorer | Real |
| **Always opens on the India overview** | Fixed two real bugs: `initialViewState` was spreading a `center: [lng,lat]` tuple that react-map-gl's `ViewState` type doesn't recognize (silently defaulting away from India on the true first paint), and the region/selected-entity camera effects fired on mount using whatever stale region/selection the store already held — both excluded from the component's first mount | Real (bug fix) |

## 3. Dependency Explorer (`/dependency`)

| Feature | Implementation | Tag |
|---|---|---|
| 60-node, 95-edge exposure graph, auto-laid-out | `lib/dagreLayout.ts` + `@xyflow/react` | Mixed (see per-edge evidence class) |
| **Scenario-reactive highlighting with nothing selected** | `getDescendants(REGION_HAZARD[region])` recomputed on every region/hazard/severity change — the graph shows exactly what the active scenario reaches before any click (fixed from a prior version where only a selected node reacted) | Modeled |
| **Live "Scenario Impact" panel** | `computeImpact(scenario)` + `computeProtectionGap()`, company count, EAD at risk, baseline→stressed EL, protection gap %, sector breakdown — all reactive | Modeled |
| Free-text node search | Client-side label match | Real |
| "Seed a hazard" quick buttons | Sets region + selects the hazard node | Real |
| Hidden concentration risk panel | `computeBottlenecks()` — shared infra/supplier nodes reaching >1 company | Modeled |
| Institution concentration panel | `computeBankConcentration()` | Modeled |
| Full entity inspector on click | Hazard/infra/company/institution-specific stat blocks, including insurance tie-ins (§7) | Modeled |

## 4. Company Investigation (`/company`)

| Feature | Implementation | Tag |
|---|---|---|
| Direct vs. indirect infrastructure dependency, kept visually distinct | `companyExposureDetail()` — one-hop edge vs. multi-hop via supplier | Modeled |
| Live stressed PD/LGD | `stressPdLgd()` | Modeled, disclosed formula |
| **Insurance-adjusted LGD** | `computeInsuranceAdjustedCredit()` — reduces effective LGD by the modeled claim payout for an insured, in-scenario borrower | Modeled, disclosed formula |
| Dual bank/investor financial view | `computeImpact` vs. `computeEquityImpact`, forked by `userMode` | Modeled |
| Satellite facility thumbnail | `LocationThumbnail` at the company's own coordinate | Sourced |
| Due-diligence question list | Static, scenario-aware prompts | Real guidance |
| Lending-brief export (.txt) | `exportBrief()`, generated live from current state | Real |

## 5. Portfolio Impact (`/portfolio`)

| Feature | Implementation | Tag |
|---|---|---|
| Baseline vs. stressed EL, per-company summation | `computeImpact()` — `ECL = EAD × PD × LGD`, summed per borrower, never a blended average | Modeled |
| ±15% severity sensitivity band | `stressedElLow` / `stressedElHigh` in `computeImpact` | Modeled |
| Sector attribution chart | `bySector` breakdown | Modeled |
| Disclosed sector vulnerability multipliers | `lib/sectorVulnerability.ts` — Tourism 1.45×, Agriculture 1.35×, …, IT/BPO 0.5× | Assumption (disclosed) |
| Largest contributing risk pathways | `computeBottlenecks()` reused | Modeled |

## 6. Mitigation Studio (`/mitigation`)

| Feature | Implementation | Tag |
|---|---|---|
| Physical interventions (alt route, supplier diversification, grid hardening, early engagement) | `lib/interventions.ts` — `combinedReductionShare()` compounds enabled levers' loss-reduction fractions | Assumption (disclosed cost/effectiveness) |
| **Parametric severity-trigger cover** | `kind: 'parametric'` on `Intervention` — fixed ₹40cr payout once severity ≥ 70/100, exactly ₹0 below it (`parametricPayout()`, `isParametricTriggered()`) | Assumption, modeled with real basis risk |
| Live TRIGGERED/NOT TRIGGERED card state | `MitigationStudioPage.tsx`, reactive to `state.severity` | Modeled |
| Portfolio-level payout folded into mitigated EL | `computeImpact()` — `mitigatedEl = max(baselineEl, baselineEl + incrementalEl×(1-reduction) - payoutCr)` | Modeled |
| Pro-rata payout allocation in the per-borrower table | Allocated by each borrower's share of stressed EL | Modeled |
| Who-benefits per-borrower breakdown | `companyRows` in `MitigationStudioPage.tsx` | Modeled |
| Net modeled benefit (avoided loss − cost) | — | Modeled |

## 7. Insurance & Protection Gap (`/insurance`)

| Feature | Implementation | Tag |
|---|---|---|
| Protection gap split (insured vs. structurally uninsured exposure) | `computeProtectionGap()` in `lib/insurance.ts` | Modeled |
| Severity-scaled claim estimate | Same disruption-fraction mechanic as the equity lens's revenue-at-risk formula, net of deductible | Modeled, disclosed formula |
| Per-insurer book stress | `computeInsurerBook()` — sum insured, expected net claims, gross loss ratio | Modeled |
| Reinsurance cession | `cededReinsuranceSharePct` field on the insurer node | Assumption (disclosed) |
| PMFBY-style subsidized crop cover | Second insurer node (`insurer-2`) with `govtSubsidyPct` — same claim mechanic, but premium is split into farmer-paid vs. government-subsidized shares in `computeInsurerBook()` | Assumption (disclosed), modeling a real scheme's structure |
| Uninsured-exposed borrower ranking | Sorted by EAD, the actionable output for a coverage-covenant decision | Modeled |
| Deliberately incomplete coverage (only ~1/4 of companies insured) | `indiaGraphData.ts` — by design, so the gap is a real finding | Synthetic, intentionally realistic |

## 8. Scenario Lab (`/scenario`)

| Feature | Implementation | Tag |
|---|---|---|
| Free scenario construction across all dials | `ScenarioConsole` | Real |
| **Run Simulation leads somewhere dynamic** | `ScenarioConsole`'s new `onRunSimulation` callback — Scenario Lab passes `() => navigate('/twin')` since it has no map/graph of its own to animate; pages that do (Digital Twin, Dependency Explorer) don't pass it, so their own behavior is unchanged | Real |
| Live, plain-English "what this scenario does" summary | `summarizeImpactPlain()` in `useScenarioStore.ts` — reactive to every dial, not a static restatement of the inputs | Modelled |
| Saved scenarios | `localStorage`-backed, `useScenarioStore.savedScenarios` | Real (local only, not shared) |
| Scenario profiles (Baseline → Compound) | `SCENARIO_PROFILES` | Assumption (disclosed presets) |

## 8a. Real Market Climate Sensitivity (`/real-market`)

| Feature | Implementation | Tag |
|---|---|---|
| 18 real, publicly listed Indian companies, ranked by sensitivity index | `lib/realMarketSensitivity.ts` — real names/tickers/sectors | Sourced (identity), Assumption (classification) |
| Sensitivity direction (exposed/beneficiary/mixed/resilient) | Reuses the sector-vulnerability multiplier mechanic, extended with direction | Assumption, disclosed |
| **Scenario-aware index** — region/hazard/duration, not severity alone | `computeSensitivityIndex()` scales by duration (monthsFraction) and a sector→hazard relevance table (`SECTOR_RELEVANT_HAZARDS`); an "off-sector hazard" tag shows when the active hazard isn't this sector's real risk, instead of silently inflating every index the same way | Modelled |
| **Plain-English per-company summary** | `summarizePortfolioEffect()` — names the actual active region/hazard/duration/severity instead of a generic sector blurb | Modelled |
| Worst-case and favorable-scenario narratives per company | Hand-written, reasoned per sector — e.g. cement/infra majors modeled as reconstruction-demand beneficiaries | Assumption, disclosed |
| Live real-news search per company | `searchNews()` → backend NewsAPI/GNews connector | Sourced |
| Full `ScenarioConsole` (region/hazard/severity/duration/substitutability) | Replaced the original severity-only slider, which left this page's content identical regardless of which disaster scenario was active elsewhere in the app | Real |

## 8b. Reverse Stress Test (Copilot-only — no dedicated page)

| Feature | Implementation | Tag |
|---|---|---|
| "What severity would it take to breach ₹X cr" | `lib/reverseStressTest.ts` — binary search over `computeImpact`, valid because stressedEl is monotonic in severity | Modelled |
| Honest "not reachable" result | Returned instead of guessing when even severity 100 doesn't breach the target at the given duration/substitutability | Modelled |

Identified by reviewing `shreyascoder2006/fusion_earth` (a teammate's separate
alternate build of this same FIN-04 problem) — its own plan document listed
"reverse stress testing" as a P2 feature it never built. No new data or
model was needed — it's a search over the engine that already existed.

## 9. Evidence & Reports (`/evidence`)

| Feature | Implementation | Tag |
|---|---|---|
| Full evidence classification browser | `EVIDENCE_ITEMS`, filterable by class | Real (self-documenting) |
| Live weather check (NASA POWER → Open-Meteo fallback) | `LiveWeatherPanel.tsx` | Sourced |
| Live news / market intelligence search | `LiveNewsPanel.tsx` (NewsAPI/GNews, AlphaAI) | Sourced |
| Reference-ticker insider signal lookup | AlphaAI `ticker_insider_summary()` — explicitly NOT linked to synthetic companies | Sourced |
| Scenario report export (.txt) | `exportReport()`, generated live | Real |

## 9a. AI Copilot (every page — floating panel)

Rules-first, local-model fallback: regex rules in `lib/copilot/respond.ts`
resolve most messages for free; a local Ollama model (`ollamaClient.ts`) is
consulted only when a rule isn't confident, and even then it only picks ONE
intent from a closed list (`tools.ts`) — it never computes or writes the
answer. Every intent calls the same deterministic functions every dashboard
page uses (`lib/copilot/answers.ts`).

| Feature | Implementation | Tag |
|---|---|---|
| Natural-language scenario control ("set severity to 85...") | `answerSetScenario` — actually calls the store setters, not just describes | Real action |
| **Guided scenario automation ("automate a scenario for me")** | `lib/copilot/automation.ts` — a stateful wizard layered on top of the stateless rule engine; asks region → hazard → severity (preset or custom) → duration → substitutability one at a time (click a chip or type free text), then sets every dial, runs `computeImpact`, and reports the outcome with the same stat/table blocks every other answer uses. "cancel" exits without changing anything; an unrecognized answer re-asks instead of guessing | Real action |
| Company/institution lookup, region comparison, methodology explainer | `answerCompanyLookup`, `answerCompareRegions`, `answerMethodology` | Modeled |
| What-If multi-scenario + portfolio overview, downloadable briefs | `engine.ts`'s `generateWhatIf`/`generatePortfolioOverview` | Modeled |
| Reverse stress test, ML anomaly bridge, semantic news search | `answerReverseStressTest`, `answerWeatherAnomaly`, `answerBackendNewsSearch` | Modeled / Sourced |
| Supply-chain route lookup ("show me freight routes for X") | `answerRoutes` — same route + financial math as `RouteInspector.tsx` | Modeled |
| Guided tour of the whole app | `lib/copilot/tours.ts` | Real guidance |
| Griid Bridge quick actions (copy bundle, copy shareable link) in the panel header | `CopilotPanel.tsx` — full export/import surface lives on the Governance page (§1b) | Real |
| Voice input/output, OFF by default | `lib/copilot/voice.ts` — browser Web Speech API, no server round trip | Real |
| Expand/collapse toggle | `CopilotPanel.tsx` — the fixed 420px docked width was cramping tables/comparison blocks; expanded mode (`inset-5`) gives them room | Real (bug fix) |

## 10. Cross-cutting: the scenario engine

| Feature | Implementation | Tag |
|---|---|---|
| Single source of truth | `useScenarioStore` (Zustand) — every page subscribes to the same state | Real |
| Bank ⇄ Investor lens toggle | `userMode`, forks `computeImpact` vs `computeEquityImpact` at the UI layer | Real |
| Presentation Mode | `PresentationOverlay.tsx` — scripted step sequence driving real store actions, not a video | Real |
| Simulation clock | `useSimulationClock()` — real-time timeline tick while a scenario "runs" | Real |

## 11. Backend (optional, additive layer)

| Feature | Implementation | Tag |
|---|---|---|
| Typed REST API | FastAPI routers under `backend/app/api/` | Real |
| Migration-managed schema | Alembic (`backend/alembic/`) — no `create_all()`; every constraint named for SQLite batch-rebuild compatibility | Real |
| Schema shared 1:1 with frontend graph IDs, including institutions | `backend/seed_graph.json`, exported from `indiaGraphData.ts`; `Institution` table for banks/insurers | Real |
| Financial formula parity with frontend | `backend/app/services/financial.py`, numerically verified identical — `tests/test_financial.py` | Real |
| Insurance/protection-gap parity with frontend | `backend/app/services/insurance.py` ports `lib/insurance.ts` over real `Institution`/`Company.insurer_id` columns | Real |
| 7 external connectors with honest status reporting | `backend/app/connectors/*.py` — `ok` / `unconfigured` / `error` / `mock`, never a faked success | Real |
| OSM Overpass connector, cached per bounding box | `osm_overpass.py` + `OsmWay` model | Real (environment-dependent reachability, documented in `docs/DATA_STRATEGY.md`) |
| ML weather anomaly detector | `services/ml_anomaly.py` (z-score + IsolationForest) → `GET /api/weather/anomalies`, persisted to `WeatherAnomaly` | Modeled (real unsupervised ML over real data) |
| NLP semantic search + entity-linking | `services/nlp.py` (TF-IDF/cosine, gazetteer+difflib) → `GET /api/search/semantic`, `NewsEntityLink` | Modeled (real NLP, intentionally lightweight) |
| Per-scenario & per-portfolio data-quality rollups | `services/data_quality.py` → `ScenarioRun.data_quality_score`, `GET /api/portfolios/{id}/data-quality` | Modeled |
| Real geocoding pipeline | `services/geocoding.py` (free Nominatim) → `POST /api/assets` | Sourced (per-call), honestly labeled on failure |
| In-process TTL cache + structured request logging | `services/cache.py`, `logging_config.py` | Real |
| 48 passing tests | `backend/tests/` | Real |
