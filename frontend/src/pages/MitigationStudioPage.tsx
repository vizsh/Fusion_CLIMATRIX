import { motion } from 'framer-motion'
import { Check, SlidersHorizontal, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import { computeBottlenecks, computeHazardReach, REGION_HAZARD } from '../lib/graphAnalytics'
import { combinedReductionShare, INTERVENTIONS, isParametricTriggered, parametricPayout } from '../lib/interventions'
import { sectorVulnerability } from '../lib/sectorVulnerability'
import { computeImpact, REGION_LABEL, stressPdLgd, useScenarioStore } from '../store/useScenarioStore'

// Which bottleneck kind each intervention mechanically targets — used to
// find a real, scenario-specific node to point at, instead of a generic
// description that never changes between scenarios.
const INTERVENTION_TARGET_KIND: Record<string, 'infra' | 'supplier' | null> = {
  'alt-route': 'infra',
  'resilience-infra': 'infra',
  'supplier-diversification': 'supplier',
  'early-engagement': null,
}

export default function MitigationStudioPage() {
  const state = useScenarioStore()
  const { interventions, toggleIntervention, clearInterventions } = state
  const impact = computeImpact(state)
  const netBenefit = impact.avoidedEl - impact.interventionCostCr
  const [showConsole, setShowConsole] = useState(true)

  const hazardId = REGION_HAZARD[state.region]
  const reach = computeHazardReach(hazardId)
  const bottlenecks = useMemo(() => computeBottlenecks(20), [])
  const scenarioBottlenecks = bottlenecks.filter((b) =>
    reach.companies.some((c) => b.reachedCompanies.some((rc) => rc.id === c.id)),
  )

  const targetFor = (interventionId: string) => {
    const kind = INTERVENTION_TARGET_KIND[interventionId]
    if (!kind) return null
    return scenarioBottlenecks.find((b) => b.node.kind === kind) ?? null
  }

  const mostExposedCompany = reach.companies.slice().sort((a, b) => (b.eadCr ?? 0) - (a.eadCr ?? 0))[0] ?? null

  // Per-company breakdown — who actually benefits from the currently
  // enabled interventions, not just the portfolio-level aggregate. A
  // triggered parametric payout is portfolio-level (one treaty), so it's
  // allocated here pro-rata by each borrower's share of stressed loss.
  const reduction = combinedReductionShare(interventions)
  const payoutCr = parametricPayout(interventions, state.severity)
  const companyRows = useMemo(() => {
    const raw = reach.companies.map((c) => {
      const { stressedPd, stressedLgd } = stressPdLgd(
        c.baselinePd ?? 0,
        c.baselineLgd ?? 0,
        state.severity,
        state.durationMonths,
        state.substitutability,
        sectorVulnerability(c.sector),
      )
      const baselineEl = (c.eadCr ?? 0) * (c.baselinePd ?? 0) * (c.baselineLgd ?? 0)
      const stressedEl = (c.eadCr ?? 0) * stressedPd * stressedLgd
      return { company: c, baselineEl, stressedEl }
    })
    const totalStressedEl = raw.reduce((s, r) => s + r.stressedEl, 0)
    return raw
      .map((r) => {
        const proRataPayout = totalStressedEl ? payoutCr * (r.stressedEl / totalStressedEl) : 0
        const mitigatedEl = Math.max(r.baselineEl, r.baselineEl + (r.stressedEl - r.baselineEl) * (1 - reduction) - proRataPayout)
        return { ...r, mitigatedEl, avoided: r.stressedEl - mitigatedEl }
      })
      .sort((a, b) => b.stressedEl - a.stressedEl)
  }, [reach.companies, state.severity, state.durationMonths, state.substitutability, reduction, payoutCr])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="MITIGATION STUDIO"
        subtitle="ENABLE INTERVENTIONS, RECOMPUTE THE SAME SCENARIO"
        tag={`ACTIVE SCENARIO: ${REGION_LABEL[state.region]} · ${state.hazard} · ${state.severity}/100`}
      />

      <div className="border-b border-line bg-panel/40">
        <button
          onClick={() => setShowConsole((v) => !v)}
          className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-[9.5px] tracking-[0.15em] text-slate-500 hover:text-slate-300"
        >
          <SlidersHorizontal size={11} className="text-cyan" />
          SCENARIO {showConsole ? '▾' : '▸'}
        </button>
        {showConsole && (
          <div className="border-t border-line-soft px-1 pb-1">
            <ScenarioConsole compact />
          </div>
        )}
      </div>

      <div className="bg-grid p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
            AVAILABLE INTERVENTIONS — {reach.companies.length} BORROWER(S) IN SCOPE
          </div>
          {interventions.length > 0 && (
            <button onClick={clearInterventions} className="font-mono text-[9.5px] text-slate-500 hover:text-slate-300">
              CLEAR ALL
            </button>
          )}
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {INTERVENTIONS.map((i) => {
            const enabled = interventions.includes(i.id)
            const target = targetFor(i.id)
            const noTarget = INTERVENTION_TARGET_KIND[i.id] && !target
            return (
              <button
                key={i.id}
                onClick={() => toggleIntervention(i.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  enabled ? 'border-cyan/50 bg-cyan/10' : 'border-line bg-panel-2 hover:border-slate-600'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`font-mono text-[11px] ${enabled ? 'text-cyan' : 'text-slate-300'}`}>{i.label}</span>
                  {enabled && <Check size={13} className="text-cyan" />}
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-500">{i.description}</p>
                {target && (
                  <div className="mt-2 rounded border border-risk-med/30 bg-risk-med/[0.06] px-1.5 py-1 text-[10px] text-risk-med">
                    Targets: {target.node.label} (₹{target.reachedEAD} cr via {target.reachedCompanies.length} borrowers)
                  </div>
                )}
                {i.id === 'early-engagement' && mostExposedCompany && (
                  <div className="mt-2 rounded border border-risk-med/30 bg-risk-med/[0.06] px-1.5 py-1 text-[10px] text-risk-med">
                    Targets: {mostExposedCompany.label} (most exposed, ₹{mostExposedCompany.eadCr} cr)
                  </div>
                )}
                {noTarget && (
                  <div className="mt-2 rounded border border-line px-1.5 py-1 text-[10px] text-slate-600">
                    No matching bottleneck in this scenario
                  </div>
                )}
                {i.kind === 'parametric' && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Trigger</span>
                      <span className="text-slate-400">severity ≥ {i.triggerSeverityThreshold}/100</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Payout if triggered</span>
                      <span className="text-slate-400">₹{i.payoutCr} cr fixed</span>
                    </div>
                    <div
                      className={`flex items-center gap-1 rounded border px-1.5 py-1 font-mono text-[9.5px] tracking-wide ${
                        isParametricTriggered(i, state.severity)
                          ? 'border-risk-low/40 bg-risk-low/10 text-risk-low'
                          : 'border-line text-slate-600'
                      }`}
                    >
                      <Zap size={10} />
                      {isParametricTriggered(i, state.severity)
                        ? `TRIGGERED — ₹${i.payoutCr} cr released`
                        : `NOT TRIGGERED at severity ${state.severity}`}
                    </div>
                  </div>
                )}
                <div className="mt-2 font-mono-tnum text-[11px] text-slate-400">
                  {i.kind === 'parametric' ? 'Premium' : 'Cost'}: ₹{i.costCr} cr
                </div>
              </button>
            )
          })}
        </div>

        <motion.div
          key={interventions.join(',')}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        >
          <div className="rounded-lg border border-line bg-panel-2 p-5">
            <div className="font-mono text-[9px] tracking-[0.15em] text-slate-500">BASELINE</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-300">₹{impact.baselineEl.toFixed(2)} cr</div>
            <div className="mt-1 text-[10.5px] text-slate-600">No shock applied</div>
          </div>
          <div className="rounded-lg border border-risk-high/40 bg-risk-high/[0.06] p-5">
            <div className="font-mono text-[9px] tracking-[0.15em] text-slate-500">UNMITIGATED STRESS</div>
            <div className="mt-2 font-mono text-2xl font-bold text-risk-high">₹{impact.stressedEl.toFixed(2)} cr</div>
            <div className="mt-1 text-[10.5px] text-slate-600">Scenario applied, no intervention</div>
          </div>
          <div className="rounded-lg border border-risk-low/40 bg-risk-low/[0.06] p-5">
            <div className="font-mono text-[9px] tracking-[0.15em] text-slate-500">MITIGATED STRESS</div>
            <div className="mt-2 font-mono text-2xl font-bold text-risk-low">₹{impact.mitigatedEl.toFixed(2)} cr</div>
            <div className="mt-1 text-[10.5px] text-slate-600">
              {interventions.length ? `${interventions.length} intervention(s) applied` : 'Enable an intervention above'}
            </div>
          </div>
        </motion.div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="MODELED AVOIDED LOSS" value={`₹${impact.avoidedEl.toFixed(2)} cr`} color="#2dd4a7" />
          <SummaryCard label="INTERVENTION COST" value={`₹${impact.interventionCostCr.toFixed(1)} cr`} color="#f5a524" />
          <SummaryCard
            label="NET MODELED BENEFIT"
            value={`${netBenefit >= 0 ? '+' : ''}₹${netBenefit.toFixed(2)} cr`}
            color={netBenefit >= 0 ? '#2dd4a7' : '#fb3a4a'}
          />
        </div>

        {interventions.includes('parametric-trigger') && (
          <div
            className={`mt-3 flex items-center justify-between rounded-lg border px-4 py-3 text-[11px] ${
              impact.parametricPayoutCr > 0
                ? 'border-risk-low/40 bg-risk-low/[0.06] text-risk-low'
                : 'border-line bg-panel-2 text-slate-500'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Zap size={12} /> Parametric trigger status at severity {state.severity}/100
            </span>
            <span className="font-mono-tnum">
              {impact.parametricPayoutCr > 0
                ? `TRIGGERED — ₹${impact.parametricPayoutCr.toFixed(0)} cr paid, folded into mitigated EL above`
                : 'NOT TRIGGERED — ₹0 payout (premium still sunk)'}
            </span>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            WHO BENEFITS — PER-BORROWER BREAKDOWN
          </div>
          {companyRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-line-soft text-left text-[9px] tracking-wide text-slate-500">
                    <th className="pb-1.5 font-normal">BORROWER</th>
                    <th className="pb-1.5 font-normal">SECTOR</th>
                    <th className="pb-1.5 text-right font-normal">STRESSED EL</th>
                    <th className="pb-1.5 text-right font-normal">MITIGATED EL</th>
                    <th className="pb-1.5 text-right font-normal">AVOIDED</th>
                  </tr>
                </thead>
                <tbody>
                  {companyRows.map((r) => (
                    <tr key={r.company.id} className="border-b border-line-soft">
                      <td className="py-1.5 text-slate-300">{r.company.label}</td>
                      <td className="py-1.5 text-slate-500">{r.company.sector}</td>
                      <td className="py-1.5 text-right font-mono-tnum text-risk-high">₹{r.stressedEl.toFixed(2)} cr</td>
                      <td className="py-1.5 text-right font-mono-tnum text-risk-low">₹{r.mitigatedEl.toFixed(2)} cr</td>
                      <td className="py-1.5 text-right font-mono-tnum text-cyan">₹{r.avoided.toFixed(2)} cr</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-slate-600">No borrowers reachable from the active scenario.</p>
          )}
        </div>

        <p className="mt-5 max-w-3xl text-[10.5px] leading-relaxed text-slate-600">
          The avoided-loss figure is a modeled difference under the selected scenario and
          intervention assumptions — a potential benefit in the model, not a guaranteed saving. The
          reduction share currently applies uniformly across affected borrowers; it does not verify
          that the intervention physically reaches every listed dependency. A real decision would
          also weigh implementation time, effectiveness uncertainty, and whether the intervention
          itself remains exposed to the same hazard. The parametric trigger is modeled with real
          basis risk: it pays the full ₹{INTERVENTIONS.find((i) => i.id === 'parametric-trigger')?.payoutCr} cr the
          instant severity reaches its threshold, and exactly ₹0 one point below it — try the severity
          slider across {INTERVENTIONS.find((i) => i.id === 'parametric-trigger')?.triggerSeverityThreshold}/100
          with it enabled to see the cliff, which is the real tradeoff a buyer accepts for fast,
          dispute-free payout instead of a slower indemnity claim.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-line bg-panel-2 p-3.5">
      <div className="font-mono text-[9px] tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-mono-tnum text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}
