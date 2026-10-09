// CLIMATRIX AI Copilot — tool definitions for the LLM understanding path.
//
// Each tool maps 1:1 to a function in answers.ts, which calls the exact
// same deterministic graph/financial/insurance engine the dashboard pages
// use. The model's job is ONLY to decide which tool(s) answer the user's
// question and with what parameters — it never receives raw financial
// data to reason about free-form, and the numbers in the final answer
// always come from these tool results, not from the model's own text.

import { ALL_REGIONS, downloadPortfolioBrief, downloadBrief, generatePortfolioOverview, generateWhatIf } from './engine'
import {
  answerBrief,
  answerClimateNews,
  answerCompliance,
  answerDependency,
  answerExposure,
  answerFinancial,
  answerGoToMap,
  answerInsurance,
  answerInstitution,
  answerPortfolio,
  answerRunSimulation,
  answerWhatIf,
} from './answers'
import { resolveScenario } from './params'
import type { Region, ScenarioState, Substitutability } from '../../store/useScenarioStore'
import { REGION_LABEL } from '../../store/useScenarioStore'
import type { CopilotBlock } from './types'

const REGION_ENUM = ALL_REGIONS
const INSTITUTIONS = [
  { id: 'bank-1', name: 'Bank of Bharat' },
  { id: 'bank-2', name: 'Union Pradesh Bank' },
  { id: 'bank-3', name: 'Kerala Gramin Bank' },
  { id: 'nbfc-1', name: 'Deccan Rural Finance NBFC' },
  { id: 'govt-1', name: 'National Infrastructure Resilience Fund' },
  { id: 'govt-2', name: 'State Disaster Recovery Fund — HP' },
  { id: 'insurer-1', name: 'Bharat General Insurance Co.' },
  { id: 'insurer-2', name: 'PMFBY — Pradhan Mantri Fasal Bima Yojana' },
]

const regionProp = {
  type: 'string',
  enum: REGION_ENUM,
  description: `Which modeled region. HP=Himachal Pradesh, KL=Kerala, MH=Marathwada agricultural/drought belt, UK=Uttarakhand Chamoli-Joshimath corridor, MB=Mumbai Metropolitan Region. Omit to use whatever region is currently active on the dashboard.`,
}
const scenarioDialProps = {
  region: regionProp,
  severity: { type: 'number', description: 'Hazard severity dial, 0-100. A UI stress input, NOT a probability or measured flood depth. Omit to use the active dashboard value.' },
  durationMonths: { type: 'number', description: 'Disruption horizon in months (0-12). Omit to use the active dashboard value.' },
  substitutability: { type: 'string', enum: ['Limited', 'Moderate', 'Strong'], description: 'How easily disrupted suppliers/routes can be substituted. Omit to use the active dashboard value.' },
}

export const TOOL_DEFS = [
  {
    name: 'get_regional_exposure',
    description:
      'Which holdings/companies are exposed to a climate hazard in one region, broken down by sector, plus shared infrastructure/supplier bottlenecks. Use for direct "which investments are exposed" or "what is at risk in X" questions.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
  {
    name: 'get_dependency_bottlenecks',
    description: 'Shared transport/supplier/infrastructure nodes in one region whose disruption reaches multiple holdings at once — the "hidden concentration" / single-point-of-failure view. Use for questions about routes, suppliers, bridges, roads, bottlenecks.',
    input_schema: { type: 'object', properties: { region: regionProp } },
  },
  {
    name: 'get_current_conditions',
    description: 'The documented historical hazard window for a region and a pointer to the live weather/news connector panels. Use for "what is happening right now" / current-conditions questions.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
  {
    name: 'run_what_if_scenario',
    description:
      'The core autonomous multi-scenario engine for ONE region: generates several plausible hazard scenarios (facility-level / severe regional / severe+supply-chain / compound-prolonged), runs each through the financial engine, and ranks them by highest loss, highest likelihood, highest priority and highest cumulative exposure. Use for ANY "what if X happens in region Y" question, hypotheticals, worst-case questions, or requests to compare/test scenarios automatically — regardless of how the user phrases the hazard (flood, cyclone, disaster, disruption, etc. all map to this region\'s modeled hazard).',
    input_schema: {
      type: 'object',
      properties: {
        region: regionProp,
        horizon: { type: 'string', enum: ['near', 'medium', 'long', 'both'], description: 'Time horizon framing. Default medium (1-3 years) if not specified.' },
      },
      required: ['region'],
    },
  },
  {
    name: 'get_portfolio_overview',
    description:
      'Autonomous whole-portfolio scan: runs a common stress test across ALL five modeled regions at once, ranks them against each other, and finds cross-portfolio hidden concentration. Use whenever the user asks about "my portfolio", "all my investments/holdings", overall/total risk, or any question that is not scoped to one specific region.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_financial_transmission',
    description: 'Baseline vs. stressed expected credit loss (ECL = EAD × PD × LGD) for one region\'s scenario, with a sensitivity band. Use for earnings/cash-flow/valuation/credit-loss questions.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
  {
    name: 'get_insurance_protection_gap',
    description: 'Insurance coverage, protection gap (% of exposed EAD with zero coverage), and per-insurer book stress for one region\'s scenario. Use for insurance/coverage/underinsured/uninsured questions.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
  {
    name: 'get_compliance_context',
    description: 'RBI\'s own 2022 pilot climate stress-test (VAST) figures and how this prototype relates to real regulatory practice. Use for compliance/regulatory/RBI questions.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_institution_exposure',
    description: `A specific bank/NBFC/insurer/government fund's exposure to one region's hazard — intersects its borrower book with the hazard's reach. Valid institutionId values: ${INSTITUTIONS.map((i) => `${i.id} (${i.name})`).join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        institutionId: { type: 'string', enum: INSTITUTIONS.map((i) => i.id) },
        region: regionProp,
      },
      required: ['institutionId'],
    },
  },
  {
    name: 'generate_brief',
    description: 'Prepares a downloadable report. Use regional=true with a region for one scenario\'s brief, or portfolio=true for the whole-portfolio brief.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['region', 'portfolio'] },
        region: regionProp,
      },
      required: ['scope'],
    },
  },
  {
    name: 'go_to_live_map',
    description:
      'Navigates the user to the Digital Twin (3D map) for a region AND starts the live simulation clock, so hazard/infrastructure/holdings animate in real time. Use whenever the user asks to see the map, be guided somewhere visual, or watch "live movement" of their investments.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
  {
    name: 'run_simulation',
    description: 'Starts the scenario simulation clock without necessarily navigating anywhere new — use when the user explicitly asks to "run" or "simulate" the current/a scenario.',
    input_schema: { type: 'object', properties: scenarioDialProps },
  },
]

export interface ToolExecutionResult {
  /** Rich UI blocks shown to the user, reusing the exact same renderer as
   * the rule-based path. */
  blocks: CopilotBlock[]
  /** A compact, numbers-only text digest sent back to the model as the
   * tool_result — lets the model reference figures in its closing message
   * or decide to call another tool, without re-deriving anything. */
  summary: string
}

function summarize(blocks: CopilotBlock[]): string {
  const lines: string[] = []
  for (const b of blocks) {
    if (b.kind === 'heading') lines.push(`## ${b.text}`)
    else if (b.kind === 'text') lines.push(b.text)
    else if (b.kind === 'stat') lines.push(`${b.label}: ${b.value}${b.sub ? ` (${b.sub})` : ''}`)
    else if (b.kind === 'statRow') lines.push(b.stats.map((s) => `${s.label}: ${s.value}`).join(' | '))
    else if (b.kind === 'bullets') lines.push(...b.items.map((i) => `- ${i}`))
    else if (b.kind === 'rankedList') {
      lines.push(`${b.title}:`)
      lines.push(...b.rows.map((r) => `  ${r.rank}. ${r.label} — ${r.value} (${r.sub}) [${r.evidence}]`))
    } else if (b.kind === 'table') {
      lines.push(b.headers.join(' | '))
      lines.push(...b.rows.map((r) => r.join(' | ')))
    }
  }
  return lines.join('\n')
}


export function executeTool(name: string, input: Record<string, unknown>, state: ScenarioState): ToolExecutionResult {
  const p = resolveScenario(
    {
      region: input.region as Region | undefined,
      severity: input.severity as number | undefined,
      durationMonths: input.durationMonths as number | undefined,
      substitutability: input.substitutability as Substitutability | undefined,
    },
    state,
  )
  const region = p.region

  let blocks: CopilotBlock[]
  switch (name) {
    case 'get_regional_exposure':
      blocks = answerExposure(p)
      break
    case 'get_dependency_bottlenecks':
      blocks = answerDependency(region)
      break
    case 'get_current_conditions':
      blocks = answerClimateNews(p)
      break
    case 'run_what_if_scenario':
      blocks = answerWhatIf(region, (input.horizon as 'near' | 'medium' | 'long' | 'both') ?? 'medium')
      break
    case 'get_portfolio_overview':
      blocks = answerPortfolio()
      break
    case 'get_financial_transmission':
      blocks = answerFinancial(p)
      break
    case 'get_insurance_protection_gap':
      blocks = answerInsurance(p)
      break
    case 'get_compliance_context':
      blocks = answerCompliance()
      break
    case 'get_institution_exposure': {
      const result = answerInstitution(String(input.institutionId ?? ''), region)
      blocks = result ?? [{ kind: 'text', text: 'Unknown institution id.' }]
      break
    }
    case 'generate_brief':
      blocks = input.scope === 'portfolio' ? [{ kind: 'actions', actions: [{ id: 'brief', label: 'Download portfolio risk brief', kind: 'download-portfolio-brief' }] }] : answerBrief(region)
      break
    case 'go_to_live_map':
      blocks = answerGoToMap(region)
      break
    case 'run_simulation':
      blocks = answerRunSimulation(p)
      break
    default:
      blocks = [{ kind: 'text', text: `Unknown tool: ${name}` }]
  }

  return { blocks, summary: summarize(blocks) }
}

// Re-exported for CopilotPanel's action executor, which needs the same
// download helpers the rule-based path uses.
export { downloadBrief, downloadPortfolioBrief, generatePortfolioOverview, generateWhatIf, REGION_LABEL }
