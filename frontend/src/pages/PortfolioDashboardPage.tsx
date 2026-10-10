// Portfolio Dashboard — the investor/institution landing view: a KPI
// strip, physical-vs-transition risk split, sector sensitivity vs.
// contribution, a near/medium/long horizon comparison, derived alerts,
// and a named-portfolio picker so "my portfolio" can mean an actual named
// subset of holdings instead of implicitly the whole graph. Every figure
// here comes from lib/portfolioDashboard.ts calling the same engine
// (stressPdLgd, computeEquityImpact, computeProtectionGap) every other
// page already uses.

import { AlertTriangle, Briefcase, ChevronDown, Download, Info, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { generatePortfolioTrajectoryBriefPdf } from '../lib/briefGenerators'
import {
  INTENSIFICATION_PATHWAYS,
  TRAJECTORY_AMBIENT_SEVERITY,
  computePortfolioTrajectory,
  generatePortfolioTrajectoryRecommendations,
  type IntensificationPathway,
} from '../lib/climateTrajectory'
import { ALL_COMPANIES, HEADLINE_DURATION, HEADLINE_SEVERITY, buildDashboardSnapshot, companiesInPortfolio } from '../lib/portfolioDashboard'
import { useScenarioStore } from '../store/useScenarioStore'

const PATHWAYS: IntensificationPathway[] = ['Low', 'Moderate', 'High']
const REC_COLOR: Record<string, string> = {
  act: 'border-risk-high/40 bg-risk-high/[0.06]',
  watch: 'border-risk-med/40 bg-risk-med/[0.06]',
  info: 'border-cyan/30 bg-cyan/[0.05]',
}
const REC_BADGE: Record<string, string> = {
  act: 'border-risk-high/40 bg-risk-high/10 text-risk-high',
  watch: 'border-risk-med/40 bg-risk-med/10 text-risk-med',
  info: 'border-cyan/40 bg-cyan/10 text-cyan',
}

function fmtCr(n: number) {
  return `₹${n.toFixed(0)} cr`
}

const LEVEL_COLOR: Record<string, string> = {
  High: 'border-risk-high/40 bg-risk-high/10 text-risk-high',
  Medium: 'border-risk-med/40 bg-risk-med/10 text-risk-med',
  Info: 'border-line text-slate-400',
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3.5">
      <div className="font-mono text-[9px] tracking-[0.15em] text-slate-500">{label}</div>
      <div className="mt-1 text-[20px] font-semibold" style={{ color: tone ?? '#e2e8f0' }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[10px] leading-relaxed text-slate-600">{sub}</div>}
    </div>
  )
}

function PortfolioBuilder({ onClose }: { onClose: () => void }) {
  const createPortfolio = useScenarioStore((s) => s.createPortfolio)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-cyan/30 bg-panel-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.15em] text-cyan">NEW PORTFOLIO</div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X size={14} />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name this portfolio…"
        className="mb-3 w-full rounded border border-line bg-panel px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
      />
      <div className="mb-3 max-h-48 overflow-y-auto rounded border border-line">
        {ALL_COMPANIES.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-line px-2.5 py-1.5 text-[11px] text-slate-300 last:border-0 hover:bg-panel">
            <input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} className="accent-cyan" />
            <span className="flex-1 truncate">{c.label}</span>
            <span className="font-mono text-[9.5px] text-slate-600">{c.sector}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">{picked.size} of {ALL_COMPANIES.length} holdings selected</span>
        <button
          disabled={!name.trim() || picked.size === 0}
          onClick={() => {
            createPortfolio(name.trim(), Array.from(picked))
            onClose()
          }}
          className="rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save portfolio
        </button>
      </div>
    </div>
  )
}

export default function PortfolioDashboardPage() {
  const portfolios = useScenarioStore((s) => s.portfolios)
  const activePortfolioId = useScenarioStore((s) => s.activePortfolioId)
  const setActivePortfolio = useScenarioStore((s) => s.setActivePortfolio)
  const deletePortfolio = useScenarioStore((s) => s.deletePortfolio)
  const policyStringency = useScenarioStore((s) => s.policyStringency)
  const setPolicyStringency = useScenarioStore((s) => s.setPolicyStringency)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [pathway, setPathway] = useState<IntensificationPathway>('Moderate')
  const trajectoryChartRef = useRef<ReactECharts>(null)
  const trajectoryChartWrapRef = useRef<HTMLDivElement>(null)

  // ReactECharts measures its container once at mount; inside this
  // fractional grid column that measurement can happen before the grid
  // itself has settled a real width, leaving the canvas stuck at 0×200
  // forever (its own ResizeObserver doesn't always catch a parent going
  // from 0 to a real size on the very next paint). Watching the wrapper
  // ourselves and forcing echarts to resize fixes it reliably.
  useEffect(() => {
    const el = trajectoryChartWrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      trajectoryChartRef.current?.getEchartsInstance().resize()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId) ?? null
  const snapshot = useMemo(() => buildDashboardSnapshot(activePortfolio, policyStringency), [activePortfolio, policyStringency])
  const maxHorizonEl = Math.max(...snapshot.horizons.map((h) => h.stressedElCr), 1e-9)
  const maxSectorContribution = Math.max(...snapshot.sectorRisk.map((s) => s.contribution), 1e-9)

  const portfolioCompanies = useMemo(() => companiesInPortfolio(activePortfolio), [activePortfolio])
  const trajectory = useMemo(
    () => computePortfolioTrajectory(portfolioCompanies, pathway, policyStringency, TRAJECTORY_AMBIENT_SEVERITY, HEADLINE_DURATION),
    [portfolioCompanies, pathway, policyStringency],
  )
  const trajectoryRecs = useMemo(() => generatePortfolioTrajectoryRecommendations(trajectory, pathway), [trajectory, pathway])

  const trajectoryChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      grid: { left: 56, right: 20, top: 24, bottom: 30 },
      xAxis: {
        type: 'category',
        data: trajectory.points.map((p) => String(p.calendarYear)),
        axisLine: { lineStyle: { color: '#1c2430' } },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: '#141a24' } },
        axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => `₹${v.toFixed(0)}cr` },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f1620',
        borderColor: '#1c2430',
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params: { dataIndex: number }[]) => {
          const p = trajectory.points[params[0].dataIndex]
          return `${p.calendarYear} (severity ${p.severity}/100)<br/>Physical: ₹${p.stressedElCr.toFixed(0)} cr<br/>Transition: ₹${p.transitionAtRiskCr.toFixed(0)} cr<br/><b>Combined: ₹${p.combinedCr.toFixed(0)} cr</b>`
        },
      },
      series: [
        {
          name: 'Combined climate-adjusted loss',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#22d3ee', width: 2.5 },
          itemStyle: { color: '#22d3ee' },
          areaStyle: { color: 'rgba(34, 211, 238, 0.12)' },
          data: trajectory.points.map((p) => Number(p.combinedCr.toFixed(1))),
        },
      ],
    }),
    [trajectory],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="PORTFOLIO DASHBOARD"
        subtitle="CLIMATE RISK, FINANCIAL IMPACT AND RESILIENCE AT A GLANCE"
        tag={`${snapshot.kpis.totalEADCr ? ALL_COMPANIES.filter((c) => (activePortfolio ? activePortfolio.companyIds.includes(c.id) : true)).length : 0} holdings`}
      />

      <div className="bg-grid space-y-5 p-6">
        {/* Portfolio picker */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className="flex items-center gap-2 rounded border border-line bg-panel-2 px-3 py-1.5 text-[12px] text-slate-200 hover:border-cyan/40"
          >
            <Briefcase size={13} className="text-cyan" />
            {activePortfolio ? activePortfolio.name : 'Full India Book (all holdings)'}
            <ChevronDown size={13} className="text-slate-500" />
          </button>
          {pickerOpen && (
            <div className="absolute z-10 mt-1 w-80 rounded-lg border border-line bg-panel-2 p-2 shadow-xl">
              <button
                onClick={() => {
                  setActivePortfolio(null)
                  setPickerOpen(false)
                }}
                className={`w-full rounded px-2.5 py-1.5 text-left text-[11.5px] hover:bg-panel ${!activePortfolioId ? 'text-cyan' : 'text-slate-300'}`}
              >
                Full India Book (all {ALL_COMPANIES.length} holdings)
              </button>
              {portfolios.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActivePortfolio(p.id)
                      setPickerOpen(false)
                    }}
                    className={`flex-1 rounded px-2.5 py-1.5 text-left text-[11.5px] hover:bg-panel ${activePortfolioId === p.id ? 'text-cyan' : 'text-slate-300'}`}
                  >
                    {p.name} <span className="text-slate-600">({p.companyIds.length})</span>
                  </button>
                  <button onClick={() => deletePortfolio(p.id)} className="p-1.5 text-slate-600 hover:text-risk-high">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setBuilderOpen(true)
                  setPickerOpen(false)
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded border-t border-line px-2.5 py-1.5 text-left text-[11.5px] text-cyan hover:bg-panel"
              >
                <Plus size={12} /> New portfolio
              </button>
            </div>
          )}
        </div>
        {builderOpen && <PortfolioBuilder onClose={() => setBuilderOpen(false)} />}

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi label="TOTAL PORTFOLIO EAD" value={fmtCr(snapshot.kpis.totalEADCr)} />
          <Kpi
            label="CLIMATE-EXPOSED VALUE"
            value={fmtCr(snapshot.kpis.climateExposedEADCr)}
            sub={`${(snapshot.kpis.climateExposedShare * 100).toFixed(1)}% of portfolio`}
            tone="#fb3a4a"
          />
          <Kpi label="REVENUE AT RISK" value={fmtCr(snapshot.kpis.revenueAtRiskCr)} sub={`severity ${HEADLINE_SEVERITY}/100, ${HEADLINE_DURATION}mo`} tone="#f5a524" />
          <Kpi label="EXPECTED CREDIT LOSS" value={fmtCr(snapshot.kpis.stressedElCr)} sub="common stress scan" tone="#a78bfa" />
          <Kpi
            label="PROTECTION GAP"
            value={`${(snapshot.kpis.protectionGapShare * 100).toFixed(0)}%`}
            sub={`${fmtCr(snapshot.kpis.protectionGapEADCr)} uninsured`}
            tone="#22d3ee"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Physical vs transition */}
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-1 font-mono text-[10px] tracking-[0.15em] text-slate-500">PHYSICAL VS. TRANSITION RISK</div>
            <p className="mb-3 text-[10.5px] leading-relaxed text-slate-600">
              Two separate, disclosed lenses — a sector can be a physical-risk beneficiary (reconstruction demand) while carrying high transition risk (carbon-intensive process), or the reverse.
            </p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded border border-line bg-panel p-3">
                <div className="font-mono text-[9px] tracking-wide text-slate-500">PHYSICAL — STRESSED EL</div>
                <div className="font-mono text-[16px] font-semibold text-risk-high">{fmtCr(snapshot.kpis.stressedElCr)}</div>
              </div>
              <div className="rounded border border-line bg-panel p-3">
                <div className="font-mono text-[9px] tracking-wide text-slate-500">TRANSITION — AT RISK</div>
                <div className="font-mono text-[16px] font-semibold text-amber-400">{fmtCr(snapshot.transition.transitionAtRiskCr)}</div>
              </div>
            </div>
            <div className="mb-1 flex items-center justify-between font-mono text-[9.5px] text-slate-500">
              <span>POLICY STRINGENCY (illustrative dial)</span>
              <span className="text-cyan">{policyStringency}/100</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={policyStringency}
              onChange={(e) => setPolicyStringency(Number(e.target.value))}
              className="w-full accent-cyan"
            />
            <div className="mt-2 space-y-1">
              {snapshot.transition.bySector.slice(0, 4).map((s) => (
                <div key={s.sector} className="flex items-center justify-between text-[10.5px] text-slate-400">
                  <span className="truncate">{s.sector}</span>
                  <span className="font-mono text-amber-400">{fmtCr(s.transitionAtRiskCr)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sensitivity vs contribution */}
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-1 font-mono text-[10px] tracking-[0.15em] text-slate-500">SECTOR SENSITIVITY VS. CONTRIBUTION</div>
            <p className="mb-3 text-[10.5px] leading-relaxed text-slate-600">
              Sensitivity = loss rate within the sector. Contribution = share of total portfolio stressed loss. A sector can be highly sensitive but contribute little (small allocation), or the reverse.
            </p>
            <div className="space-y-2">
              {snapshot.sectorRisk.slice(0, 6).map((s) => (
                <div key={s.sector}>
                  <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                    <span className="truncate">{s.sector}</span>
                    <span className="font-mono text-slate-500">
                      sensitivity {(s.sensitivity * 100).toFixed(1)}% · contributes {(s.contribution * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                    <div className="h-full rounded-full bg-cyan" style={{ width: `${(s.contribution / maxSectorContribution) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Horizon comparison */}
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-1 font-mono text-[10px] tracking-[0.15em] text-slate-500">EXPOSURE BY HORIZON</div>
            <p className="mb-3 text-[10.5px] leading-relaxed text-slate-600">
              Near/medium/long-term stress dials, portfolio-wide — not calendar-year climate projections this prototype has no data to back.
            </p>
            <div className="flex items-end gap-4" style={{ height: 140 }}>
              {snapshot.horizons.map((h) => (
                <div key={h.horizon} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="font-mono text-[10px] text-slate-300">{fmtCr(h.stressedElCr)}</span>
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-cyan/20 to-cyan/60"
                    style={{ height: `${Math.max((h.stressedElCr / maxHorizonEl) * 100, 4)}%` }}
                  />
                  <span className="font-mono text-[9px] text-slate-500">{h.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-lg border border-line bg-panel-2 p-4">
            <div className="mb-1 flex items-center justify-between">
              <div className="font-mono text-[10px] tracking-[0.15em] text-slate-500">DERIVED ALERTS</div>
              <span title="Computed live from the current graph and a common stress scan — not a persisted or timestamped monitoring feed.">
                <Info size={12} className="text-slate-600" />
              </span>
            </div>
            <p className="mb-3 text-[10.5px] leading-relaxed text-slate-600">Derived from current graph &amp; scenario state — reproducible any time, not a live feed.</p>
            {snapshot.alerts.length === 0 ? (
              <div className="rounded border border-line px-3 py-4 text-center text-[10.5px] text-slate-600">No material concentrations found for this portfolio.</div>
            ) : (
              <div className="space-y-2">
                {snapshot.alerts.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded border border-line bg-panel p-2.5">
                    <span className={`mt-0.5 rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-wide ${LEVEL_COLOR[a.level]}`}>{a.level}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-200">
                        {a.level === 'High' && <AlertTriangle size={10} className="text-risk-high" />}
                        {a.title}
                      </div>
                      <div className="text-[10px] leading-relaxed text-slate-500">{a.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Long-term climate trajectory */}
        <div className="rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              <TrendingUp size={12} className="text-cyan" /> LONG-TERM CLIMATE TRAJECTORY
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded border border-line bg-panel p-0.5">
                {PATHWAYS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPathway(p)}
                    title={INTENSIFICATION_PATHWAYS[p].desc}
                    className={`rounded px-2.5 py-1 font-mono text-[9.5px] tracking-wide transition-colors ${
                      pathway === p ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  generatePortfolioTrajectoryBriefPdf(
                    activePortfolio ? activePortfolio.name : 'Full India Book',
                    trajectory,
                    trajectoryRecs,
                    pathway,
                  )
                }
                className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[9.5px] tracking-wide text-cyan hover:bg-cyan/20"
              >
                <Download size={11} /> BRIEF (PDF)
              </button>
            </div>
          </div>
          <p className="mb-3 max-w-3xl text-[10.5px] leading-relaxed text-slate-600">
            How this same book's combined physical + transition climate-adjusted loss evolves over a 20-year horizon
            under a selectable, disclosed intensification pathway — a gradual trajectory, not a single point-in-time
            stress test, with recommendations derived from where the curve actually goes.
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div ref={trajectoryChartWrapRef}>
              <ReactECharts ref={trajectoryChartRef} option={trajectoryChartOption} style={{ height: 200, width: '100%' }} />
              <div className="mt-1 text-center font-mono text-[9px] text-slate-600">
                {INTENSIFICATION_PATHWAYS[pathway].label} — {INTENSIFICATION_PATHWAYS[pathway].desc}
              </div>
            </div>
            <div className="space-y-2">
              {trajectoryRecs.map((r, i) => (
                <div key={i} className={`rounded border p-2.5 ${REC_COLOR[r.level]}`}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[7.5px] tracking-wide ${REC_BADGE[r.level]}`}>
                      {r.level.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-200">{r.title}</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{r.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
