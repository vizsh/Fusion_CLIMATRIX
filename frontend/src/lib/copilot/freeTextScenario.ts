// Free-text scenario understanding — "describe the scenario you want to
// explore" on What-If Analysis (and the same parser is reused from chat).
// Turns an unstructured sentence into the same {region, hazard, severity,
// durationMonths, substitutability} shape every other scenario-driven
// feature in this app already runs on. Deliberately NOT an LLM call —
// every field is resolved by an explicit, auditable rule, and every field
// is tagged with HOW it was resolved (detected in the text, or defaulted)
// so the UI can show the user exactly what it understood instead of
// silently guessing, the same evidence-integrity standard as the rest of
// the Copilot.

import { REGION_LABEL, type Hazard, type Region, type Substitutability } from '../../store/useScenarioStore'
import { detectRegion } from './params'

export interface ParsedScenario {
  region: Region
  hazard: Hazard
  severity: number
  durationMonths: number
  substitutability: Substitutability
}

export interface FreeTextParseResult {
  scenario: ParsedScenario
  detected: { region: boolean; hazard: boolean; severity: boolean; duration: boolean; substitutability: boolean }
  notes: string[]
}

function escapeRegExpTerm(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function termMatches(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExpTerm(term)}\\b`, 'i').test(text)
}

// `strong` = the hazard's own name (or an unambiguous synonym) — if this
// is present anywhere in the text, that hazard wins outright. `weak` =
// a contextually-associated word that's suggestive but genuinely
// ambiguous on its own. "monsoon" is the reason this split exists: it
// used to live under Flood's terms and, because Flood was checked first,
// silently mis-tagged a real post-monsoon HEATWAVE article as a Flood —
// the article said "monsoon" constantly (monsoon withdrawal, post-monsoon
// season) while describing the opposite hazard. Every hazard's strong
// terms are now checked first, across ALL hazards, before any hazard's
// weak terms are considered at all — so a sentence naming its hazard
// explicitly is never out-voted by another hazard's looser context word.
const HAZARD_TERMS: { hazard: Hazard; strong: string[]; weak: string[] }[] = [
  { hazard: 'Flood', strong: ['flood', 'flooding', 'flooded'], weak: ['monsoon', 'deluge', 'inundat'] },
  { hazard: 'Drought', strong: ['drought'], weak: ['dry spell', 'water scarcity', 'water stress'] },
  { hazard: 'Cyclone', strong: ['cyclone', 'hurricane', 'typhoon'], weak: ['storm surge'] },
  { hazard: 'Heatwave', strong: ['heatwave', 'heat wave'], weak: ['extreme heat', 'scorching'] },
  { hazard: 'Landslide', strong: ['landslide', 'mudslide', 'rockslide'], weak: ['slope failure'] },
]

export function detectHazard(text: string): Hazard | null {
  for (const { hazard, strong } of HAZARD_TERMS) {
    if (strong.some((t) => termMatches(text, t))) return hazard
  }
  for (const { hazard, weak } of HAZARD_TERMS) {
    if (weak.some((t) => termMatches(text, t))) return hazard
  }
  return null
}

// Checked in order (most extreme first) so a sentence using more than one
// descriptive word resolves to its most severe cue, not whichever regex
// happens to run last.
const SEVERITY_WORDS: { re: RegExp; value: number }[] = [
  { re: /\b(catastrophic|extreme|compound|devastating|unprecedented)\b/i, value: 100 },
  { re: /\b(severe|major|serious|significant|dangerous|intense|worst[- ]case)\b/i, value: 80 },
  { re: /\b(moderate|noticeable|meaningful)\b/i, value: 45 },
  { re: /\b(mild|minor|slight|light|modest|small)\b/i, value: 20 },
  { re: /\b(baseline|ordinary|normal|typical)\b/i, value: 15 },
]

function detectSeverityLoose(text: string): number | null {
  const explicit = text.match(/severity\s*(?:to|of|at|=|:)?\s*(\d{1,3})/i) ?? text.match(/(\d{1,3})\s*(?:\/\s*100|\s*%)\b/)
  if (explicit) {
    const n = parseInt(explicit[1], 10)
    if (n >= 0 && n <= 100) return n
  }
  for (const { re, value } of SEVERITY_WORDS) if (re.test(text)) return value
  return null
}

function detectDurationLoose(text: string): number | null {
  const explicitMonths = text.match(/(\d{1,2})\s*[- ]?months?/i)
  if (explicitMonths) {
    const n = parseInt(explicitMonths[1], 10)
    if (n >= 1 && n <= 36) return n
  }
  const explicitYears = text.match(/(\d{1,2})\s*[- ]?years?/i)
  if (explicitYears) {
    const n = Math.min(parseInt(explicitYears[1], 10) * 12, 36)
    if (n >= 1) return n
  }
  if (/\btwo years\b/i.test(text)) return 24
  if (/\ba (?:full |whole )?year\b/i.test(text)) return 12
  if (/\bprolonged\b|\bextended\b|\blong[- ]?term\b/i.test(text)) return 12
  if (/\ba few months\b|\bseveral months\b/i.test(text)) return 3
  if (/\ba couple(?: of)? months\b/i.test(text)) return 2
  if (/\bbrief\b|\bshort[- ]?lived\b/i.test(text)) return 1
  return null
}

function detectSubstitutabilityLoose(text: string): Substitutability | null {
  const lower = text.toLowerCase()
  if (/\b(no alternative|hard(?:ly)? to reroute|limited (?:supply chain|alternatives?|options?)|single[- ]source|sole supplier)\b/.test(lower)) return 'Limited'
  if (/\b(easy to reroute|plenty of alternatives|strong alternatives|diversified supply chain|many suppliers)\b/.test(lower)) return 'Strong'
  if (/\blimited\b/.test(lower)) return 'Limited'
  if (/\bstrong\b/.test(lower)) return 'Strong'
  if (/\bmoderate\b/.test(lower)) return 'Moderate'
  return null
}

/** `fallback` supplies every field this text doesn't mention — pass the
 * live dashboard scenario (or a fixed default) so an under-specified
 * description ("what if there's a flood in Kerala") still resolves to a
 * complete, runnable scenario instead of erroring. */
export function parseFreeTextScenario(text: string, fallback: ParsedScenario): FreeTextParseResult {
  const region = detectRegion(text)
  const hazard = detectHazard(text)
  const severity = detectSeverityLoose(text)
  const duration = detectDurationLoose(text)
  const sub = detectSubstitutabilityLoose(text)

  const scenario: ParsedScenario = {
    region: region ?? fallback.region,
    hazard: hazard ?? fallback.hazard,
    severity: severity ?? fallback.severity,
    durationMonths: duration ?? fallback.durationMonths,
    substitutability: sub ?? fallback.substitutability,
  }

  const notes: string[] = []
  if (!region) notes.push(`No region named — used ${REGION_LABEL[scenario.region]} (the active dashboard region).`)
  if (!hazard) notes.push(`No hazard named — defaulted to ${scenario.hazard}.`)
  if (severity === null) notes.push(`No severity cue found — defaulted to ${scenario.severity}/100.`)
  if (duration === null) notes.push(`No duration found — defaulted to ${scenario.durationMonths} month${scenario.durationMonths === 1 ? '' : 's'}.`)
  if (!sub) notes.push(`No supply-chain substitutability cue found — defaulted to ${scenario.substitutability}.`)

  return {
    scenario,
    detected: { region: !!region, hazard: !!hazard, severity: severity !== null, duration: duration !== null, substitutability: !!sub },
    notes,
  }
}

/** True only when the text gives enough SPECIFIC signal (a named hazard
 * plus at least one of severity/duration/substitutability) to be worth
 * running as its own precise scenario rather than the general "what if"
 * archetype comparison — "what if there's a flood in Kerala" stays a
 * region+hazard-only archetype request; "what if a severe cyclone hits
 * Kerala for 9 months" is specific enough to run directly. */
export function isDetailedFreeTextScenario(text: string): boolean {
  const hazard = detectHazard(text)
  if (!hazard) return false
  const severity = detectSeverityLoose(text) !== null
  const duration = detectDurationLoose(text) !== null
  const sub = detectSubstitutabilityLoose(text) !== null
  return severity || duration || sub
}
