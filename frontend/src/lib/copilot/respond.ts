// CLIMATRIX AI Copilot — intent recognition + response composition.
//
// Deliberately rule-based, not an LLM call: the Copilot's job is to invoke
// the SAME deterministic graph/financial/insurance engine every dashboard
// page already uses and present the result conversationally, never to
// generate a number itself. This keeps every figure the chatbot shows
// traceable to the evidence-labeled engine that produced it (see
// docs/ARCHITECTURE.md's evidence-integrity rule).

import { computeBottlenecks, institutionExposureToHazard, REGION_HAZARD } from '../graphAnalytics'
import { computeInsurerBook, computeProtectionGap, allInsurers } from '../insurance'
import { NODES } from '../indiaGraphData'
import { WEATHER_WINDOWS } from '../weatherWindows'
import {
  REGION_LABEL,
  computeImpact,
  type Region,
  type ScenarioState,
} from '../../store/useScenarioStore'
import { generateWhatIf, PROBABILITY_BASIS_LABEL, type Horizon } from './engine'
import type { CopilotBlock, CopilotAction } from './types'

const REGION_ALIASES: { region: Region; terms: string[] }[] = [
  { region: 'HP', terms: ['himachal', 'hp', 'kullu', 'manali', 'beas'] },
  { region: 'KL', terms: ['kerala', 'kl', 'kochi', 'idukki', 'wayanad', 'ernakulam'] },
  { region: 'MH', terms: ['maharashtra', 'mh', 'drought', 'agricultural', 'marathwada', 'latur', 'solapur'] },
  { region: 'UK', terms: ['uttarakhand', 'uk', 'landslide'] },
]

function detectRegion(text: string): Region | null {
  const lower = text.toLowerCase()
  for (const { region, terms } of REGION_ALIASES) {
    if (terms.some((t) => lower.includes(t))) return region
  }
  return null
}

function detectHorizon(text: string): Horizon {
  const lower = text.toLowerCase()
  if (/long[\s-]?term|5[\s-]?10 years|decade/.test(lower)) return 'long'
  if (/near[\s-]?term|current conditions|next few weeks|right now/.test(lower)) return 'near'
  if (/near.*long|both/.test(lower)) return 'both'
  return 'medium'
}

function fmtCr(n: number) {
  return `₹${n.toFixed(1)} cr`
}

function evidenceNote(text: string): CopilotBlock {
  return { kind: 'text', text }
}

interface Ctx {
  state: ScenarioState
}

export interface CopilotReply {
  blocks: CopilotBlock[]
}

function regionOrCurrent(text: string, ctx: Ctx): Region {
  return detectRegion(text) ?? ctx.state.region
}

function scenarioActions(region: Region): CopilotAction[] {
  return [
    { id: 'open-scenario', label: 'Open Scenario Lab', kind: 'navigate', to: '/scenario' },
    { id: 'open-whatif', label: 'Compare scenarios (What-If Analysis)', kind: 'navigate', to: '/what-if', region },
    { id: 'open-twin', label: 'Open Digital Twin', kind: 'navigate', to: '/twin' },
  ]
}

// --- individual intent handlers -------------------------------------------------

function handleExposure(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const hazardId = REGION_HAZARD[region]
  const impact = computeImpact({
    region,
    severity: ctx.state.severity,
    durationMonths: ctx.state.durationMonths,
    substitutability: ctx.state.substitutability,
    interventions: ctx.state.interventions,
  })
  const bottlenecks = computeBottlenecks(3).filter((b) =>
    NODES.some((n) => n.id === b.node.id && n.region === region),
  )
  return [
    { kind: 'heading', text: `Climate exposure — ${REGION_LABEL[region]}` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Exposed EAD', value: fmtCr(impact.eadCr), evidence: 'modelled' },
        { label: 'Holdings reached', value: String(impact.companyCount), evidence: 'modelled' },
        { label: 'Stressed EL (active scenario)', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
      ],
    },
    {
      kind: 'table',
      headers: ['Sector', 'EAD', 'Stressed EL'],
      rows: impact.bySector.slice(0, 5).map((s) => [s.sector, fmtCr(s.eadCr), fmtCr(s.stressedEl)]),
    },
    ...(bottlenecks.length
      ? ([
          {
            kind: 'bullets',
            items: bottlenecks.map(
              (b) => `Shared dependency "${b.node.label}" reaches ${b.reachedCompanies.length} holdings (${fmtCr(b.reachedEAD)} combined EAD) — a hidden concentration, not visible from any single holding's own risk assessment.`,
            ),
          },
        ] as CopilotBlock[])
      : []),
    evidenceNote('Figures use the active scenario dial (severity/duration/substitutability) set on Scenario Lab, applied through the same ECL = EAD × PD × LGD engine every page reads.'),
    { kind: 'actions', actions: scenarioActions(region) },
  ]
}

function handleDependency(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const bottlenecks = computeBottlenecks(6).filter((b) => NODES.find((n) => n.id === b.node.id)?.region === region)
  if (!bottlenecks.length) {
    return [{ kind: 'text', text: `No shared infrastructure or supplier bottleneck is traced for ${REGION_LABEL[region]} in the current graph.` }]
  }
  return [
    { kind: 'heading', text: `Transport & supplier dependencies — ${REGION_LABEL[region]}` },
    {
      kind: 'rankedList',
      title: 'Ranked by downstream EAD reached',
      rows: bottlenecks.map((b, i) => ({
        rank: i + 1,
        label: b.node.label,
        value: fmtCr(b.reachedEAD),
        sub: `${b.reachedCompanies.length} holdings depend on this node: ${b.reachedCompanies.map((c) => c.label).join(', ')}`,
        evidence: 'modelled',
      })),
    },
    { kind: 'actions', actions: [{ id: 'open-dep', label: 'Open Dependency Explorer', kind: 'navigate', to: '/dependency', region }] },
  ]
}

function handleClimateNews(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const window = WEATHER_WINDOWS[region]
  const impact = computeImpact({
    region,
    severity: ctx.state.severity,
    durationMonths: ctx.state.durationMonths,
    substitutability: ctx.state.substitutability,
    interventions: ctx.state.interventions,
  })
  return [
    { kind: 'heading', text: `${REGION_LABEL[region]} — current conditions` },
    { kind: 'text', text: `Reference hazard window: ${window.label}. Live weather and news for this region are available on the Evidence & Reports page's connector panels (NASA POWER, Open-Meteo, Tomorrow.io, NewsAPI/GNews) — the Copilot does not re-fetch them separately so results never drift from what's shown there.` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Holdings exposed under active scenario', value: String(impact.companyCount), evidence: 'modelled' },
        { label: 'Stressed EL', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
      ],
    },
    { kind: 'actions', actions: [{ id: 'open-evidence', label: 'Open live conditions (Evidence & Reports)', kind: 'navigate', to: '/evidence' }] },
  ]
}

function handleWhatIf(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const horizon = detectHorizon(text)
  const ranked = generateWhatIf(region, horizon)
  const top = ranked.byPriority[0]
  return [
    { kind: 'heading', text: `Multi-scenario analysis — ${REGION_LABEL[region]} (${horizon} horizon)` },
    {
      kind: 'text',
      text: `I generated ${ranked.scenarios.length} plausible scenarios instead of asking you to pick one, and ran each through the same financial engine the dashboard uses. Highest-priority: "${top.label}".`,
    },
    {
      kind: 'rankedList',
      title: 'Highest potential loss',
      rows: ranked.byLoss.map((s, i) => ({
        rank: i + 1,
        label: s.label,
        value: fmtCr(s.impact.stressedEl),
        sub: `${(s.impact.stressedEl / ranked.portfolioStats.eadCr * 100 || 0).toFixed(1)}% of exposed EAD`,
        evidence: 'modelled',
      })),
    },
    {
      kind: 'rankedList',
      title: 'Highest likelihood',
      rows: ranked.byLikelihood.map((s, i) => ({
        rank: i + 1,
        label: s.label,
        value: s.likelihoodLabel,
        sub: `Basis: ${PROBABILITY_BASIS_LABEL[s.probabilityBasis]} — ordinal ranking aid, not a measured probability`,
        evidence: s.probabilityEvidence,
      })),
    },
    {
      kind: 'rankedList',
      title: 'Highest cumulative exposure (illustrative recurrence assumption)',
      rows: ranked.byCumulative.map((s, i) => ({
        rank: i + 1,
        label: s.label,
        value: fmtCr(s.cumulativeExposureCr),
        sub: 'Disclosed recurrence multiplier, not an actuarial return-period model',
        evidence: 'assumption',
      })),
    },
    evidenceNote('Scenario losses share the same underlying exposure graph — they are alternative hypotheses about ONE region, not independent additive risks. Do not sum them.'),
    {
      kind: 'actions',
      actions: [
        { id: 'open-whatif-full', label: 'Open full What-If Analysis', kind: 'navigate', to: '/what-if', region },
        { id: 'apply-top', label: `Load "${top.label}" into Scenario Lab`, kind: 'apply-scenario', region, severity: top.severity, durationMonths: top.durationMonths, substitutability: top.substitutability },
        { id: 'brief', label: 'Generate scenario brief', kind: 'download-brief', briefRegion: region },
      ],
    },
  ]
}

function handleFinancial(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const impact = computeImpact({
    region,
    severity: ctx.state.severity,
    durationMonths: ctx.state.durationMonths,
    substitutability: ctx.state.substitutability,
    interventions: ctx.state.interventions,
  })
  return [
    { kind: 'heading', text: `Financial transmission — ${REGION_LABEL[region]}, active scenario` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Baseline EL', value: fmtCr(impact.baselineEl), evidence: 'modelled' },
        { label: 'Stressed EL', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
        { label: 'Sensitivity band (±15% severity)', value: `${fmtCr(impact.stressedElLow)} – ${fmtCr(impact.stressedElHigh)}`, evidence: 'modelled' },
        { label: 'Avoided EL from active interventions', value: fmtCr(impact.avoidedEl), evidence: 'modelled' },
      ],
    },
    { kind: 'text', text: `ECL = EAD × PD × LGD, summed per borrower (never double-counted across graph paths). Credit view (bank) and revenue-at-risk view (investor) are kept as separate lenses — switch with the BANK/INVESTOR toggle in the top bar.` },
    { kind: 'actions', actions: [{ id: 'open-portfolio', label: 'Open Portfolio Impact', kind: 'navigate', to: '/portfolio' }] },
  ]
}

function handleInsurance(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  const hazardId = REGION_HAZARD[region]
  const gap = computeProtectionGap(hazardId, ctx.state.severity, ctx.state.durationMonths)
  const insurerRows = allInsurers()
    .map((ins) => computeInsurerBook(ins.id, hazardId, ctx.state.severity, ctx.state.durationMonths))
    .filter((b): b is NonNullable<typeof b> => !!b && b.policyCount > 0)
  return [
    { kind: 'heading', text: `Insurance & protection gap — ${REGION_LABEL[region]}` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Protection gap', value: `${(gap.protectionGapShare * 100).toFixed(0)}%`, sub: 'of exposed EAD uninsured', evidence: 'modelled' },
        { label: 'Exposed EAD', value: fmtCr(gap.exposedEADCr), evidence: 'modelled' },
        { label: 'Est. net claims (insured subset)', value: fmtCr(gap.totalNetClaimsCr), evidence: 'modelled' },
      ],
    },
    {
      kind: 'bullets',
      items: [
        `Uninsured exposed, ranked by EAD: ${gap.uninsuredExposed.slice(0, 5).map((c) => c.label).join(', ') || 'none traced'}.`,
        ...insurerRows.map((b) => `${b.insurer.label}: gross loss ratio ${(b.grossLossRatio * 100).toFixed(0)}%, cedes ${b.cededSharePct}% to reinsurance.`),
      ],
    },
    { kind: 'text', text: 'A policy limit is not an automatic payout — exclusions, deductibles and sublimits change the actual claim, which is why the figures above are modelled estimates, not a guarantee.' },
    { kind: 'actions', actions: [{ id: 'open-insurance', label: 'Open Insurance & Protection Gap', kind: 'navigate', to: '/insurance' }] },
  ]
}

function handleBrief(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  return [
    { kind: 'heading', text: `Climate Scenario Intelligence Brief — ${REGION_LABEL[region]}` },
    { kind: 'text', text: 'This assembles the scenario ranking, holding breakdown, bottlenecks, insurance review and evidence register into one downloadable report.' },
    { kind: 'actions', actions: [{ id: 'brief', label: 'Download brief (.txt)', kind: 'download-brief', briefRegion: region }] },
  ]
}

function handleInstitution(ctx: Ctx, text: string): CopilotBlock[] | null {
  const lower = text.toLowerCase()
  const institution = NODES.find(
    (n) => (n.kind === 'bank' || n.kind === 'insurer' || n.kind === 'govt') && lower.includes(n.label.toLowerCase().split(' ')[0].toLowerCase()),
  )
  if (!institution) return null
  const region = regionOrCurrent(text, ctx)
  const hazardId = REGION_HAZARD[region]
  const exposure = institutionExposureToHazard(institution.id, hazardId)
  return [
    { kind: 'heading', text: `${institution.label} — exposure to ${REGION_LABEL[region]} hazard` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Exposed borrowers', value: `${exposure.exposedBorrowers.length} / ${exposure.totalBorrowers.length}`, evidence: 'modelled' },
        { label: 'Exposed EAD', value: fmtCr(exposure.exposedEAD), evidence: 'modelled' },
        { label: 'Share of book', value: `${(exposure.totalEAD ? (exposure.exposedEAD / exposure.totalEAD) * 100 : 0).toFixed(0)}%`, evidence: 'modelled' },
      ],
    },
    { kind: 'text', text: 'Answered structurally by intersecting this institution’s borrower graph with the hazard’s descendant graph — not a keyword search.' },
    { kind: 'actions', actions: [{ id: 'open-portfolio-2', label: 'Open Portfolio Impact', kind: 'navigate', to: '/portfolio' }] },
  ]
}

function handleHelp(): CopilotBlock[] {
  return [
    { kind: 'heading', text: 'CLIMATRIX AI Copilot' },
    {
      kind: 'text',
      text: 'I can investigate exposure, dependencies, financial impact, insurance and run multi-scenario analysis — the same engine every dashboard page uses, so nothing I say disagrees with what you see on screen. Try one of these, or ask in your own words:',
    },
    {
      kind: 'bullets',
      items: [
        'Which of my investments are exposed to risky transport routes in Himachal Pradesh?',
        'What is happening in Maharashtra right now, and which holdings could be affected?',
        'Automatically test the most relevant climate scenarios for Kerala.',
        'How could this scenario affect earnings, cash flow and valuation?',
        'Which exposures may be uninsured or underinsured?',
        'Generate a scenario brief.',
      ],
    },
  ]
}

const RULES: { test: (t: string) => boolean; handler: (ctx: Ctx, t: string) => CopilotBlock[] | null }[] = [
  { test: (t) => /insur|protection gap|coverage|underinsured|uninsured/i.test(t), handler: handleInsurance },
  { test: (t) => /what.?if|worst case|compare scenario|multi.?scenario|automatically test/i.test(t), handler: handleWhatIf },
  { test: (t) => /brief|report|summary document/i.test(t), handler: handleBrief },
  { test: (t) => /earning|cash flow|valuation|financial impact|credit loss|expected loss/i.test(t), handler: handleFinancial },
  { test: (t) => /route|transport|supplier|bridge|road|bottleneck|dependen/i.test(t), handler: handleDependency },
  { test: (t) => /happening|current condition|weather|news|right now/i.test(t), handler: handleClimateNews },
  { test: (t) => NODES.some((n) => (n.kind === 'bank' || n.kind === 'insurer' || n.kind === 'govt') && t.toLowerCase().includes(n.label.toLowerCase().split(' ')[0])), handler: (ctx, t) => handleInstitution(ctx, t) },
  { test: (t) => /expos|vulnerab|risk(y)?\b|holding/i.test(t), handler: handleExposure },
]

export function respondTo(message: string, state: ScenarioState): CopilotReply {
  const text = message.trim()
  if (!text) return { blocks: handleHelp() }
  if (/^help$|what can you do|^hi$|^hello$/i.test(text)) return { blocks: handleHelp() }

  const ctx: Ctx = { state }
  for (const rule of RULES) {
    if (rule.test(text)) {
      const blocks = rule.handler(ctx, text)
      if (blocks) return { blocks }
    }
  }
  // Fallback: treat it as an exposure question about whatever region it mentions
  // (or the active one), which is the single most generically useful answer.
  return { blocks: handleExposure(ctx, text) }
}
