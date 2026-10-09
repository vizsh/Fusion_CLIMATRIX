// Standalone Multi-Scenario Intelligence module — "What-If Analysis" in the
// sidebar, per the product brief: a first-class page, not a feature hidden
// inside the chatbot. Select a region and time horizon; CLIMATRIX generates
// plausible scenarios, runs them through the same engine as every other
// page, and ranks them on four axes instead of declaring one winner.

import { Download, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { downloadBrief, generateWhatIf, HORIZON_LABEL, type Horizon } from '../lib/copilot/engine'
import { CopilotBlockView } from '../components/Copilot/CopilotBlocks'
import type { CopilotBlock } from '../lib/copilot/types'
import { REGION_LABEL, useScenarioStore, type Region } from '../store/useScenarioStore'

const REGIONS: Region[] = ['HP', 'KL', 'MH', 'UK']
const HORIZONS: Horizon[] = ['near', 'medium', 'long', 'both']

function fmtCr(n: number) {
  return `₹${n.toFixed(1)} cr`
}

export default function WhatIfAnalysisPage() {
  const storeRegion = useScenarioStore((s) => s.region)
  const [region, setRegion] = useState<Region>(storeRegion)
  const [horizon, setHorizon] = useState<Horizon>('medium')

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
