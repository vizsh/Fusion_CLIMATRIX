// Shared entity/parameter resolution for the Copilot — used by BOTH the
// rule-based fallback parser (respond.ts) and the LLM tool-call path
// (tools.ts), so "what does 'Mumbai' mean" and "what counts as the active
// scenario" are answered exactly once, not reimplemented per path.

import type { Region, ScenarioState, Substitutability } from '../../store/useScenarioStore'

export interface ScenarioParams {
  region: Region
  severity: number
  durationMonths: number
  substitutability: Substitutability
}

/** Merges an optional partial override (from an LLM tool call, or parsed
 * from free text) onto the live dashboard scenario state. Unset fields
 * fall back to whatever's actually on screen right now. */
export function resolveScenario(partial: Partial<ScenarioParams> | undefined, state: ScenarioState): ScenarioParams {
  return {
    region: partial?.region ?? state.region,
    severity: partial?.severity ?? state.severity,
    durationMonths: partial?.durationMonths ?? state.durationMonths,
    substitutability: partial?.substitutability ?? state.substitutability,
  }
}

export const REGION_ALIASES: { region: Region; terms: string[] }[] = [
  { region: 'HP', terms: ['himachal', 'hp', 'kullu', 'manali', 'beas'] },
  { region: 'KL', terms: ['kerala', 'kl', 'kochi', 'idukki', 'wayanad', 'ernakulam'] },
  { region: 'MH', terms: ['marathwada', 'latur', 'solapur', 'drought belt', 'agricultural belt'] },
  { region: 'UK', terms: ['uttarakhand', 'chamoli', 'joshimath', 'landslide corridor'] },
  { region: 'MB', terms: ['mumbai', 'bombay', 'bkc', 'bandra', 'kurla', 'mithi', 'jnpt', 'nariman point', 'financial capital', 'financial hub'] },
  // Generic "maharashtra"/"mh" is ambiguous between the Marathwada drought
  // belt and Mumbai — defaults to the drought belt (the region's existing
  // identity), but a city-specific term above always wins since it's
  // checked first.
  { region: 'MH', terms: ['maharashtra', 'mh'] },
]

// Real Indian financial/population centers this graph does NOT model yet —
// answering silently as if they were the active region would be a quiet
// fabrication, so these get an honest "not modeled, here's the nearest
// comparable one" response instead.
export const UNMAPPED_CITIES: { name: string; terms: string[]; nearest: Region }[] = [
  { name: 'Chennai', terms: ['chennai', 'madras'], nearest: 'KL' },
  { name: 'Bengaluru', terms: ['bengaluru', 'bangalore'], nearest: 'KL' },
  { name: 'Delhi / NCR', terms: ['delhi', 'ncr', 'gurugram', 'gurgaon', 'noida'], nearest: 'HP' },
  { name: 'Hyderabad', terms: ['hyderabad', 'telangana'], nearest: 'MH' },
  { name: 'Kolkata', terms: ['kolkata', 'calcutta', 'west bengal'], nearest: 'KL' },
  { name: 'Ahmedabad / Gujarat', terms: ['ahmedabad', 'surat', 'gujarat'], nearest: 'MH' },
]

export function detectRegion(text: string): Region | null {
  const lower = text.toLowerCase()
  for (const { region, terms } of REGION_ALIASES) {
    if (terms.some((t) => lower.includes(t))) return region
  }
  return null
}

export function detectUnmappedCity(text: string) {
  const lower = text.toLowerCase()
  return UNMAPPED_CITIES.find((c) => c.terms.some((t) => lower.includes(t))) ?? null
}

export type Horizon = 'near' | 'medium' | 'long' | 'both'

export function detectHorizon(text: string): Horizon {
  const lower = text.toLowerCase()
  if (/long[\s-]?term|5[\s-]?10 years|decade/.test(lower)) return 'long'
  if (/near[\s-]?term|current conditions|next few weeks|right now/.test(lower)) return 'near'
  if (/near.*long|both/.test(lower)) return 'both'
  return 'medium'
}

export function fmtCr(n: number) {
  return `₹${n.toFixed(1)} cr`
}
