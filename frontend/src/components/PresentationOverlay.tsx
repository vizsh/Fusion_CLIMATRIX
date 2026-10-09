import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useScenarioStore } from '../store/useScenarioStore'

interface Step {
  path: string
  title: string
  caption: string
  setup: () => void
}

function buildSteps(store: ReturnType<typeof useScenarioStore.getState>): Step[] {
  return [
    {
      path: '/twin',
      title: '1 · Enter the landscape',
      caption:
        "CLIMATRIX opens over India's climate-exposed infrastructure. We fly into Himachal Pradesh — the 2023 monsoon disaster.",
      setup: () => {
        store.setRegion('HP')
        store.reset()
        store.setSelectedEntity(null)
      },
    },
    {
      path: '/twin',
      title: '2 · The Kullu–Manali valley',
      caption:
        'Roads, bridges, suppliers and borrowers share a single river corridor — a physical spine for very different businesses.',
      setup: () => store.setSelectedEntity('infra-hp-nh5'),
    },
    {
      path: '/twin',
      title: '3 · Trigger the shock',
      caption: 'Severity 90/100, six-month horizon — a user-defined stress dial, not a flood probability. Running the scenario.',
      setup: () => {
        store.setSeverity(90)
        store.setDuration(6)
        store.run()
      },
    },
    {
      path: '/dependency',
      title: '4 · Watch it propagate',
      caption: 'The same hazard, traced through infrastructure and suppliers to the borrowers and banks financing them.',
      setup: () => store.setSelectedEntity('hz-hp'),
    },
    {
      path: '/company',
      title: '5 · Inspect an affected borrower',
      caption: 'Baddi Pharmaceuticals: indirect exposure through a single grid substation outside the flood footprint itself.',
      setup: () => store.setSelectedEntity('co-hp-pharma'),
    },
    {
      path: '/portfolio',
      title: '6 · Translate disruption into financial risk',
      caption: 'EAD × PD × LGD, baseline versus stressed — every figure traceable back to its inputs.',
      setup: () => {},
    },
    {
      path: '/mitigation',
      title: '7 · Change the outcome',
      caption: 'Enable an infrastructure resilience upgrade and recompute the same scenario.',
      setup: () => {
        if (!store.interventions.includes('resilience-infra')) store.toggleIntervention('resilience-infra')
      },
    },
    {
      path: '/evidence',
      title: '8 · Inspect the evidence',
      caption: 'Every figure in this tour is labeled Sourced, Modelled, Assumption or Synthetic — never presented as more certain than it is.',
      setup: () => {},
    },
  ]
}

export default function PresentationOverlay() {
  const navigate = useNavigate()
  const exitPresentation = useScenarioStore((s) => s.exitPresentation)
  const presentationStep = useScenarioStore((s) => s.presentationStep)
  const setPresentationStep = useScenarioStore((s) => s.setPresentationStep)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const steps = buildSteps(useScenarioStore.getState())
  const step = steps[presentationStep]

  useEffect(() => {
    if (!step) return
    navigate(step.path)
    step.setup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationStep])

  useEffect(() => {
    if (!playing || presentationStep >= steps.length - 1) return
    timer.current = setTimeout(() => setPresentationStep(presentationStep + 1), 7000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [playing, presentationStep, steps.length, setPresentationStep])

  if (!step) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-5">
      <div className="pointer-events-auto flex w-[640px] max-w-[92vw] flex-col gap-3 rounded-lg border border-cyan/30 bg-panel/95 p-4 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.15em] text-cyan">{step.title}</div>
          <button onClick={exitPresentation} className="rounded border border-line p-1 text-slate-500 hover:text-slate-300">
            <X size={13} />
          </button>
        </div>
        <p className="text-[12.5px] leading-relaxed text-slate-300">{step.caption}</p>

        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{ background: i <= presentationStep ? '#22d3ee' : '#1c2430' }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            disabled={presentationStep === 0}
            onClick={() => setPresentationStep(Math.max(0, presentationStep - 1))}
            className="flex items-center gap-1 rounded border border-line px-2 py-1.5 font-mono text-[10px] text-slate-400 disabled:opacity-30"
          >
            <ChevronLeft size={12} /> BACK
          </button>

          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10px] tracking-wide text-cyan"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? 'PAUSE' : 'PLAY'}
          </button>

          {presentationStep < steps.length - 1 ? (
            <button
              onClick={() => setPresentationStep(presentationStep + 1)}
              className="flex items-center gap-1 rounded border border-line px-2 py-1.5 font-mono text-[10px] text-slate-400"
            >
              NEXT <ChevronRight size={12} />
            </button>
          ) : (
            <button
              onClick={exitPresentation}
              className="flex items-center gap-1 rounded border border-risk-low/40 bg-risk-low/10 px-2 py-1.5 font-mono text-[10px] text-risk-low"
            >
              FINISH
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
