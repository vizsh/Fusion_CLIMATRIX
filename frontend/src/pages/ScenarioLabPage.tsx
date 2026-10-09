import { Save, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import { computeImpact, REGION_LABEL, summarizeImpactPlain, useScenarioStore } from '../store/useScenarioStore'

export default function ScenarioLabPage() {
  const state = useScenarioStore()
  const { savedScenarios, saveCurrentScenario, restoreScenario, deleteScenario, region, hazard, severity, durationMonths } = state
  const [label, setLabel] = useState('')
  const navigate = useNavigate()

  const impact = computeImpact(state)
  const summary = summarizeImpactPlain(region, hazard, severity, durationMonths, impact)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="SCENARIO LAB"
        subtitle="CONFIGURE, RUN AND SAVE CLIMATE STRESS SCENARIOS"
        tag="SHARED STATE — DRIVES THE DIGITAL TWIN, GRAPH AND FINANCIAL ENGINE"
      />

      <div className="border-b border-line bg-panel/40">
        {/* Running from here jumps to the Digital Twin, since this page has
            no map/graph of its own to visibly animate — otherwise RUN
            SIMULATION was just a thin progress bar going nowhere. */}
        <ScenarioConsole onRunSimulation={() => navigate('/twin')} />
      </div>

      <div className="bg-grid p-6">
        <div className="mb-6 max-w-2xl rounded-lg border border-cyan/30 bg-cyan/[0.06] p-4">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-cyan">
            <Zap size={11} /> LIVE — UPDATES AS YOU MOVE ANY DIAL ABOVE
          </div>
          <p className="text-[12.5px] leading-relaxed text-slate-200">{summary}</p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <Stat label="BASELINE EL" value={`₹${impact.baselineEl.toFixed(1)} cr`} />
            <Stat label="STRESSED EL" value={`₹${impact.stressedEl.toFixed(1)} cr`} color="#fb3a4a" />
            <Stat label="BORROWERS REACHED" value={String(impact.companyCount)} />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            This exact configuration also drives the Digital Twin's hazard layer, the Dependency
            Explorer's propagation, and Portfolio Impact / Mitigation Studio — one scenario, one set of
            numbers everywhere. Click RUN SIMULATION above to watch it play out on the live 3D map.
          </p>
        </div>

        <div className="mb-6 max-w-2xl rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-1 font-mono text-[10px] tracking-[0.15em] text-slate-500">SAVE THIS CONFIGURATION</div>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name this configuration…"
              className="flex-1 rounded border border-line bg-panel px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
            />
            <button
              onClick={() => {
                if (!label.trim()) return
                saveCurrentScenario(label.trim())
                setLabel('')
              }}
              className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
            >
              <Save size={12} /> SAVE
            </button>
          </div>
        </div>

        <div className="max-w-2xl">
          <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            SAVED SCENARIOS ({savedScenarios.length})
          </div>
          {savedScenarios.length === 0 ? (
            <p className="text-[11px] text-slate-600">No saved scenarios yet — configure one above and save it.</p>
          ) : (
            <div className="space-y-2">
              {savedScenarios.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border border-line bg-panel-2 p-3">
                  <div>
                    <div className="text-[12px] text-slate-200">{s.label}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {REGION_LABEL[s.region]} · {s.hazard} · {s.severity}/100 · {s.durationMonths}mo
                      {s.interventions.length > 0 && ` · ${s.interventions.length} mitigation(s)`}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => restoreScenario(s.id)}
                      className="rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] text-cyan hover:bg-cyan/20"
                    >
                      RESTORE
                    </button>
                    <button
                      onClick={() => deleteScenario(s.id)}
                      className="rounded border border-line p-1.5 text-slate-500 hover:border-risk-high/40 hover:text-risk-high"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-line bg-panel p-2.5">
      <div className="font-mono text-[9px] tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono-tnum text-[15px] font-semibold" style={{ color: color ?? '#e2e8f0' }}>
        {value}
      </div>
    </div>
  )
}
