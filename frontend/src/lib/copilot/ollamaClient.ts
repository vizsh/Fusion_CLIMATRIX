// CLIMATRIX AI Copilot — local-model fallback classifier.
//
// Mirrors the architecture in vizsh/Jarvis_Hedge_Fund (agents/llm.py +
// backend/assistant.py's llm_intent): a LOCAL Ollama model is asked to
// pick exactly ONE intent from a closed list, via structured JSON output
// (Ollama's `format` schema parameter), never free-form prose. It is
// consulted ONLY when respond.ts's regex rules don't confidently match —
// most messages never reach this file at all. Token footprint per call:
// one short prompt (no system prompt, no conversation history, no tool
// schemas), one tiny JSON object back (intent + confidence) and nothing
// else. Region is deliberately NOT asked of the model: respond.ts's own
// regex alias list is a closed, exact lookup and is more reliable at
// that one job than an 8B model's guess — asking for it here would only
// add output tokens for a field the caller mostly overrides anyway. The
// model never computes or states a number — every figure still comes
// from tools.ts -> answers.ts calling the same engine the dashboard uses.

import { getCopilotStatus, postCopilotClassify } from '../api'
import { INTENT_MENU, type IntentId } from './tools'

let availability: Promise<{ available: boolean; model: string | null }> | null = null

/** Cached for the session. */
export function ollamaStatus() {
  if (!availability) {
    availability = getCopilotStatus().catch(() => ({ available: false, model: null }))
  }
  return availability
}

/** Fire-and-forget: loads the model into memory ahead of the first real
 * question, since a cold local model can take 30-60s on a CPU-only
 * machine (see backend/app/api/copilot.py) but a warm one answers in a
 * few seconds. Call once when the Copilot panel mounts. */
export function warmUpOllama() {
  ollamaStatus().then((s) => {
    if (!s.available || !s.model) return
    postCopilotClassify({
      model: s.model,
      prompt: 'Reply with {"ok": true}.',
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      max_tokens: 10,
    }).catch(() => {})
  })
}

export interface IntentPick {
  intent: IntentId
  confidence: number
}

const MIN_CONFIDENCE = 0.6

const MENU_TEXT = Object.entries(INTENT_MENU)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [...Object.keys(INTENT_MENU), 'none'] },
    confidence: { type: 'number' },
  },
  required: ['intent', 'confidence'],
}

/** Asks the local model to classify one message. Returns null on any
 * failure, low confidence, or "none" — the caller (respond.ts) then
 * falls back to its own best-effort answer rather than guessing further. */
export async function classifyIntent(text: string): Promise<IntentPick | null> {
  const status = await ollamaStatus()
  if (!status.available || !status.model) return null

  const prompt =
    `Classify this question about an Indian climate-risk investment dashboard into exactly one intent.\n` +
    `Intents:\n${MENU_TEXT}\n\n` +
    `Message: "${text}"\n` +
    `Return the best intent and your confidence from 0 to 1. If unclear, use intent "none".`

  let raw: { message?: { content?: string }; error?: string }
  try {
    raw = await postCopilotClassify({ model: status.model, prompt, schema: SCHEMA, max_tokens: 40 })
  } catch {
    return null
  }
  if (!raw?.message?.content) return null

  let parsed: { intent?: string; confidence?: number }
  try {
    parsed = JSON.parse(raw.message.content)
  } catch {
    return null
  }

  const intent = parsed.intent as IntentId | 'none' | undefined
  const confidence = Number(parsed.confidence ?? 0)
  if (!intent || intent === 'none' || !(intent in INTENT_MENU) || confidence < MIN_CONFIDENCE) return null

  return { intent, confidence }
}
