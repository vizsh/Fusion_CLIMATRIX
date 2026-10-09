// CLIMATRIX AI Copilot — the closed intent list + dispatcher shared by
// BOTH understanding paths: respond.ts's regex rules (free, instant, the
// primary path) and ollamaClient.ts's local-model fallback classifier
// (used only when the rules don't confidently match). Each intent maps
// 1:1 to a function in answers.ts, which calls the exact same
// deterministic graph/financial/insurance engine the dashboard pages use
// — the model's only job, when it's consulted at all, is picking ONE
// name from this list, never computing or writing the answer itself.

import { downloadBrief, downloadPortfolioBrief, generatePortfolioOverview, generateWhatIf } from './engine'
import {
  answerBrief,
  answerClimateNews,
  answerCompliance,
  answerDependency,
  answerExposure,
  answerFinancial,
  answerGoToMap,
  answerInsurance,
  answerPortfolio,
  answerRoutes,
  answerRunSimulation,
  answerWhatIf,
} from './answers'
import { answerTour } from './tours'
import { resolveScenario, type Horizon } from './params'
import type { Region, ScenarioState } from '../../store/useScenarioStore'
import { REGION_LABEL } from '../../store/useScenarioStore'
import type { CopilotBlock } from './types'

export type IntentId =
  | 'exposure'
  | 'dependency'
  | 'current_conditions'
  | 'whatif'
  | 'portfolio'
  | 'financial'
  | 'insurance'
  | 'compliance'
  | 'brief'
  | 'map'
  | 'simulate'
  | 'tour'
  | 'routes'

/** One short line per intent — this whole menu is what gets sent to the
 * local classifier, Jarvis-style (INTENT_DOC in its assistant.py): compact
 * on purpose, since every extra word here is extra input tokens on every
 * single fallback call. */
export const INTENT_MENU: Record<IntentId, string> = {
  exposure: 'which holdings/investments are exposed to a climate hazard in one region, or what is at risk there',
  dependency: 'shared transport/supplier/infrastructure routes or bottlenecks in one region',
  current_conditions: 'what is happening right now / current conditions in one region',
  whatif: 'a hypothetical, worst-case, or "what if X happens" scenario in one region; testing scenarios automatically',
  portfolio: 'the whole portfolio across ALL regions at once, not scoped to one place',
  financial: 'earnings, cash flow, valuation, or credit-loss impact of a scenario',
  insurance: 'insurance coverage, protection gap, underinsured or uninsured exposure',
  compliance: 'RBI or other regulatory/compliance context',
  brief: 'generate or download a report/brief',
  map: 'go to the live 3D map, or watch live movement of a scenario',
  simulate: 'run or start the simulation clock',
  tour: 'a guided tour of the whole app, or "what can this app do"',
  routes: 'freight/supply-chain routes (trucks, ports), which route a holding depends on, or route-level risk',
}

export interface IntentParams {
  region?: Region
  horizon?: Horizon
}

export function runIntent(intent: IntentId, params: IntentParams, state: ScenarioState): CopilotBlock[] {
  const p = resolveScenario({ region: params.region }, state)
  const region = p.region
  switch (intent) {
    case 'exposure':
      return answerExposure(p)
    case 'dependency':
      return answerDependency(region)
    case 'current_conditions':
      return answerClimateNews(p)
    case 'whatif':
      return answerWhatIf(region, params.horizon ?? 'medium')
    case 'portfolio':
      return answerPortfolio()
    case 'financial':
      return answerFinancial(p)
    case 'insurance':
      return answerInsurance(p)
    case 'compliance':
      return answerCompliance()
    case 'brief':
      return answerBrief(region)
    case 'map':
      return answerGoToMap(region)
    case 'simulate':
      return answerRunSimulation(p)
    case 'tour':
      return answerTour()
    case 'routes':
      return answerRoutes(p)
  }
}

export { REGION_LABEL, downloadBrief, downloadPortfolioBrief, generatePortfolioOverview, generateWhatIf }
