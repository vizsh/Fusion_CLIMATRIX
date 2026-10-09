// CLIMATRIX AI Copilot — the natural-language interface to the platform.
// Operates the dashboard (navigates, loads a scenario, downloads a brief)
// rather than only describing it, per the product brief: "the chatbot can
// operate the dashboard, and the dashboard can be used without the
// chatbot. They should never maintain separate calculations or
// conflicting results." Every figure it shows comes from respond.ts
// calling the exact same engine the dashboard pages call.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Radar, Send, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScenarioStore } from '../../store/useScenarioStore'
import { downloadBrief, downloadPortfolioBrief, generatePortfolioOverview, generateWhatIf } from '../../lib/copilot/engine'
import { isLLMAvailable, runAgentTurn, type AnthropicMessage } from '../../lib/copilot/llmClient'
import { respondTo } from '../../lib/copilot/respond'
import type { CopilotAction, CopilotTurn } from '../../lib/copilot/types'
import { CopilotBlockView } from './CopilotBlocks'

const SUGGESTIONS = [
  'Analyse my portfolio and give me the risks',
  "What if there's a severe flood in Mumbai?",
  'Guide me to the map and show live movement',
  'Which exposures may be uninsured?',
]

let turnSeq = 0
function nextId() {
  turnSeq += 1
  return `t${turnSeq}-${Date.now()}`
}

export default function CopilotPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<CopilotTurn[]>([
    {
      id: nextId(),
      role: 'assistant',
      blocks: [
        { kind: 'heading', text: 'CLIMATRIX AI Copilot' },
        {
          kind: 'text',
          text: "Ask me to analyse your whole portfolio, run a what-if scenario anywhere in the graph, check insurance or compliance, or guide you to the live map. I read and operate the same live scenario state as the dashboard — nothing I say will disagree with what's on screen, and I never invent a number.",
        },
      ],
    },
  ])
  const [llmReady, setLlmReady] = useState<boolean | null>(null)
  const [thinking, setThinking] = useState(false)
  const historyRef = useRef<AnthropicMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const state = useScenarioStore()

  useEffect(() => {
    isLLMAvailable().then(setLlmReady)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, open, thinking])

  function applyDials(action: CopilotAction) {
    if (action.region) state.setRegion(action.region)
    if (action.severity !== undefined) state.setSeverity(action.severity)
    if (action.durationMonths !== undefined) state.setDuration(action.durationMonths)
    if (action.substitutability) state.setSubstitutability(action.substitutability)
  }

  function runAction(action: CopilotAction) {
    switch (action.kind) {
      case 'navigate':
        if (action.region) state.setRegion(action.region)
        if (action.to) navigate(action.to)
        break
      case 'apply-scenario':
        applyDials(action)
        navigate('/scenario')
        break
      case 'go-to-map':
        // Navigate AND start the simulation clock — "guide me to the map
        // and show me live movement" in one click, per the brief's request
        // that the chatbot operate the dashboard, not just describe it.
        applyDials(action)
        navigate('/twin')
        state.run()
        break
      case 'run-simulation':
        applyDials(action)
        state.run()
        break
      case 'download-brief':
        if (action.briefRegion) downloadBrief(generateWhatIf(action.briefRegion, 'medium'))
        break
      case 'download-portfolio-brief':
        downloadPortfolioBrief(generatePortfolioOverview())
        break
      case 'select-entity':
        if (action.entityId) state.setSelectedEntity(action.entityId)
        break
    }
  }

  async function send(raw?: string) {
    const text = (raw ?? input).trim()
    if (!text || thinking) return
    setInput('')
    const userTurn: CopilotTurn = { id: nextId(), role: 'user', text }
    setTurns((prev) => [...prev, userTurn])

    if (llmReady) {
      setThinking(true)
      try {
        const result = await runAgentTurn(text, state, historyRef.current)
        historyRef.current = result.history
        setTurns((prev) => [...prev, { id: nextId(), role: 'assistant', blocks: result.blocks }])
      } catch {
        // Backend unreachable or the request failed mid-flight — fall back
        // to the rule-based parser for just this message rather than
        // leaving the user with no answer, and flag the degraded mode.
        const reply = respondTo(text, state)
        setTurns((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            blocks: [
              { kind: 'text', text: '(The AI understanding service is unreachable right now — answering with the rule-based fallback instead.)' },
              ...reply.blocks,
            ],
          },
        ])
      } finally {
        setThinking(false)
      }
      return
    }

    const reply = respondTo(text, state)
    setTurns((prev) => [...prev, { id: nextId(), role: 'assistant', blocks: reply.blocks }])
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-cyan/40 bg-panel px-4 py-3 shadow-[0_0_0_4px_rgba(34,211,238,0.06)] transition-transform hover:scale-105"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
            </span>
            <Radar size={16} className="text-cyan" />
            <span className="font-mono text-[10.5px] tracking-wide text-slate-200">AI COPILOT</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-5 right-5 z-40 flex h-[640px] w-[420px] max-h-[85vh] flex-col overflow-hidden rounded-xl border border-line bg-panel/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line bg-panel-2/70 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded border border-cyan/30 bg-cyan/[0.1]">
                  <Radar size={12} className="text-cyan" />
                </div>
                <div>
                  <div className="font-mono text-[11px] font-semibold tracking-wide text-white">CLIMATRIX COPILOT</div>
                  <div className="font-mono text-[8.5px] tracking-wide text-slate-500">TOOL-USING · SAME ENGINE AS DASHBOARD</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  title={
                    llmReady
                      ? 'Genuine language understanding via Claude tool-use — numbers still come from the dashboard engine, never the model.'
                      : 'Rule-based keyword fallback — set ANTHROPIC_API_KEY in backend/.env for full language understanding.'
                  }
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[8.5px] tracking-wide ${
                    llmReady === null
                      ? 'border-line text-slate-600'
                      : llmReady
                        ? 'border-cyan/40 bg-cyan/10 text-cyan'
                        : 'border-risk-med/40 bg-risk-med/10 text-risk-med'
                  }`}
                >
                  <Sparkles size={9} />
                  {llmReady === null ? 'CHECKING' : llmReady ? 'AI UNDERSTANDING' : 'RULE-BASED'}
                </span>
                <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:bg-panel-2 hover:text-slate-200">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
              {turns.map((turn) =>
                turn.role === 'user' ? (
                  <div key={turn.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg rounded-tr-sm bg-cyan/15 px-3 py-2 text-[12.5px] text-cyan-50">
                      {turn.text}
                    </div>
                  </div>
                ) : (
                  <div key={turn.id} className="flex justify-start">
                    <div className="max-w-[92%] space-y-2 rounded-lg rounded-tl-sm border border-line bg-panel-2/50 px-3 py-2.5">
                      {turn.blocks?.map((b, i) => (
                        <CopilotBlockView key={i} block={b} onAction={runAction} onSuggest={(t) => send(t)} />
                      ))}
                    </div>
                  </div>
                ),
              )}
              {thinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-lg rounded-tl-sm border border-line bg-panel-2/50 px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan/70 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan/70 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan/70" />
                  </div>
                </div>
              )}
            </div>

            {turns.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 border-t border-line px-3.5 py-2.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-panel-2/60 px-2.5 py-1 text-left font-mono text-[9.5px] leading-tight text-slate-400 hover:border-cyan/30 hover:text-cyan"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex shrink-0 items-center gap-2 border-t border-line bg-panel-2/40 px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={thinking}
                placeholder={thinking ? 'Thinking…' : 'Ask about exposure, scenarios, insurance…'}
                className="flex-1 bg-transparent text-[12.5px] text-slate-200 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={thinking}
                className="flex h-7 w-7 items-center justify-center rounded border border-cyan/35 bg-cyan/10 text-cyan hover:bg-cyan/20 disabled:opacity-50"
              >
                <Send size={13} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
