// Shared "apply a fully-specified scenario to the live store and report
// the outcome" step — used by the guided wizard (automation.ts), the
// What-If Analysis page's free-text scenario box, and the chat rule for a
// detailed free-text description. One function, so every entry point
// reports the exact same stat/table shape and the exact same disclaimers
// instead of three slightly-drifting copies.

import { computeImpact, REGION_LABEL, summarizeImpactPlain, type ScenarioState } from '../../store/useScenarioStore'
import type { ParsedScenario } from './freeTextScenario'
import type { CopilotAction, CopilotBlock } from './types'

export interface ScenarioRunResult {
  blocks: CopilotBlock[]
  impact: ReturnType<typeof computeImpact>
  summary: string
}

export function applyScenarioToStore(p: ParsedScenario, state: ScenarioState) {
  // setRegion resets hazard to that region's own default, so hazard must
  // be applied AFTER region — see CopilotPanel.tsx's applyDials for the
  // bug this ordering fixes.
  state.setRegion(p.region)
  state.setHazard(p.hazard)
  state.setSeverity(p.severity)
  state.setDuration(p.durationMonths)
  state.setSubstitutability(p.substitutability)
}

export function runScenarioAndReport(p: ParsedScenario, state: ScenarioState | null, headingPrefix = 'Scenario built and run', closingNote?: string): ScenarioRunResult {
  if (state) applyScenarioToStore(p, state)

  const impact = computeImpact({
    region: p.region,
    severity: p.severity,
    durationMonths: p.durationMonths,
    substitutability: p.substitutability,
    interventions: [],
  })
  const summary = summarizeImpactPlain(p.region, p.hazard, p.severity, p.durationMonths, impact)

  const actions: CopilotAction[] = [
    { id: 'run-map', label: 'Watch it play out on the live map', kind: 'go-to-map', region: p.region, hazard: p.hazard, severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability },
    { id: 'run-portfolio', label: 'Open Portfolio Impact', kind: 'navigate', to: '/portfolio', region: p.region },
    { id: 'run-insurance', label: 'Check the insurance view', kind: 'navigate', to: '/insurance', region: p.region },
    { id: 'run-brief', label: 'Download a scenario brief', kind: 'download-brief', briefRegion: p.region },
  ]

  const blocks: CopilotBlock[] = [
    { kind: 'heading', text: `${headingPrefix} — ${REGION_LABEL[p.region]}` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Baseline EL', value: `₹${impact.baselineEl.toFixed(1)} cr`, evidence: 'modelled' },
        { label: 'Stressed EL', value: `₹${impact.stressedEl.toFixed(1)} cr`, evidence: 'modelled' },
        { label: 'Borrowers reached', value: String(impact.companyCount), evidence: 'modelled' },
      ],
    },
    { kind: 'text', text: summary },
    {
      kind: 'table',
      headers: ['Sector', 'EAD', 'Stressed EL'],
      rows: impact.bySector.slice(0, 5).map((s) => [s.sector, `₹${s.eadCr.toFixed(1)} cr`, `₹${s.stressedEl.toFixed(1)} cr`]),
    },
    ...(closingNote ? [{ kind: 'text', text: closingNote } as CopilotBlock] : []),
    { kind: 'actions', actions },
  ]

  return { blocks, impact, summary }
}
