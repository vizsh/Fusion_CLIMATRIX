// CLIMATRIX AI Copilot — the main response path.
//
// Decision order (mirrors vizsh/Jarvis_Hedge_Fund's backend/assistant.py
// `detect()`/`aanswer()`):
//   1. Precise regex rules. Free, instant, trusted — most messages
//      resolve here with zero model call.
//   2. A LOCAL Ollama model (ollamaClient.ts) picks ONE intent from a
//      closed list, ONLY when no rule matched. It never writes the
//      answer or states a number — it just tells us which deterministic
//      function in answers.ts to call.
//   3. If neither is confident, a clarifying answer with suggested
//      next questions — asking beats guessing.
// Every number in every path comes from the same engine every dashboard
// page already uses.

import { classifyIntent } from './ollamaClient'
import {
  answerBackendNewsSearch,
  answerBrief,
  answerClimateNews,
  answerCompanyLookup,
  answerCompareRegions,
  answerCompliance,
  answerDependency,
  answerExposure,
  answerFinancial,
  answerGoToMap,
  answerHelp,
  answerInsurance,
  answerInstitution,
  answerMethodology,
  answerPortfolio,
  answerRunSimulation,
  answerSetScenario,
  answerUnmappedCity,
  answerWeatherAnomaly,
  answerWhatIf,
  findCompanyByName,
  findInstitutionByName,
} from './answers'
import { answerTour } from './tours'
import { runIntent } from './tools'
import {
  detectDurationMonths,
  detectHorizon,
  detectRegion,
  detectRegions,
  detectSeverity,
  detectSubstitutability,
  detectUnmappedCity,
  detectUserMode,
  resolveScenario,
  type ScenarioParams,
} from './params'
import type { Region, ScenarioState } from '../../store/useScenarioStore'
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
  // Imperative dial-setting checked FIRST — "set severity to 85" is a
  // command, not a question, and should win over any keyword overlap with
  // the exposure/insurance rules below (e.g. "set severity to 90 for the
  // insurance view" still just sets the dial).
  {
    test: (t) => detectSeverity(t) !== null || detectDurationMonths(t) !== null || detectSubstitutability(t) !== null || detectUserMode(t) !== null,
    handler: (ctx, t) => {
      const region = detectRegion(t)
      if (region) ctx.state.setRegion(region)
      return answerSetScenario(ctx.state, t)
    },
  },
  {
    test: (t) =>
      /guide me through|tour of (this|the) (app|prototype|platform)|show me around|what (can|does) (this|the) (app|prototype)\b.{0,20}\bdo\b|\ball (the )?features\b|\bwalk me through\b/i.test(
        t,
      ),
    handler: () => answerTour(),
  },
  {
    test: (t) => /how (is|are|does)\b.*\b(calculat|comput|deriv)|explain the formula|methodolog|what does severity mean/i.test(t),
    handler: () => answerMethodology(),
  },
  {
    test: (t) => (/\bcompar|\bvs\.?\b|\bversus\b|which (region|one) is (worse|riskier|safer|better)/i.test(t)) && detectRegions(t).length >= 2,
    handler: (ctx, t) => {
      const [a, b] = detectRegions(t)
      return answerCompareRegions(a, b, resolveScenario({ region: a }, ctx.state))
    },
  },
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
  { test: (t) => /insur|protection gap|coverage|underinsured|uninsured|\bcovered\b|\b(not|un)covered\b/i.test(t), handler: (ctx, t) => answerInsurance(paramsFor(t, ctx)) },
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
  {
    test: (t) => !!findCompanyByName(t),
    handler: (ctx, t) => {
      const company = findCompanyByName(t)
      return company ? answerCompanyLookup(company.id, paramsFor(t, ctx)) : null
    },
  },
  // Deliberately narrower than earlier drafts: a bare "risk" or "holding"
  // matched almost anything (including insurance/compliance questions
  // that happen to mention a holding), which is exactly the "matches a
  // similar word regardless of meaning" failure this Copilot is meant to
  // avoid. Unmatched messages fall through to the Ollama classifier
  // instead of a too-eager keyword grab.
  { test: (t) => /\bexpos(ed|ure)?\b|\bvulnerab\w*\b|\bat risk\b|\bwhich (of my )?(investments|holdings)\b/i.test(t), handler: (ctx, t) => answerExposure(paramsFor(t, ctx)) },
]

function matchRules(text: string, ctx: Ctx): CopilotBlock[] | null {
  for (const rule of RULES) {
    if (rule.test(text)) {
      const blocks = rule.handler(ctx, text)
      if (blocks) return blocks
    }
  }
  return null
}

function clarify(text: string): CopilotBlock[] {
  return [
    ...answerHelp(),
    { kind: 'suggestions', prompts: [text.length > 60 ? text.slice(0, 57) + '...' : text, 'Analyse my portfolio and give me the risks', 'Guide me through this app'] },
  ]
}

/** The main entry point. Async because step 2 (the local-model fallback)
 * is a network call — but step 1 (rules) resolves synchronously in
 * practice for most messages, so most calls return almost immediately
 * with zero model involvement. */
export async function respondTo(message: string, state: ScenarioState): Promise<CopilotReply> {
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

  // Backend-bridge intents — genuinely async (a live HTTP call to the
  // FastAPI backend's ML/NLP layer), so they're checked here rather than
  // through the synchronous RULES list. Specific enough phrasing that
  // they won't shadow the sync rules below for an ordinary question.
  if (/\banomal\w*|unusual weather|something changed|weird weather|weather (going|gone) wrong/i.test(text)) {
    return { blocks: await answerWeatherAnomaly(regionOrCurrent(text, ctx)) }
  }
  const semanticMatch = text.match(/\bsearch (?:news |evidence )?(?:for|about)\s+(.+)/i) ?? text.match(/\bfind (?:news|articles|evidence) (?:about|on)\s+(.+)/i)
  if (semanticMatch) {
    return { blocks: await answerBackendNewsSearch(semanticMatch[1].trim()) }
  }

  const ruleMatch = matchRules(text, ctx)
  if (ruleMatch) return { blocks: ruleMatch }

  const picked = await classifyIntent(text)
  if (picked) {
    // The model decides ONLY the intent; region comes from the regex
    // alias list (resolveScenario falls back to the active dashboard
    // region if neither names one) — more reliable than an 8B model's
    // guess, and cheaper (see ollamaClient.ts).
    return { blocks: runIntent(picked.intent, { region: detectRegion(text), horizon: detectHorizon(text) }, state) }
  }

  // Neither a rule nor the local model was confident — ask rather than
  // guess, with the clearest fallback (exposure) still offered via
  // suggestions, not presented as if it answered the question.
  return { blocks: clarify(text) }
}
