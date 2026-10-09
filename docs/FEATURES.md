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

## 2. Digital Twin (`/twin`)

| Feature | Implementation | Tag |
|---|---|---|
| Native 3D terrain | MapLibre `raster-dem` source, free AWS Terrarium tiles | Sourced (real elevation data) |
| Satellite imagery | Esri World Imagery raster tiles, no API key | Sourced |
| Real India district boundaries (HP/KL/MH) | Bundled GeoJSON, `frontend/public/geo/` | Sourced |
| DEM-derived flood extent ribbon | `lib/floodModel.ts` — decodes real Terrarium elevation client-side (`createImageBitmap` + `OffscreenCanvas`), grows a ribbon from the river/road corridor until real terrain exceeds a severity-scaled water level | Modeled (real elevation input, disclosed hazard-to-waterlevel assumption) |
| Real OSM road/bridge geometry layer | `components/OsmRoadsLayer.tsx` → `GET /api/infra/osm` → OSM Overpass, cached per bbox | Sourced |
| Causal replay panel | `graphStages()` — BFS by hop over the **actual graph**, not a scripted sequence | Modeled |
| Live "current conditions" badge | Tomorrow.io connector | Sourced |
| Live river discharge badge | Open-Meteo/GloFAS connector | Sourced |
| Animated disruption pulse along the NH-5 corridor | `pointAlong()` interpolation, driven by `runState` | Illustrative |
| Click-to-inspect any asset | `EntityInspector`, shared with Dependency Explorer | Real |

## 3. Dependency Explorer (`/dependency`)

| Feature | Implementation | Tag |
|---|---|---|
| 51-node, 74-edge exposure graph, auto-laid-out | `lib/dagreLayout.ts` + `@xyflow/react` | Mixed (see per-edge evidence class) |
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
| Saved scenarios | `localStorage`-backed, `useScenarioStore.savedScenarios` | Real (local only, not shared) |
| Scenario profiles (Baseline → Compound) | `SCENARIO_PROFILES` | Assumption (disclosed presets) |

## 9. Evidence & Reports (`/evidence`)

| Feature | Implementation | Tag |
|---|---|---|
| Full evidence classification browser | `EVIDENCE_ITEMS`, filterable by class | Real (self-documenting) |
| Live weather check (NASA POWER → Open-Meteo fallback) | `LiveWeatherPanel.tsx` | Sourced |
| Live news / market intelligence search | `LiveNewsPanel.tsx` (NewsAPI/GNews, AlphaAI) | Sourced |
| Reference-ticker insider signal lookup | AlphaAI `ticker_insider_summary()` — explicitly NOT linked to synthetic companies | Sourced |
| Scenario report export (.txt) | `exportReport()`, generated live | Real |

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
| 40 passing tests | `backend/tests/` | Real |
