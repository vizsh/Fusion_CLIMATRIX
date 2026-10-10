import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  Link2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Radar,
  Send,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useScenarioStore } from '../../store/useScenarioStore'
import { copyContextBundle, copyShareableLink, downloadContextBundle } from '../../lib/copilot/contextExport'
import { ollamaStatus, warmUpOllama } from '../../lib/copilot/ollamaClient'
import { respondTo } from '../../lib/copilot/respond'
import type { CopilotAction, CopilotTurn } from '../../lib/copilot/types'
import { isVoiceInputSupported, isVoiceOutputSupported, speak, speechFromBlocks, startListening, stopSpeaking } from '../../lib/copilot/voice'
import { CopilotBlockView } from './CopilotBlocks'

const QUICK_ACTIONS = [
  { label: 'Explain this loss', prompt: 'How is expected credit loss actually calculated for this scenario?' },
  { label: 'Find bottlenecks', prompt: 'Which infrastructure nodes are the top bottleneck risks?' },
  { label: 'Compare scenarios', prompt: 'Compare Himachal Pradesh flood vs Mumbai flood scenarios' },
  { label: 'Portfolio risk brief', prompt: 'Analyse my portfolio and give me the headline risks' },
]

let turnSeq = 0
function nextId() {
  turnSeq += 1
  return `t${turnSeq}-${Date.now()}`
}

export default function CopilotPanel() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState<CopilotTurn[]>([
    {
      id: nextId(),
      role: 'assistant',
      blocks: [
        { kind: 'heading', text: 'CLIMATRIX Intelligence Copilot' },
        {
          kind: 'text',
          text: 'Institutional climate risk copilot. Operates the active scenario state, traces systemic transmission pathways, and evaluates financial balance-sheet impact using the same deterministic models as the workstation.',
        },
      ],
    },
  ])
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null)
  const [thinking, setThinking] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceOut, setVoiceOut] = useState(false)
  const [justCopied, setJustCopied] = useState<'bundle' | 'link' | null>(null)
  const stopListenRef = useRef<() => void>(() => {})
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const state = useScenarioStore()

  useEffect(() => {
    ollamaStatus().then((s) => setOllamaReady(s.available))
    warmUpOllama()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, open, thinking])

  useEffect(() => stopSpeaking, [])

  async function handleCopyBundle() {
    const ok = await copyContextBundle(state)
    if (ok) {
      setJustCopied('bundle')
      setTimeout(() => setJustCopied(null), 1600)
    } else {
      downloadContextBundle(state)
    }
  }

  async function handleCopyLink() {
    const ok = await copyShareableLink(state)
    if (ok) {
      setJustCopied('link')
      setTimeout(() => setJustCopied(null), 1600)
    }
  }

  function runAction(action: CopilotAction) {
    if (action.kind === 'navigate' && action.to) {
      navigate(action.to)
    } else if (action.kind === 'select-entity' && action.entityId) {
      state.setSelectedEntity(action.entityId)
    } else if (action.kind === 'apply-scenario') {
      if (action.region) state.setRegion(action.region)
      if (action.hazard) state.setHazard(action.hazard)
      if (typeof action.severity === 'number') state.setSeverity(action.severity)
      if (typeof action.durationMonths === 'number') state.setDuration(action.durationMonths)
      if (action.substitutability) state.setSubstitutability(action.substitutability)
    } else if (action.kind === 'go-to-map') {
      if (action.region) state.setRegion(action.region)
      navigate('/app/digital-twin')
    }
  }

  async function send(explicitText?: string) {
    const text = (explicitText ?? input).trim()
    if (!text || thinking) return
    setInput('')

    const userTurn: CopilotTurn = { id: nextId(), role: 'user', text }
    setTurns((prev) => [...prev, userTurn])
    setThinking(true)

    try {
      const reply = await respondTo(text, state)
      const assistantTurn: CopilotTurn = {
        id: nextId(),
        role: 'assistant',
        blocks: reply.blocks,
      }
      setTurns((prev) => [...prev, assistantTurn])

      if (voiceOut && isVoiceOutputSupported()) {
        const spoken = speechFromBlocks(reply.blocks)
        if (spoken) speak(spoken)
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          blocks: [{ kind: 'text', text: 'Could not compute a response for that prompt. Please try again.' }],
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  function toggleListening() {
    if (listening) {
      stopListenRef.current()
      setListening(false)
    } else {
      stopListenRef.current = startListening(
        (transcript: string) => {
          setListening(false)
          send(transcript)
        },
        () => setListening(false),
      )
      setListening(true)
    }
  }

  function toggleVoiceOut() {
    if (voiceOut) stopSpeaking()
    setVoiceOut(!voiceOut)
  }

  return (
    <>
      {/* Floating Launcher Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-accent-teal/40 bg-bg-elevated/95 px-3.5 py-2 shadow-2xl backdrop-blur-md hover:border-accent-teal transition-all cursor-pointer group"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-teal/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-teal" />
            </span>
            <Radar size={15} className="text-accent-teal group-hover:rotate-45 transition-transform" />
            <span className="font-mono text-[11px] font-bold tracking-wider text-text-primary">
              AI COPILOT
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Docked Drawer / Extended Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed z-50 flex flex-col overflow-hidden border-border-subtle bg-bg-secondary/95 shadow-2xl backdrop-blur-2xl ${
              expanded
                ? 'inset-4 rounded-xl border'
                : 'right-0 top-13 bottom-0 w-[420px] sm:w-[460px] border-l'
            }`}
          >
            {/* Drawer Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-card/80 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded border border-accent-teal/30 bg-accent-teal/10">
                  <Radar size={13} className="text-accent-teal" />
                </div>
                <div>
                  <div className="font-mono text-[12px] font-bold tracking-wide text-text-primary">
                    CLIMATRIX COPILOT
                  </div>
                  <div className="font-mono text-[9px] tracking-wider text-text-muted flex items-center gap-1.5">
                    <span>SYNCHRONIZED RISK INTELLIGENCE</span>
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${ollamaReady ? 'bg-success-green' : 'bg-border-subtle'}`}
                      title={ollamaReady ? 'Local LLM Connected' : 'Heuristic Engine Active'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopyBundle}
                  title="Copy context bundle for LLM export"
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-colors cursor-pointer ${
                    justCopied === 'bundle'
                      ? 'border-success-green/40 text-success-green'
                      : 'border-border-subtle text-text-muted hover:text-text-primary'
                  }`}
                >
                  {justCopied === 'bundle' ? <Check size={12} /> : <Share2 size={12} />}
                </button>

                <button
                  onClick={handleCopyLink}
                  title="Copy shareable scenario link"
                  className={`flex h-7 w-7 items-center justify-center rounded border transition-colors cursor-pointer ${
                    justCopied === 'link'
                      ? 'border-success-green/40 text-success-green'
                      : 'border-border-subtle text-text-muted hover:text-text-primary'
                  }`}
                >
                  {justCopied === 'link' ? <Check size={12} /> : <Link2 size={12} />}
                </button>

                {isVoiceOutputSupported() && (
                  <button
                    onClick={toggleVoiceOut}
                    title={voiceOut ? 'Mute voice replies' : 'Enable voice output'}
                    className={`flex h-7 w-7 items-center justify-center rounded border transition-colors cursor-pointer ${
                      voiceOut
                        ? 'border-accent-teal/40 bg-accent-teal/15 text-accent-teal'
                        : 'border-border-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {voiceOut ? <Volume2 size={12} /> : <VolumeX size={12} />}
                  </button>
                )}

                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border-subtle text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  title={expanded ? 'Dock to side' : 'Expand window'}
                >
                  {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>

                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded border border-border-subtle text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
                  title="Close Copilot"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Conversation Stream */}
            <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto p-4 font-sans">
              {turns.map((turn) =>
                turn.role === 'user' ? (
                  <div key={turn.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg rounded-tr-xs bg-accent-teal/15 border border-accent-teal/30 px-3 py-2 text-[12.5px] text-text-primary font-mono">
                      {turn.text}
                    </div>
                  </div>
                ) : (
                  <div key={turn.id} className="flex justify-start">
                    <div className="max-w-[95%] space-y-2 rounded-lg rounded-tl-xs border border-border-subtle bg-bg-card p-3 shadow-xs">
                      {turn.blocks?.map((b, i) => (
                        <CopilotBlockView key={i} block={b} onAction={runAction} onSuggest={(t) => send(t)} />
                      ))}
                    </div>
                  </div>
                ),
              )}

              {thinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-card px-3 py-2">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-teal [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-teal [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-teal" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts Bar */}
            <div className="border-t border-border-subtle bg-bg-card/60 p-2.5">
              <div className="mb-1.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.16em] text-text-muted px-1">
                RECOMMENDED ACTIONS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => send(item.prompt)}
                    className="rounded border border-border-subtle bg-bg-elevated px-2 py-1 font-mono text-[9.5px] text-text-secondary hover:border-accent-teal/40 hover:text-accent-teal transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
              className="flex shrink-0 items-center gap-2 border-t border-border-subtle bg-bg-card p-3"
            >
              {isVoiceInputSupported() && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                    listening
                      ? 'border-critical-coral bg-critical-coral/15 text-critical-coral'
                      : 'border-border-subtle text-text-muted hover:text-text-primary'
                  }`}
                  title={listening ? 'Stop listening' : 'Speak voice prompt'}
                >
                  {listening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              )}

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={thinking}
                placeholder={thinking ? 'Computing shock response…' : listening ? 'Listening…' : 'Ask Copilot about exposure, loss, interventions…'}
                className="flex-1 bg-transparent font-mono text-[11.5px] text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded border border-accent-teal/40 bg-accent-teal/15 text-accent-teal hover:bg-accent-teal/25 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
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
