import { Check, SlidersHorizontal, Shield, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import KpiCard from '../components/ui/KpiCard'
import EvidenceBadge from '../components/ui/EvidenceBadge'
import { computeBottlenecks, computeHazardReach, REGION_HAZARD } from '../lib/graphAnalytics'
import { combinedReductionShare, INTERVENTIONS, isParametricTriggered, parametricPayout } from '../lib/interventions'
import { sectorVulnerability } from '../lib/sectorVulnerability'
import { computeImpact, REGION_LABEL, stressPdLgd, useScenarioStore } from '../store/useScenarioStore'

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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="MITIGATION STUDIO"
        subtitle="PHYSICAL ADAPTATION, RESILIENCE BUDGETING & NET ECONOMIC BENEFIT"
        tag={`${REGION_LABEL[state.region]} · ${state.hazard}`}
        actions={
          interventions.length > 0 && (
            <button
              onClick={clearInterventions}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-2.5 py-1 font-mono text-[10.5px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <RotateCcw size={11} />
              <span>CLEAR INTERVENTIONS</span>
            </button>
          )
        }
      />

      <div className="border-b border-border-subtle bg-bg-secondary/70 backdrop-blur-sm">
        <button
          onClick={() => setShowConsole((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <SlidersHorizontal size={11} className="text-accent-teal" />
          <span>SCENARIO CONTROLLER {showConsole ? '▾' : '▸'}</span>
        </button>
        {showConsole && (
          <div className="border-t border-border-subtle/50 px-2 pb-2">
            <ScenarioConsole compact />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Gross Stressed Loss"
            value={`₹${impact.stressedEl.toFixed(1)}`}
            unit="Cr"
            comparison="Unmitigated ECL"
            comparisonTone="coral"
            evidence="modelled"
          />

          <KpiCard
            label="Mitigated Expected Loss"
            value={`₹${impact.mitigatedEl.toFixed(1)}`}
            unit="Cr"
            comparison={`₹${impact.avoidedEl.toFixed(1)} Cr Avoided`}
            comparisonTone="teal"
            evidence="modelled"
          />

          <KpiCard
            label="Mitigation Cost"
            value={`₹${impact.interventionCostCr.toFixed(1)}`}
            unit="Cr"
            comparison={`${interventions.length} Active Measures`}
            comparisonTone="neutral"
            evidence="assumption"
          />

          <KpiCard
            label="Net Economic Benefit"
            value={`₹${netBenefit.toFixed(1)}`}
            unit="Cr"
            comparison={netBenefit > 0 ? 'Net Positive ROI' : 'Capital Consumptive'}
            comparisonTone={netBenefit > 0 ? 'teal' : 'amber'}
            evidence="modelled"
          />
        </div>

        {/* Interventions Selection Grid */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              <Shield size={14} className="text-accent-teal" />
              <span>DECISION STUDIO — PHYSICAL ADAPTATION MEASURES</span>
            </div>
            <EvidenceBadge type="assumption" size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {INTERVENTIONS.map((item) => {
              const active = interventions.includes(item.id)
              const target = targetFor(item.id)
              const isParametric = item.id === 'parametric-cover'
              const triggered = isParametric && isParametricTriggered(item, state.severity)

              return (
                <div
                  key={item.id}
                  onClick={() => toggleIntervention(item.id)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                    active
                      ? 'border-accent-teal/50 bg-accent-teal/[0.08] shadow-sm'
                      : 'border-border-subtle bg-bg-elevated/70 hover:border-text-muted/40'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                            active
                              ? 'border-accent-teal bg-accent-teal text-bg-main'
                              : 'border-border-subtle bg-bg-card'
                          }`}
                        >
                          {active && <Check size={11} strokeWidth={3} />}
                        </div>
                        <span className="font-mono text-[12.5px] font-bold text-text-primary">
                          {item.label}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-text-muted">
                        ₹{item.costCr} Cr
                      </span>
                    </div>

                    <p className="text-[11.5px] leading-relaxed text-text-secondary pl-6">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-2 border-t border-border-subtle/50 pl-6 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono">
                    <span className="text-accent-teal font-semibold">
                      {((item.lossReductionShare ?? 0) * 100).toFixed(0)}% loss reduction
                    </span>
                    {target && (
                      <span className="text-text-muted truncate max-w-[200px]">
                        Target: {target.node.label}
                      </span>
                    )}
                    {isParametric && (
                      <span className={triggered ? 'text-critical-coral font-bold' : 'text-text-muted'}>
                        {triggered ? `TRIGGERED: ₹${item.payoutCr} Cr Payout` : `Triggers at ≥${item.triggerSeverityThreshold ?? 0}% severity`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Borrower-by-Borrower Mitigation Breakdown Table */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              BORROWER-LEVEL MITIGATION APPORTIONMENT
            </div>
            <span className="font-mono text-[10.5px] text-text-muted">
              {companyRows.length} BORROWERS EVALUATED
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-bg-elevated border-b border-border-subtle text-text-muted text-[9.5px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Company</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3 text-right">EAD (₹ Cr)</th>
                  <th className="p-3 text-right">Stressed ECL</th>
                  <th className="p-3 text-right">Mitigated ECL</th>
                  <th className="p-3 text-right">Avoided Loss (Δ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 bg-bg-card">
                {companyRows.map((r) => (
                  <tr key={r.company.id} className="hover:bg-bg-elevated/50 transition-colors">
                    <td className="p-3 font-semibold text-text-primary">{r.company.label}</td>
                    <td className="p-3 text-text-muted">{r.company.sector}</td>
                    <td className="p-3 text-right tabular-nums text-text-primary">₹{(r.company.eadCr ?? 0).toFixed(0)}</td>
                    <td className="p-3 text-right tabular-nums text-critical-coral">₹{r.stressedEl.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums text-accent-teal">₹{r.mitigatedEl.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums text-success-green font-bold">
                      {r.avoided > 0 ? `-₹${r.avoided.toFixed(2)}` : '₹0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
