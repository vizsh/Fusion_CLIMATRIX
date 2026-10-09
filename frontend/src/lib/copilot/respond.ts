// CLIMATRIX AI Copilot — rule-based fallback parser.
//
// This path runs when the LLM understanding path (llmClient.ts, backed by
// a real Claude call with tool-use — see docs comment there) is
// unavailable: no backend reachable, or ANTHROPIC_API_KEY not configured.
// It is deliberately a regex/keyword matcher, NOT genuine language
// understanding — it will miss indirect phrasing, compound questions and
// anything that doesn't contain one of its trigger words. When the LLM
// path is available, CopilotPanel.tsx prefers it and only falls back to
// this parser on error, so the "just matches similar words" behavior only
// shows up when the Copilot is running without a configured model.
//
// Every handler it calls (answers.ts) still goes through the same
// deterministic engine the dashboard uses — only the PARSING here is
// unsophisticated, never the numbers.

import type { Region, ScenarioState } from '../../store/useScenarioStore'
import {
  answerBrief,
  answerClimateNews,
  answerCompliance,
  answerDependency,
  answerExposure,
  answerFinancial,
  answerGoToMap,
  answerHelp,
  answerInsurance,
  answerInstitution,
  answerPortfolio,
  answerRunSimulation,
  answerUnmappedCity,
  answerWhatIf,
  findInstitutionByName,
} from './answers'
import { detectHorizon, detectRegion, detectUnmappedCity, resolveScenario, type ScenarioParams } from './params'
import type { CopilotBlock } from './types'

interface Ctx {
  state: ScenarioState
}

export interface CopilotReply {
  blocks: CopilotBlock[]
}

function regionOrCurrent(text: string, ctx: Ctx): Region {
  return detectRegion(text) ?? ctx.state.region
}

function paramsFor(text: string, ctx: Ctx): ScenarioParams {
  return resolveScenario({ region: regionOrCurrent(text, ctx) }, ctx.state)
}

const RULES: { test: (t: string) => boolean; handler: (ctx: Ctx, t: string) => CopilotBlock[] | null }[] = [
  {
    test: (t) =>
      /guide me to the map|show me the map|take me to (the )?(digital )?twin|open (the )?(digital )?twin|open (the )?map|show (me )?(my )?(investment|portfolio)s?.{0,20}(live|moving|movement)/i.test(
        t,
      ),
    handler: (ctx, t) => answerGoToMap(regionOrCurrent(t, ctx)),
  },
  {
    test: (t) => /\brun (the )?simulation\b|\bsimulate (this|it|the scenario)\b|\bstart (the )?simulation\b/i.test(t),
    handler: (ctx, t) => answerRunSimulation(paramsFor(t, ctx)),
  },
  { test: (t) => /complian|regulat|rbi\b|vast (exercise|pilot)/i.test(t), handler: () => answerCompliance() },
  // Portfolio-WIDE overview only fires when no specific region is named —
  // "what if there's a flood in Mumbai, how will that affect my
  // portfolio" mentions "my portfolio" too, but clearly wants the Mumbai
  // scenario (that region's own share of total portfolio EAD is already
  // surfaced inside answerWhatIf).
  {
    test: (t) =>
      !detectRegion(t) &&
      /\bmy (entire |whole |overall )?portfolio\b|\ball my (investments|holdings)\b|portfolio.?wide|across (my|the) portfolio|overall (portfolio )?risk/i.test(t),
    handler: () => answerPortfolio(),
  },
  { test: (t) => /insur|protection gap|coverage|underinsured|uninsured/i.test(t), handler: (ctx, t) => answerInsurance(paramsFor(t, ctx)) },
  {
    test: (t) => /what.?if|worst case|compare scenario|multi.?scenario|automatically test/i.test(t),
    handler: (ctx, t) => answerWhatIf(regionOrCurrent(t, ctx), detectHorizon(t)),
  },
  { test: (t) => /brief|report|summary document/i.test(t), handler: (ctx, t) => answerBrief(regionOrCurrent(t, ctx)) },
  { test: (t) => /earning|cash flow|valuation|financial impact|credit loss|expected loss/i.test(t), handler: (ctx, t) => answerFinancial(paramsFor(t, ctx)) },
  { test: (t) => /route|transport|supplier|bridge|road|bottleneck|dependen/i.test(t), handler: (ctx, t) => answerDependency(regionOrCurrent(t, ctx)) },
  { test: (t) => /happening|current condition|weather|news|right now/i.test(t), handler: (ctx, t) => answerClimateNews(paramsFor(t, ctx)) },
  {
    test: (t) => !!findInstitutionByName(t),
    handler: (ctx, t) => {
      const inst = findInstitutionByName(t)
      return inst ? answerInstitution(inst.id, regionOrCurrent(t, ctx)) : null
    },
  },
  { test: (t) => /expos|vulnerab|risk(y)?\b|holding/i.test(t), handler: (ctx, t) => answerExposure(paramsFor(t, ctx)) },
]

export function respondTo(message: string, state: ScenarioState): CopilotReply {
  const text = message.trim()
  if (!text) return { blocks: answerHelp() }
  if (/^help$|what can you do|^hi$|^hello$/i.test(text)) return { blocks: answerHelp() }

  const ctx: Ctx = { state }

  // An unmapped city gets an honest disclosure before anything else —
  // never silently substitute the active region for a place the graph
  // doesn't actually model, even if a covered region is also mentioned.
  if (!detectRegion(text)) {
    const unmapped = detectUnmappedCity(text)
    if (unmapped) return { blocks: answerUnmappedCity(unmapped) }
  }

  for (const rule of RULES) {
    if (rule.test(text)) {
      const blocks = rule.handler(ctx, text)
      if (blocks) return { blocks }
    }
  }
  // Fallback: treat it as an exposure question about whatever region it
  // mentions (or the active one) — the single most generically useful
  // answer this unsophisticated parser can give.
  return { blocks: answerExposure(paramsFor(text, ctx)) }
}
