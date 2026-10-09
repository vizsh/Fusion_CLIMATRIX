// CLIMATRIX AI Copilot — optional voice input/output. Both are OFF by
// default per explicit product direction: text is the primary mode, voice
// is an opt-in convenience, never the default experience. Pure browser
// Web Speech API — no server round trip, no tokens, no extra cost.

import type { CopilotBlock } from './types'

type SpeechRecognitionCtor = new () => SpeechRecognitionLike
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((ev: any) => void) | null
  onerror: ((ev: any) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isVoiceInputSupported(): boolean {
  return getRecognitionCtor() !== null
}

export function isVoiceOutputSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Starts one listening session. Calls onResult with the final
 * transcript and onEnd when the session closes (success, error, or
 * manual stop). Returns a function to stop early. */
export function startListening(onResult: (text: string) => void, onEnd: () => void): () => void {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    onEnd()
    return () => {}
  }
  const rec = new Ctor()
  rec.lang = 'en-IN'
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.continuous = false
  rec.onresult = (ev: any) => {
    const transcript = ev.results?.[0]?.[0]?.transcript
    if (transcript) onResult(transcript)
  }
  rec.onerror = () => onEnd()
  rec.onend = () => onEnd()
  try {
    rec.start()
  } catch {
    onEnd()
  }
  return () => {
    try {
      rec.stop()
    } catch {
      /* already stopped */
    }
  }
}

/** A short, speakable digest of a reply — the headline and key figures,
 * skipping tables/rankings that read poorly aloud (they're still shown
 * on screen; speech is a supplement, not a transcript). */
export function speechFromBlocks(blocks: CopilotBlock[]): string {
  const parts: string[] = []
  for (const b of blocks) {
    if (b.kind === 'heading') parts.push(b.text)
    else if (b.kind === 'text') parts.push(b.text)
    else if (b.kind === 'stat') parts.push(`${b.label}: ${b.value}.`)
    else if (b.kind === 'statRow') parts.push(b.stats.map((s) => `${s.label}: ${s.value}`).join('. ') + '.')
    if (parts.length >= 3) break
  }
  return parts.join(' ').slice(0, 600)
}

export function speak(text: string) {
  if (!isVoiceOutputSupported() || !text) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-IN'
  utter.rate = 1.02
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking() {
  if (isVoiceOutputSupported()) window.speechSynthesis.cancel()
}
