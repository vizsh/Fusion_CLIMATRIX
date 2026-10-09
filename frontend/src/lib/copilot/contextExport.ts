// Griid-pattern context export — "Claude ↔ Griid ↔ ChatGPT ↔ your next AI
// workspace": the active CLIMATRIX scenario and its modelled figures,
// packaged as a plain-text bundle a user can paste into their own
// ChatGPT/Claude/Griid session so that tool reasons from the same
// context instead of CLIMATRIX staying a walled garden. Pure client-side
// text generation — no dependency on Griid's product existing, no new
// backend call, same numbers the Copilot and dashboard already show.

import { REGION_LABEL, computeImpact, type ScenarioState } from '../../store/useScenarioStore'

export function buildContextBundle(state: ScenarioState): string {
  const impact = computeImpact({
    region: state.region,
    severity: state.severity,
    durationMonths: state.durationMonths,
    substitutability: state.substitutability,
    interventions: state.interventions,
  })

  return [
    '# CLIMATRIX India — exported scenario context',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Active scenario',
    `Region: ${REGION_LABEL[state.region]} (${state.region})`,
    `Hazard: ${state.hazard}`,
    `Severity: ${state.severity}/100 — a UI stress dial, not a probability or measured flood depth`,
    `Duration: ${state.durationMonths} months`,
    `Substitutability: ${state.substitutability}`,
    `Lens: ${state.userMode === 'bank' ? 'Bank / credit risk' : 'Investor / equity'}`,
    '',
    '## Key figures (modelled — ECL = EAD × PD × LGD)',
    `Exposed EAD: ₹${impact.eadCr.toFixed(1)} cr across ${impact.companyCount} holdings`,
    `Baseline expected loss: ₹${impact.baselineEl.toFixed(2)} cr`,
    `Stressed expected loss: ₹${impact.stressedEl.toFixed(2)} cr (±15% severity sensitivity band: ₹${impact.stressedElLow.toFixed(2)} – ₹${impact.stressedElHigh.toFixed(2)} cr)`,
    `Top sectors by stressed loss: ${impact.bySector.slice(0, 3).map((s) => `${s.sector} (₹${s.stressedEl.toFixed(1)} cr)`).join(', ') || 'none traced'}`,
    '',
    '## Evidence classes this platform uses for every figure',
    '- sourced: a cited, externally verifiable fact (e.g. RBI’s own published stress-test figures)',
    '- modelled: a real computation over real or synthetic inputs (e.g. the ECL figures above)',
    '- assumption: a disclosed illustrative parameter (e.g. the severity dial itself)',
    '- synthetic: fabricated demonstration data, labeled as such everywhere (company identities, loan exposures)',
    '',
    '## How to use this',
    'Paste this block into ChatGPT, Claude, Griid, or any other AI workspace so it has the same scenario context CLIMATRIX is showing, without re-deriving it. Every figure above is a model output under a disclosed assumption, not a verified real-world loss or investment advice.',
  ].join('\n')
}

export function downloadContextBundle(state: ScenarioState) {
  const text = buildContextBundle(state)
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `climatrix-context-${state.region}.md`
  a.click()
  URL.revokeObjectURL(url)
}
