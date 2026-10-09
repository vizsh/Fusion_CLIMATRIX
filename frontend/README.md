# CLIMATRIX India — frontend

Vite + React 19 + TypeScript SPA. This is the entire interactive product —
see the root [`README.md`](../README.md) for screenshots and the full
feature tour, and [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for
the design rationale behind the structure below.

## Commands

```bash
npm install
npm run dev        # http://localhost:5181
npm run build       # tsc -b && vite build
npm run lint         # oxlint
npx tsc --noEmit      # typecheck only
```

No backend is required to run this — it's entirely self-contained on the
bundled dataset in `src/lib/indiaGraphData.ts`. See
[`../docs/GETTING_STARTED.md`](../docs/GETTING_STARTED.md) to also run the
optional backend for the live-data panels.

## Structure

```
src/
  lib/
    indiaGraphData.ts    The exposure graph — nodes, edges, the only data source
    graphAnalytics.ts    Pure BFS traversal: ancestors, descendants, bottlenecks,
                          hazard reach, company exposure detail
    insurance.ts         Protection gap, insurer book stress, insurance-adjusted LGD
    interventions.ts     Mitigation levers, including the parametric trigger
    sectorVulnerability.ts
    evidence.ts           The sourced/modelled/assumption/synthetic taxonomy
    digitalTwinMap.ts    MapLibre styles, camera presets, region bounding boxes
    floodModel.ts         DEM decode + flood ribbon computation
    api.ts                 Typed backend client
  store/
    useScenarioStore.ts  THE single source of truth — region, hazard, severity,
                          duration, substitutability, interventions, selection,
                          run state, user mode — plus the financial engine
                          (stressPdLgd, computeImpact, computeEquityImpact)
  pages/                  One file per route — see src/App.tsx for the route list
  components/
    graph/                 React Flow node renderer + the shared entity inspector
    ScenarioConsole.tsx   Shared region/hazard/severity/duration controls
    PresentationOverlay.tsx
    LiveWeatherPanel.tsx, LiveNewsPanel.tsx, LiveConditionsBadges.tsx
                            Backend-dependent live-data panels (fail silently
                            without a running backend)
  layout/
    AppShell.tsx           Top bar, nav rail, bank/investor toggle
```

## Key architectural rule

Every page reads scenario state from `useScenarioStore` and every
calculation (`computeImpact`, `computeEquityImpact`, `computeProtectionGap`,
`parametricPayout`, …) is a pure function over that state and the graph —
never component-local state duplicating what the store already holds. If
you're adding a feature that needs "what does the current scenario affect,"
it almost certainly already exists as an exported function in `lib/` —
check `graphAnalytics.ts` and `insurance.ts` before writing a new traversal.
