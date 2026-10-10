// Long-term, gradual climate-intensification lens — deliberately separate
// from every other module's point-in-time stress dial. The rest of this
// app answers "what happens if severity hits X right now"; this answers
// the question a bank's climate-risk committee and an investor doing
// multi-year diligence actually need: how does the SAME portfolio or
// company look 5, 10, 15, 20 years out if conditions gradually intensify,
// and what should be done about it before that happens.
//
// INTENSIFICATION_PATHWAYS is a disclosed modelling assumption — a yearly
// severity-drift rate, loosely patterned after the "low/moderate/high"
// framing used in climate-scenario literature — NOT a calibrated RCP/SSP
// pathway or a forecast. Labeled as illustrative everywhere it's shown,
// the same evidence-integrity standard as every other dial in this app.

import { sectorVulnerability } from './sectorVulnerability'
import { computeTransitionExposure, transitionSensitivity } from './transitionRisk'
import { computeSensitivityIndex, type RealMarketEntity } from './realMarketSensitivity'
import type { GNode } from './indiaGraphData'
import { stressPdLgd, type Hazard, type Substitutability } from '../store/useScenarioStore'

export type IntensificationPathway = 'Low' | 'Moderate' | 'High'

export const INTENSIFICATION_PATHWAYS: Record<IntensificationPathway, { label: string; yearlyDrift: number; desc: string }> = {
  Low: {
    label: 'Low intensification',
    yearlyDrift: 0.55,
    desc: 'Gradual, continued-mitigation-style pathway — the smallest disclosed yearly drift in effective hazard severity.',
  },
  Moderate: {
    label: 'Moderate intensification',
    yearlyDrift: 1.3,
    desc: 'Current-trajectory pathway — a disclosed middle assumption, not a forecast or a calibrated climate model.',
  },
  High: {
    label: 'High intensification',
    yearlyDrift: 2.4,
    desc: 'Limited-mitigation-style pathway — the fastest disclosed yearly drift, same illustrative basis as the other two.',
  },
}

export const TRAJECTORY_YEARS_OUT = [0, 5, 10, 15, 20] as const
export const TRAJECTORY_BASE_YEAR = 2026

// Deliberately NOT the 80/100 "severe stress test" dial every other module
// uses — that already sits close to the 100-point ceiling, so every
// pathway would converge on the same capped trajectory within a decade and
// the Low/Moderate/High selector would stop meaning anything. A 20-year
// GRADUAL trajectory is a different question from a point-in-time stress
// test: it asks how today's ordinary conditions drift, so it starts from
// an ordinary-conditions baseline instead.
export const TRAJECTORY_AMBIENT_SEVERITY = 30

export function driftedSeverity(baseSeverity: number, pathway: IntensificationPathway, yearsOut: number): number {
  const drift = INTENSIFICATION_PATHWAYS[pathway].yearlyDrift
  return Math.min(100, Math.round(baseSeverity + drift * yearsOut))
}

// ---------------------------------------------------------------------
// Portfolio-level trajectory (₹cr terms) — Portfolio Dashboard
// ---------------------------------------------------------------------

export interface PortfolioTrajectoryPoint {
  yearsOut: number
  calendarYear: number
  severity: number
  stressedElCr: number
  transitionAtRiskCr: number
  combinedCr: number
  shareOfEAD: number
}

export interface PortfolioTrajectoryResult {
  points: PortfolioTrajectoryPoint[]
  totalEADCr: number
  finalSectorBreakdown: { sector: string; combinedCr: number; physicalShare: number; transitionShare: number }[]
}

function stressedElFor(
  c: { eadCr?: number; baselinePd?: number; baselineLgd?: number; sector?: string },
  severity: number,
  durationMonths: number,
  substitutability: Substitutability,
) {
  const ead = c.eadCr ?? 0
  const { stressedPd, stressedLgd } = stressPdLgd(c.baselinePd ?? 0, c.baselineLgd ?? 0, severity, durationMonths, substitutability, sectorVulnerability(c.sector))
  return ead * stressedPd * stressedLgd
}

/** Projects the portfolio's combined physical + transition climate-adjusted
 * loss across a 20-year horizon under a selectable intensification pathway.
 * Transition stringency is assumed to drift gently upward alongside the
 * physical pathway too (a higher-intensification world plausibly also
 * carries tighter decarbonisation policy over time) — a disclosed, modest
 * coupling, not an independently calibrated policy forecast. */
export function computePortfolioTrajectory(
  companies: GNode[],
  pathway: IntensificationPathway,
  policyStringency: number,
  baseSeverity = TRAJECTORY_AMBIENT_SEVERITY,
  baseDurationMonths = 6,
): PortfolioTrajectoryResult {
  const totalEADCr = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0) || 1
  // Transition stringency must drift at a rate that scales WITH the
  // selected pathway, not a fixed rate independent of it — otherwise a
  // pathway-invariant transition-risk term dominates the combined figure
  // and the Low/Moderate/High selector barely moves the headline number.
  const drift = INTENSIFICATION_PATHWAYS[pathway].yearlyDrift

  const points: PortfolioTrajectoryPoint[] = TRAJECTORY_YEARS_OUT.map((yearsOut) => {
    const severity = driftedSeverity(baseSeverity, pathway, yearsOut)
    const stressedElCr = companies.reduce((s, c) => s + stressedElFor(c, severity, baseDurationMonths, 'Moderate'), 0)
    const stringencyAtYear = Math.min(100, policyStringency + yearsOut * drift * 0.6)
    const { transitionAtRiskCr } = computeTransitionExposure(companies, stringencyAtYear)
    const combinedCr = stressedElCr + transitionAtRiskCr
    return {
      yearsOut,
      calendarYear: TRAJECTORY_BASE_YEAR + yearsOut,
      severity,
      stressedElCr,
      transitionAtRiskCr,
      combinedCr,
      shareOfEAD: combinedCr / totalEADCr,
    }
  })

  const finalYearsOut = TRAJECTORY_YEARS_OUT[TRAJECTORY_YEARS_OUT.length - 1]
  const finalSeverity = driftedSeverity(baseSeverity, pathway, finalYearsOut)
  const finalStringency = Math.min(100, policyStringency + finalYearsOut * drift * 0.6)
  const bySector = new Map<string, { physical: number; transition: number }>()
  for (const c of companies) {
    const key = c.sector ?? 'Other'
    const existing = bySector.get(key) ?? { physical: 0, transition: 0 }
    existing.physical += stressedElFor(c, finalSeverity, baseDurationMonths, 'Moderate')
    existing.transition += (c.eadCr ?? 0) * transitionSensitivity(c.sector) * (finalStringency / 100) * 0.35
    bySector.set(key, existing)
  }
  const finalSectorBreakdown = Array.from(bySector.entries())
    .map(([sector, v]) => ({
      sector,
      combinedCr: v.physical + v.transition,
      physicalShare: v.physical + v.transition > 0 ? v.physical / (v.physical + v.transition) : 0,
      transitionShare: v.physical + v.transition > 0 ? v.transition / (v.physical + v.transition) : 0,
    }))
    .sort((a, b) => b.combinedCr - a.combinedCr)

  return { points, totalEADCr, finalSectorBreakdown }
}

export interface TrajectoryRecommendation {
  level: 'info' | 'watch' | 'act'
  title: string
  detail: string
}

/** Rule-based, thresholded against the trajectory's own computed numbers —
 * never a generic "diversify your portfolio" platitude. Every recommendation
 * names the specific driver (a sector, a share of EAD, a growth pattern)
 * that triggered it, so it's auditable the same way every other modelled
 * figure in this app is. */
export function generatePortfolioTrajectoryRecommendations(result: PortfolioTrajectoryResult, pathway: IntensificationPathway): TrajectoryRecommendation[] {
  const { points, finalSectorBreakdown } = result
  const recs: TrajectoryRecommendation[] = []
  const first = points[0]
  const final = points[points.length - 1]
  const mid = points[Math.floor(points.length / 2)]

  if (final.shareOfEAD >= 0.3) {
    recs.push({
      level: 'act',
      title: `Climate-adjusted loss could reach ${(final.shareOfEAD * 100).toFixed(0)}% of total EAD by ${final.calendarYear}`,
      detail: `Under the ${INTENSIFICATION_PATHWAYS[pathway].label.toLowerCase()} pathway, combined physical + transition loss grows from ₹${first.combinedCr.toFixed(0)} cr today to ₹${final.combinedCr.toFixed(0)} cr by ${final.calendarYear}. Consider reducing concentration in ${finalSectorBreakdown[0]?.sector ?? 'the top-contributing sector'}, arranging parametric cover, or tightening covenants before long-tenor commitments roll over.`,
    })
  } else if (final.shareOfEAD >= 0.15) {
    recs.push({
      level: 'watch',
      title: `Climate-adjusted loss trends toward ${(final.shareOfEAD * 100).toFixed(0)}% of total EAD by ${final.calendarYear}`,
      detail: `Not yet structural, but the ${INTENSIFICATION_PATHWAYS[pathway].label.toLowerCase()} pathway takes combined loss from ₹${first.combinedCr.toFixed(0)} cr to ₹${final.combinedCr.toFixed(0)} cr over the horizon. A phased insurance and mitigation review over the next ${mid.yearsOut}–${final.yearsOut} years is worth scheduling now, while terms are presumably cheaper than after conditions worsen.`,
    })
  } else {
    recs.push({
      level: 'info',
      title: `Long-term climate-adjusted loss stays under ${(final.shareOfEAD * 100).toFixed(0)}% of EAD through ${final.calendarYear}`,
      detail: `Under the ${INTENSIFICATION_PATHWAYS[pathway].label.toLowerCase()} pathway, no structural action is indicated by this trajectory alone — continue routine monitoring and re-check if the pathway or portfolio composition changes.`,
    })
  }

  const topSector = finalSectorBreakdown[0]
  if (topSector && topSector.combinedCr > 0 && topSector.physicalShare > 0.4 && topSector.transitionShare > 0.3) {
    recs.push({
      level: 'watch',
      title: `${topSector.sector} carries BOTH physical and transition risk by ${final.calendarYear}`,
      detail: `${topSector.sector} contributes the largest share of year-${final.yearsOut} combined loss (₹${topSector.combinedCr.toFixed(0)} cr), with neither physical nor transition risk dominant (${(topSector.physicalShare * 100).toFixed(0)}% physical / ${(topSector.transitionShare * 100).toFixed(0)}% transition). That compounding — not either risk alone — is the case for active engagement with these borrowers now, not just monitoring.`,
    })
  }

  // Convexity check: is loss growth accelerating in the back half of the
  // horizon? A borrower/committee deciding WHEN to act benefits from
  // knowing the shape of the curve, not just its endpoint.
  const firstHalfGrowth = mid.combinedCr - first.combinedCr
  const secondHalfGrowth = final.combinedCr - mid.combinedCr
  if (secondHalfGrowth > firstHalfGrowth * 1.3 && firstHalfGrowth > 0) {
    recs.push({
      level: 'info',
      title: 'Loss growth accelerates in the back half of the horizon',
      detail: `From ${first.calendarYear} to ${mid.calendarYear}, combined loss rises ₹${firstHalfGrowth.toFixed(0)} cr; from ${mid.calendarYear} to ${final.calendarYear} it rises ₹${secondHalfGrowth.toFixed(0)} cr — faster in the second half. That's the case for locking in mitigation or insurance terms earlier in the horizon rather than waiting for the trajectory to flatten, which this pathway does not show happening.`,
    })
  }

  return recs
}

// ---------------------------------------------------------------------
// Company-level trajectory (sensitivity-index terms) — Real Market
// Climate Sensitivity, the "factor to consider when picking a new
// company" lens.
// ---------------------------------------------------------------------

export interface SensitivityTrajectoryPoint {
  yearsOut: number
  calendarYear: number
  severity: number
  sensitivityIndex: number
}

export function computeSensitivityTrajectory(
  entity: RealMarketEntity,
  baseSeverity: number,
  durationMonths: number,
  hazard: Hazard,
  pathway: IntensificationPathway,
): SensitivityTrajectoryPoint[] {
  return TRAJECTORY_YEARS_OUT.map((yearsOut) => {
    const severity = driftedSeverity(baseSeverity, pathway, yearsOut)
    const { sensitivityIndex } = computeSensitivityIndex(entity, severity, durationMonths, hazard)
    return { yearsOut, calendarYear: TRAJECTORY_BASE_YEAR + yearsOut, severity, sensitivityIndex }
  })
}

export type CompanyVerdict = 'Low long-term concern' | 'Monitor' | 'Elevated — mitigate before committing' | 'High — reconsider or price in a premium'

export interface CompanyTrajectoryVerdict {
  verdict: CompanyVerdict
  color: string
  reasoning: string[]
}

const VERDICT_COLOR: Record<CompanyVerdict, string> = {
  'Low long-term concern': '#2dd4a7',
  Monitor: '#94a3b8',
  'Elevated — mitigate before committing': '#f5a524',
  'High — reconsider or price in a premium': '#fb3a4a',
}

/** The actual "should I consider this when picking up/analysing a new
 * company" output — one verdict plus the specific, auditable reasons
 * behind it, never a bare score. A beneficiary direction overrides a high
 * index (the index alone doesn't know the stress helps this business). */
export function verdictForCompanyTrajectory(
  entity: RealMarketEntity,
  points: SensitivityTrajectoryPoint[],
  hazardRelevant: boolean,
  pathway: IntensificationPathway,
): CompanyTrajectoryVerdict {
  const first = points[0]
  const final = points[points.length - 1]
  const delta = final.sensitivityIndex - first.sensitivityIndex
  const reasoning: string[] = []
  let verdict: CompanyVerdict

  if (entity.direction === 'beneficiary') {
    verdict = 'Low long-term concern'
    reasoning.push(`${entity.name} is modelled as a net beneficiary of this hazard type — the trajectory raising its sensitivity index to ${final.sensitivityIndex}/100 by ${final.calendarYear} reflects more activity, not more risk, for this business.`)
  } else if (final.sensitivityIndex >= 70) {
    verdict = 'High — reconsider or price in a premium'
    reasoning.push(`Sensitivity index climbs to ${final.sensitivityIndex}/100 by ${final.calendarYear} under the ${INTENSIFICATION_PATHWAYS[pathway].label.toLowerCase()} pathway, from ${first.sensitivityIndex}/100 today — a ${delta >= 0 ? '+' : ''}${delta}-point rise over ${final.yearsOut} years.`)
  } else if (final.sensitivityIndex >= 45) {
    verdict = 'Elevated — mitigate before committing'
    reasoning.push(`Sensitivity index reaches ${final.sensitivityIndex}/100 by ${final.calendarYear} (from ${first.sensitivityIndex}/100 today) — material enough to factor into due diligence, not yet severe enough to rule out on its own.`)
  } else {
    verdict = 'Monitor'
    reasoning.push(`Sensitivity index stays at or under ${final.sensitivityIndex}/100 through ${final.calendarYear} under this pathway — no long-term structural concern indicated by this trajectory alone.`)
  }

  if (entity.direction === 'mixed') {
    reasoning.push(`Direction is classified "mixed" — real exposure and a plausible offsetting tailwind both exist; which dominates depends on specifics this index doesn't capture (see the worst-case/favorable narratives above).`)
  }
  if (!hazardRelevant) {
    reasoning.push(`The currently active hazard isn't this sector's primary risk — most of this reading is the off-sector residual, not a direct hit; re-check under a hazard this sector actually faces before relying on this verdict.`)
  }
  if (entity.direction !== 'beneficiary' && delta >= 20) {
    reasoning.push(`The trajectory itself — a ${delta}-point rise over ${final.yearsOut} years — is the signal worth weighing, not just where the index sits today.`)
  }

  return { verdict, color: VERDICT_COLOR[verdict], reasoning }
}
