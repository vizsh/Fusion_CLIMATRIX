// Guided scenario automation — the Copilot asks one question at a time
// (click an option or type a free-text answer), then applies the dials and
// reports the modeled outcome itself. This is the "I only use the chatbot
// and it guides me through it" flow: a stateful wizard layered on top of
// the stateless rule engine in respond.ts, not a replacement for it.
//
// Design choice: no new CopilotBlock/CopilotAction kinds. Each question
// renders as a 'suggestions' block (already clickable — clicking sends the
// option text as the next message, exactly like typing it), and the final
// report reuses 'statRow'/'actions' exactly like every other answer in
// answers.ts, so the wizard's output looks and behaves like the rest of
// the Copilot, not like a bolted-on feature.

import {
  computeImpact,
  REGION_LABEL,
  SCENARIO_PROFILES,
  summarizeImpactPlain,
  type Hazard,
  type Region,
  type ScenarioProfile,
  type ScenarioState,
  type Substitutability,
} from '../../store/useScenarioStore'
import { detectRegion } from './params'
import type { CopilotAction, CopilotBlock } from './types'

export type WizardStep = 'region' | 'hazard' | 'severity' | 'customSeverity' | 'duration' | 'substitutability'

export interface WizardState {
  step: WizardStep
  region?: Region
  hazard?: Hazard
  severity?: number
  durationMonths?: number
}

const HAZARDS: Hazard[] = ['Flood', 'Drought', 'Cyclone', 'Heatwave', 'Landslide']
const SUBSTITUTABILITIES: Substitutability[] = ['Limited', 'Moderate', 'Strong']
const PROFILE_NAMES = Object.keys(SCENARIO_PROFILES) as ScenarioProfile[]

function text(t: string): CopilotBlock {
  return { kind: 'text', text: t }
}
function suggestions(prompts: string[]): CopilotBlock {
  return { kind: 'suggestions', prompts }
}
function stepLabel(n: number) {
  return `Step ${n} of 5`
}

export function isAutomationTrigger(t: string): boolean {
  return /\bautomate\b|\bautomat(ed|ion|ically)\b|\bbuild (me )?a scenario\b|\bguide me (through|to build)\b.*\bscenario\b|\bwalk me through (building|creating|setting up)\b.*\bscenario\b|\bask me (questions|options)\b|\bstep[- ]?by[- ]?step\b.*\bscenario\b/i.test(
    t,
  )
}

export function isWizardCancel(t: string): boolean {
  return /^(cancel|stop|exit|quit|never ?mind|start over|restart)\.?$/i.test(t.trim())
}

export function cancelWizardBlocks(): CopilotBlock[] {
  return [text('Guided builder cancelled — nothing was changed. Ask me anything, or say "automate" to start again.')]
}

export function startWizard(): { blocks: CopilotBlock[]; wizard: WizardState } {
  return {
    wizard: { step: 'region' },
    blocks: [
      { kind: 'heading', text: 'Guided scenario builder' },
      text(
        'I’ll ask one question at a time — click an option, or just type your answer. At the end I’ll set the dials, run the numbers through the exact same engine every dashboard page uses, and show you what happens. Say "cancel" anytime to stop.',
      ),
      text(`${stepLabel(1)} — which region?`),
      suggestions(Object.values(REGION_LABEL)),
    ],
  }
}

function matchFromList<T extends string>(t: string, options: T[]): T | null {
  const lower = t.toLowerCase().trim()
  const exact = options.find((o) => o.toLowerCase() === lower)
  if (exact) return exact
  const partial = options.find((o) => lower.includes(o.toLowerCase()) || o.toLowerCase().includes(lower))
  return partial ?? null
}

function parseFirstNumber(t: string): number | null {
  const m = t.match(/-?\d+(\.\d+)?/)
  if (!m) return null
  const n = Math.round(parseFloat(m[0]))
  return Number.isFinite(n) ? n : null
}

export interface WizardAdvanceResult {
  blocks: CopilotBlock[]
  wizard: WizardState | null
}

function reask(blocks: CopilotBlock[], wizard: WizardState): WizardAdvanceResult {
  return { blocks, wizard }
}

export function advanceWizard(wizard: WizardState, userText: string, currentState: ScenarioState): WizardAdvanceResult {
  switch (wizard.step) {
    case 'region': {
      const region = matchFromList(userText, Object.values(REGION_LABEL) as string[])
        ? (Object.entries(REGION_LABEL).find(([, label]) => label === matchFromList(userText, Object.values(REGION_LABEL) as string[]))?.[0] as Region | undefined)
        : detectRegion(userText)
      if (!region) {
        return reask(
          [text(`I didn’t catch a region in "${userText}" — pick one below, or type its name.`), suggestions(Object.values(REGION_LABEL))],
          wizard,
        )
      }
      const next: WizardState = { step: 'hazard', region }
      return {
        wizard: next,
        blocks: [text(`Region: ${REGION_LABEL[region]}.`), text(`${stepLabel(2)} — which hazard?`), suggestions(HAZARDS)],
      }
    }

    case 'hazard': {
      const hazard = matchFromList(userText, HAZARDS)
      if (!hazard) {
        return reask([text(`"${userText}" isn’t one of the modeled hazards — pick one below.`), suggestions(HAZARDS)], wizard)
      }
      const next: WizardState = { ...wizard, step: 'severity', hazard }
      return {
        wizard: next,
        blocks: [
          text(`Hazard: ${hazard}.`),
          text(`${stepLabel(3)} — how severe? Pick a preset, or say "custom" to type an exact 0–100 value.`),
          suggestions([...PROFILE_NAMES, 'Custom severity']),
        ],
      }
    }

    case 'severity': {
      if (/custom/i.test(userText)) {
        return {
          wizard: { ...wizard, step: 'customSeverity' },
          blocks: [text('Type a severity from 0 (ordinary conditions) to 100 (catastrophic).')],
        }
      }
      const profile = matchFromList(userText, PROFILE_NAMES)
      if (!profile) {
        return reask(
          [text(`I didn’t recognize "${userText}" as a severity preset — pick one, or say "custom".`), suggestions([...PROFILE_NAMES, 'Custom severity'])],
          wizard,
        )
      }
      const preset = SCENARIO_PROFILES[profile]
      const next: WizardState = { ...wizard, step: 'duration', severity: preset.severity, durationMonths: preset.durationMonths }
      return {
        wizard: next,
        blocks: [
          text(`Severity: ${profile} (${preset.severity}/100, ${preset.desc})`),
          text(`${stepLabel(4)} — how many months should this last? (Preset duration is ${preset.durationMonths}mo — pick below or type a different number.)`),
          suggestions(['1 month', '3 months', '6 months', '9 months', '12 months', `Keep ${preset.durationMonths} months`]),
        ],
      }
    }

    case 'customSeverity': {
      const n = parseFirstNumber(userText)
      if (n === null || n < 0 || n > 100) {
        return reask([text('That doesn’t parse as a number from 0 to 100 — try again, e.g. "72".')], wizard)
      }
      const next: WizardState = { ...wizard, step: 'duration', severity: n }
      return {
        wizard: next,
        blocks: [
          text(`Severity: ${n}/100 (custom).`),
          text(`${stepLabel(4)} — how many months should this last?`),
          suggestions(['1 month', '3 months', '6 months', '9 months', '12 months']),
        ],
      }
    }

    case 'duration': {
      const n = parseFirstNumber(userText)
      const durationMonths = n !== null && n >= 1 && n <= 36 ? n : wizard.durationMonths
      if (durationMonths === undefined) {
        return reask([text('I need a duration in months (1–36) — try "6 months".')], wizard)
      }
      const next: WizardState = { ...wizard, step: 'substitutability', durationMonths }
      return {
        wizard: next,
        blocks: [
          text(`Duration: ${durationMonths} month${durationMonths === 1 ? '' : 's'}.`),
          text(`${stepLabel(5)} — last question: how substitutable are the affected supply chains? ("Limited" = hardest to reroute, "Strong" = easiest.)`),
          suggestions(SUBSTITUTABILITIES),
        ],
      }
    }

    case 'substitutability': {
      const substitutability = matchFromList(userText, SUBSTITUTABILITIES)
      if (!substitutability) {
        return reask([text(`"${userText}" isn’t Limited, Moderate or Strong — pick one below.`), suggestions(SUBSTITUTABILITIES)], wizard)
      }
      return finish({ ...wizard, substitutability } as Required<WizardState> & { substitutability: Substitutability }, currentState)
    }
  }
}

function finish(
  w: WizardState & { region: Region; hazard: Hazard; severity: number; durationMonths: number; substitutability: Substitutability },
  currentState: ScenarioState,
): WizardAdvanceResult {
  // Apply the collected answers to the shared store NOW — the same object
  // every dashboard page reads — so the guided answer and the dashboards
  // can never disagree, exactly like every other Copilot action.
  currentState.setRegion(w.region)
  currentState.setHazard(w.hazard)
  currentState.setSeverity(w.severity)
  currentState.setDuration(w.durationMonths)
  currentState.setSubstitutability(w.substitutability)

  const impact = computeImpact({
    region: w.region,
    severity: w.severity,
    durationMonths: w.durationMonths,
    substitutability: w.substitutability,
    interventions: [],
  })
  const summary = summarizeImpactPlain(w.region, w.hazard, w.severity, w.durationMonths, impact)

  const actions: CopilotAction[] = [
    { id: 'wiz-map', label: 'Watch it play out on the live map', kind: 'go-to-map', region: w.region, hazard: w.hazard, severity: w.severity, durationMonths: w.durationMonths, substitutability: w.substitutability },
    { id: 'wiz-portfolio', label: 'Open Portfolio Impact', kind: 'navigate', to: '/portfolio', region: w.region },
    { id: 'wiz-insurance', label: 'Check the insurance view', kind: 'navigate', to: '/insurance', region: w.region },
    { id: 'wiz-brief', label: 'Download a scenario brief', kind: 'download-brief', briefRegion: w.region },
  ]

  return {
    wizard: null,
    blocks: [
      { kind: 'heading', text: `Scenario built and run — ${REGION_LABEL[w.region]}` },
      {
        kind: 'statRow',
        stats: [
          { label: 'Baseline EL', value: `₹${impact.baselineEl.toFixed(1)} cr`, evidence: 'modelled' },
          { label: 'Stressed EL', value: `₹${impact.stressedEl.toFixed(1)} cr`, evidence: 'modelled' },
          { label: 'Borrowers reached', value: String(impact.companyCount), evidence: 'modelled' },
        ],
      },
      text(summary),
      {
        kind: 'table',
        headers: ['Sector', 'EAD', 'Stressed EL'],
        rows: impact.bySector.slice(0, 5).map((s) => [s.sector, `₹${s.eadCr.toFixed(1)} cr`, `₹${s.stressedEl.toFixed(1)} cr`]),
      },
      text(
        `These dials are now live everywhere — Scenario Lab, Digital Twin, Dependency Explorer and Portfolio Impact all read the same ${w.region}/${w.hazard}/${w.severity}/${w.durationMonths}mo/${w.substitutability} configuration you just built. Say "automate" again to build another one.`,
      ),
      { kind: 'actions', actions },
    ],
  }
}
