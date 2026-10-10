// CLIMATRIX AI Copilot — the actual answer-computing layer.
//
// Every function here takes EXPLICIT, already-resolved parameters (never
// raw free text) and calls the same deterministic graph/financial/
// insurance engine every dashboard page uses. This is the one place a
// number gets produced for the Copilot, called from two different
// front-doors:
//   - respond.ts: a regex parser extracts parameters from free text (the
//     offline/no-API-key fallback — limited understanding, but safe).
//   - tools.ts: an LLM reads the user's message (including indirect,
//     compound, or ambiguous phrasing) and decides which function to call
//     with which parameters — genuine language understanding, but the
//     model still never invents the number itself.
// Both produce the exact same CopilotBlock[] rendering, so the UI can't
// tell (or disagree on figures) depending on which path answered.

import {
  companyExposureDetail,
  computeBottlenecks,
  directFinanciers,
  getAncestors,
  institutionExposureToHazard,
  REGION_HAZARD,
  totalPortfolioEAD,
} from '../graphAnalytics'
import { computeInsuranceAdjustedCredit, computeInsurerBook, computeProtectionGap, allInsurers, formatLossRatio } from '../insurance'
import { getWeatherAnomalies, semanticSearch } from '../api'
import { NODES } from '../indiaGraphData'
import { findBreachingSeverity } from '../reverseStressTest'
import { sectorVulnerability } from '../sectorVulnerability'
import { routeForRegion } from '../supplyChainRoutes'
import { WEATHER_WINDOWS } from '../weatherWindows'
import { REGION_LABEL, computeImpact, stressPdLgd, type ScenarioState } from '../../store/useScenarioStore'
import type { Region } from '../../store/useScenarioStore'
import {
  ALL_REGIONS,
  generatePortfolioOverview,
  generateWhatIf,
  PROBABILITY_BASIS_LABEL,
  type Horizon,
} from './engine'
import { detectDurationMonths, detectSeverity, detectSubstitutability, detectUserMode, fmtCr, resolveScenario, type ScenarioParams } from './params'
import type { CopilotBlock, CopilotAction } from './types'

function evidenceNote(text: string): CopilotBlock {
  return { kind: 'text', text }
}

function suggestions(prompts: string[]): CopilotBlock {
  return { kind: 'suggestions', prompts }
}

function scenarioActions(region: Region): CopilotAction[] {
  return [
    { id: 'open-scenario', label: 'Open Scenario Lab', kind: 'navigate', to: '/scenario', region },
    { id: 'open-whatif', label: 'Compare scenarios (What-If Analysis)', kind: 'navigate', to: '/what-if', region },
    { id: 'go-map', label: 'Show it on the live map', kind: 'go-to-map', region },
  ]
}

export function answerUnmappedCity(city: { name: string; nearest: Region }): CopilotBlock[] {
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

/** The honest "I understand the question, but I have nothing to answer it
 * with" response — for risk categories (political unrest, security,
 * pandemic, macro) this platform has zero data, connector or model for.
 * Exists specifically because the freight/route rule used to match on a
 * bare keyword like "supply chain route" and answer with the CURRENT
 * scenario's region regardless of what was actually asked — a quiet
 * fabrication this function replaces with an explicit scope boundary. */
export function answerOutOfScope(domain: string): CopilotBlock[] {
  return [
    { kind: 'heading', text: "That's outside what this platform models" },
    {
      kind: 'text',
      text: `This question is about ${domain}, not a physical climate hazard. CLIMATRIX only models five hazard types — Flood, Drought, Cyclone, Heatwave, Landslide — propagating through infrastructure, suppliers and financial exposure. It has no data, connector or model for ${domain}, so rather than substitute the active climate scenario as if it answered this, I'm telling you directly: I don't know, and this tool can't compute an answer here.`,
    },
    {
      kind: 'text',
      text: 'If you meant a climate-hazard question, try something like "what if a flood hits Kerala" or "show me the freight routes for Himachal Pradesh". For political, security or macro risk specifically, you\'ll need a dedicated source for that — not this platform.',
    },
  ]
}

export function answerPortfolio(): CopilotBlock[] {
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
    evidenceNote('This is a cross-region screening pass, not each region’s own saved scenario. Ask to go deep on any one region for the full scenario comparison.'),
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

export function answerCompliance(): CopilotBlock[] {
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

/** "Show me the freight routes for X" / "which routes are exposed" — the
 * supply-chain movement layer's Copilot front door. Reuses the exact
 * route + financial math RouteInspector.tsx renders on the map, kept
 * deliberately brief per the brief's "clearer and briefed" direction:
 * one assessment line, the concrete number, one next step — not a
 * seven-section essay for a one-route answer. */
export function answerRoutes(p: ScenarioParams): CopilotBlock[] {
  const route = routeForRegion(p.region)
  if (!route) {
    return [{ kind: 'text', text: `No supply-chain route is modelled for ${REGION_LABEL[p.region]} yet.` }]
  }
  const hazardNode = NODES.find((n) => n.id === route.hazardId)
  const infraNode = NODES.find((n) => n.id === route.infraId)
  const company = NODES.find((n) => n.id === route.companyId)
  if (!hazardNode || !infraNode || !company) return []

  const { stressedPd, stressedLgd } = stressPdLgd(company.baselinePd ?? 0, company.baselineLgd ?? 0, p.severity, p.durationMonths, p.substitutability, sectorVulnerability(company.sector))
  const stressedElCr = (company.eadCr ?? 0) * stressedPd * stressedLgd

  return [
    { kind: 'heading', text: route.label },
    {
      kind: 'text',
      text: `${hazardNode.label} → ${infraNode.label} → ${company.label}. At the active scenario (severity ${p.severity}/100, ${p.durationMonths}mo), this route’s modelled stressed EL for ${company.label} is ${fmtCr(stressedElCr)}.`,
    },
    { kind: 'text', text: 'This is a demo-simulation route (a plausible corridor between this graph’s own real coordinates) — not a live logistics feed. Open the Digital Twin and click the amber marker to inspect it.' },
    {
      kind: 'actions',
      actions: [
        { id: 'go-route', label: 'Open on the live map', kind: 'go-to-map', region: p.region },
        { id: 'open-co', label: `Open ${company.label}`, kind: 'navigate', to: `/company?id=${company.id}` },
      ],
    },
  ]
}

export function answerGoToMap(region: Region): CopilotBlock[] {
  return [
    { kind: 'heading', text: `Opening the Digital Twin — ${REGION_LABEL[region]}` },
    {
      kind: 'text',
      text: 'Taking you to the live 3D map and starting the scenario clock so you can watch the hazard, affected infrastructure and holdings animate in real time — exactly what’s rendered there, nothing recalculated separately here.',
    },
    { kind: 'actions', actions: [{ id: 'go', label: `Go to ${REGION_LABEL[region]} on the map`, kind: 'go-to-map', region }] },
  ]
}

export function answerRunSimulation(p: ScenarioParams): CopilotBlock[] {
  return [
    { kind: 'heading', text: `Running the scenario — ${REGION_LABEL[p.region]}` },
    { kind: 'text', text: `Starting the simulation clock for ${REGION_LABEL[p.region]} · severity ${p.severity}/100 · ${p.durationMonths}mo. Watch the timeline, map and financial panels update together as it runs.` },
    { kind: 'actions', actions: [{ id: 'run', label: 'Run simulation now', kind: 'run-simulation', region: p.region, severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability }] },
  ]
}

export function answerExposure(p: ScenarioParams): CopilotBlock[] {
  const impact = computeImpact({ region: p.region, severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability, interventions: [] })
  const bottlenecks = computeBottlenecks(3).filter((b) => NODES.some((n) => n.id === b.node.id && n.region === p.region))
  return [
    { kind: 'heading', text: `Climate exposure — ${REGION_LABEL[p.region]}` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Exposed EAD', value: fmtCr(impact.eadCr), evidence: 'modelled' },
        { label: 'Holdings reached', value: String(impact.companyCount), evidence: 'modelled' },
        { label: 'Stressed EL (this scenario)', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
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
    evidenceNote(`Figures use severity ${p.severity}/100, ${p.durationMonths}mo, substitutability ${p.substitutability}, applied through the same ECL = EAD × PD × LGD engine every page reads.`),
    { kind: 'actions', actions: scenarioActions(p.region) },
    suggestions([
      `What if there's a severe flood in ${REGION_LABEL[p.region]}?`,
      'How could this affect earnings and cash flow?',
      'Analyse my entire portfolio',
    ]),
  ]
}

export function answerDependency(region: Region): CopilotBlock[] {
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

export function answerClimateNews(p: ScenarioParams): CopilotBlock[] {
  const window = WEATHER_WINDOWS[p.region]
  const impact = computeImpact({ region: p.region, severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability, interventions: [] })
  return [
    { kind: 'heading', text: `${REGION_LABEL[p.region]} — current conditions` },
    { kind: 'text', text: `Reference hazard window: ${window.label}. Live weather and news for this region are available on the Evidence & Reports page's connector panels (NASA POWER, Open-Meteo, Tomorrow.io, NewsAPI/GNews) — the Copilot does not re-fetch them separately so results never drift from what's shown there.` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Holdings exposed under this scenario', value: String(impact.companyCount), evidence: 'modelled' },
        { label: 'Stressed EL', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
      ],
    },
    { kind: 'actions', actions: [{ id: 'open-evidence', label: 'Open live conditions (Evidence & Reports)', kind: 'navigate', to: '/evidence' }] },
  ]
}

export function answerWhatIf(region: Region, horizon: Horizon): CopilotBlock[] {
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
    suggestions(['Which exposures here are uninsured?', 'Show me this on the live map', 'Compare this with my whole portfolio']),
  ]
}

export function answerFinancial(p: ScenarioParams): CopilotBlock[] {
  const impact = computeImpact({ region: p.region, severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability, interventions: [] })
  return [
    { kind: 'heading', text: `Financial transmission — ${REGION_LABEL[p.region]}` },
    {
      kind: 'statRow',
      stats: [
        { label: 'Baseline EL', value: fmtCr(impact.baselineEl), evidence: 'modelled' },
        { label: 'Stressed EL', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
        { label: 'Sensitivity band (±15% severity)', value: `${fmtCr(impact.stressedElLow)} – ${fmtCr(impact.stressedElHigh)}`, evidence: 'modelled' },
      ],
    },
    { kind: 'text', text: `ECL = EAD × PD × LGD, summed per borrower (never double-counted across graph paths). Credit view (bank) and revenue-at-risk view (investor) are kept as separate lenses — switch with the BANK/INVESTOR toggle in the top bar.` },
    { kind: 'actions', actions: [{ id: 'open-portfolio', label: 'Open Portfolio Impact', kind: 'navigate', to: '/portfolio' }] },
    suggestions(['What mitigation options would reduce this?', 'Which exposures here are uninsured?']),
  ]
}

export function answerInsurance(p: ScenarioParams): CopilotBlock[] {
  const hazardId = REGION_HAZARD[p.region]
  const gap = computeProtectionGap(hazardId, p.severity, p.durationMonths)
  const insurerRows = allInsurers()
    .map((ins) => computeInsurerBook(ins.id, hazardId, p.severity, p.durationMonths))
    .filter((b): b is NonNullable<typeof b> => !!b && b.policyCount > 0)
  return [
    { kind: 'heading', text: `Insurance & protection gap — ${REGION_LABEL[p.region]}` },
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

export function answerBrief(region: Region): CopilotBlock[] {
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

export function answerInstitution(institutionId: string, region: Region): CopilotBlock[] | null {
  const institution = NODES.find((n) => n.id === institutionId)
  if (!institution) return null
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

// Matching on a bare first word ("Bank of Bharat" -> "bank") used to
// false-match anything containing the English word "bank" — including
// "river banks". Require a whole-word hit on a token that's actually
// distinctive to this institution's name instead.
const INSTITUTION_GENERIC_WORDS = new Set([
  'bank',
  'banks',
  'fund',
  'funds',
  'finance',
  'insurance',
  'national',
  'state',
  'public',
  'sector',
  'general',
  'india',
  'company',
  'co',
  'govt',
  'government',
  'of',
  'and',
  'the',
])

export function findInstitutionByName(query: string) {
  const lower = query.toLowerCase()
  for (const n of NODES) {
    if (n.kind !== 'bank' && n.kind !== 'insurer' && n.kind !== 'govt') continue
    const words = n.label
      .toLowerCase()
      .replace(/[—–-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !INSTITUTION_GENERIC_WORDS.has(w))
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) return n
  }
  return null
}

// Matching on a bare short word used to false-match ("Ltd" inside "Ltd.",
// "Mills" being common) — same whole-word-on-a-distinctive-token rule as
// findInstitutionByName, applied to companies.
const COMPANY_GENERIC_WORDS = new Set([
  'ltd', 'pvt', 'co', 'cooperative', 'federation', 'mills', 'works', 'exports',
  'processors', 'services', 'india', 'the', 'and', 'of', 'company', 'corp',
])

export function findCompanyByName(query: string) {
  const lower = query.toLowerCase()
  for (const n of NODES) {
    if (n.kind !== 'company') continue
    const words = n.label
      .toLowerCase()
      .replace(/[—–-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !COMPANY_GENERIC_WORDS.has(w))
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) return n
  }
  return null
}

/** Direct, free-text scenario control — "set severity to 85 and make
 * substitutability limited" actually moves the live dials (not just
 * describes what they'd show), then confirms with the recomputed figure.
 * This is the one place the Copilot WRITES state instead of only reading
 * it — every other answer function is a pure read over the engine. */
export function answerSetScenario(state: ScenarioState, text: string): CopilotBlock[] {
  const severity = detectSeverity(text)
  const durationMonths = detectDurationMonths(text)
  const substitutability = detectSubstitutability(text)
  const mode = detectUserMode(text)

  const changes: string[] = []
  if (severity !== null) {
    state.setSeverity(severity)
    changes.push(`Severity → ${severity}/100`)
  }
  if (durationMonths !== null) {
    state.setDuration(durationMonths)
    changes.push(`Duration → ${durationMonths} month(s)`)
  }
  if (substitutability) {
    state.setSubstitutability(substitutability)
    changes.push(`Substitutability → ${substitutability}`)
  }
  if (mode) {
    state.setUserMode(mode)
    changes.push(`Lens → ${mode === 'bank' ? 'Bank' : 'Investor'}`)
  }

  const p = resolveScenario(undefined, state)
  const impact = computeImpact({
    region: p.region,
    severity: p.severity,
    durationMonths: p.durationMonths,
    substitutability: p.substitutability,
    interventions: state.interventions,
  })

  return [
    { kind: 'heading', text: 'Scenario updated' },
    { kind: 'bullets', items: changes },
    {
      kind: 'statRow',
      stats: [
        { label: 'Active region', value: REGION_LABEL[p.region], evidence: 'assumption' },
        { label: 'Stressed EL (recomputed)', value: fmtCr(impact.stressedEl), evidence: 'modelled' },
      ],
    },
    { kind: 'text', text: 'Applied directly to the live scenario — every dashboard page now reflects this, not just this chat.' },
    { kind: 'actions', actions: [{ id: 'open-scenario-after-set', label: 'Open Scenario Lab to see it', kind: 'navigate', to: '/scenario' }] },
  ]
}

export function answerCompanyLookup(companyId: string, p: ScenarioParams): CopilotBlock[] | null {
  const company = NODES.find((n) => n.id === companyId)
  if (!company) return null

  const { hazards, directInfra, indirectInfra, suppliers, directInfraParent } = companyExposureDetail(company.id)
  const activeHazardId = REGION_HAZARD[p.region]
  const { nodes: ancestorIds } = getAncestors(company.id)
  const inScenario = ancestorIds.has(activeHazardId)
  const vulnerability = sectorVulnerability(company.sector)
  const { stressedPd, stressedLgd } = stressPdLgd(
    company.baselinePd ?? 0,
    company.baselineLgd ?? 0,
    p.severity,
    p.durationMonths,
    p.substitutability,
    vulnerability,
  )
  const eadCr = company.eadCr ?? 0
  const stressedEl = eadCr * stressedPd * stressedLgd
  const insuranceAdjusted = inScenario ? computeInsuranceAdjustedCredit(company, stressedPd, stressedLgd, p.severity, p.durationMonths) : null
  const financiers = directFinanciers(company.id)

  const pathSentence = directInfraParent
    ? `Directly dependent on ${directInfra.map((i) => i.label).join(' and ')}.${indirectInfra.length ? ` Also indirectly linked to ${indirectInfra.map((n) => n.label).join(', ')} through a shared supplier.` : ''}`
    : hazards.length
      ? `Indirectly exposed — the path runs through ${[...indirectInfra, ...suppliers].map((n) => n.label).join(' → ') || 'a supplier'}.`
      : 'No hazard dependency is traced to this company in the current graph.'

  return [
    { kind: 'heading', text: `${company.label} — ${REGION_LABEL[p.region]} scenario` },
    {
      kind: 'text',
      text: inScenario
        ? `Exposed to the active scenario (severity ${p.severity}/100). ${pathSentence}`
        : `Not reachable from ${REGION_LABEL[p.region]}'s hazard under the current graph. ${pathSentence}`,
    },
    {
      kind: 'statRow',
      stats: [
        { label: 'Exposure at default (EAD)', value: fmtCr(eadCr), evidence: 'synthetic' },
        { label: 'Stressed PD / LGD', value: `${(stressedPd * 100).toFixed(1)}% / ${(stressedLgd * 100).toFixed(1)}%`, evidence: 'modelled' },
        { label: 'Stressed EL', value: fmtCr(stressedEl), evidence: 'modelled' },
      ],
    },
    insuranceAdjusted
      ? {
          kind: 'text',
          text: `Insured by ${insuranceAdjusted.insurer.label} — the modeled claim payout offsets ₹${insuranceAdjusted.insuranceOffsetCr.toFixed(2)} cr of loss, bringing the insurance-adjusted EL to ₹${insuranceAdjusted.effectiveEl.toFixed(2)} cr.`,
        }
      : inScenario
        ? { kind: 'text', text: 'No insurance coverage traced for this company — the full stressed loss above is uninsured.' }
        : evidenceNote('Insurance status not evaluated — this company is outside the current scenario.'),
    { kind: 'text', text: financiers.length ? `Financed by: ${financiers.map((f) => f.label).join(', ')}.` : 'No financier traced in the graph.' },
    {
      kind: 'actions',
      actions: [
        { id: 'select-company', label: 'Open full Company Investigation', kind: 'select-entity', entityId: company.id },
        { id: 'open-dependency-co', label: 'Trace it on the Dependency Explorer', kind: 'navigate', to: '/dependency' },
      ],
    },
  ]
}

/** "Compare Himachal Pradesh and Mumbai" — runs the identical engine under
 * matched dials for two named regions, so the comparison is apples-to-
 * apples rather than each region's own last-left scenario. */
export function answerCompareRegions(regionA: Region, regionB: Region, p: ScenarioParams): CopilotBlock[] {
  const common = { severity: p.severity, durationMonths: p.durationMonths, substitutability: p.substitutability, interventions: [] as string[] }
  const a = computeImpact({ ...common, region: regionA })
  const b = computeImpact({ ...common, region: regionB })
  const gapA = computeProtectionGap(REGION_HAZARD[regionA], p.severity, p.durationMonths)
  const gapB = computeProtectionGap(REGION_HAZARD[regionB], p.severity, p.durationMonths)
  const worse = a.stressedEl >= b.stressedEl ? regionA : regionB

  return [
    {
      kind: 'heading',
      text: `${REGION_LABEL[regionA]} vs ${REGION_LABEL[regionB]} — same dials (severity ${p.severity}/100, ${p.durationMonths}mo, ${p.substitutability})`,
    },
    {
      kind: 'table',
      headers: ['', REGION_LABEL[regionA], REGION_LABEL[regionB]],
      rows: [
        ['Companies reached', String(a.companyCount), String(b.companyCount)],
        ['EAD at risk', fmtCr(a.eadCr), fmtCr(b.eadCr)],
        ['Stressed EL', fmtCr(a.stressedEl), fmtCr(b.stressedEl)],
        ['Protection gap', `${(gapA.protectionGapShare * 100).toFixed(0)}%`, `${(gapB.protectionGapShare * 100).toFixed(0)}%`],
      ],
    },
    {
      kind: 'text',
      text: `${REGION_LABEL[worse]} shows the higher stressed loss under this common stress test — both sides computed from the identical formula and dials, so the comparison isn't an artifact of different assumptions.`,
    },
    {
      kind: 'actions',
      actions: [
        { id: 'cmp-a', label: `Open ${REGION_LABEL[regionA]} in Scenario Lab`, kind: 'navigate', to: '/scenario', region: regionA },
        { id: 'cmp-b', label: `Open ${REGION_LABEL[regionB]} in Scenario Lab`, kind: 'navigate', to: '/scenario', region: regionB },
      ],
    },
  ]
}

/** Reverse stress test — "what severity would it take to lose ₹500 cr in
 * Himachal Pradesh." Binary search over the existing engine
 * (lib/reverseStressTest.ts), not a new model — the feature identified by
 * reviewing shreyascoder2006/fusion_earth's own plan doc, which listed
 * this as a P2 item it never built. */
export function answerReverseStressTest(region: Region, targetLossCr: number, p: ScenarioParams): CopilotBlock[] {
  const result = findBreachingSeverity(region, targetLossCr, p.durationMonths, p.substitutability)
  return [
    { kind: 'heading', text: `Reverse stress test — ${REGION_LABEL[region]}` },
    {
      kind: 'text',
      text:
        result.breachingSeverity !== null
          ? `A stressed EL of ₹${targetLossCr.toFixed(0)} cr or more is first reached at severity ${result.breachingSeverity}/100 (holding duration at ${p.durationMonths} months, substitutability ${p.substitutability}).`
          : `Even at maximum severity (100/100, ${p.durationMonths} months, ${p.substitutability}), stressed EL only reaches ₹${result.lossAtMaxSeverity.toFixed(1)} cr — this threshold isn't reachable at these dials. Try a longer duration or lower substitutability.`,
    },
    {
      kind: 'statRow',
      stats: [
        { label: 'Target loss', value: fmtCr(targetLossCr), evidence: 'assumption' },
        { label: 'Breaching severity', value: result.breachingSeverity !== null ? `${result.breachingSeverity}/100` : 'Not reachable', evidence: 'modelled' },
        { label: 'Loss at severity 100', value: fmtCr(result.lossAtMaxSeverity), evidence: 'modelled' },
      ],
    },
    {
      kind: 'text',
      text: 'Found by binary search over the same engine every other page uses (computeImpact) — a real search, not a lookup table.',
    },
    { kind: 'actions', actions: result.breachingSeverity !== null ? [{ id: 'rst-apply', label: 'Apply this severity in Scenario Lab', kind: 'apply-scenario', region, severity: result.breachingSeverity, durationMonths: p.durationMonths, substitutability: p.substitutability }] : [] },
  ]
}

export function answerMethodology(): CopilotBlock[] {
  return [
    { kind: 'heading', text: 'How these numbers are actually calculated' },
    { kind: 'text', text: "Every figure in CLIMATRIX traces to one of these disclosed formulas — nothing is a black-box score, and I'll never show a number the dashboard can't reproduce." },
    {
      kind: 'bullets',
      items: [
        'Stressed PD/LGD: baseline PD/LGD scaled by (severity/100) × sector vulnerability × substitutability multiplier × duration factor — stressPdLgd() in useScenarioStore.ts.',
        'Expected credit loss: EAD × stressed PD × stressed LGD, summed per company — never a blended portfolio average.',
        'Protection gap: of every company a scenario reaches, the EAD share with zero INSURED_BY edge in the graph.',
        'Insurance claim estimate: sum insured × severity-scaled disruption fraction, net of deductible — the same mechanic the equity lens uses for revenue-at-risk.',
        'Parametric trigger: a fixed payout once severity crosses a disclosed threshold, exactly ₹0 one point under it — real basis risk, not a smoothed curve.',
        'Sector vulnerability multiplier: a disclosed table (Tourism 1.45×, Agriculture 1.35× … IT/BPO 0.5×) — an assumption, not a calibrated empirical result.',
      ],
    },
    {
      kind: 'text',
      text: 'See Evidence & Reports for the full sourced/modelled/assumption/synthetic breakdown, or open the Dependency Explorer and expand "Show the math" for a live step-by-step trace on the top company in your current scenario.',
    },
    { kind: 'actions', actions: [{ id: 'open-evidence-method', label: 'Open Evidence & Reports', kind: 'navigate', to: '/evidence' }] },
  ]
}

/** Backend bridge #1 — real TF-IDF semantic search (scikit-learn) over
 * whatever news/evidence the backend has already fetched, instead of the
 * Copilot staying 100% frontend-only. Fails honestly if the backend isn't
 * running, matching every connector's own "never fake success" pattern. */
export async function answerBackendNewsSearch(query: string): Promise<CopilotBlock[]> {
  try {
    const result = await semanticSearch(query, 'news', 5)
    if (!result.hits.length) {
      return [
        {
          kind: 'text',
          text: `No semantically similar news found for "${query}" among articles already fetched. Try Evidence & Reports' live news panel first to pull in fresh articles, then ask again.`,
        },
      ]
    }
    return [
      { kind: 'heading', text: `Semantic search — "${query}"` },
      {
        kind: 'rankedList',
        title: 'Most topically similar (not just keyword match)',
        rows: result.hits.map((h, i) => ({ rank: i + 1, label: h.title, value: `${(h.score * 100).toFixed(0)}% match`, sub: h.kind, evidence: 'sourced' as const })),
      },
      { kind: 'text', text: `Backend TF-IDF + cosine similarity (${result.method}) — ranks by topic, so "crop failure" surfaces a drought article even without an exact keyword match.` },
    ]
  } catch {
    return [{ kind: 'text', text: 'Backend not reachable for semantic search — make sure the FastAPI server is running (see backend/README.md).' }]
  }
}

/** Backend bridge #2 — real scikit-learn anomaly detection (rolling
 * z-score + IsolationForest) over this region's actual NASA POWER/
 * Open-Meteo history, live from the backend built for exactly this. */
export async function answerWeatherAnomaly(region: Region): Promise<CopilotBlock[]> {
  const hazard = NODES.find((n) => n.id === REGION_HAZARD[region])
  if (!hazard?.coords) return [{ kind: 'text', text: "No coordinates traced for this region's hazard node." }]
  try {
    const result = await getWeatherAnomalies(hazard.coords[1], hazard.coords[0], 60)
    const anomalies = result.points.filter((p) => p.is_anomaly)
    return [
      { kind: 'heading', text: `Weather anomaly check — ${REGION_LABEL[region]}` },
      {
        kind: 'stat',
        label: anomalies.length ? `${anomalies.length} anomalous day(s) found` : 'No anomalies found',
        value: `${result.points.length} days scanned`,
        evidence: 'modelled',
      },
      ...(anomalies.length
        ? [
            {
              kind: 'bullets',
              items: anomalies.slice(0, 5).map((a) => `${a.date}: ${a.value.toFixed(1)}mm — z=${a.z_score.toFixed(1)} vs. this location's own baseline of ${a.baseline_mean.toFixed(1)}mm`),
            } as CopilotBlock,
          ]
        : []),
      { kind: 'text', text: result.method_note },
    ]
  } catch {
    return [{ kind: 'text', text: 'Backend not reachable for live weather anomaly detection — make sure the FastAPI server is running on :8000.' }]
  }
}

export function answerHelp(): CopilotBlock[] {
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
        'Set severity to 85 and duration to 9 months.',
        "What's the exposure for Kullu Apple Growers Federation?",
        'Compare Himachal Pradesh and Kerala.',
        'How is expected credit loss actually calculated?',
        'Has anything anomalous happened with the weather in Himachal Pradesh?',
        'What severity would it take to breach ₹500 cr in losses here?',
        'Search news about drought in Marathwada.',
        'Which of my investments are exposed to risky transport routes in Himachal Pradesh?',
        'Which exposures may be uninsured or underinsured?',
        'What is the RBI compliance angle here?',
        'Guide me to the map and show live movement for Mumbai.',
        'Generate a portfolio risk brief.',
      ],
    },
  ]
}
