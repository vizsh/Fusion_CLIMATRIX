import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import { computeBottlenecks } from '../lib/graphAnalytics'
import { SECTOR_VULNERABILITY } from '../lib/sectorVulnerability'
import { computeImpact, useScenarioStore } from '../store/useScenarioStore'

export default function PortfolioImpactPage() {
  const state = useScenarioStore()
  const impact = computeImpact(state)
  const bottlenecks = computeBottlenecks(5)

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
        data: impact.bySector.map((s) => s.sector),
        axisLine: { lineStyle: { color: '#1c2430' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10.5, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          type: 'bar',
          data: impact.bySector.map((s) => Number(s.stressedEl.toFixed(2))),
          barWidth: 14,
          itemStyle: { color: '#fb3a4a', borderRadius: [0, 3, 3, 0] },
        },
      ],
      tooltip: { trigger: 'axis', axisPointer: { type: 'none' } },
    }),
    [impact.bySector],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="PORTFOLIO IMPACT"
        subtitle="BASELINE · STRESSED · MITIGATED — TRANSPARENT FINANCIAL TRANSMISSION"
        tag="ECL = EAD × PD × LGD, PER BORROWER, SECTOR-WEIGHTED"
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

        <div className="mb-6 rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.15em] text-slate-500">
            <span>SENSITIVITY TO SEVERITY (±15%)</span>
            <span className="text-slate-400">
              ₹{impact.stressedElLow.toFixed(2)} cr — ₹{impact.stressedElHigh.toFixed(2)} cr
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="absolute h-full rounded-full bg-risk-high/30"
              style={{
                left: `${(impact.stressedElLow / impact.stressedElHigh) * 100}%`,
                right: 0,
              }}
            />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-risk-high"
              style={{ left: `${(impact.stressedEl / impact.stressedElHigh) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-slate-600">
            Point estimate shown as the marker. Band is a disclosed sensitivity test — rerunning
            the same formula at severity ±15% — not a Monte Carlo or confidence interval.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              PD / LGD — BASELINE VS STRESSED (EAD-WEIGHTED AVG)
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
              SECTOR ATTRIBUTION — STRESSED EL (₹ CR)
            </div>
            {impact.bySector.length ? (
              <ReactECharts option={option} style={{ height: 180 }} />
            ) : (
              <p className="text-[11px] text-slate-600">No companies reachable from the current hazard.</p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            SECTOR VULNERABILITY MULTIPLIERS (DISCLOSED ASSUMPTION)
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SECTOR_VULNERABILITY).map(([sector, mult]) => (
              <div key={sector} className="rounded border border-line px-2 py-1 text-[10.5px] text-slate-400">
                {sector} <span className="font-mono-tnum text-slate-300">×{mult.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-slate-600">
            Multiplies the severity factor before it enters the stressed-PD formula, so e.g.
            Tourism stresses harder than IT/BPO under the identical scenario — a disclosed
            modeling assumption, not an empirically calibrated result.
          </p>
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
          stressed PD/LGD is computed individually (sector vulnerability applied per company) and
          summed once — this view does not add overlapping supplier, infrastructure and borrower
          impacts as if they were independent losses. Public reconstruction costs are not included
          here — see the Digital Twin's government-finance nodes, modeled as a separate layer.
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
