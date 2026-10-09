// Griid-pattern context bridge — "Claude ↔ Griid ↔ ChatGPT ↔ your next AI
// workspace": the active CLIMATRIX scenario and its modelled figures,
// packaged so a user can round-trip it through their own ChatGPT/Claude/
// Griid session (or a teammate's browser) and have that tool — or this one,
// later — reason from the same context instead of re-deriving it.
//
// Honesty note: a public griid.ai API could not be confirmed to exist at
// the time this was built, so nothing here depends on it. What's
// implemented is the *pattern* griid.ai is named for — a portable,
// fingerprinted context bundle, a shareable link that restores a scenario
// exactly, and a paste-back importer that accepts either this tool's own
// JSON or the plain-text bundle a teammate pasted into another chatbot and
// pasted back — all pure client-side logic, no new backend dependency.

import { REGION_LABEL, computeImpact, type Region, type Hazard, type Substitutability, type UserMode, type ScenarioState } from '../../store/useScenarioStore'
import type { ProposedUpdate } from '../api'

export const CONTEXT_SCHEMA = 'climatrix.griid.v1'

export interface ScenarioContextPayload {
  schema: typeof CONTEXT_SCHEMA
  kind: 'scenario'
  generatedAt: string
  fingerprint: string
  scenario: {
    region: Region
    hazard: Hazard
    severity: number
    durationMonths: number
    substitutability: Substitutability
    userMode: UserMode
  }
  impact: {
    eadCr: number
    companyCount: number
    baselineEl: number
    stressedEl: number
    stressedElLow: number
    stressedElHigh: number
    topSectors: { sector: string; stressedEl: number }[]
  }
  evidenceLegend: Record<string, string>
}

// --- a tiny, dependency-free FNV-1a hash — not cryptographic, just enough
// for two sessions to notice "the context I received doesn't match the
// context you sent," which is the actual failure mode a text-paste handoff
// between AI tools can silently suffer from. ---
function fingerprint(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function scenarioFields(state: ScenarioState) {
  return {
    region: state.region,
    hazard: state.hazard,
    severity: state.severity,
    durationMonths: state.durationMonths,
    substitutability: state.substitutability,
    userMode: state.userMode,
  }
}

const EVIDENCE_LEGEND = {
  sourced: 'a cited, externally verifiable fact (e.g. RBI’s own published stress-test figures)',
  modelled: 'a real computation over real or synthetic inputs (e.g. the ECL figures below)',
  assumption: 'a disclosed illustrative parameter (e.g. the severity dial itself)',
  synthetic: 'fabricated demonstration data, labeled as such everywhere (company identities, loan exposures)',
}

export function buildContextPayload(state: ScenarioState): ScenarioContextPayload {
  const impact = computeImpact({
    region: state.region,
    severity: state.severity,
    durationMonths: state.durationMonths,
    substitutability: state.substitutability,
    interventions: state.interventions,
  })
  const scenario = scenarioFields(state)
  const fp = fingerprint(JSON.stringify(scenario))
  return {
    schema: CONTEXT_SCHEMA,
    kind: 'scenario',
    generatedAt: new Date().toISOString(),
    fingerprint: fp,
    scenario,
    impact: {
      eadCr: impact.eadCr,
      companyCount: impact.companyCount,
      baselineEl: impact.baselineEl,
      stressedEl: impact.stressedEl,
      stressedElLow: impact.stressedElLow,
      stressedElHigh: impact.stressedElHigh,
      topSectors: impact.bySector.slice(0, 3).map((s) => ({ sector: s.sector, stressedEl: s.stressedEl })),
    },
    evidenceLegend: EVIDENCE_LEGEND,
  }
}

export function buildContextBundle(state: ScenarioState): string {
  const p = buildContextPayload(state)
  return [
    '# CLIMATRIX India — exported scenario context (Griid-pattern bundle)',
    `Schema: ${p.schema}  ·  Generated: ${p.generatedAt}`,
    `Context fingerprint: ${p.fingerprint}`,
    '(If another workspace echoes this context back with a different fingerprint for the same scenario, something was lost in translation — re-paste rather than trust the drift.)',
    '',
    '## Active scenario',
    `Region: ${REGION_LABEL[p.scenario.region]} (${p.scenario.region})`,
    `Hazard: ${p.scenario.hazard}`,
    `Severity: ${p.scenario.severity}/100 — a UI stress dial, not a probability or measured flood depth`,
    `Duration: ${p.scenario.durationMonths} months`,
    `Substitutability: ${p.scenario.substitutability}`,
    `Lens: ${p.scenario.userMode === 'bank' ? 'Bank / credit risk' : 'Investor / equity'}`,
    '',
    '## Key figures (modelled — ECL = EAD × PD × LGD)',
    `Exposed EAD: ₹${p.impact.eadCr.toFixed(1)} cr across ${p.impact.companyCount} holdings`,
    `Baseline expected loss: ₹${p.impact.baselineEl.toFixed(2)} cr`,
    `Stressed expected loss: ₹${p.impact.stressedEl.toFixed(2)} cr (±15% severity sensitivity band: ₹${p.impact.stressedElLow.toFixed(2)} – ₹${p.impact.stressedElHigh.toFixed(2)} cr)`,
    `Top sectors by stressed loss: ${p.impact.topSectors.map((s) => `${s.sector} (₹${s.stressedEl.toFixed(1)} cr)`).join(', ') || 'none traced'}`,
    '',
    '## Evidence classes this platform uses for every figure',
    ...Object.entries(p.evidenceLegend).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## How to use this',
    'Paste this whole block into ChatGPT, Claude, Griid, or any other AI workspace so it has the same scenario context CLIMATRIX is showing, without re-deriving it. Every figure above is a model output under a disclosed assumption, not a verified real-world loss or investment advice.',
    '',
    'To bring a scenario back into CLIMATRIX later (this session or another browser), paste this entire block — or the JSON export — into the "Import context" box on the Governance page; the fingerprint above will be recomputed and compared so you can tell if anything drifted.',
  ].join('\n')
}

export function buildContextBundleJSON(state: ScenarioState): string {
  return JSON.stringify(buildContextPayload(state), null, 2)
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

export function downloadContextBundleJSON(state: ScenarioState) {
  const text = buildContextBundleJSON(state)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `climatrix-context-${state.region}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function copyContextBundle(state: ScenarioState): Promise<boolean> {
  return copyText(buildContextBundle(state))
}

export function copyContextBundleJSON(state: ScenarioState): Promise<boolean> {
  return copyText(buildContextBundleJSON(state))
}

// --- shareable link: restore an exact scenario from a URL, no backend
// round trip, no account needed. ---
export function buildShareableLink(state: ScenarioState): string {
  const encoded = btoa(JSON.stringify(scenarioFields(state)))
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/scenario?griid=${encoded}`
}

export function copyShareableLink(state: ScenarioState): Promise<boolean> {
  return copyText(buildShareableLink(state))
}

export interface DecodedScenario {
  region: Region
  hazard: Hazard
  severity: number
  durationMonths: number
  substitutability: Substitutability
  userMode: UserMode
}

export function decodeShareParam(encoded: string): DecodedScenario | null {
  try {
    const obj = JSON.parse(atob(encoded))
    if (typeof obj.region === 'string' && typeof obj.severity === 'number') return obj as DecodedScenario
    return null
  } catch {
    return null
  }
}

export interface ImportResult {
  ok: boolean
  scenario?: DecodedScenario
  sourceFingerprint?: string
  recomputedFingerprint?: string
  fingerprintMatches?: boolean
  error?: string
}

// Accepts either this tool's own JSON bundle, or the plain-text markdown
// bundle a user pasted back from another AI workspace (the realistic path:
// someone copies CLIMATRIX's text block into ChatGPT, gets a reply, and
// pastes the ORIGINAL block back here from their clipboard history, or a
// teammate forwards the .md file's contents verbatim).
export function parseImportedContext(raw: string): ImportResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Nothing to import — paste a CLIMATRIX context bundle or a shareable link.' }

  // Shareable link or bare encoded param
  const linkMatch = trimmed.match(/griid=([A-Za-z0-9+/=]+)/)
  if (linkMatch) {
    const decoded = decodeShareParam(linkMatch[1])
    if (decoded) return { ok: true, scenario: decoded }
  }

  // JSON bundle
  try {
    const obj = JSON.parse(trimmed)
    if (obj.schema === CONTEXT_SCHEMA && obj.scenario) {
      const recomputed = fingerprint(JSON.stringify(obj.scenario))
      return {
        ok: true,
        scenario: obj.scenario,
        sourceFingerprint: obj.fingerprint,
        recomputedFingerprint: recomputed,
        fingerprintMatches: obj.fingerprint === recomputed,
      }
    }
  } catch {
    // fall through to markdown parsing
  }

  // Markdown bundle fallback — regex over the human-readable export
  const regionM = trimmed.match(/Region:\s*.*?\(([A-Z]{2,4})\)/)
  const hazardM = trimmed.match(/Hazard:\s*(\w+)/)
  const severityM = trimmed.match(/Severity:\s*(\d+)\s*\/\s*100/)
  const durationM = trimmed.match(/Duration:\s*(\d+)\s*months?/)
  const subM = trimmed.match(/Substitutability:\s*(\w+)/)
  const lensM = trimmed.match(/Lens:\s*(Bank|Investor)/i)
  const fpM = trimmed.match(/Context fingerprint:\s*([0-9a-f]{8})/)

  if (regionM && severityM) {
    const scenario: DecodedScenario = {
      region: regionM[1] as Region,
      hazard: (hazardM?.[1] ?? 'Flood') as Hazard,
      severity: Number(severityM[1]),
      durationMonths: durationM ? Number(durationM[1]) : 6,
      substitutability: (subM?.[1] ?? 'Moderate') as Substitutability,
      userMode: lensM && /investor/i.test(lensM[1]) ? 'investor' : 'bank',
    }
    const recomputed = fingerprint(JSON.stringify(scenario))
    return {
      ok: true,
      scenario,
      sourceFingerprint: fpM?.[1],
      recomputedFingerprint: recomputed,
      fingerprintMatches: fpM ? fpM[1] === recomputed : undefined,
    }
  }

  return { ok: false, error: 'Could not recognize this as a CLIMATRIX context bundle, JSON export or shareable link.' }
}

// --- institutional-memory export: the approved Governance ledger, not just
// one live scenario — so another AI workspace can reason with the
// institution's currently-accepted modelling assumptions, not only the
// dial positions of whoever happens to be looking at the screen. ---
export function buildGovernanceBundle(proposals: ProposedUpdate[]): string {
  const approved = proposals.filter((p) => p.status === 'approved')
  const pending = proposals.filter((p) => p.status === 'pending')
  const fp = fingerprint(JSON.stringify(approved.map((p) => [p.target, p.proposed_value])))
  return [
    '# CLIMATRIX India — exported assumption ledger (Griid-pattern institutional memory)',
    `Schema: climatrix.griid.ledger.v1  ·  Generated: ${new Date().toISOString()}`,
    `Ledger fingerprint: ${fp}`,
    '',
    `## Approved assumptions (${approved.length})`,
    ...(approved.length
      ? approved.map((p) => `- ${p.target}: ${p.current_value || '—'} → ${p.proposed_value}  (${p.rationale}${p.reviewer ? ` — approved by ${p.reviewer}` : ''})`)
      : ['- None approved yet.']),
    '',
    `## Pending, not yet institutional (${pending.length})`,
    ...(pending.length ? pending.map((p) => `- ${p.target}: ${p.current_value || '—'} → ${p.proposed_value} (proposed by ${p.proposed_by || 'anonymous'})`) : ['- None pending.']),
    '',
    '## How to use this',
    'Paste this into any AI workspace reasoning about CLIMATRIX figures so it only treats APPROVED rows as the institution’s current assumption set — pending rows are proposals under review, not yet real, and should not be cited as settled.',
  ].join('\n')
}

export function downloadGovernanceBundle(proposals: ProposedUpdate[]) {
  const text = buildGovernanceBundle(proposals)
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'climatrix-assumption-ledger.md'
  a.click()
  URL.revokeObjectURL(url)
}

export function copyGovernanceBundle(proposals: ProposedUpdate[]): Promise<boolean> {
  return copyText(buildGovernanceBundle(proposals))
}
