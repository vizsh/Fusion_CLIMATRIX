import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { hazardPortfolioStats, REGION_HAZARD } from '../lib/graphAnalytics'
import { combinedReductionShare, totalInterventionCost } from '../lib/interventions'

export type Hazard = 'Flood' | 'Drought' | 'Cyclone' | 'Heatwave'
export type Substitutability = 'Limited' | 'Moderate' | 'Strong'
export type Region = 'HP' | 'KL' | 'MH'
export type RunState = 'idle' | 'running' | 'paused' | 'done'

export const REGION_LABEL: Record<Region, string> = {
  HP: 'Himachal Pradesh',
  KL: 'Kerala',
  MH: 'Agricultural Belt (Drought)',
}

export const REGION_DEFAULT_HAZARD: Record<Region, Hazard> = {
  HP: 'Flood',
  KL: 'Flood',
  MH: 'Drought',
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
  // --- scenario configuration (shared across every module) ---
  region: Region
  hazard: Hazard
  severity: number // 0-100, a UI stress dial — never a flood probability or damage rate
  durationMonths: number
  substitutability: Substitutability
  interventions: string[]

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
 * stressed by the scenario dials — portfolio-level or single-borrower. */
export function stressPdLgd(
  baselinePd: number,
  baselineLgd: number,
  severity: number,
  durationMonths: number,
  substitutability: Substitutability,
) {
  const subMultiplier = { Limited: 1.25, Moderate: 1.0, Strong: 0.75 }[substitutability]
  const durationFactor = Math.min(durationMonths / 12, 1)
  const severityFactor = severity / 100
  const stressedPd = Math.min(baselinePd * (1 + severityFactor * 4 * subMultiplier * (0.5 + durationFactor)), 0.95)
  const stressedLgd = Math.min(baselineLgd + severityFactor * 0.15 * subMultiplier, 0.95)
  return { stressedPd, stressedLgd }
}

export interface ImpactResult {
  eadCr: number
  companyCount: number
  baselinePd: number
  stressedPd: number
  baselineLgd: number
  stressedLgd: number
  baselineEl: number
  stressedEl: number
  mitigatedEl: number
  incrementalEl: number // stressed - baseline (unmitigated)
  avoidedEl: number // stressed - mitigated
  interventionCostCr: number
}

/** The single financial transmission calculation every module reads from.
 * Stressed PD/LGD are a transparent function of the scenario dial inputs —
 * NOT a calibrated hazard-to-credit model. ECL = EAD x PD x LGD throughout. */
export function computeImpact(state: {
  region: Region
  severity: number
  durationMonths: number
  substitutability: Substitutability
  interventions: string[]
}): ImpactResult {
  const hazardId = REGION_HAZARD[state.region]
  const portfolio = hazardPortfolioStats(hazardId)

  const { stressedPd, stressedLgd } = stressPdLgd(
    portfolio.baselinePd,
    portfolio.baselineLgd,
    state.severity,
    state.durationMonths,
    state.substitutability,
  )

  const baselineEl = portfolio.eadCr * portfolio.baselinePd * portfolio.baselineLgd
  const stressedEl = portfolio.eadCr * stressedPd * stressedLgd
  const incrementalEl = stressedEl - baselineEl

  const reduction = combinedReductionShare(state.interventions)
  const mitigatedEl = baselineEl + incrementalEl * (1 - reduction)
  const avoidedEl = stressedEl - mitigatedEl
  const interventionCostCr = totalInterventionCost(state.interventions)

  return {
    eadCr: portfolio.eadCr,
    companyCount: portfolio.companyCount,
    baselinePd: portfolio.baselinePd,
    stressedPd,
    baselineLgd: portfolio.baselineLgd,
    stressedLgd,
    baselineEl,
    stressedEl,
    mitigatedEl,
    incrementalEl,
    avoidedEl,
    interventionCostCr,
  }
}
