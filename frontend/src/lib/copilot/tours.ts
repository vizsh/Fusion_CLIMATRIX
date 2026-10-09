// CLIMATRIX AI Copilot — guided tour of the whole prototype. Answers
// "guide me through this app", "what can this app do", "show me around"
// with a structured walkthrough of every page and a one-click action to
// jump to each — the automation the product brief asked for: the
// chatbot should be able to operate and explain every feature, not just
// the scenario engine.

import type { CopilotAction, CopilotBlock } from './types'

interface TourStop {
  to: string
  label: string
  what: string
}

const TOUR: TourStop[] = [
  { to: '/', label: 'Command Centre', what: 'The opening frame — one scenario summary, a one-click flagship stress run, and the RBI’s own 2024 climate stress-test pilot figures for context.' },
  { to: '/twin', label: 'Digital Twin', what: 'Real 3D terrain, real elevation, a hazard layer over the active region. Click any asset to trace its dependency chain live.' },
  { to: '/scenario', label: 'Scenario Lab', what: 'The shared controls — region, hazard, severity, duration, substitutability — that drive every other page from one state.' },
  { to: '/what-if', label: 'What-If Analysis', what: 'The autonomous multi-scenario engine: generates several plausible scenarios for a region and ranks them by loss, likelihood, priority and cumulative exposure — no chatbot required, but I can run it for you.' },
  { to: '/dependency', label: 'Dependency Explorer', what: 'The exposure graph — hazard → infrastructure → supplier → company → bank/insurer — laid out so you can see exactly how a shock reaches a holding.' },
  { to: '/company', label: 'Company Investigation', what: 'A single borrower’s full exposure path, live stressed PD/LGD, and an insurance-adjusted credit view. Exports a lending brief.' },
  { to: '/portfolio', label: 'Portfolio Impact', what: 'ECL = EAD × PD × LGD computed per company and summed, sector attribution, and a disclosed sensitivity band instead of a false-precision point estimate.' },
  { to: '/mitigation', label: 'Mitigation Studio', what: 'Toggle structural interventions and a parametric insurance trigger, and watch avoided loss recompute live.' },
  { to: '/insurance', label: 'Insurance & Protection Gap', what: 'What’s insured, what isn’t, and who carries the tail — per-insurer book stress and the uninsured-exposed list ranked by EAD.' },
  { to: '/evidence', label: 'Evidence & Reports', what: 'Live weather/news connector panels and the evidence register behind every figure in the app.' },
]

export function answerTour(): CopilotBlock[] {
  const actions: CopilotAction[] = TOUR.map((s, i) => ({
    id: `tour-${i}`,
    label: `${i + 1}. ${s.label}`,
    kind: 'navigate',
    to: s.to,
  }))
  return [
    { kind: 'heading', text: 'A tour of CLIMATRIX India' },
    {
      kind: 'text',
      text: 'Ten pages, one shared scenario state. Short version: pick a region and hazard on Scenario Lab, watch it propagate on the Digital Twin and Dependency Explorer, read the financial consequence on Portfolio Impact and Insurance, then test what would reduce it on Mitigation Studio and What-If Analysis. I can open any of them for you, or just ask me directly instead ("which holdings are exposed in Kerala", "generate a brief") and I’ll do the analysis without you navigating at all.',
    },
    {
      kind: 'bullets',
      items: TOUR.map((s) => `${s.label} — ${s.what}`),
    },
    { kind: 'actions', actions },
    { kind: 'suggestions', prompts: ['Analyse my portfolio and give me the risks', "What if there's a severe flood in Mumbai?", 'Guide me to the live map'] },
  ]
}
