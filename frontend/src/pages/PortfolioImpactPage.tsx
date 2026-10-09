import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import { computeBottlenecks, computeHazardReach, REGION_HAZARD } from '../lib/graphAnalytics'
import { computeImpact, useScenarioStore } from '../store/useScenarioStore'

export default function PortfolioImpactPage() {
  const state = useScenarioStore()
  const impact = computeImpact(state)
  const hazardId = REGION_HAZARD[state.region]
  const reach = computeHazardReach(hazardId)
  const bottlenecks = computeBottlenecks(5)

  const sectorData = useMemo(() => {
    const bySector = new Map<string, number>()
    for (const c of reach.companies) {
      const key = c.sector ?? 'Other'
      bySector.set(key, (bySector.get(key) ?? 0) + (c.eadCr ?? 0))
    }
    return Array.from(bySector.entries()).sort((a, b) => b[1] - a[1])
  }, [reach.companies])

  const option = useMemo(
    () => ({
      backgroundColor: 'transparent',
      grid: { left: 140, right: 24, top: 10, bottom: 24 },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#141a24' } },
        axisLabel: { color: '#64748b', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: sectorData.map(([s]) => s),
        axisLine: { lineStyle: { color: '#1c2430' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10.5, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          type: 'bar',
          data: sectorData.map(([, v]) => Math.round(v)),
          barWidth: 14,
          itemStyle: { color: '#22d3ee', borderRadius: [0, 3, 3, 0] },
        },
      ],
      tooltip: { trigger: 'axis', axisPointer: { type: 'none' } },
    }),
    [sectorData],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="PORTFOLIO IMPACT"
        subtitle="BASELINE · STRESSED · MITIGATED — TRANSPARENT FINANCIAL TRANSMISSION"
        tag="ECL = EAD × PD × LGD"
      />

      <div className="bg-grid p-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <BigStat label="Reachable portfolio EAD" value={`₹${impact.eadCr.toFixed(0)} cr`} color="#94a3b8" />
          <BigStat label="Baseline expected loss" value={`₹${impact.baselineEl.toFixed(2)} cr`} color="#2dd4a7" />
          <BigStat label="Stressed expected loss" value={`₹${impact.stressedEl.toFixed(2)} cr`} color="#fb3a4a" />
          <BigStat label="Incremental ECL (Δ)" value={`₹${impact.incrementalEl.toFixed(2)} cr`} color="#f5a524" />
        </motion.div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              PD / LGD — BASELINE VS STRESSED
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="PD baseline → stressed" value={`${(impact.baselinePd * 100).toFixed(1)}% → ${(impact.stressedPd * 100).toFixed(1)}%`} />
              <MiniStat label="LGD baseline → stressed" value={`${(impact.baselineLgd * 100).toFixed(0)}% → ${(impact.stressedLgd * 100).toFixed(0)}%`} />
              <MiniStat label="Borrowers in scope" value={`${impact.companyCount}`} />
              <MiniStat label="Intervention(s) active" value={`${state.interventions.length}`} />
            </div>
            {state.interventions.length > 0 && (
              <div className="mt-3 rounded border border-risk-low/30 bg-risk-low/[0.06] p-2.5 text-[11px] text-risk-low">
                Mitigated expected loss: ₹{impact.mitigatedEl.toFixed(2)} cr — ₹{impact.avoidedEl.toFixed(2)} cr
                modeled avoided loss. See Mitigation Studio for the full comparison.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              SECTOR ATTRIBUTION — REACHABLE EAD (₹ CR)
            </div>
            {sectorData.length ? (
              <ReactECharts option={option} style={{ height: 180 }} />
            ) : (
              <p className="text-[11px] text-slate-600">No companies reachable from the current hazard.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            LARGEST CONTRIBUTING RISK PATHWAYS
          </div>
          <div className="space-y-2">
            {bottlenecks.map((b) => (
              <div key={b.node.id} className="flex items-center justify-between border-b border-line-soft py-2 text-[12px]">
                <span className="text-slate-300">{b.node.label}</span>
                <span className="font-mono-tnum text-risk-med">₹{b.reachedEAD} cr via {b.reachedCompanies.length} borrowers</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-[10.5px] leading-relaxed text-slate-600">
          ECL = EAD × PD × LGD. Incremental ECL = Stressed ECL − Baseline ECL. Each borrower's
          operational and credit effect is counted once; this view does not add overlapping
          supplier, infrastructure and borrower impacts as if they were independent losses. Public
          reconstruction costs are not included here — see the Digital Twin's government-finance
          nodes, which are modeled as a separate layer.
        </p>
      </div>
    </div>
  )
}

function BigStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-4">
      <div className="font-mono text-[9px] tracking-wide text-slate-500">{label.toUpperCase()}</div>
      <div className="mt-1.5 font-mono-tnum text-xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-wide text-slate-500">{label}</div>
      <div className="font-mono-tnum text-[13px] text-slate-200">{value}</div>
    </div>
  )
}
