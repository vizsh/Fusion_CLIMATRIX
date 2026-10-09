import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { INTERVENTIONS } from '../lib/interventions'
import { computeImpact, useScenarioStore } from '../store/useScenarioStore'

export default function MitigationStudioPage() {
  const state = useScenarioStore()
  const { interventions, toggleIntervention, clearInterventions } = state
  const impact = computeImpact(state)
  const netBenefit = impact.avoidedEl - impact.interventionCostCr

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="MITIGATION STUDIO"
        subtitle="ENABLE INTERVENTIONS, RECOMPUTE THE SAME SCENARIO"
        tag={`ACTIVE SCENARIO: ${state.region} · ${state.hazard} · ${state.severity}/100`}
      />

      <div className="bg-grid p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.15em] text-slate-500">AVAILABLE INTERVENTIONS</div>
          {interventions.length > 0 && (
            <button onClick={clearInterventions} className="font-mono text-[9.5px] text-slate-500 hover:text-slate-300">
              CLEAR ALL
            </button>
          )}
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {INTERVENTIONS.map((i) => {
            const enabled = interventions.includes(i.id)
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
                <div className="mt-2 font-mono-tnum text-[11px] text-slate-400">Cost: ₹{i.costCr} cr</div>
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

        <p className="mt-5 max-w-3xl text-[10.5px] leading-relaxed text-slate-600">
          The avoided-loss figure is a modeled difference under the selected scenario and
          intervention assumptions — a potential benefit in the model, not a guaranteed saving. A
          real decision would also weigh implementation time, effectiveness uncertainty, and
          whether the intervention itself remains exposed to the same hazard.
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
