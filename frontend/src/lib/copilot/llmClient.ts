// CLIMATRIX AI Copilot — the genuine-understanding path.
//
// This drives an actual agentic tool-use loop against Claude (via the
// backend proxy in backend/app/api/copilot.py): the model reads the
// user's message — including indirect phrasing, compound questions,
// follow-ups referencing earlier turns, synonyms it was never explicitly
// coded to match — and decides which deterministic tool(s) in tools.ts to
// call and with what parameters. Tool results (always real numbers from
// the same engine the dashboard uses) are fed back to the model, which
// can call further tools (compound questions: "what if X, and is it
// insured, and what's the compliance angle" can resolve in one turn) or
// give a final natural-language answer. The model NEVER sees raw
// permission to state a number itself — every figure in tool results is
// pre-computed, and the system prompt instructs it to defer to those.
//
// Falls back to respond.ts's regex parser automatically (see
// CopilotPanel.tsx) if the backend is unreachable or no API key is
// configured — degraded understanding, but the Copilot still answers.

import { getCopilotStatus, postCopilotChat } from '../api'
import { REGION_LABEL, type ScenarioState } from '../../store/useScenarioStore'
import { executeTool, TOOL_DEFS } from './tools'
import type { CopilotBlock } from './types'

export type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown }

let availability: Promise<boolean> | null = null

/** Cached for the session — avoids a round trip before every single
 * message once we know whether a key is configured. */
export function isLLMAvailable(): Promise<boolean> {
  if (!availability) {
    availability = getCopilotStatus()
      .then((r) => r.configured)
      .catch(() => false)
  }
  return availability
}

function systemPrompt(state: ScenarioState): string {
  return [
    'You are the CLIMATRIX India AI Copilot: a climate-risk investment analyst embedded in a working financial dashboard, not a general chatbot.',
    'The dashboard models five Indian regions (HP=Himachal Pradesh, KL=Kerala, MH=Marathwada agricultural/drought belt, UK=Uttarakhand Chamoli-Joshimath corridor, MB=Mumbai Metropolitan Region) as a graph of climate hazards, infrastructure, suppliers, companies, banks and insurers.',
    '',
    'Hard rules:',
    '1. You must NEVER state a financial figure, exposure number, percentage, or risk ranking from your own reasoning. Every number in your answer must come from a tool result. If no tool covers what the user asked, say so honestly instead of estimating.',
    '2. Understand indirect and compound questions. "What if Mumbai floods, how does that hit my book" means: call run_what_if_scenario(region=MB). A question touching several topics (exposure AND insurance AND compliance) may call multiple tools in one turn.',
    '3. A city not in the modeled list (e.g. Chennai, Bengaluru, Delhi, Hyderabad, Kolkata, Ahmedabad) is NOT covered — say so plainly and suggest the nearest modeled region instead of silently picking one.',
    '4. "My portfolio" / "all my holdings" / unscoped risk questions -> get_portfolio_overview (all regions at once). A question naming or implying one specific region -> the region-scoped tools.',
    '5. Keep your final written answer tight: 2-4 sentences synthesizing what the tool(s) found and directly answering the question. The tool results already render as rich cards below your text — don’t re-list every number, just give the headline takeaway and any direct recommendation.',
    '6. If the user asks to see something on the map, watch live movement, or run/simulate a scenario, use go_to_live_map or run_simulation — don’t just describe it.',
    '',
    `Current dashboard state: region=${state.region} (${REGION_LABEL[state.region]}), hazard=${state.hazard}, severity=${state.severity}/100, duration=${state.durationMonths}mo, substitutability=${state.substitutability}, lens=${state.userMode}. Tool calls that omit a parameter use this live state as the default.`,
  ].join('\n')
}

export interface AgentTurnResult {
  blocks: CopilotBlock[]
  history: AnthropicMessage[]
}

const MAX_TOOL_ITERATIONS = 5

/** Runs one full user turn, including however many tool calls the model
 * decides it needs, and returns the rendered blocks plus the updated
 * message history to pass into the next turn (so follow-ups keep
 * context). Throws on any backend/network failure — CopilotPanel catches
 * this and falls back to respond.ts. */
export async function runAgentTurn(userText: string, state: ScenarioState, priorHistory: AnthropicMessage[]): Promise<AgentTurnResult> {
  const messages: AnthropicMessage[] = [...priorHistory, { role: 'user', content: userText }]
  const gatheredBlocks: CopilotBlock[][] = []
  let finalText = ''

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await postCopilotChat({
      system: systemPrompt(state),
      messages,
      tools: TOOL_DEFS,
    })

    messages.push({ role: 'assistant', content: response.content })

    const toolUses = (response.content as any[]).filter((b) => b.type === 'tool_use')
    const textParts = (response.content as any[]).filter((b) => b.type === 'text').map((b) => b.text)
    if (textParts.length) finalText = textParts.join('\n\n')

    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      break
    }

    const toolResults = toolUses.map((call) => {
      const { blocks, summary } = executeTool(call.name, call.input ?? {}, state)
      gatheredBlocks.push(blocks)
      return { type: 'tool_result', tool_use_id: call.id, content: summary }
    })
    messages.push({ role: 'user', content: toolResults })
  }

  const blocks: CopilotBlock[] = []
  if (finalText) blocks.push({ kind: 'text', text: finalText })
  // Each tool's own block set already carries its relevant action
  // buttons, so a compound question that called two tools simply shows
  // two sections, each with its own actions — no separate consolidation
  // needed.
  for (const set of gatheredBlocks) blocks.push(...set)

  if (!blocks.length) {
    blocks.push({ kind: 'text', text: "I wasn't able to find a relevant tool for that — try rephrasing, or ask about exposure, scenarios, insurance, compliance or your portfolio." })
  }

  return { blocks, history: messages }
}
