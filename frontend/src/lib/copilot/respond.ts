// CLIMATRIX AI Copilot — intent recognition + response composition.
//
// Deliberately rule-based, not an LLM call: the Copilot's job is to invoke
// the SAME deterministic graph/financial/insurance engine every dashboard
// page already uses and present the result conversationally, never to
// generate a number itself. This keeps every figure the chatbot shows
// traceable to the evidence-labeled engine that produced it (see
// docs/ARCHITECTURE.md's evidence-integrity rule). Intents can also chain
// more than one engine call in a single turn (e.g. the portfolio overview
// fans out across every region) — that's the "runs multiple queries on
// its own" behavior, still with zero hallucinated numbers.

import { computeBottlenecks, institutionExposureToHazard, REGION_HAZARD, totalPortfolioEAD } from '../graphAnalytics'
import { computeInsurerBook, computeProtectionGap, allInsurers, formatLossRatio } from '../insurance'
import { NODES } from '../indiaGraphData'
import { WEATHER_WINDOWS } from '../weatherWindows'
import { REGION_LABEL, computeImpact, type Region, type ScenarioState } from '../../store/useScenarioStore'
import {
  ALL_REGIONS,
  downloadPortfolioBrief,
  generatePortfolioOverview,
  generateWhatIf,
  PROBABILITY_BASIS_LABEL,
  type Horizon,
} from './engine'
import type { CopilotBlock, CopilotAction } from './types'

const REGION_ALIASES: { region: Region; terms: string[] }[] = [
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
const UNMAPPED_CITIES: { name: string; terms: string[]; nearest: Region }[] = [
  { name: 'Chennai', terms: ['chennai', 'madras'], nearest: 'KL' },
  { name: 'Bengaluru', terms: ['bengaluru', 'bangalore'], nearest: 'KL' },
  { name: 'Delhi / NCR', terms: ['delhi', 'ncr', 'gurugram', 'gurgaon', 'noida'], nearest: 'HP' },
  { name: 'Hyderabad', terms: ['hyderabad', 'telangana'], nearest: 'MH' },
  { name: 'Kolkata', terms: ['kolkata', 'calcutta', 'west bengal'], nearest: 'KL' },
  { name: 'Ahmedabad / Gujarat', terms: ['ahmedabad', 'surat', 'gujarat'], nearest: 'MH' },
]

function detectRegion(text: string): Region | null {
  const lower = text.toLowerCase()
  for (const { region, terms } of REGION_ALIASES) {
    if (terms.some((t) => lower.includes(t))) return region
  }
  return null
}

function detectUnmappedCity(text: string) {
  const lower = text.toLowerCase()
  return UNMAPPED_CITIES.find((c) => c.terms.some((t) => lower.includes(t))) ?? null
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

function suggestions(prompts: string[]): CopilotBlock {
  return { kind: 'suggestions', prompts }
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
    { id: 'open-scenario', label: 'Open Scenario Lab', kind: 'navigate', to: '/scenario', region },
    { id: 'open-whatif', label: 'Compare scenarios (What-If Analysis)', kind: 'navigate', to: '/what-if', region },
    { id: 'go-map', label: 'Show it on the live map', kind: 'go-to-map', region },
  ]
}

// --- individual intent handlers -------------------------------------------------

function handleUnmappedCity(city: { name: string; nearest: Region }): CopilotBlock[] {
  return [
    { kind: 'heading', text: `${city.name} isn't in this prototype's graph yet` },
    {
      kind: 'text',
      text: `CLIMATRIX currently models five regions: Himachal Pradesh, Kerala, the Marathwada agricultural belt, Uttarakhand's Chamoli–Joshimath corridor, and the Mumbai Metropolitan Region. ${city.name} has no hazard, infrastructure or holdings traced yet, so I won't invent exposure figures for it.`,
    },
    {
      kind: 'text',
      text: `The closest modeled analogue for this kind of question is ${REGION_LABEL[city.nearest]} — happy to run the same analysis there, or you can tell me which of the five regions you meant.`,
    },
    {
      kind: 'actions',
      actions: [
        { id: 'use-nearest', label: `Analyse ${REGION_LABEL[city.nearest]} instead`, kind: 'navigate', to: '/what-if', region: city.nearest },
        ...ALL_REGIONS.filter((r) => r !== city.nearest).map((r) => ({
          id: `pick-${r}`,
          label: REGION_LABEL[r],
          kind: 'navigate' as const,
          to: '/scenario',
          region: r,
        })),
      ],
    },
  ]
}

function handlePortfolio(ctx: Ctx, _text: string): CopilotBlock[] {
  const overview = generatePortfolioOverview()
  const top = overview.byLoss[0]
  return [
    { kind: 'heading', text: 'Portfolio-wide climate risk' },
    {
      kind: 'text',
      text: `I ran a common severity-80/6-month stress test across all ${overview.regions.length} tracked regions so they can be compared on equal footing, instead of only looking at whichever one is currently selected.`,
    },
    {
      kind: 'statRow',
      stats: [
        { label: 'Total exposed EAD', value: fmtCr(overview.totalEADCr), evidence: 'modelled' },
        { label: 'Highest-risk region', value: top.label, evidence: 'modelled' },
        { label: 'Portfolio-wide protection gap', value: `${(overview.portfolioProtectionGapShare * 100).toFixed(0)}%`, evidence: 'modelled' },
      ],
    },
    {
      kind: 'rankedList',
      title: 'Regions ranked by stressed EL (common scenario)',
      rows: overview.byLoss.map((r, i) => ({
        rank: i + 1,
        label: r.label,
        value: fmtCr(r.impact.stressedEl),
        sub: `${r.impact.companyCount} holdings · ${(r.portfolioShareOfTotal * 100).toFixed(1)}% of total portfolio EAD · protection gap ${(r.protectionGap.protectionGapShare * 100).toFixed(0)}%`,
        evidence: 'modelled',
      })),
    },
    {
      kind: 'rankedList',
      title: 'Cross-portfolio hidden concentration',
      rows: overview.bottlenecks.map((b, i) => ({
        rank: i + 1,
        label: b.node.label,
        value: fmtCr(b.reachedEAD),
        sub: `Reaches ${b.reachedCompanies.length} holdings across the whole graph — a single point of failure most single-region views won't show.`,
        evidence: 'modelled',
      })),
    },
    evidenceNote('This is a cross-region screening pass, not each region’s own saved scenario. Ask "what if there’s a flood in [region]" to go deep on any one of them.'),
    {
      kind: 'actions',
      actions: [
        { id: 'deep-dive-top', label: `Deep-dive ${top.label}`, kind: 'navigate', to: '/what-if', region: top.region },
        { id: 'map-top', label: `Show ${top.label} on the live map`, kind: 'go-to-map', region: top.region },
        { id: 'portfolio-brief', label: 'Download portfolio risk brief', kind: 'download-portfolio-brief' },
      ],
    },
    suggestions([
      `What if there's a severe flood in ${top.label}?`,
      'Which exposures across my portfolio are uninsured?',
      'What is the RBI compliance angle on this?',
    ]),
  ]
}

function handleCompliance(_ctx: Ctx, _text: string): CopilotBlock[] {
  return [
    { kind: 'heading', text: 'Regulatory & compliance context' },
    {
      kind: 'text',
      text: "CLIMATRIX is built to complement, not replace, India's own climate stress-testing framework. The Reserve Bank of India ran a pilot Climate Vulnerability Assessment and Stress Test (VAST) with 15 banks in 2022, reported in its January 2024 Bulletin.",
    },
    {
      kind: 'statRow',
      stats: [
        { label: 'Flood scenario', value: '+66.1%', sub: 'credit-loss potential vs. baseline', evidence: 'sourced' },
        { label: 'Cyclone scenario', value: '+65.8%', sub: 'credit-loss potential vs. baseline', evidence: 'sourced' },
        { label: 'Tail-risk scenario', value: '+138%', sub: 'credit-loss potential vs. baseline', evidence: 'sourced' },
      ],
    },
    {
      kind: 'bullets',
      items: [
        'These are the RBI’s own reported pilot figures — scenario-model outputs, not realized losses from a named disaster.',
        'The RBI exercise flagged granular location data, counterparty information and climate-risk modeling capability as the practical obstacles — exactly what this graph’s evidence-class system (sourced/modelled/assumption/synthetic) is designed to make legible.',
        'This prototype does not file, replace or certify any regulatory return. Treat every figure here as a decision-support input for your own compliance process, not a submission-ready number.',
      ],
    },
    { kind: 'actions', actions: [{ id: 'open-evidence-compliance', label: 'Open Evidence & Reports', kind: 'navigate', to: '/evidence' }] },
    suggestions(['Analyse my portfolio and give me the risks', 'Which exposures may be uninsured or underinsured?']),
  ]
}

function handleGoToMap(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  return [
    { kind: 'heading', text: `Opening the Digital Twin — ${REGION_LABEL[region]}` },
    {
      kind: 'text',
      text: 'Taking you to the live 3D map and starting the scenario clock so you can watch the hazard, affected infrastructure and holdings animate in real time — exactly what’s rendered there, nothing recalculated separately here.',
    },
    { kind: 'actions', actions: [{ id: 'go', label: `Go to ${REGION_LABEL[region]} on the map`, kind: 'go-to-map', region }] },
  ]
}

function handleRunSimulation(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  return [
    { kind: 'heading', text: `Running the scenario — ${REGION_LABEL[region]}` },
    { kind: 'text', text: `Starting the simulation clock for ${REGION_LABEL[region]} · ${ctx.state.hazard} · severity ${ctx.state.severity}/100. Watch the timeline, map and financial panels update together as it runs.` },
    { kind: 'actions', actions: [{ id: 'run', label: 'Run simulation now', kind: 'run-simulation', region }] },
  ]
}

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
    suggestions([
      `What if there's a severe flood in ${REGION_LABEL[region]}?`,
      'How could this affect earnings and cash flow?',
      'Analyse my entire portfolio',
    ]),
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
    {
      kind: 'actions',
      actions: [
        { id: 'open-dep', label: 'Open Dependency Explorer', kind: 'navigate', to: '/dependency', region },
        { id: 'go-map-dep', label: 'Show it on the live map', kind: 'go-to-map', region },
      ],
    },
    suggestions([`What happens to the credit view if this hazard hits ${REGION_LABEL[region]}?`]),
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
      kind: 'statRow',
      stats: [
        {
          label: 'This region’s share of your total portfolio EAD',
          value: `${((ranked.portfolioStats.eadCr / totalPortfolioEAD()) * 100 || 0).toFixed(1)}%`,
          evidence: 'modelled',
        },
        { label: 'Worst-case stressed EL here', value: fmtCr(top.impact.stressedEl), evidence: 'modelled' },
      ],
    },
    {
      kind: 'rankedList',
      title: 'Highest potential loss',
      rows: ranked.byLoss.map((s, i) => ({
        rank: i + 1,
        label: s.label,
        value: fmtCr(s.impact.stressedEl),
        sub: `${((s.impact.stressedEl / ranked.portfolioStats.eadCr) * 100 || 0).toFixed(1)}% of exposed EAD in this region`,
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
        { id: 'go-map-whatif', label: 'Run it on the live map', kind: 'go-to-map', region, severity: top.severity, durationMonths: top.durationMonths, substitutability: top.substitutability },
        { id: 'brief', label: 'Generate scenario brief', kind: 'download-brief', briefRegion: region },
      ],
    },
    suggestions(['Which exposures here are uninsured?', 'Show me this on the live map', `Compare this with my whole portfolio`]),
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
    suggestions(['What mitigation options would reduce this?', 'Which exposures here are uninsured?']),
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
        ...insurerRows.map((b) => `${b.insurer.label}: gross loss ratio ${formatLossRatio(b.grossLossRatio)}, cedes ${b.cededSharePct}% to reinsurance.`),
      ],
    },
    { kind: 'text', text: 'A policy limit is not an automatic payout — exclusions, deductibles and sublimits change the actual claim, which is why the figures above are modelled estimates, not a guarantee.' },
    { kind: 'actions', actions: [{ id: 'open-insurance', label: 'Open Insurance & Protection Gap', kind: 'navigate', to: '/insurance' }] },
    suggestions(['Generate a scenario brief', 'What is the RBI compliance angle on this?']),
  ]
}

function handleBrief(ctx: Ctx, text: string): CopilotBlock[] {
  const region = regionOrCurrent(text, ctx)
  return [
    { kind: 'heading', text: `Climate Scenario Intelligence Brief — ${REGION_LABEL[region]}` },
    { kind: 'text', text: 'This assembles the scenario ranking, holding breakdown, bottlenecks, insurance review and evidence register into one downloadable report.' },
    {
      kind: 'actions',
      actions: [
        { id: 'brief', label: 'Download brief (.txt)', kind: 'download-brief', briefRegion: region },
        { id: 'portfolio-brief-2', label: 'Download portfolio-wide brief instead', kind: 'download-portfolio-brief' },
      ],
    },
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
      text: 'I can investigate exposure, dependencies, financial impact, insurance, compliance and run multi-scenario or whole-portfolio analysis — the same engine every dashboard page uses, so nothing I say disagrees with what you see on screen. I can also take you to the live map and run the simulation directly. Try one of these, or ask in your own words:',
    },
    {
      kind: 'bullets',
      items: [
        'Analyse my portfolio and give me the risks.',
        "What if there's a flood in Mumbai — how would that affect my portfolio?",
        'Which of my investments are exposed to risky transport routes in Himachal Pradesh?',
        'Automatically test the most relevant climate scenarios for Kerala.',
        'How could this scenario affect earnings, cash flow and valuation?',
        'Which exposures may be uninsured or underinsured?',
        'What is the RBI compliance angle here?',
        'Guide me to the map and show live movement for Mumbai.',
        'Generate a portfolio risk brief.',
      ],
    },
  ]
}

const RULES: { test: (t: string) => boolean; handler: (ctx: Ctx, t: string) => CopilotBlock[] | null }[] = [
  { test: (t) => /guide me to the map|show me the map|take me to (the )?(digital )?twin|open (the )?(digital )?twin|open (the )?map|show (me )?(my )?(investment|portfolio)s?.{0,20}(live|moving|movement)/i.test(t), handler: handleGoToMap },
  { test: (t) => /\brun (the )?simulation\b|\bsimulate (this|it|the scenario)\b|\bstart (the )?simulation\b/i.test(t), handler: handleRunSimulation },
  { test: (t) => /complian|regulat|rbi\b|vast (exercise|pilot)/i.test(t), handler: handleCompliance },
  // Portfolio-WIDE overview only fires when no specific region is named —
  // "what if there's a flood in Mumbai, how will that affect my portfolio"
  // mentions "my portfolio" too, but the user clearly wants the Mumbai
  // scenario (handled below), with that region's share of the total
  // portfolio already surfaced in its own response.
  {
    test: (t) =>
      !detectRegion(t) &&
      /\bmy (entire |whole |overall )?portfolio\b|\ball my (investments|holdings)\b|portfolio.?wide|across (my|the) portfolio|overall (portfolio )?risk/i.test(t),
    handler: handlePortfolio,
  },
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

  // An unmapped city gets an honest disclosure before anything else —
  // never silently substitute the active region for a place the graph
  // doesn't actually model, even if a covered region is also mentioned.
  if (!detectRegion(text)) {
    const unmapped = detectUnmappedCity(text)
    if (unmapped) return { blocks: handleUnmappedCity(unmapped) }
  }

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
