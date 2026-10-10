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
// comparable one" response instead. Deliberately broad: a narrow list just
// means more unmapped cities silently fall through to the wrong rule (see
// detectOutOfScopeDomain's doc comment for the bug this caused in practice).
export const UNMAPPED_CITIES: { name: string; terms: string[]; nearest: Region }[] = [
  { name: 'Chennai', terms: ['chennai', 'madras'], nearest: 'KL' },
  { name: 'Bengaluru', terms: ['bengaluru', 'bangalore'], nearest: 'KL' },
  { name: 'Delhi / NCR', terms: ['delhi', 'ncr', 'gurugram', 'gurgaon', 'noida'], nearest: 'HP' },
  { name: 'Hyderabad', terms: ['hyderabad', 'telangana'], nearest: 'MH' },
  { name: 'Kolkata', terms: ['kolkata', 'calcutta', 'west bengal'], nearest: 'KL' },
  { name: 'Ahmedabad / Gujarat', terms: ['ahmedabad', 'surat', 'gujarat'], nearest: 'MH' },
  { name: 'Indore / Madhya Pradesh', terms: ['indore', 'madhya pradesh', 'bhopal'], nearest: 'MH' },
  { name: 'Pune', terms: ['pune'], nearest: 'MH' },
  { name: 'Jaipur / Rajasthan', terms: ['jaipur', 'rajasthan', 'jodhpur', 'udaipur'], nearest: 'MH' },
  { name: 'Lucknow / Uttar Pradesh', terms: ['lucknow', 'uttar pradesh', 'kanpur', 'varanasi', 'ayodhya'], nearest: 'HP' },
  { name: 'Patna / Bihar', terms: ['patna', 'bihar'], nearest: 'HP' },
  { name: 'Chandigarh / Punjab', terms: ['chandigarh', 'punjab', 'ludhiana', 'amritsar'], nearest: 'HP' },
  { name: 'Nagpur', terms: ['nagpur', 'vidarbha'], nearest: 'MH' },
  { name: 'Bhubaneswar / Odisha', terms: ['bhubaneswar', 'odisha', 'orissa', 'puri'], nearest: 'KL' },
  { name: 'Visakhapatnam / Andhra Pradesh', terms: ['visakhapatnam', 'vizag', 'andhra pradesh', 'amaravati'], nearest: 'KL' },
  { name: 'Coimbatore / Tamil Nadu', terms: ['coimbatore', 'tamil nadu', 'madurai', 'tiruchirappalli'], nearest: 'KL' },
  { name: 'Goa', terms: ['goa', 'panaji'], nearest: 'KL' },
  { name: 'Jammu & Kashmir', terms: ['srinagar', 'jammu and kashmir', 'jammu & kashmir', 'kashmir'], nearest: 'HP' },
  { name: 'Northeast India', terms: ['guwahati', 'assam', 'shillong', 'meghalaya'], nearest: 'KL' },
]

// Risk categories this platform has zero data, connector or model for —
// a question like "is my supply-chain route affected by political rallies"
// used to silently match the freight/route rule's keyword and get answered
// with whatever the CURRENT scenario's region happened to be (e.g. a
// Himachal Pradesh flood corridor), which is a quiet fabrication: the
// platform substituted an unrelated climate answer for a political-risk
// question it has no actual basis to answer. Checked FIRST, before any
// region/route/hazard rule, so a domain mismatch is caught regardless of
// which other keywords the question happens to also contain.
const OUT_OF_SCOPE_DOMAINS: { domain: string; terms: string[] }[] = [
  {
    domain: 'political unrest or civil disturbance',
    terms: ['political rally', 'political rallies', 'protest', 'bandh', 'riot', 'civil unrest', 'curfew', 'election', 'strike action', 'agitation'],
  },
  {
    domain: 'security, terrorism or armed conflict',
    terms: ['terrorism', 'terrorist', 'terrorists', 'war', 'military conflict', 'armed conflict', 'insurgency', 'cyberattack', 'cyber attack', 'sabotage', 'border conflict'],
  },
  {
    domain: 'pandemic or public-health risk',
    terms: ['pandemic', 'epidemic', 'disease outbreak', 'covid'],
  },
  {
    domain: 'currency, interest-rate or broad macroeconomic risk',
    terms: ['interest rate', 'currency devaluation', 'inflation shock', 'recession', 'stock market crash', 'rbi repo rate'],
  },
]

function escapeRegExpTerm(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Word-boundary term matching, used by every gazetteer-style detector in
 * this file (region, unmapped-city, out-of-scope domain) — NOT a bare
 * substring check. Two real bugs this fixes, both caught live against
 * real news article text: `.includes('kl')` (Kerala's short alias)
 * matched inside the ordinary word "quickly", silently misattributing an
 * unrelated Mumbai heatwave story to Kerala; `.includes('war')` matched
 * inside "heatwave-warning", misrouting a genuine weather-warning article
 * into the out-of-scope "security/armed conflict" answer. Short 2-letter
 * region codes ('hp'/'kl'/'mh') are the worst offenders, but matching
 * everything the same way is simpler and strictly safer than
 * special-casing only the short ones. */
function termMatches(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExpTerm(term)}\\b`, 'i').test(text)
}

/** Returns the unmodeled risk domain a question is actually about, or null
 * if it isn't one of these — never a guess, only an explicit keyword match,
 * same discipline as every other detector in this file. */
export function detectOutOfScopeDomain(text: string): string | null {
  for (const { domain, terms } of OUT_OF_SCOPE_DOMAINS) {
    if (terms.some((t) => termMatches(text, t))) return domain
  }
  return null
}

export function detectRegion(text: string): Region | null {
  for (const { region, terms } of REGION_ALIASES) {
    if (terms.some((t) => termMatches(text, t))) return region
  }
  return null
}

export function detectUnmappedCity(text: string) {
  return UNMAPPED_CITIES.find((c) => c.terms.some((t) => termMatches(text, t))) ?? null
}

/** Every region named in the text, in first-mention order — used for
 * "compare X and Y" questions, unlike detectRegion's single-best-match. */
export function detectRegions(text: string): Region[] {
  const found: Region[] = []
  for (const { region, terms } of REGION_ALIASES) {
    if (!found.includes(region) && terms.some((t) => termMatches(text, t))) found.push(region)
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

/** "What severity would it take to lose ₹500 cr" — the reverse-stress-test
 * target. Requires a currency/loss cue next to the number, not a bare
 * figure, so an unrelated number in the sentence doesn't misfire. */
export function detectTargetLossCr(text: string): number | null {
  const m = text.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*cr(?:ore)?s?\b/i)
  if (!m) return null
  const n = parseFloat(m[1])
  return n > 0 ? n : null
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
