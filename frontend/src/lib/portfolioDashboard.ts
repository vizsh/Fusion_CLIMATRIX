// Portfolio Dashboard engine — composes the SAME deterministic functions
// every other page uses (stressPdLgd, computeEquityImpact, insurance's
// computeProtectionGap, graphAnalytics' hazard-reach/bottleneck BFS) over
// an explicit, optionally portfolio-scoped company list, rather than
// introducing a second calculation path. Nothing here recomputes a
// formula that already exists elsewhere in the codebase.

import { NODES, type GNode } from './indiaGraphData'
import { computeBottlenecks, REGION_HAZARD, computeHazardReach } from './graphAnalytics'
import { computeProtectionGap } from './insurance'
import { sectorVulnerability } from './sectorVulnerability'
import { computeTransitionExposure, type TransitionExposureResult } from './transitionRisk'
import { ALL_REGIONS } from './copilot/engine'
import {
  REGION_LABEL,
  computeEquityImpact,
  stressPdLgd,
  type Region,
  type SavedPortfolio,
  type Substitutability,
} from '../store/useScenarioStore'

export const ALL_COMPANIES: GNode[] = NODES.filter((n) => n.kind === 'company')
export const TOTAL_EAD_CR = ALL_COMPANIES.reduce((s, c) => s + (c.eadCr ?? 0), 0)

/** A portfolio's company list — every company when none is active (today's
 * implicit "full book" behaviour), or the saved subset otherwise. Falls
 * back to the full book if a saved portfolio ends up empty (e.g. every
 * member was somehow removed from the graph), so the dashboard never
 * silently shows zero holdings. */
export function companiesInPortfolio(portfolio: SavedPortfolio | null): GNode[] {
  if (!portfolio || portfolio.companyIds.length === 0) return ALL_COMPANIES
  const idSet = new Set(portfolio.companyIds)
  const filtered = ALL_COMPANIES.filter((c) => idSet.has(c.id))
  return filtered.length ? filtered : ALL_COMPANIES
}

// A common stress level for cross-portfolio/cross-sector comparisons —
// matches the "Severe" profile used elsewhere (SCENARIO_PROFILES in
// useScenarioStore.ts) so dashboard figures are comparable with What-If
// Analysis's own scenario ranking, not a third invented number.
export const HEADLINE_SEVERITY = 80
export const HEADLINE_DURATION = 6
const HEADLINE_SUB: Substitutability = 'Moderate'

function stressOne(c: GNode, severity: number, durationMonths: number, substitutability: Substitutability) {
  const ead = c.eadCr ?? 0
  const pd = c.baselinePd ?? 0
  const lgd = c.baselineLgd ?? 0
  const { stressedPd, stressedLgd } = stressPdLgd(pd, lgd, severity, durationMonths, substitutability, sectorVulnerability(c.sector))
  return { ead, baselineEl: ead * pd * lgd, stressedEl: ead * stressedPd * stressedLgd }
}

export interface DashboardKPIs {
  totalEADCr: number
  climateExposedEADCr: number
  climateExposedShare: number
  revenueAtRiskCr: number
  stressedElCr: number
  protectionGapShare: number
  protectionGapEADCr: number
}

/** The exposed-value figure: every portfolio company reachable from ANY
 * region's hazard node (union across regions) — "climate-exposed" in the
 * portfolio-wide sense your Command Centre KPI strip needs, distinct from
 * any single region's own exposure. */
function exposedCompanyIds(companies: GNode[]): Set<string> {
  const exposed = new Set<string>()
  const companyIdSet = new Set(companies.map((c) => c.id))
  for (const region of ALL_REGIONS) {
    const { companies: reached } = computeHazardReach(REGION_HAZARD[region])
    for (const c of reached) if (companyIdSet.has(c.id)) exposed.add(c.id)
  }
  return exposed
}

export function computeDashboardKPIs(companies: GNode[]): DashboardKPIs {
  const totalEADCr = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0)
  const exposedIds = exposedCompanyIds(companies)
  const exposed = companies.filter((c) => exposedIds.has(c.id))
  const climateExposedEADCr = exposed.reduce((s, c) => s + (c.eadCr ?? 0), 0)

  let revenueAtRiskCr = 0
  let stressedElCr = 0
  for (const c of exposed) {
    revenueAtRiskCr += computeEquityImpact(c, HEADLINE_SEVERITY, HEADLINE_DURATION).revenueAtRiskCr
    stressedElCr += stressOne(c, HEADLINE_SEVERITY, HEADLINE_DURATION, HEADLINE_SUB).stressedEl
  }

  // Protection gap, portfolio-scoped: recompute from each region's gap
  // result but keep only this portfolio's companies in the sums, rather
  // than re-deriving the claim/deductible math (that stays in
  // insurance.ts, called once per region here).
  let exposedForGap = 0
  let uninsuredForGap = 0
  const companyIdSet = new Set(companies.map((c) => c.id))
  for (const region of ALL_REGIONS) {
    const gap = computeProtectionGap(REGION_HAZARD[region], HEADLINE_SEVERITY, HEADLINE_DURATION)
    for (const c of gap.exposedCompanies) if (companyIdSet.has(c.id)) exposedForGap += c.eadCr ?? 0
    for (const c of gap.uninsuredExposed) if (companyIdSet.has(c.id)) uninsuredForGap += c.eadCr ?? 0
  }

  return {
    totalEADCr,
    climateExposedEADCr,
    climateExposedShare: totalEADCr ? climateExposedEADCr / totalEADCr : 0,
    revenueAtRiskCr,
    stressedElCr,
    protectionGapShare: exposedForGap ? uninsuredForGap / exposedForGap : 0,
    protectionGapEADCr: uninsuredForGap,
  }
}

export interface SectorRiskRow {
  sector: string
  eadCr: number
  stressedElCr: number
  /** Loss rate — how hard this sector gets hit relative to its own size (stressedEl / eadCr). */
  sensitivity: number
  /** Share of the portfolio's TOTAL stressed loss this sector drives — can be high sensitivity, low contribution (small sector) or vice versa. */
  contribution: number
}

/** Sensitivity and contribution shown together, per UNEP FI's TCFD
 * guidance pattern: a sector can be highly sensitive but contribute
 * little to total portfolio risk (small allocation) or the reverse (large
 * allocation, modest sensitivity) — one number alone hides which is true. */
export function computeSectorRisk(companies: GNode[]): SectorRiskRow[] {
  const bySector = new Map<string, { eadCr: number; stressedElCr: number }>()
  let totalStressedEl = 0
  for (const c of companies) {
    const { ead, stressedEl } = stressOne(c, HEADLINE_SEVERITY, HEADLINE_DURATION, HEADLINE_SUB)
    const key = c.sector ?? 'Other'
    const existing = bySector.get(key) ?? { eadCr: 0, stressedElCr: 0 }
    existing.eadCr += ead
    existing.stressedElCr += stressedEl
    bySector.set(key, existing)
    totalStressedEl += stressedEl
  }
  return Array.from(bySector.entries())
    .map(([sector, v]) => ({
      sector,
      eadCr: v.eadCr,
      stressedElCr: v.stressedElCr,
      sensitivity: v.eadCr ? v.stressedElCr / v.eadCr : 0,
      contribution: totalStressedEl ? v.stressedElCr / totalStressedEl : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution)
}

export type HorizonKey = 'near' | 'medium' | 'long'

export const HORIZON_DIALS: Record<HorizonKey, { label: string; severity: number; durationMonths: number; desc: string }> = {
  near: { label: 'Near-term', severity: 15, durationMonths: 1, desc: 'Ordinary seasonal conditions' },
  medium: { label: 'Medium-term', severity: 80, durationMonths: 6, desc: 'Severe but plausible stress' },
  long: { label: 'Long-term', severity: 100, durationMonths: 12, desc: 'Compound / prolonged stress' },
}

/** Portfolio-wide stressed EL at three fixed horizon dials — the "2030 vs
 * 2050" pattern real institutional climate reports use (ISS ESG's
 * temperature-alignment horizons), reusing the dial shape this app
 * already models conditions with (SCENARIO_PROFILES) rather than
 * inventing calendar-year climate projections this prototype has no data
 * to back. */
export function computeHorizonComparison(companies: GNode[]): { horizon: HorizonKey; label: string; stressedElCr: number }[] {
  return (Object.keys(HORIZON_DIALS) as HorizonKey[]).map((horizon) => {
    const dial = HORIZON_DIALS[horizon]
    const stressedElCr = companies.reduce((s, c) => s + stressOne(c, dial.severity, dial.durationMonths, HEADLINE_SUB).stressedEl, 0)
    return { horizon, label: dial.label, stressedElCr }
  })
}

export interface DashboardAlert {
  id: string
  level: 'High' | 'Medium' | 'Info'
  title: string
  detail: string
  region?: Region
}

/** Alerts derived live from the current graph + a common stress scan —
 * NOT a persisted or time-stamped monitoring feed. Deliberately no fake
 * "2 hours ago" timestamps: this app's whole premise is not claiming
 * capabilities it doesn't have, and this prototype has no live alerting
 * pipeline. Every alert here is reproducible from the graph at any time. */
export function computeDashboardAlerts(companies: GNode[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const companyIdSet = new Set(companies.map((c) => c.id))
  const totalEAD = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0) || 1

  for (const region of ALL_REGIONS) {
    const { companies: reached } = computeHazardReach(REGION_HAZARD[region])
    const portfolioReached = reached.filter((c) => companyIdSet.has(c.id))
    const reachedEAD = portfolioReached.reduce((s, c) => s + (c.eadCr ?? 0), 0)
    const share = reachedEAD / totalEAD
    if (share >= 0.1) {
      alerts.push({
        id: `region-${region}`,
        level: share >= 0.25 ? 'High' : 'Medium',
        title: `${REGION_LABEL[region]} concentration`,
        detail: `${(share * 100).toFixed(0)}% of this portfolio's EAD (₹${reachedEAD.toFixed(0)} cr, ${portfolioReached.length} holdings) is reachable from the ${REGION_LABEL[region]} hazard node.`,
        region,
      })
    }
  }

  const bottlenecks = computeBottlenecks(8)
  for (const b of bottlenecks) {
    const portfolioReached = b.reachedCompanies.filter((c) => companyIdSet.has(c.id))
    if (portfolioReached.length < 2) continue
    const reachedEAD = portfolioReached.reduce((s, c) => s + (c.eadCr ?? 0), 0)
    alerts.push({
      id: `bottleneck-${b.node.id}`,
      level: portfolioReached.length >= 4 ? 'High' : 'Info',
      title: `Shared dependency: ${b.node.label}`,
      detail: `Reaches ${portfolioReached.length} holdings in this portfolio (₹${reachedEAD.toFixed(0)} cr combined EAD) — a single point of failure, not visible from any one holding's own risk view.`,
    })
    if (alerts.filter((a) => a.id.startsWith('bottleneck-')).length >= 2) break
  }

  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'High' ? -1 : b.level === 'High' ? 1 : 0))
}

export interface DashboardSnapshot {
  kpis: DashboardKPIs
  sectorRisk: SectorRiskRow[]
  horizons: { horizon: HorizonKey; label: string; stressedElCr: number }[]
  alerts: DashboardAlert[]
  transition: TransitionExposureResult
}

export function buildDashboardSnapshot(portfolio: SavedPortfolio | null, policyStringency: number): DashboardSnapshot {
  const companies = companiesInPortfolio(portfolio)
  return {
    kpis: computeDashboardKPIs(companies),
    sectorRisk: computeSectorRisk(companies),
    horizons: computeHorizonComparison(companies),
    alerts: computeDashboardAlerts(companies),
    transition: computeTransitionExposure(companies, policyStringency),
  }
}
