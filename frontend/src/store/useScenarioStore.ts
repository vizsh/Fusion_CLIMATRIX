import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { computeHazardReach, REGION_HAZARD } from '../lib/graphAnalytics'
import { combinedReductionShare, parametricPayout, totalInterventionCost } from '../lib/interventions'
import { estimateRevenue, sectorVulnerability } from '../lib/sectorVulnerability'

export type Hazard = 'Flood' | 'Drought' | 'Cyclone' | 'Heatwave' | 'Landslide'
export type Substitutability = 'Limited' | 'Moderate' | 'Strong'
export type Region = 'HP' | 'KL' | 'MH' | 'UK'
export type RunState = 'idle' | 'running' | 'paused' | 'done'
export type UserMode = 'bank' | 'investor'
export type ScenarioProfile = 'Baseline' | 'Moderate' | 'Severe' | 'Compound'

export const REGION_LABEL: Record<Region, string> = {
  HP: 'Himachal Pradesh',
  KL: 'Kerala',
  MH: 'Agricultural Belt (Drought)',
  UK: 'Uttarakhand (Construction)',
}

export const REGION_DEFAULT_HAZARD: Record<Region, Hazard> = {
  HP: 'Flood',
  KL: 'Flood',
  MH: 'Drought',
  UK: 'Landslide',
}

// "Ordinary conditions" through to catastrophic — severity/duration presets
// so the product isn't only about extreme disasters. These are illustrative
// stress-dial combinations, not calibrated return periods or probabilities.
export const SCENARIO_PROFILES: Record<ScenarioProfile, { severity: number; durationMonths: number; desc: string }> = {
  Baseline: { severity: 15, durationMonths: 1, desc: 'Ordinary seasonal conditions — minimal disruption.' },
  Moderate: { severity: 45, durationMonths: 3, desc: 'Moderate adverse conditions — repeated minor disruption.' },
  Severe: { severity: 80, durationMonths: 6, desc: 'Severe but plausible — the flagship stress scenario.' },
  Compound: { severity: 100, durationMonths: 12, desc: 'Compound/prolonged — extreme and sustained.' },
}

interface SavedScenario {
  id: string
  label: string
  region: Region
  hazard: Hazard
  severity: number
  durationMonths: number
  substitutability: Substitutability
  interventions: string[]
}

interface ScenarioState {
  // --- which financial lens every view renders — forks the analysis, not the data ---
  userMode: UserMode
  setUserMode: (m: UserMode) => void

  // --- scenario configuration (shared across every module) ---
  region: Region
  hazard: Hazard
  severity: number // 0-100, a UI stress dial — never a flood probability or damage rate
  durationMonths: number
  substitutability: Substitutability
  interventions: string[]
  applyProfile: (p: ScenarioProfile) => void

  // --- run / timeline state ---
  runState: RunState
  timelineMonth: number

  // --- cross-module selection sync: the SAME id drives the digital twin,
  // dependency explorer and company investigation panels ---
  selectedEntityId: string | null

  // --- presentation mode ---
  presentationActive: boolean
  presentationStep: number

  // --- saved scenarios (localStorage-backed) ---
  savedScenarios: SavedScenario[]

  setRegion: (r: Region) => void
  setHazard: (h: Hazard) => void
  setSeverity: (s: number) => void
  setDuration: (d: number) => void
  setSubstitutability: (s: Substitutability) => void
  toggleIntervention: (id: string) => void
  clearInterventions: () => void

  run: () => void
  pause: () => void
  resume: () => void
  replay: () => void
  reset: () => void
  tick: (deltaMonths: number) => void

  setSelectedEntity: (id: string | null) => void

  startPresentation: () => void
  exitPresentation: () => void
  setPresentationStep: (step: number) => void

  saveCurrentScenario: (label: string) => void
  restoreScenario: (id: string) => void
  deleteScenario: (id: string) => void
}

const SAVE_KEY = 'climatrix.savedScenarios'

function loadSaved(): SavedScenario[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSaved(list: SavedScenario[]) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota/availability errors — non-critical */
  }
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  userMode: 'bank',
  setUserMode: (userMode) => set({ userMode }),

  region: 'HP',
  hazard: 'Flood',
  severity: 90,
  durationMonths: 6,
  substitutability: 'Moderate',
  interventions: [],

  runState: 'idle',
  timelineMonth: 0,

  selectedEntityId: null,

  presentationActive: false,
  presentationStep: 0,

  savedScenarios: loadSaved(),

  setRegion: (region) =>
    set({ region, hazard: REGION_DEFAULT_HAZARD[region], runState: 'idle', timelineMonth: 0 }),
  setHazard: (hazard) => set({ hazard, runState: 'idle', timelineMonth: 0 }),
  setSeverity: (severity) => set({ severity, runState: 'idle', timelineMonth: 0 }),
  setDuration: (durationMonths) => set({ durationMonths, runState: 'idle', timelineMonth: 0 }),
  setSubstitutability: (substitutability) => set({ substitutability, runState: 'idle', timelineMonth: 0 }),
  applyProfile: (profile) => {
    const p = SCENARIO_PROFILES[profile]
    set({ severity: p.severity, durationMonths: p.durationMonths, runState: 'idle', timelineMonth: 0 })
  },

  toggleIntervention: (id) =>
    set((s) => ({
      interventions: s.interventions.includes(id)
        ? s.interventions.filter((x) => x !== id)
        : [...s.interventions, id],
    })),
  clearInterventions: () => set({ interventions: [] }),

  run: () => set({ runState: 'running', timelineMonth: 0 }),
  pause: () => set((s) => (s.runState === 'running' ? { runState: 'paused' } : {})),
  resume: () => set((s) => (s.runState === 'paused' ? { runState: 'running' } : {})),
  replay: () => set({ runState: 'running', timelineMonth: 0 }),
  reset: () => set({ runState: 'idle', timelineMonth: 0 }),
  tick: (deltaMonths) =>
    set((s) => {
      if (s.runState !== 'running') return {}
      const next = s.timelineMonth + deltaMonths
      if (next >= s.durationMonths) return { timelineMonth: s.durationMonths, runState: 'done' }
      return { timelineMonth: next }
    }),

  setSelectedEntity: (selectedEntityId) => set({ selectedEntityId }),

  startPresentation: () => set({ presentationActive: true, presentationStep: 0 }),
  exitPresentation: () => set({ presentationActive: false }),
  setPresentationStep: (presentationStep) => set({ presentationStep }),

  saveCurrentScenario: (label) => {
    const s = get()
    const entry: SavedScenario = {
      id: `scn-${Date.now()}`,
      label,
      region: s.region,
      hazard: s.hazard,
      severity: s.severity,
      durationMonths: s.durationMonths,
      substitutability: s.substitutability,
      interventions: s.interventions,
    }
    const list = [entry, ...s.savedScenarios].slice(0, 12)
    persistSaved(list)
    set({ savedScenarios: list })
  },
  restoreScenario: (id) => {
    const found = get().savedScenarios.find((x) => x.id === id)
    if (!found) return
    set({
      region: found.region,
      hazard: found.hazard,
      severity: found.severity,
      durationMonths: found.durationMonths,
      substitutability: found.substitutability,
      interventions: found.interventions,
      runState: 'idle',
      timelineMonth: 0,
    })
  },
  deleteScenario: (id) => {
    const list = get().savedScenarios.filter((x) => x.id !== id)
    persistSaved(list)
    set({ savedScenarios: list })
  },
}))

/** Drives the scenario timeline forward in real time while a simulation is
 * running. Mount once near the app root. */
export function useSimulationClock() {
  const tick = useScenarioStore((s) => s.tick)
  const runState = useScenarioStore((s) => s.runState)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (runState !== 'running') return
    let last = performance.now()
    const MONTHS_PER_SECOND = 1.1
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      tick(dt * MONTHS_PER_SECOND)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [runState, tick])
}

/** The one stress formula used everywhere a baseline PD/LGD needs to be
 * stressed by the scenario dials — portfolio-level or single-borrower.
 * `vulnerability` is a sector-specific multiplier on the severity factor
 * (1.0 = neutral; see lib/sectorVulnerability.ts) so two borrowers under
 * the identical scenario can carry different stressed PD if their sectors
 * carry different climate sensitivity. */
export function stressPdLgd(
  baselinePd: number,
  baselineLgd: number,
  severity: number,
  durationMonths: number,
  substitutability: Substitutability,
  vulnerability = 1,
) {
  const subMultiplier = { Limited: 1.25, Moderate: 1.0, Strong: 0.75 }[substitutability]
  const durationFactor = Math.min(durationMonths / 12, 1)
  const severityFactor = (severity / 100) * vulnerability
  const stressedPd = Math.min(baselinePd * (1 + severityFactor * 4 * subMultiplier * (0.5 + durationFactor)), 0.95)
  const stressedLgd = Math.min(baselineLgd + severityFactor * 0.15 * subMultiplier, 0.95)
  return { stressedPd, stressedLgd }
}

export interface SectorBreakdown {
  sector: string
  eadCr: number
  baselineEl: number
  stressedEl: number
}

export interface ImpactResult {
  eadCr: number
  companyCount: number
  baselinePd: number // EAD-weighted average, for display only — EL totals are summed per-company
  stressedPd: number
  baselineLgd: number
  stressedLgd: number
  baselineEl: number
  stressedEl: number
  stressedElLow: number // sensitivity band: severity -15%
  stressedElHigh: number // sensitivity band: severity +15%
  mitigatedEl: number
  incrementalEl: number // stressed - baseline (unmitigated)
  avoidedEl: number // stressed - mitigated
  interventionCostCr: number
  parametricPayoutCr: number // fixed payout from any triggered parametric intervention, already folded into mitigatedEl
  bySector: SectorBreakdown[]
}

const SENSITIVITY_SWING = 0.15 // +/- 15% on the severity dial

function sumCompanyEl(
  companies: { eadCr?: number; baselinePd?: number; baselineLgd?: number; sector?: string }[],
  severity: number,
  durationMonths: number,
  substitutability: Substitutability,
) {
  let baselineEl = 0
  let stressedEl = 0
  for (const c of companies) {
    const ead = c.eadCr ?? 0
    const pd = c.baselinePd ?? 0
    const lgd = c.baselineLgd ?? 0
    const { stressedPd, stressedLgd } = stressPdLgd(
      pd,
      lgd,
      severity,
      durationMonths,
      substitutability,
      sectorVulnerability(c.sector),
    )
    baselineEl += ead * pd * lgd
    stressedEl += ead * stressedPd * stressedLgd
  }
  return { baselineEl, stressedEl }
}

/** The single financial transmission calculation every module reads from.
 * Stressed PD/LGD are a transparent, disclosed function of the scenario
 * dial inputs and each borrower's sector vulnerability — NOT a calibrated
 * hazard-to-credit model. ECL = EAD x PD x LGD throughout, summed once per
 * borrower (never double-counted across graph paths). */
export function computeImpact(state: {
  region: Region
  severity: number
  durationMonths: number
  substitutability: Substitutability
  interventions: string[]
}): ImpactResult {
  const hazardId = REGION_HAZARD[state.region]
  const { companies, companyEAD } = computeHazardReach(hazardId)

  const { baselineEl, stressedEl } = sumCompanyEl(companies, state.severity, state.durationMonths, state.substitutability)
  const { baselineEl: lowEl, stressedEl: stressedElLow } = sumCompanyEl(
    companies,
    Math.max(0, state.severity * (1 - SENSITIVITY_SWING)),
    state.durationMonths,
    state.substitutability,
  )
  const { stressedEl: stressedElHigh } = sumCompanyEl(
    companies,
    Math.min(100, state.severity * (1 + SENSITIVITY_SWING)),
    state.durationMonths,
    state.substitutability,
  )
  void lowEl // baseline is swing-invariant; only the stressed low/high bound is used

  const bySectorMap = new Map<string, SectorBreakdown>()
  for (const c of companies) {
    const key = c.sector ?? 'Other'
    const existing = bySectorMap.get(key) ?? { sector: key, eadCr: 0, baselineEl: 0, stressedEl: 0 }
    const ead = c.eadCr ?? 0
    const pd = c.baselinePd ?? 0
    const lgd = c.baselineLgd ?? 0
    const { stressedPd, stressedLgd } = stressPdLgd(
      pd,
      lgd,
      state.severity,
      state.durationMonths,
      state.substitutability,
      sectorVulnerability(c.sector),
    )
    existing.eadCr += ead
    existing.baselineEl += ead * pd * lgd
    existing.stressedEl += ead * stressedPd * stressedLgd
    bySectorMap.set(key, existing)
  }

  const incrementalEl = stressedEl - baselineEl
  const reduction = combinedReductionShare(state.interventions)
  const payoutCr = parametricPayout(state.interventions, state.severity)
  // Payout offsets stress-induced loss only, never below the untressed
  // baseline — a parametric trigger pays for the shock, not for ordinary
  // credit risk the borrower already carried.
  const mitigatedEl = Math.max(baselineEl, baselineEl + incrementalEl * (1 - reduction) - payoutCr)
  const avoidedEl = stressedEl - mitigatedEl
  const interventionCostCr = totalInterventionCost(state.interventions)

  const avgBaselinePd = companyEAD ? companies.reduce((s, c) => s + (c.baselinePd ?? 0) * (c.eadCr ?? 0), 0) / companyEAD : 0
  const avgBaselineLgd = companyEAD ? companies.reduce((s, c) => s + (c.baselineLgd ?? 0) * (c.eadCr ?? 0), 0) / companyEAD : 0
  const avgStressedPd = companyEAD
    ? companies.reduce((s, c) => {
        const { stressedPd } = stressPdLgd(c.baselinePd ?? 0, c.baselineLgd ?? 0, state.severity, state.durationMonths, state.substitutability, sectorVulnerability(c.sector))
        return s + stressedPd * (c.eadCr ?? 0)
      }, 0) / companyEAD
    : 0
  const avgStressedLgd = companyEAD
    ? companies.reduce((s, c) => {
        const { stressedLgd } = stressPdLgd(c.baselinePd ?? 0, c.baselineLgd ?? 0, state.severity, state.durationMonths, state.substitutability, sectorVulnerability(c.sector))
        return s + stressedLgd * (c.eadCr ?? 0)
      }, 0) / companyEAD
    : 0

  return {
    eadCr: companyEAD,
    companyCount: companies.length,
    baselinePd: avgBaselinePd,
    stressedPd: avgStressedPd,
    baselineLgd: avgBaselineLgd,
    stressedLgd: avgStressedLgd,
    baselineEl,
    stressedEl,
    stressedElLow: Math.min(stressedElLow, stressedEl),
    stressedElHigh: Math.max(stressedElHigh, stressedEl),
    mitigatedEl,
    incrementalEl,
    avoidedEl,
    interventionCostCr,
    parametricPayoutCr: payoutCr,
    bySector: Array.from(bySectorMap.values()).sort((a, b) => b.stressedEl - a.stressedEl),
  }
}

export interface EquityImpactResult {
  annualRevenueCr: number
  exposedRevenueShare: number
  disruptionFraction: number
  revenueAtRiskCr: number
  marginImpactCr: number
  cashflowImpactCr: number
}

// Disclosed placeholder assumptions for the equity/investor lens — a
// screening approximation (per Revenue at risk = annual revenue x exposed
// share x disruption fraction x months/12), NOT a calibrated earnings
// model, DCF input, or valuation adjustment.
const ASSUMED_EXPOSED_REVENUE_SHARE = 0.55
const ASSUMED_OPERATING_MARGIN = 0.16

/** The equity/investor financial lens — deliberately separate from the
 * bank's credit-risk calculation above. Operates on a single company, not
 * a portfolio, since investment research is bottom-up by construction. */
export function computeEquityImpact(
  company: { sector?: string; eadCr?: number; annualRevenueCr?: number },
  severity: number,
  durationMonths: number,
): EquityImpactResult {
  const annualRevenueCr = estimateRevenue(company.eadCr, company.annualRevenueCr)
  const vulnerability = sectorVulnerability(company.sector)
  const disruptionFraction = Math.min((severity / 100) * vulnerability, 1)
  const monthsFraction = Math.min(durationMonths / 12, 1)

  const revenueAtRiskCr = annualRevenueCr * ASSUMED_EXPOSED_REVENUE_SHARE * disruptionFraction * monthsFraction
  const marginImpactCr = revenueAtRiskCr * ASSUMED_OPERATING_MARGIN
  const cashflowImpactCr = marginImpactCr

  return {
    annualRevenueCr,
    exposedRevenueShare: ASSUMED_EXPOSED_REVENUE_SHARE,
    disruptionFraction,
    revenueAtRiskCr,
    marginImpactCr,
    cashflowImpactCr,
  }
}
