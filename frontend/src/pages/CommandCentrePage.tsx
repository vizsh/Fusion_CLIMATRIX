import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  FileCheck2,
  Network,
  PieChart,
  Shield,
  Layers,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import KpiCard from '../components/ui/KpiCard'
import { GlobeScene } from '../components/globe/GlobeScene'
import { ALL_COMPANIES, computeDashboardKPIs } from '../lib/portfolioDashboard'
import { formatCr } from '../lib/palette'
import { useSimStore } from '../store/sim'
import { useUiStore } from '../store/ui'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

const SECONDARY_LINKS = [
  { to: '/dependency', icon: Network, label: 'Dependency Explorer', desc: 'Trace infrastructure bottlenecks' },
  { to: '/company', icon: Building2, label: 'Company Investigation', desc: 'Single-name margin loss breakdown' },
  { to: '/portfolio', icon: PieChart, label: 'Financial Impact', desc: 'Sector attribution & balance-sheet bridge' },
  { to: '/mitigation', icon: Shield, label: 'Mitigation Studio', desc: 'Intervention ROI & capital allocation' },
  { to: '/evidence', icon: FileCheck2, label: 'Evidence & Reports', desc: 'Data provenance & methodology audit' },
]

const RBI_STATS = [
  { label: 'Flood Scenario', value: '+66.1%', sub: 'Sector capital stress' },
  { label: 'Cyclone Scenario', value: '+65.8%', sub: 'Coastal book write-down' },
  { label: 'Tail-Risk Scenario', value: '+138.0%', sub: 'Compound systemic shock' },
]

export default function CommandCentrePage() {
  const navigate = useNavigate()
  const { region, hazard, severity, durationMonths, run } = useScenarioStore()

  // Real calculated portfolio KPIs from deterministic financial model
  const kpis = useMemo(() => computeDashboardKPIs(ALL_COMPANIES), [])

  // 3D Earth simulation store
  const runSim = useSimStore((s) => s.run)
  const result = useSimStore((s) => s.result)
  const hiddenOnly = useUiStore((s) => s.hiddenOnly)
  const toggleHiddenOnly = useUiStore((s) => s.toggleHiddenOnly)
  const play = useUiStore((s) => s.play)
  const playing = useUiStore((s) => s.playing)

  // Initialize baseline simulation and trigger propagation playback on load
  useEffect(() => {
    void runSim().then(() => useUiStore.getState().play())
  }, [runSim])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="COMMAND CENTRE"
        subtitle="PHYSICAL CLIMATE RISK & SYSTEMIC TRANSMISSION WORKSTATION"
        tag="FIN-04 · RBI CLIMATE VAST STANDARD"
        actions={
          <button
            onClick={() => {
              run()
              navigate('/twin')
            }}
            className="flex items-center gap-1.5 rounded border border-accent-teal/40 bg-accent-teal/10 px-3 py-1 font-mono text-[11px] font-semibold text-accent-teal hover:bg-accent-teal/20 transition-colors cursor-pointer"
          >
            <span>LAUNCH RUN</span>
            <ArrowRight size={12} />
          </button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* Top High-Value Institutional KPI Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Modeled Stressed ECL"
            value={`₹${kpis.stressedElCr.toFixed(1)}`}
            unit="Cr"
            comparison="+66.1% vs Baseline"
            comparisonTone="coral"
            evidence="modelled"
            subtitle="RBI Pilot Benchmark"
          />

          <KpiCard
            label="Climate-Exposed EAD"
            value={`₹${kpis.climateExposedEADCr.toFixed(0)}`}
            unit="Cr"
            comparison={`${(kpis.climateExposedShare * 100).toFixed(1)}% of Portfolio`}
            comparisonTone="amber"
            evidence="sourced"
            subtitle={`₹${kpis.totalEADCr.toLocaleString()} Cr Total Book`}
          />

          <KpiCard
            label="Physical Protection Gap"
            value={`${(kpis.protectionGapShare * 100).toFixed(1)}%`}
            unit="Uninsured"
            comparison={`₹${kpis.protectionGapEADCr.toFixed(0)} Cr Unhedged`}
            comparisonTone="coral"
            evidence="modelled"
            subtitle="Commercial & Infra Assets"
          />

          <KpiCard
            label="Active Shock Dial"
            value={`${severity}%`}
            unit="Severity"
            comparison={`${durationMonths}M Horizon · ${hazard}`}
            comparisonTone="teal"
            evidence="assumption"
            subtitle={REGION_LABEL[region]}
          />
        </div>

        {/* Main Workstation: Left Analytical Story + Right Dominant 3D Geospatial Twin */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Contextual Risk Transmission & Launch Controls */}
          <div className="xl:col-span-5 flex flex-col space-y-5">
            {/* Risk Transmission Overview */}
            <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-teal">
                  TRANSMISSION CHAIN
                </span>
                <span className="font-mono text-[10px] text-text-muted">
                  STEP 1 → 4
                </span>
              </div>

              <h2 className="text-[19px] font-semibold tracking-tight text-text-primary leading-snug">
                When the landscape fails, <span className="text-accent-teal">what breaks next?</span>
              </h2>

              <p className="mt-2.5 text-[12.5px] leading-relaxed text-text-secondary">
                CLIMATRIX tracks the physical shock from hazard touchdown through road/grid
                infrastructure failures, single-source supplier shutdowns, borrower balance-sheet
                stress, and institutional capital losses.
              </p>

              {/* Transmission Pipeline Diagram */}
              <div className="mt-4 grid grid-cols-4 gap-1.5 pt-3 border-t border-border-subtle/60 text-center font-mono">
                <div className="p-2 rounded bg-bg-elevated/70 border border-border-subtle">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Hazard</div>
                  <div className="mt-1 text-[11px] font-semibold text-critical-coral truncate">{hazard}</div>
                </div>
                <div className="p-2 rounded bg-bg-elevated/70 border border-border-subtle">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Infra</div>
                  <div className="mt-1 text-[11px] font-semibold text-warning-amber truncate">Road/Grid</div>
                </div>
                <div className="p-2 rounded bg-bg-elevated/70 border border-border-subtle">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Borrower</div>
                  <div className="mt-1 text-[11px] font-semibold text-accent-blue truncate">Margin Loss</div>
                </div>
                <div className="p-2 rounded bg-bg-elevated/70 border border-border-subtle">
                  <div className="text-[9px] text-text-muted uppercase tracking-wider">Portfolio</div>
                  <div className="mt-1 text-[11px] font-semibold text-accent-teal truncate">ECL Shock</div>
                </div>
              </div>
            </div>

            {/* Scenario Stress Launcher Box */}
            <div className="rounded-xl border border-accent-teal/30 bg-bg-card p-5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
                  ACTIVE SCENARIO SPECIFICATION
                </span>
                <span className="font-mono text-[10px] text-accent-teal font-semibold">
                  {durationMonths} MONTH HORIZON
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div className="text-[17px] font-bold text-text-primary">
                  {REGION_LABEL[region]} · <span className="text-accent-teal">{hazard}</span>
                </div>
                <div className="font-mono text-[12px] font-semibold text-critical-coral">
                  {severity}% STRESS
                </div>
              </div>

              {/* Stress Dial Progress */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-elevated border border-border-subtle">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-teal via-warning-amber to-critical-coral transition-all duration-300"
                  style={{ width: `${severity}%` }}
                />
              </div>

              <button
                onClick={() => {
                  run()
                  navigate('/twin')
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-critical-coral/50 bg-critical-coral/10 hover:bg-critical-coral/20 py-3 font-mono text-[12px] font-bold tracking-[0.1em] text-critical-coral transition-colors cursor-pointer shadow-sm"
              >
                <span>RUN SCENARIO IN DIGITAL TWIN</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {/* RBI Climate VAST Exercise Benchmarks */}
            <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
                  REGULATORY BENCHMARK · RBI 2024
                </span>
                <span className="font-mono text-[9.5px] text-text-muted">
                  15 SCHEDULED BANKS
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {RBI_STATS.map((s) => (
                  <div key={s.label} className="p-2.5 rounded bg-bg-elevated border border-border-subtle/70">
                    <div className="font-mono text-[18px] font-bold text-critical-coral leading-none">
                      {s.value}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-text-primary mt-1.5 truncate">
                      {s.label}
                    </div>
                    <div className="text-[9.5px] text-text-muted mt-0.5 truncate">
                      {s.sub}
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[10.5px] leading-relaxed text-text-muted border-t border-border-subtle/50 pt-2.5">
                Reported exploratory credit-loss potential from the Reserve Bank of India climate pilot.
                The baseline calibration this workstation is structured against.
              </p>
            </div>

            {/* Quick Navigation to Investigative Tools */}
            <div className="rounded-xl border border-border-subtle bg-bg-card p-4 shadow-sm">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted mb-2.5">
                INVESTIGATION WORKSPACES
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SECONDARY_LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-text-secondary hover:border-accent-teal/40 hover:text-text-primary transition-all group"
                  >
                    <l.icon size={14} className="text-accent-teal shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-text-primary truncate">
                        {l.label}
                      </span>
                      <span className="text-[9.5px] text-text-muted truncate">
                        {l.desc}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Dominant 3D Geospatial Digital Twin (60-70% Workspace) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="xl:col-span-7 flex flex-col rounded-xl border border-border-subtle bg-bg-card shadow-lg overflow-hidden relative"
          >
            {/* Top Workspace Header Bar */}
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-elevated px-4 py-3 z-20">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-teal opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-teal"></span>
                </span>
                <span className="font-mono text-[11px] font-bold tracking-[0.14em] text-text-primary">
                  PLANETARY 3D DIGITAL TWIN
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border-subtle bg-bg-card text-text-muted">
                  ORTHOGRAPHIC INDIA
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to="/twin"
                  className="flex items-center gap-1.5 rounded border border-accent-teal/40 bg-accent-teal/10 hover:bg-accent-teal/20 px-2.5 py-1 font-mono text-[10px] font-semibold text-accent-teal transition-colors cursor-pointer"
                >
                  <Layers size={11} />
                  <span>REGIONAL TERRAIN MAP</span>
                  <ArrowRight size={10} />
                </Link>
              </div>
            </div>

            {/* 3D Canvas Container */}
            <div className="relative w-full h-[540px] sm:h-[600px] xl:h-[660px] bg-[#07090D]">
              <GlobeScene />

              {/* Top-Left Shock Vector Readout */}
              {result && (
                <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 rounded-lg border border-border-subtle bg-bg-elevated/90 px-3 py-2 shadow-md backdrop-blur-md">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    ACTIVE SHOCK VECTOR
                  </div>
                  <div className="mt-0.5 text-[12px] font-bold text-text-primary">
                    {result.hazard.name}
                  </div>
                  <div className="font-mono text-[9.5px] text-accent-teal">
                    {result.scenarioId}
                  </div>
                </div>
              )}

              {/* Bottom In-Globe Floating HUD */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4 sm:p-5 bg-gradient-to-t from-[#07090D] via-[#07090D]/85 to-transparent">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  {/* Action Buttons */}
                  <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={play}
                      disabled={!result || playing}
                      className="flex items-center gap-1.5 border border-accent-teal/60 bg-accent-teal/15 hover:bg-accent-teal/25 px-3 py-1.5 font-mono text-[11px] font-bold tracking-wider uppercase text-accent-teal backdrop-blur-sm transition-colors disabled:opacity-40 cursor-pointer rounded"
                    >
                      <span>{playing ? 'PROPAGATING…' : '▶ RUN PROPAGATION'}</span>
                    </button>

                    <button
                      onClick={toggleHiddenOnly}
                      className="border border-border-subtle bg-bg-card/90 hover:border-text-muted px-3 py-1.5 font-mono text-[11px] font-medium tracking-wider uppercase backdrop-blur-sm transition-colors cursor-pointer rounded"
                      style={hiddenOnly ? { borderColor: 'var(--color-ev-assumed)' } : undefined}
                    >
                      <span style={hiddenOnly ? { color: 'var(--color-ev-assumed)' } : { color: '#A9B7C7' }}>
                        HIDDEN EXPOSURE ONLY
                      </span>
                    </button>
                  </div>

                  {/* Impact Summary Pill */}
                  {result && (
                    <div className="pointer-events-auto flex items-center gap-4 bg-bg-elevated/90 border border-border-subtle px-3.5 py-1.5 rounded-lg shadow-sm backdrop-blur-md">
                      <div>
                        <div className="font-mono text-[14px] font-bold text-text-primary tabular-nums">
                          {result.totals.affectedEntities}
                        </div>
                        <div className="font-mono text-[8.5px] text-text-muted uppercase tracking-wider">
                          AFFECTED
                        </div>
                      </div>
                      <div className="w-px h-6 bg-border-subtle" />
                      <div>
                        <div className="font-mono text-[14px] font-bold tabular-nums" style={{ color: 'var(--color-ev-assumed)' }}>
                          {result.totals.hiddenExposureCount}
                        </div>
                        <div className="font-mono text-[8.5px] text-text-muted uppercase tracking-wider">
                          HIDDEN
                        </div>
                      </div>
                      <div className="w-px h-6 bg-border-subtle" />
                      <div>
                        <div className="font-mono text-[14px] font-bold text-accent-teal tabular-nums">
                          {formatCr(result.totals.deltaEl_cr)}
                        </div>
                        <div className="font-mono text-[8.5px] text-text-muted uppercase tracking-wider">
                          DELTA ECL
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-2.5 text-[10px] text-text-muted font-mono flex items-center justify-between">
                  <span>Interactive: Drag to rotate · Scroll to zoom · Hover entities for loss details</span>
                  <span className="hidden sm:inline text-text-muted/70">Ortho Projection (R3F)</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
