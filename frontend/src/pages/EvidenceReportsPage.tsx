import { ChevronDown, Download } from 'lucide-react'
import { useState } from 'react'
import LiveNewsPanel from '../components/LiveNewsPanel'
import LiveWeatherPanel from '../components/LiveWeatherPanel'
import PageHeader from '../components/PageHeader'
import EvidenceBadge from '../components/ui/EvidenceBadge'
import { EVIDENCE_META, type EvidenceClass } from '../lib/evidence'
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
    detail: 'Computed from real elevation data (free Terrarium DEM tiles): water level is set to valley-floor elevation plus severity rise, then grown outward until terrain exceeds level. Disclosed geometric approximation, not calibrated hydraulic simulation.',
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
    detail: 'Computed live from scenario dials using transparent, disclosed formula — see Portfolio Impact for the full breakdown.',
  },
  {
    label: 'Sector vulnerability multipliers and sensitivity band (±15% severity)',
    cls: 'assumption',
    detail: 'A disclosed sector-sensitivity table (Tourism/Agri stress harder than IT/Pharma) and severity sensitivity re-run — not an empirical calibration or Monte Carlo confidence interval.',
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
    label: 'Insurance protection gap, claim estimates, insurer loss ratios',
    cls: 'assumption',
    detail: 'Sum insured, premium rate and deductible are disclosed illustrative figures on an incomplete subset of companies. Claim estimates use severity-scaled disruption fraction mechanic.',
  },
  {
    label: 'Company names, sectors, EAD, baseline PD/LGD, bank/supplier relationships',
    cls: 'synthetic',
    detail: 'Fabricated for this prototype demonstration. No real Indian borrower, bank or supplier private disclosure is compromised.',
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

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function downloadReport() {
    const lines = [
      '# CLIMATRIX INDIA — SCENARIO AUDIT & DISCLOSURE REPORT',
      `Generated: ${new Date().toISOString()}`,
      `Region: ${REGION_LABEL[state.region]}`,
      `Hazard: ${state.hazard}`,
      `Severity: ${state.severity}/100`,
      `Horizon: ${state.durationMonths} months`,
      `Substitutability: ${state.substitutability}`,
      '',
      '## Financial Transmission Summary',
      `Reachable EAD: Rs ${impact.eadCr.toFixed(0)} cr`,
      `Baseline EL: Rs ${impact.baselineEl.toFixed(2)} cr`,
      `Stressed EL: Rs ${impact.stressedEl.toFixed(2)} cr`,
      `Incremental ECL: Rs ${impact.incrementalEl.toFixed(2)} cr`,
      `Mitigated EL: Rs ${impact.mitigatedEl.toFixed(2)} cr`,
      `Interventions: ${state.interventions.length ? state.interventions.join(', ') : 'None'}`,
      '',
      '## Provenance & Methodology Audit',
      ...EVIDENCE_ITEMS.map((item) => `[${item.cls.toUpperCase()}] ${item.label}\n  -> ${item.detail}\n`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `climatrix-audit-${state.region.toLowerCase()}-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredItems = EVIDENCE_ITEMS.filter((item) => activeFilters.has(item.cls))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="EVIDENCE & REPORTS"
        subtitle="DATA PROVENANCE, METHODOLOGY AUDIT & REGULATORY COMPLIANCE"
        tag="FOUR-TIER DISCLOSURE VOCABULARY"
        actions={
          <button
            onClick={downloadReport}
            className="flex items-center gap-1.5 rounded-lg border border-accent-teal/40 bg-accent-teal/15 hover:bg-accent-teal/25 px-3 py-1 font-mono text-[11px] font-bold text-accent-teal transition-colors cursor-pointer"
          >
            <Download size={13} />
            <span>EXPORT AUDIT REPORT</span>
          </button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* Top Summary Banner */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              PROVENANCE CLASSIFICATION STANDARD
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              FILTER BY EVIDENCE TIER
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.keys(EVIDENCE_META) as EvidenceClass[]).map((cls) => {
              const active = activeFilters.has(cls)
              return (
                <button
                  key={cls}
                  onClick={() => toggleFilter(cls)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                    active
                      ? 'border-border-subtle bg-bg-elevated'
                      : 'border-border-subtle/50 bg-bg-card opacity-40 hover:opacity-75'
                  }`}
                >
                  <EvidenceBadge type={cls} size="sm" showTooltip={false} />
                  <span className="text-[10px] text-text-muted">
                    {EVIDENCE_ITEMS.filter((i) => i.cls === cls).length} Items
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Evidence Items List */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              MODEL INPUT AUDIT & FIELD PROVENANCE ({filteredItems.length})
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              CLICK ITEM TO INSPECT METHODOLOGY
            </span>
          </div>

          <div className="space-y-2">
            {filteredItems.map((item, idx) => {
              const isExpanded = expanded.has(idx)
              return (
                <div
                  key={idx}
                  onClick={() => toggleExpand(idx)}
                  className="rounded-lg border border-border-subtle bg-bg-elevated p-3 cursor-pointer hover:border-text-muted/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <EvidenceBadge type={item.cls} size="sm" />
                      <span className="font-mono text-[11.5px] font-semibold text-text-primary leading-snug">
                        {item.label}
                      </span>
                    </div>
                    <ChevronDown
                      size={14}
                      className={`text-text-muted shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-border-subtle/60 pl-2">
                      <p className="text-[12px] leading-relaxed text-text-secondary font-sans">
                        {item.detail}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Live Weather & News Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <LiveWeatherPanel />
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <LiveNewsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
