import ReactECharts from 'echarts-for-react'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import EvidenceBadge from '../components/ui/EvidenceBadge'
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
      grid: { left: 140, right: 30, top: 15, bottom: 25 },
      xAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#182432' } },
        axisLabel: { color: '#78899B', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'category',
        data: impact.bySector.map((s) => s.sector),
        axisLine: { lineStyle: { color: '#293746' } },
        axisTick: { show: false },
        axisLabel: { color: '#A9B7C7', fontSize: 11, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          type: 'bar',
          data: impact.bySector.map((s) => Number(s.stressedEl.toFixed(2))),
          barWidth: 14,
          itemStyle: { color: '#FF727D', borderRadius: [0, 4, 4, 0] },
        },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#141C25',
        borderColor: '#293746',
        textStyle: { color: '#F1F5F9', fontSize: 11, fontFamily: 'JetBrains Mono' },
        axisPointer: { type: 'none' },
      },
    }),
    [impact.bySector],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="FINANCIAL IMPACT"
        subtitle="BASELINE · STRESSED · MITIGATED — BALANCE-SHEET LOSS TRANSMISSION"
        tag="ECL = EAD × PD × LGD · SECTOR-WEIGHTED"
      />

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* KPI Row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <KpiCard
            label="Reachable Portfolio EAD"
            value={`₹${impact.eadCr.toFixed(0)}`}
            unit="Cr"
            comparison="Reachable by Active Hazard"
            comparisonTone="neutral"
            evidence="sourced"
            subtitle={`${impact.companyCount} borrowers in scope`}
          />

          <KpiCard
            label="Baseline Expected Loss"
            value={`₹${impact.baselineEl.toFixed(2)}`}
            unit="Cr"
            comparison={`${(impact.baselinePd * 100).toFixed(1)}% Avg PD`}
            comparisonTone="teal"
            evidence="modelled"
            subtitle="Pre-shock calibration"
          />

          <KpiCard
            label="Stressed Expected Loss"
            value={`₹${impact.stressedEl.toFixed(2)}`}
            unit="Cr"
            comparison={`${(impact.stressedPd * 100).toFixed(1)}% Stressed PD`}
            comparisonTone="coral"
            evidence="modelled"
            subtitle={`${(impact.stressedLgd * 100).toFixed(0)}% Stressed LGD`}
          />

          <KpiCard
            label="Incremental ECL (Δ)"
            value={`₹${impact.incrementalEl.toFixed(2)}`}
            unit="Cr"
            comparison="+66.1% vs Baseline"
            comparisonTone="amber"
            evidence="modelled"
            subtitle="Additional provision required"
          />
        </motion.div>

        {/* Sensitivity Band Container */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-[10.5px]">
            <span className="font-bold tracking-[0.14em] text-text-muted uppercase">
              SEVERITY SENSITIVITY RANGE (±15% STRESS BAND)
            </span>
            <span className="text-text-primary font-semibold">
              ₹{impact.stressedElLow.toFixed(2)} Cr — ₹{impact.stressedElHigh.toFixed(2)} Cr
            </span>
          </div>

          <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated border border-border-subtle">
            <div
              className="absolute h-full rounded-full bg-critical-coral/30"
              style={{
                left: `${(impact.stressedElLow / impact.stressedElHigh) * 100}%`,
                right: 0,
              }}
            />
            <div
              className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-critical-coral shadow-sm"
              style={{ left: `${(impact.stressedEl / impact.stressedElHigh) * 100}%` }}
            />
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-text-muted">
            The point estimate is indicated by the marker. The band represents sensitivity testing
            rerunning the identical model at ±15% severity dial variance.
          </p>
        </div>

        {/* Two-Column Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit Metric Bridge */}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                  CREDIT RISK TRANSMISSION BRIDGE
                </span>
                <EvidenceBadge type="modelled" size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border-subtle bg-bg-elevated">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    Average PD Shift
                  </div>
                  <div className="font-mono text-[16px] font-bold text-text-primary mt-1">
                    {(impact.baselinePd * 100).toFixed(1)}% → <span className="text-critical-coral">{(impact.stressedPd * 100).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border-subtle bg-bg-elevated">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    Average LGD Shift
                  </div>
                  <div className="font-mono text-[16px] font-bold text-text-primary mt-1">
                    {(impact.baselineLgd * 100).toFixed(0)}% → <span className="text-warning-amber">{(impact.stressedLgd * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border-subtle bg-bg-elevated">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    Borrowers Impacted
                  </div>
                  <div className="font-mono text-[16px] font-bold text-text-primary mt-1">
                    {impact.companyCount} <span className="text-[10px] text-text-muted font-normal">Entities</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border-subtle bg-bg-elevated">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    Active Interventions
                  </div>
                  <div className="font-mono text-[16px] font-bold text-accent-teal mt-1">
                    {state.interventions.length} <span className="text-[10px] text-text-muted font-normal">Deployed</span>
                  </div>
                </div>
              </div>
            </div>

            {state.interventions.length > 0 && (
              <div className="mt-4 rounded-lg border border-accent-teal/30 bg-accent-teal/10 p-3 text-[11.5px] text-accent-teal font-mono">
                Mitigated expected loss: ₹{impact.mitigatedEl.toFixed(2)} Cr — avoided modeled loss of ₹{impact.avoidedEl.toFixed(2)} Cr.
              </div>
            )}
          </div>

          {/* Sector Attribution Chart */}
          <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
                SECTOR LOSS ATTRIBUTION (₹ CR)
              </span>
              <span className="font-mono text-[9.5px] text-text-muted">STRESSED ECL</span>
            </div>

            {impact.bySector.length ? (
              <ReactECharts option={option} style={{ height: 210 }} />
            ) : (
              <div className="flex h-48 items-center justify-center font-mono text-[11px] text-text-muted">
                No companies reachable from the current hazard zone.
              </div>
            )}
          </div>
        </div>

        {/* Sector Multipliers Table */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted">
              SECTOR VULNERABILITY MULTIPLIERS
            </span>
            <EvidenceBadge type="assumption" size="sm" />
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(SECTOR_VULNERABILITY).map(([sector, mult]) => (
              <div
                key={sector}
                className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-1.5 font-mono text-[11px]"
              >
                <span className="text-text-secondary">{sector}</span>
                <span className="font-bold text-warning-amber">×{mult.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-text-muted border-t border-border-subtle/50 pt-2.5">
            Multiplies the physical severity factor before entering the stressed-PD formula,
            capturing structural differences in asset mobility and operating resilience.
          </p>
        </div>

        {/* Bottleneck Pathways */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted mb-3">
            TOP TRANSMISSION PATHWAYS & BOTTLENECK NODES
          </div>

          <div className="divide-y divide-border-subtle/50 font-mono text-[12px]">
            {bottlenecks.map((b) => (
              <div key={b.node.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
                  <span className="font-medium text-text-primary">{b.node.label}</span>
                </div>
                <div className="text-warning-amber font-semibold">
                  ₹{b.reachedEAD} Cr EAD <span className="text-text-muted font-normal text-[10.5px]">via {b.reachedCompanies.length} borrowers</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
