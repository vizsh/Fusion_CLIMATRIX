// CLIMATRIX AI Copilot — Multi-Scenario Intelligence engine.
//
// This is the autonomous "What-If Analysis" core described in the product
// brief: instead of asking an investor to invent and test one scenario at a
// time, it generates a small set of plausible scenario archetypes for a
// region, runs the SAME financial/exposure engine the rest of the app uses
// (computeImpact / computeProtectionGap — see useScenarioStore.ts and
// insurance.ts), and ranks them on more than one axis.
//
// Deliberately NOT an LLM call: every number here is produced by the
// existing deterministic graph + financial engine, so nothing is
// hallucinated. A probabilityBasis is attached to every scenario per the
// brief's "probability rules" — a severity dial is never reported as a
// likelihood, and a stress-test assumption is never reported as a forecast.

import {
  REGION_HAZARD,
  computeBottlenecks,
  computeHazardReach,
  hazardPortfolioStats,
} from '../graphAnalytics'
import { computeProtectionGap, type ProtectionGapResult } from '../insurance'
import { sectorVulnerability } from '../sectorVulnerability'
import {
  REGION_LABEL,
  computeImpact,
  stressPdLgd,
  type ImpactResult,
  type Region,
  type Substitutability,
} from '../../store/useScenarioStore'
import type { GNode } from '../indiaGraphData'
import type { EvidenceClass } from '../evidence'

export type ProbabilityBasis =
  | 'forecast-based'
  | 'modelled'
  | 'historical-frequency'
  | 'stress-test-assumption'
  | 'insufficient-evidence'

export const PROBABILITY_BASIS_LABEL: Record<ProbabilityBasis, string> = {
  'forecast-based': 'Forecast-based',
  modelled: 'Modelled',
  'historical-frequency': 'Historical frequency',
  'stress-test-assumption': 'Stress-test assumption',
  'insufficient-evidence': 'Insufficient evidence',
}

export type Horizon = 'near' | 'medium' | 'long' | 'both'

export const HORIZON_LABEL: Record<Horizon, string> = {
  near: 'Near-term (current conditions, next few weeks)',
  medium: 'Medium-term (next 1–3 years)',
  long: 'Long-term (5–10 years and beyond)',
  both: 'Near-term and long-term',
}

interface ScenarioArchetype {
  key: string
  label: string
  severity: number
  durationMonths: number
  substitutability: Substitutability
  probabilityBasis: ProbabilityBasis
  likelihoodLabel: string
  /** Ordinal weight 0-1, used only to rank scenarios against each other —
   * never displayed or treated as a probability. */
  likelihoodScore: number
  /** Disclosed illustrative recurrence multiplier for the cumulative-exposure
   * ranking — NOT an actuarial return-period estimate. */
  recurrenceFactor: number
}

// Four scenario archetypes spanning the brief's examples (facility-level
// flooding / severe regional flooding + logistics / compound long-horizon
// stress). Severity/duration/substitutability combinations reuse the exact
// dials every other module in the app already uses (SCENARIO_PROFILES in
// useScenarioStore.ts), so a scenario produced here is reproducible on the
// Scenario Lab page with the identical inputs.
function archetypes(horizon: Horizon): ScenarioArchetype[] {
  const longHorizon = horizon === 'long' || horizon === 'both'
  return [
    {
      key: 'facility',
      label: 'Facility-level disruption',
      severity: 45,
      durationMonths: 3,
      substitutability: 'Moderate',
      probabilityBasis: 'historical-frequency',
      likelihoodLabel: 'Medium–high',
      likelihoodScore: 0.72,
      recurrenceFactor: 2.5,
    },
    {
      key: 'regional',
      label: 'Severe regional disruption',
      severity: 80,
      durationMonths: 6,
      substitutability: 'Moderate',
      probabilityBasis: 'stress-test-assumption',
      likelihoodLabel: 'Medium',
      likelihoodScore: 0.45,
      recurrenceFactor: 1.2,
    },
    {
      key: 'supply-chain',
      label: 'Severe disruption + supply-chain strain',
      severity: 80,
      durationMonths: 6,
      substitutability: 'Limited',
      probabilityBasis: 'stress-test-assumption',
      likelihoodLabel: 'Medium',
      likelihoodScore: 0.4,
      recurrenceFactor: 1.0,
    },
    {
      key: 'compound',
      label: 'Compound / prolonged stress',
      severity: 100,
      durationMonths: 12,
      substitutability: 'Limited',
      probabilityBasis: longHorizon ? 'historical-frequency' : 'stress-test-assumption',
      likelihoodLabel: longHorizon ? 'Elevated over long horizons' : 'Low (near-term)',
      likelihoodScore: longHorizon ? 0.35 : 0.15,
      recurrenceFactor: 0.6,
    },
  ]
}

export interface WhatIfScenario {
  id: string
  label: string
  region: Region
  severity: number
  durationMonths: number
  substitutability: Substitutability
  probabilityBasis: ProbabilityBasis
  probabilityEvidence: EvidenceClass
  likelihoodLabel: string
  likelihoodScore: number
  impact: ImpactResult
  protectionGap: ProtectionGapResult
  cumulativeExposureCr: number
  topCompanies: { node: GNode; stressedElCr: number }[]
}

export interface RankedWhatIf {
  region: Region
  horizon: Horizon
  scenarios: WhatIfScenario[]
  byLoss: WhatIfScenario[]
  byLikelihood: WhatIfScenario[]
  byPriority: WhatIfScenario[]
  byCumulative: WhatIfScenario[]
  bottlenecks: ReturnType<typeof computeBottlenecks>
  portfolioStats: ReturnType<typeof hazardPortfolioStats>
}

function probabilityEvidence(basis: ProbabilityBasis): EvidenceClass {
  if (basis === 'forecast-based' || basis === 'historical-frequency') return 'sourced'
  if (basis === 'modelled') return 'modelled'
  if (basis === 'insufficient-evidence') return 'assumption'
  return 'assumption'
}

/** The core automation entry point: generate, run and rank a small set of
 * plausible scenarios for a region without the user having to invent any
 * of them. Everything downstream (loss, protection gap, bottlenecks) is
 * computed by the same engine the dashboard pages use. */
export function generateWhatIf(region: Region, horizon: Horizon = 'medium'): RankedWhatIf {
  const hazardId = REGION_HAZARD[region]
  const list = archetypes(horizon)

  const scenarios: WhatIfScenario[] = list.map((a) => {
    const impact = computeImpact({
      region,
      severity: a.severity,
      durationMonths: a.durationMonths,
      substitutability: a.substitutability,
      interventions: [],
    })
    const protectionGap = computeProtectionGap(hazardId, a.severity, a.durationMonths)
    return {
      id: `${region}-${a.key}`,
      label: a.label,
      region,
      severity: a.severity,
      durationMonths: a.durationMonths,
      substitutability: a.substitutability,
      probabilityBasis: a.probabilityBasis,
      probabilityEvidence: probabilityEvidence(a.probabilityBasis),
      likelihoodLabel: a.likelihoodLabel,
      likelihoodScore: a.likelihoodScore,
      impact,
      protectionGap,
      cumulativeExposureCr: impact.stressedEl * a.recurrenceFactor,
      topCompanies: [] as { node: GNode; stressedElCr: number }[],
    }
  })

  // Per-company stressed EL, computed with the exact same stressPdLgd
  // formula the portfolio-level impact above already uses — so the "which
  // holdings drive this scenario" list sums consistently with the headline
  // number instead of being an independent approximation.
  const { companies } = computeHazardReach(hazardId)
  for (const s of scenarios) {
    s.topCompanies = companies
      .map((node) => {
        const ead = node.eadCr ?? 0
        const { stressedPd, stressedLgd } = stressPdLgd(
          node.baselinePd ?? 0,
          node.baselineLgd ?? 0,
          s.severity,
          s.durationMonths,
          s.substitutability,
          sectorVulnerability(node.sector),
        )
        return { node, stressedElCr: ead * stressedPd * stressedLgd }
      })
      .sort((a, b) => b.stressedElCr - a.stressedElCr)
      .slice(0, 3)
  }

  const maxLoss = Math.max(...scenarios.map((s) => s.impact.stressedEl), 1e-9)
  const maxLikelihood = Math.max(...scenarios.map((s) => s.likelihoodScore), 1e-9)
  const priority = (s: WhatIfScenario) =>
    (s.impact.stressedEl / maxLoss) * 0.6 + (s.likelihoodScore / maxLikelihood) * 0.4

  return {
    region,
    horizon,
    scenarios,
    byLoss: [...scenarios].sort((a, b) => b.impact.stressedEl - a.impact.stressedEl),
    byLikelihood: [...scenarios].sort((a, b) => b.likelihoodScore - a.likelihoodScore),
    byPriority: [...scenarios].sort((a, b) => priority(b) - priority(a)),
    byCumulative: [...scenarios].sort((a, b) => b.cumulativeExposureCr - a.cumulativeExposureCr),
    bottlenecks: computeBottlenecks(5),
    portfolioStats: hazardPortfolioStats(hazardId),
  }
}

/** Plain-text "Climate Scenario Intelligence Brief" per the product brief's
 * report structure — downloadable, reusable, not a wall of chat text. */
export function buildBriefText(ranked: RankedWhatIf): string {
  const regionLabel = REGION_LABEL[ranked.region]
  const top = ranked.byPriority[0]
  const lines: string[] = [
    'CLIMATRIX INDIA — CLIMATE SCENARIO INTELLIGENCE BRIEF',
    `Generated: ${new Date().toISOString()}`,
    `Region: ${regionLabel} · Horizon: ${HORIZON_LABEL[ranked.horizon]}`,
    '',
    '— EXECUTIVE SUMMARY —',
    `${ranked.scenarios.length} scenarios compared. Highest-priority scenario: "${top.label}" ` +
      `(stressed EL ₹${top.impact.stressedEl.toFixed(1)} cr, likelihood: ${top.likelihoodLabel}, basis: ${PROBABILITY_BASIS_LABEL[top.probabilityBasis]}).`,
    `Underlying exposed portfolio: ₹${ranked.portfolioStats.eadCr.toFixed(0)} cr EAD across ${ranked.portfolioStats.companyCount} borrowers/holdings reachable from this region's hazard node.`,
    '',
    '— SCENARIO RANKING —',
    ...ranked.scenarios.map(
      (s, i) =>
        `${i + 1}. ${s.label} — severity ${s.severity}/100, ${s.durationMonths}mo, substitutability ${s.substitutability} | ` +
        `stressed EL ₹${s.impact.stressedEl.toFixed(1)} cr (±${(((s.impact.stressedElHigh - s.impact.stressedElLow) / 2)).toFixed(1)} cr band) | ` +
        `likelihood: ${s.likelihoodLabel} [${PROBABILITY_BASIS_LABEL[s.probabilityBasis]}]`,
    ),
    '',
    '— HOLDING-LEVEL BREAKDOWN (highest-priority scenario) —',
    ...top.topCompanies.map((c) => `- ${c.node.label} (${c.node.sector}) — est. stressed EL contribution ₹${c.stressedElCr.toFixed(1)} cr`),
    '',
    '— HIDDEN CONCENTRATION / BOTTLENECKS —',
    ...ranked.bottlenecks
      .slice(0, 3)
      .map((b) => `- ${b.node.label}: reaches ${b.reachedCompanies.length} companies, ₹${b.reachedEAD.toFixed(0)} cr combined EAD`),
    '',
    '— INSURANCE REVIEW (highest-priority scenario) —',
    `Protection gap: ${(top.protectionGap.protectionGapShare * 100).toFixed(0)}% of exposed EAD carries zero coverage against this scenario.`,
    `Uninsured exposed (ranked by EAD): ${top.protectionGap.uninsuredExposed
      .slice(0, 5)
      .map((c) => c.label)
      .join(', ') || 'none traced'}.`,
    '',
    '— INVESTOR / RISK-TEAM ACTION PLAN —',
    '- Review repayment capacity / investment thesis for the holdings listed above before the scenario window.',
    '- Request current insurance documentation for every uninsured-exposed holding.',
    '- Re-run this brief if official warnings, forecasts or news change the evidence basis for any scenario.',
    '',
    '— EVIDENCE REGISTER —',
    '- Scenario severity/duration dials: assumption (stress-test input, not a measured flood depth or probability).',
    '- Expected credit loss (EAD × PD × LGD) and protection-gap figures: modelled, from this app’s disclosed formulas.',
    '- Company identities, loan exposures, insurance terms: synthetic demonstration data — see Honest limitations in the repo README.',
    '- Likelihood labels: ordinal ranking aid only, derived from the basis shown per scenario — never an actuarial probability.',
  ]
  return lines.join('\n')
}

export function downloadBrief(ranked: RankedWhatIf) {
  const text = buildBriefText(ranked)
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `climatrix-scenario-brief-${ranked.region}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
