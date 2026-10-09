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

/** Every region named in the text, in first-mention order — used for
 * "compare X and Y" questions, unlike detectRegion's single-best-match. */
export function detectRegions(text: string): Region[] {
  const lower = text.toLowerCase()
  const found: Region[] = []
  for (const { region, terms } of REGION_ALIASES) {
    if (!found.includes(region) && terms.some((t) => lower.includes(t))) found.push(region)
  }
  return found
}

// Direct scenario-dial control from free text — "set severity to 85", the
// gap that made the Copilot describe the scenario but never actually set
// it. Each detector requires its own literal keyword next to the number,
// not a bare digit, so an unrelated sentence that happens to contain a
// number doesn't misfire.
export function detectSeverity(text: string): number | null {
  const m = text.match(/severity\s*(?:to|of|at|=|:)?\s*(\d{1,3})/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n >= 0 && n <= 100 ? n : null
}

export function detectDurationMonths(text: string): number | null {
  const m = text.match(/(\d{1,2})\s*[- ]?month/i) ?? text.match(/duration\s*(?:to|of|=|:)?\s*(\d{1,2})/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return n >= 1 && n <= 36 ? n : null
}

export function detectSubstitutability(text: string): Substitutability | null {
  if (!/substitutab/i.test(text)) return null
  const lower = text.toLowerCase()
  if (/\blimited\b/.test(lower)) return 'Limited'
  if (/\bstrong\b/.test(lower)) return 'Strong'
  if (/\bmoderate\b/.test(lower)) return 'Moderate'
  return null
}

export function detectUserMode(text: string): 'bank' | 'investor' | null {
  const lower = text.toLowerCase()
  if (/\b(switch to|use|act as an?)\s+investor\b|\binvestor (mode|view|lens)\b/.test(lower)) return 'investor'
  if (/\b(switch to|use|act as an?)\s+bank\b|\bbank (mode|view|lens)\b/.test(lower)) return 'bank'
  return null
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
