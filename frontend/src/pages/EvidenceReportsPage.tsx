import { ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { EVIDENCE_META, type EvidenceClass } from '../lib/evidence'
import { INTERVENTIONS } from '../lib/interventions'
import { computeImpact, REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

interface EvidenceItem {
  label: string
  cls: EvidenceClass
  detail: string
}

const EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    label: 'RBI pilot VAST results (+66.1% flood, +65.8% cyclone, +138% tail-risk credit-loss potential)',
    cls: 'sourced',
    detail: 'RBI Bulletin, "Climate Stress Testing and Scenario Analysis", 18 January 2024 — scenario-model outputs from a 2022 exploratory pilot across 15 banks, not realized historical losses.',
  },
  {
    label: 'Himachal Pradesh 2023 recovery allocation — ₹2,006.40 cr',
    cls: 'sourced',
    detail: 'Government of India central-share approval, June 2025, for 2023 disaster recovery and reconstruction — a public-finance figure, not a bank credit loss.',
  },
  {
    label: 'District boundaries (Himachal Pradesh, Kerala, Maharashtra)',
    cls: 'sourced',
    detail: 'Real district polygons from a public India shapefile dataset, simplified for this prototype.',
  },
  {
    label: 'District-level hazard risk scores (choropleth on the Digital Twin)',
    cls: 'assumption',
    detail: 'Illustrative severity estimates informed by which districts were worst affected in the named historical events — not an official hazard model output.',
  },
  {
    label: 'Flood extent ribbon on the Digital Twin (Himachal Pradesh)',
    cls: 'modelled',
    detail: 'Computed from real elevation data (the same free Terrarium DEM tiles used for 3D terrain): the water level is set to the valley-floor elevation plus a severity-scaled rise, then grown outward from the river/road corridor until the real terrain exceeds that level. This is a disclosed geometric approximation, not a calibrated hydrological or hydraulic flood simulation — it has no knowledge of river discharge, soil saturation, drainage or flood defenses.',
  },
  {
    label: 'Hazard → infrastructure edges in the dependency graph',
    cls: 'sourced',
    detail: 'Which infrastructure a hazard affects is grounded in which districts the documented disaster struck.',
  },
  {
    label: 'Infrastructure → supplier/company dependency edges',
    cls: 'modelled',
    detail: "Asserted operational dependencies inferred by this application's graph logic — a reasonable construction, not independently verified against real operations.",
  },
  {
    label: 'Stressed PD/LGD, expected credit loss (EAD × PD × LGD)',
    cls: 'modelled',
    detail: 'Computed live from the scenario dials using a transparent, disclosed formula — see Portfolio Impact for the full breakdown.',
  },
  {
    label: 'Sector vulnerability multipliers and sensitivity band (±15% severity)',
    cls: 'assumption',
    detail: "A disclosed sector-sensitivity table (Tourism and Agriculture stress harder than IT/BPO or Pharmaceuticals under the identical scenario) and a severity sensitivity re-run — not an empirically calibrated result, and not a Monte Carlo confidence interval.",
  },
  {
    label: 'Hidden concentration risk / institution concentration rankings',
    cls: 'modelled',
    detail: 'Computed via graph traversal (downstream reach, EAD summation) over the current dataset — a real computation over synthetic inputs.',
  },
  {
    label: 'Scenario severity dial, duration, substitutability setting',
    cls: 'assumption',
    detail: 'User-chosen stress inputs for this run. Severity is a stress dial, never a flood probability or measured damage rate.',
  },
  {
    label: 'Mitigation intervention cost and loss-reduction share',
    cls: 'assumption',
    detail: 'Illustrative cost/benefit assumptions for each intervention lever — not validated engineering or financial estimates.',
  },
  {
    label: 'Company names, sectors, EAD, baseline PD/LGD, bank/supplier relationships',
    cls: 'synthetic',
    detail: 'Entirely fabricated for this demonstration. No real Indian borrower, bank or supplier data is used anywhere in this prototype.',
  },
]

export default function EvidenceReportsPage() {
  const state = useScenarioStore()
  const impact = computeImpact(state)
  const [activeFilters, setActiveFilters] = useState<Set<EvidenceClass>>(
    new Set(Object.keys(EVIDENCE_META) as EvidenceClass[]),
  )
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleFilter(cls: EvidenceClass) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(cls)) next.delete(cls)
      else next.add(cls)
      return next
    })
  }

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function exportReport() {
    const activeInterventions = INTERVENTIONS.filter((i) => state.interventions.includes(i.id))
    const lines = [
      'CLIMATRIX INDIA — SCENARIO REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      '— SCENARIO CONFIGURATION —',
      `Region: ${REGION_LABEL[state.region]}`,
      `Hazard: ${state.hazard}`,
      `Severity: ${state.severity}/100 (user-defined stress dial)`,
      `Disruption horizon: ${state.durationMonths} months`,
      `Supplier substitutability: ${state.substitutability}`,
      `Interventions active: ${activeInterventions.length ? activeInterventions.map((i) => i.label).join(', ') : 'none'}`,
      '',
      '— FINANCIAL TRANSMISSION (modelled) —',
      `Reachable portfolio EAD: ₹${impact.eadCr.toFixed(1)} cr across ${impact.companyCount} borrower(s)`,
      `Baseline PD / LGD: ${(impact.baselinePd * 100).toFixed(2)}% / ${(impact.baselineLgd * 100).toFixed(1)}%`,
      `Stressed PD / LGD: ${(impact.stressedPd * 100).toFixed(2)}% / ${(impact.stressedLgd * 100).toFixed(1)}%`,
      `Baseline expected loss: ₹${impact.baselineEl.toFixed(2)} cr`,
      `Stressed expected loss: ₹${impact.stressedEl.toFixed(2)} cr (sensitivity band ₹${impact.stressedElLow.toFixed(2)}–₹${impact.stressedElHigh.toFixed(2)} cr at severity ±15%)`,
      `Incremental ECL: ₹${impact.incrementalEl.toFixed(2)} cr`,
      `Mitigated expected loss: ₹${impact.mitigatedEl.toFixed(2)} cr`,
      `Modeled avoided loss: ₹${impact.avoidedEl.toFixed(2)} cr (intervention cost ₹${impact.interventionCostCr.toFixed(1)} cr)`,
      '',
      '— EVIDENCE CLASSIFICATION —',
      ...EVIDENCE_ITEMS.map((e) => `[${EVIDENCE_META[e.cls].label.toUpperCase()}] ${e.label}`),
      '',
      'This report is generated from a prototype. Company, loan-exposure and relationship data',
      'are synthetic and must not be treated as real borrower, bank or portfolio records.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `climatrix-scenario-${state.region}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="EVIDENCE & REPORTS"
        subtitle="EVERY MAJOR RESULT, AUDITABLE"
        tag="SOURCED · MODELLED · ASSUMPTION · SYNTHETIC"
      />

      <div className="bg-grid p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EVIDENCE_META) as EvidenceClass[]).map((cls) => {
              const meta = EVIDENCE_META[cls]
              const active = activeFilters.has(cls)
              return (
                <button
                  key={cls}
                  onClick={() => toggleFilter(cls)}
                  className="rounded border px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors"
                  style={{
                    borderColor: active ? meta.color : '#1c2430',
                    color: active ? meta.color : '#64748b',
                    background: active ? `${meta.color}14` : 'transparent',
                  }}
                >
                  {meta.label.toUpperCase()}
                </button>
              )
            })}
          </div>
          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
          >
            <Download size={12} /> EXPORT SCENARIO REPORT
          </button>
        </div>

        <div className="max-w-3xl space-y-2">
          {EVIDENCE_ITEMS.filter((e) => activeFilters.has(e.cls)).map((e, i) => {
            const meta = EVIDENCE_META[e.cls]
            const isOpen = expanded.has(i)
            return (
              <div key={e.label} className="rounded-lg border border-line bg-panel-2">
                <button onClick={() => toggleExpand(i)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]"
                      style={{ borderColor: meta.color, color: meta.color }}
                    >
                      {meta.label.toUpperCase()}
                    </span>
                    <span className="text-[12px] text-slate-300">{e.label}</span>
                  </div>
                  <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-line-soft px-3 pb-3 pt-2 text-[11.5px] leading-relaxed text-slate-500">
                    <div className="mb-1.5 italic text-slate-600">{meta.desc}</div>
                    {e.detail}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
