// Standalone Multi-Scenario Intelligence module — "What-If Analysis" in the
// sidebar, per the product brief: a first-class page, not a feature hidden
// inside the chatbot. Select a region and time horizon; CLIMATRIX generates
// plausible scenarios, runs them through the same engine as every other
// page, and ranks them on four axes instead of declaring one winner.

import { Download, MessageSquareText, Sparkles, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { downloadBrief, generateWhatIf, HORIZON_LABEL, type Horizon } from '../lib/copilot/engine'
import { parseFreeTextScenario, type FreeTextParseResult } from '../lib/copilot/freeTextScenario'
import { runScenarioAndReport, type ScenarioRunResult } from '../lib/copilot/scenarioRunner'
import { generateScenarioBriefPdf } from '../lib/briefGenerators'
import { CopilotBlockView } from '../components/Copilot/CopilotBlocks'
import type { CopilotBlock } from '../lib/copilot/types'
import { REGION_LABEL, useScenarioStore, type Region } from '../store/useScenarioStore'

const EXAMPLE_PROMPTS = [
  'A severe cyclone hits Kerala and lasts 9 months with limited supply-chain alternatives',
  'A catastrophic flood in Himachal Pradesh for a full year',
  'A mild drought in the agricultural belt for a couple of months',
]

const REGIONS: Region[] = ['HP', 'KL', 'MH', 'UK', 'MB']
const HORIZONS: Horizon[] = ['near', 'medium', 'long', 'both']

function fmtCr(n: number) {
  return `₹${n.toFixed(1)} cr`
}

export default function WhatIfAnalysisPage() {
  const state = useScenarioStore()
  const storeRegion = useScenarioStore((s) => s.region)
  const [region, setRegion] = useState<Region>(storeRegion)
  const [horizon, setHorizon] = useState<Horizon>('medium')

  const [freeText, setFreeText] = useState('')
  const [lastParse, setLastParse] = useState<FreeTextParseResult | null>(null)
  const [lastRun, setLastRun] = useState<ScenarioRunResult | null>(null)

  function runFreeTextScenario(raw?: string) {
    const text = (raw ?? freeText).trim()
    if (!text) return
    const parsed = parseFreeTextScenario(text, {
      region: state.region,
      hazard: state.hazard,
      severity: state.severity,
      durationMonths: state.durationMonths,
      substitutability: state.substitutability,
    })
    setLastParse(parsed)
    setRegion(parsed.scenario.region)
    const run = runScenarioAndReport(
      parsed.scenario,
      state,
      'Your scenario, built and run',
      'This exact configuration is now live on every page — Scenario Lab, Digital Twin, Dependency Explorer and Portfolio Impact all read it too.',
    )
    setLastRun(run)
  }

  const ranked = useMemo(() => generateWhatIf(region, horizon), [region, horizon])

  const blocks: CopilotBlock[] = useMemo(() => {
    const out: CopilotBlock[] = [
      {
        kind: 'statRow',
        stats: [
          { label: 'Scenarios generated', value: String(ranked.scenarios.length), evidence: 'modelled' },
          { label: 'Exposed EAD', value: fmtCr(ranked.portfolioStats.eadCr), evidence: 'modelled' },
          { label: 'Holdings reached', value: String(ranked.portfolioStats.companyCount), evidence: 'modelled' },
        ],
      },
      {
        kind: 'rankedList',
        title: 'Highest potential loss',
        rows: ranked.byLoss.map((s, i) => ({
          rank: i + 1,
          label: s.label,
          value: fmtCr(s.impact.stressedEl),
          sub: `severity ${s.severity}/100 · ${s.durationMonths}mo · substitutability ${s.substitutability}`,
          evidence: 'modelled',
        })),
      },
      {
        kind: 'rankedList',
        title: 'Highest likelihood',
        rows: ranked.byLikelihood.map((s, i) => ({
          rank: i + 1,
          label: s.label,
          value: s.likelihoodLabel,
          sub: `Probability basis: ${s.probabilityBasis.replace(/-/g, ' ')} — an ordinal ranking aid, never a measured probability`,
          evidence: s.probabilityEvidence,
        })),
      },
      {
        kind: 'rankedList',
        title: 'Highest risk priority (loss × likelihood)',
        rows: ranked.byPriority.map((s, i) => ({
          rank: i + 1,
          label: s.label,
          value: fmtCr(s.impact.stressedEl),
          sub: s.likelihoodLabel,
          evidence: 'modelled',
        })),
      },
      {
        kind: 'rankedList',
        title: 'Highest cumulative exposure (illustrative recurrence assumption)',
        rows: ranked.byCumulative.map((s, i) => ({
          rank: i + 1,
          label: s.label,
          value: fmtCr(s.cumulativeExposureCr),
          sub: 'Disclosed recurrence multiplier over the selected horizon, not an actuarial frequency model',
          evidence: 'assumption',
        })),
      },
      {
        kind: 'text',
        text: 'These scenarios share the same underlying hazard and exposure graph — they are alternative hypotheses about one region, not independent additive risks. Do not sum their losses.',
      },
      {
        kind: 'rankedList',
        title: 'Hidden concentration / shared bottlenecks',
        rows: ranked.bottlenecks.map((b, i) => ({
          rank: i + 1,
          label: b.node.label,
          value: fmtCr(b.reachedEAD),
          sub: `Reaches ${b.reachedCompanies.length} holdings: ${b.reachedCompanies.map((c) => c.label).join(', ')}`,
          evidence: 'modelled',
        })),
      },
    ]
    return out
  }, [ranked])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="WHAT-IF ANALYSIS"
        subtitle="AUTONOMOUS MULTI-SCENARIO INTELLIGENCE — NO CHATBOT REQUIRED"
        tag="GENERATES, RUNS AND RANKS SCENARIOS SO YOU DON'T HAVE TO INVENT THEM"
      />

      <div className="border-b border-line bg-panel/40 p-4">
        <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-slate-500">
          <Wand2 size={12} className="text-cyan" /> DESCRIBE THE SCENARIO YOU ENVISION
        </div>
        <p className="mb-2 max-w-3xl text-[10.5px] leading-relaxed text-slate-600">
          Type it in plain English — region, hazard, how bad, how long, how hard it'd be to reroute around. CLIMATRIX
          parses what it can find, defaults the rest honestly (shown below, not hidden), applies it to the live
          scenario, and runs it through the exact same engine every page uses.
        </p>
        <div className="flex items-start gap-2">
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={2}
            placeholder="e.g. A severe cyclone hits Kerala and lasts 9 months, supply chains have almost no alternative routes…"
            className="flex-1 rounded border border-line bg-panel-2 px-2.5 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
          <button
            onClick={() => runFreeTextScenario()}
            disabled={!freeText.trim()}
            className="flex shrink-0 items-center gap-1.5 self-stretch rounded border border-cyan/40 bg-cyan/10 px-3 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MessageSquareText size={13} /> BUILD &amp; RUN IT
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setFreeText(p)
                runFreeTextScenario(p)
              }}
              className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] text-slate-500 hover:border-cyan/40 hover:text-cyan"
            >
              {p}
            </button>
          ))}
        </div>

        {lastRun && lastParse && (
          <div className="mt-3 rounded-lg border border-cyan/30 bg-cyan/[0.05] p-3">
            {lastParse.notes.length > 0 && (
              <p className="mb-2 text-[10px] leading-relaxed text-risk-med">
                {lastParse.notes.join(' ')}
              </p>
            )}
            <div className="space-y-2.5">
              {lastRun.blocks.map((b, i) => (
                <CopilotBlockView key={i} block={b} onAction={() => {}} />
              ))}
            </div>
            <button
              onClick={() => generateScenarioBriefPdf(lastParse.scenario, lastRun.impact, lastParse.notes, freeText)}
              className="mt-2 flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
            >
              <Download size={12} /> DOWNLOAD THIS SCENARIO'S BRIEF (PDF)
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-line bg-panel/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-slate-500">
            <Sparkles size={12} className="text-cyan" /> ANALYSIS SCOPE
          </div>
          <div className="flex rounded border border-line bg-panel-2 p-0.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`rounded px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors ${
                  region === r ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {REGION_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="mx-1 h-4 w-px bg-line" />
          <div className="font-mono text-[10px] tracking-wide text-slate-500">TIME HORIZON</div>
          <div className="flex rounded border border-line bg-panel-2 p-0.5">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                title={HORIZON_LABEL[h]}
                className={`rounded px-2.5 py-1 font-mono text-[10px] capitalize tracking-wide transition-colors ${
                  horizon === h ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <button
              onClick={() => downloadBrief(ranked)}
              className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
            >
              <Download size={12} /> GENERATE BRIEF
            </button>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-slate-500">
          {HORIZON_LABEL[horizon]}. CLIMATRIX collects the available scenario evidence, generates plausible
          hazard/severity/duration combinations for {REGION_LABEL[region]}, runs each through the same ECL and
          protection-gap engine as the rest of the app, then ranks them by loss, likelihood, priority and
          cumulative exposure — four rankings because one universal winner hides more than it reveals.
        </p>
      </div>

      <div className="bg-grid space-y-4 p-6">
        {blocks.map((b, i) => (
          <CopilotBlockView key={i} block={b} onAction={() => {}} />
        ))}
      </div>
    </div>
  )
}
