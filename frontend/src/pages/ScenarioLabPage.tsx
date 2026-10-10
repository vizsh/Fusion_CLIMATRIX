import { Save, Trash2, Zap, ArrowRight, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import KpiCard from '../components/ui/KpiCard'
import EvidenceBadge from '../components/ui/EvidenceBadge'
import { computeImpact, REGION_LABEL, summarizeImpactPlain, useScenarioStore } from '../store/useScenarioStore'

export default function ScenarioLabPage() {
  const state = useScenarioStore()
  const {
    savedScenarios,
    saveCurrentScenario,
    restoreScenario,
    deleteScenario,
    region,
    hazard,
    severity,
    durationMonths,
    applyProfile,
  } = state
  const [label, setLabel] = useState('')
  const navigate = useNavigate()

  const impact = computeImpact(state)
  const summary = summarizeImpactPlain(region, hazard, severity, durationMonths, impact)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="SCENARIO LAB"
        subtitle="STRESS-DIAL CALIBRATION & SYSTEMIC TRANSMISSION BENCHMARKS"
        tag="CROSS-MODULE PARAMETER CONTROLLER"
        actions={
          <button
            onClick={() => applyProfile('Baseline')}
            className="flex items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-2.5 py-1 font-mono text-[10.5px] text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>RESET TO BASELINE</span>
          </button>
        }
      />

      {/* Top Controller Ribbon */}
      <div className="border-b border-border-subtle bg-bg-secondary/70 backdrop-blur-sm">
        <ScenarioConsole onRunSimulation={() => navigate('/twin')} />
      </div>

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Baseline Expected Loss"
            value={`₹${impact.baselineEl.toFixed(1)}`}
            unit="Cr"
            comparison="Unstressed baseline"
            comparisonTone="neutral"
            evidence="modelled"
          />

          <KpiCard
            label="Stressed Expected Loss"
            value={`₹${impact.stressedEl.toFixed(1)}`}
            unit="Cr"
            comparison={`+${((impact.stressedEl / (impact.baselineEl || 1) - 1) * 100).toFixed(0)}% increase`}
            comparisonTone="coral"
            evidence="modelled"
          />

          <KpiCard
            label="Borrowers Reached"
            value={impact.companyCount}
            unit="Entities"
            comparison={`${REGION_LABEL[region]}`}
            comparisonTone="amber"
            evidence="sourced"
          />

          <KpiCard
            label="Incremental ECL (Δ)"
            value={`₹${impact.incrementalEl.toFixed(1)}`}
            unit="Cr"
            comparison={`${severity}% Severity Dial`}
            comparisonTone="teal"
            evidence="assumption"
          />
        </div>

        {/* Live Impact Narrative Card */}
        <div className="rounded-xl border border-accent-teal/30 bg-bg-card p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-accent-teal">
              <Zap size={12} />
              <span>LIVE SYNCHRONIZATION SUMMARY</span>
            </div>
            <EvidenceBadge type="modelled" size="sm" />
          </div>

          <p className="text-[13px] leading-relaxed text-text-primary mt-1 font-sans">
            {summary}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle/60 text-[11px] font-mono text-text-muted">
            <span>
              Synchronized across Digital Twin, Exposure Graph, and Portfolio Impact engines.
            </span>
            <button
              onClick={() => navigate('/twin')}
              className="flex items-center gap-1 text-accent-teal hover:underline font-semibold cursor-pointer"
            >
              <span>View spatial propagation in Digital Twin</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Save & Saved Scenarios Library */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Save Configuration Form */}
          <div className="lg:col-span-5 rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-4">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              SAVE ACTIVE CONFIGURATION
            </div>

            <p className="text-[11.5px] leading-relaxed text-text-secondary">
              Snapshot the current parameter set (Region: {REGION_LABEL[region]}, Hazard: {hazard},
              Severity: {severity}%, Horizon: {durationMonths}M) for team benchmarking or what-if comparisons.
            </p>

            <div className="flex gap-2 pt-1">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Q3 Monsoon Severe Stress…"
                className="flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:border-accent-teal/50 focus:outline-none"
              />
              <button
                disabled={!label.trim()}
                onClick={() => {
                  if (!label.trim()) return
                  saveCurrentScenario(label.trim())
                  setLabel('')
                }}
                className="flex items-center gap-1.5 rounded-lg border border-accent-teal/40 bg-accent-teal/15 px-3.5 py-2 font-mono text-[11px] font-bold text-accent-teal hover:bg-accent-teal/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Save size={13} />
                <span>SAVE</span>
              </button>
            </div>
          </div>

          {/* Saved Scenarios Table */}
          <div className="lg:col-span-7 rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                SAVED BENCHMARKS ({savedScenarios.length})
              </div>
              <span className="font-mono text-[10px] text-text-muted">LOCAL REPOSITORY</span>
            </div>

            {savedScenarios.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-8 text-center font-mono text-[11px] text-text-muted">
                No saved scenario configurations yet. Set parameters above and click Save.
              </div>
            ) : (
              <div className="space-y-2">
                {savedScenarios.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 hover:border-text-muted/40 transition-colors"
                  >
                    <div>
                      <div className="font-mono text-[12.5px] font-bold text-text-primary">{s.label}</div>
                      <div className="font-mono text-[10.5px] text-text-muted mt-0.5">
                        {REGION_LABEL[s.region]} · <span className="text-accent-teal">{s.hazard}</span> · {s.severity}% SEV · {s.durationMonths}M
                        {s.interventions.length > 0 && ` · ${s.interventions.length} mitigation(s)`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreScenario(s.id)}
                        className="rounded border border-accent-teal/40 bg-accent-teal/10 hover:bg-accent-teal/20 px-3 py-1 font-mono text-[10px] font-semibold text-accent-teal transition-colors cursor-pointer"
                      >
                        RESTORE
                      </button>
                      <button
                        onClick={() => deleteScenario(s.id)}
                        className="rounded border border-border-subtle p-1.5 text-text-muted hover:border-critical-coral/40 hover:text-critical-coral transition-colors cursor-pointer"
                        title="Delete saved configuration"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
