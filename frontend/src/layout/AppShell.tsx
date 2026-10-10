import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileCheck2,
  Globe2,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Play,
  Shield,
  Sparkles,
  TrendingUp,
  Umbrella,
  Workflow,
  Menu,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import CopilotPanel from '../components/Copilot/CopilotPanel'
import PresentationOverlay from '../components/PresentationOverlay'
import { decodeShareParam } from '../lib/copilot/contextExport'
import type { Region } from '../store/useScenarioStore'
import { REGION_LABEL, useScenarioStore, useSimulationClock } from '../store/useScenarioStore'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutGrid
  badge?: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'CORE WORKSTATION',
    items: [
      { to: '/app', label: 'Command Centre', icon: LayoutGrid },
      { to: '/twin', label: 'Digital Twin (3D)', icon: Globe2 },
      { to: '/dependency', label: 'Exposure Graph', icon: Network },
      { to: '/company', label: 'Company Investigation', icon: Building2 },
    ],
  },
  {
    group: 'FINANCIAL STRESS',
    items: [
      { to: '/portfolio', label: 'Financial Impact', icon: PieChart },
      { to: '/dashboard', label: 'Portfolio Dashboard', icon: LayoutDashboard },
      { to: '/real-market', label: 'Market Sensitivity', icon: TrendingUp },
    ],
  },
  {
    group: 'SCENARIO & MITIGATION',
    items: [
      { to: '/scenario', label: 'Scenario Lab', icon: Workflow },
      { to: '/what-if', label: 'What-If Analysis', icon: Sparkles },
      { to: '/mitigation', label: 'Mitigation Studio', icon: Shield },
      { to: '/insurance', label: 'Insurance & Protection', icon: Umbrella },
    ],
  },
  {
    group: 'GOVERNANCE & AUDIT',
    items: [
      { to: '/evidence', label: 'Evidence & Reports', icon: FileCheck2 },
      { to: '/governance', label: 'Governance & Proposals', icon: ClipboardCheck },
    ],
  },
]

const RUN_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  idle: { label: 'STANDBY', dot: 'bg-text-muted', text: 'text-text-muted' },
  running: { label: 'SIMULATING', dot: 'bg-accent-teal animate-pulse', text: 'text-accent-teal' },
  paused: { label: 'PAUSED', dot: 'bg-warning-amber', text: 'text-warning-amber' },
  done: { label: 'COMPUTED', dot: 'bg-success-green', text: 'text-success-green' },
}

export default function AppShell() {
  useSimulationClock()
  const location = useLocation()

  const region = useScenarioStore((s) => s.region)
  const hazard = useScenarioStore((s) => s.hazard)
  const severity = useScenarioStore((s) => s.severity)
  const durationMonths = useScenarioStore((s) => s.durationMonths)
  const runState = useScenarioStore((s) => s.runState)
  const startPresentation = useScenarioStore((s) => s.startPresentation)
  const presentationActive = useScenarioStore((s) => s.presentationActive)
  const userMode = useScenarioStore((s) => s.userMode)
  const setUserMode = useScenarioStore((s) => s.setUserMode)
  const setRegion = useScenarioStore((s) => s.setRegion)
  const setHazard = useScenarioStore((s) => s.setHazard)
  const setSeverity = useScenarioStore((s) => s.setSeverity)
  const setDuration = useScenarioStore((s) => s.setDuration)
  const setSubstitutability = useScenarioStore((s) => s.setSubstitutability)

  const [searchParams, setSearchParams] = useSearchParams()
  const [importBanner, setImportBanner] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [regionMenuOpen, setRegionMenuOpen] = useState(false)

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const griidParam = searchParams.get('griid')
  useEffect(() => {
    const encoded = griidParam
    if (!encoded) return
    const decoded = decodeShareParam(encoded)
    if (decoded) {
      setRegion(decoded.region)
      setHazard(decoded.hazard)
      setSeverity(decoded.severity)
      setDuration(decoded.durationMonths)
      setSubstitutability(decoded.substitutability)
      setUserMode(decoded.userMode)
      setImportBanner(`Restored shared scenario: ${REGION_LABEL[decoded.region]} · ${decoded.hazard} · ${decoded.severity}%`)
    } else {
      setImportBanner('Could not read the shared scenario parameter.')
    }
    const next = new URLSearchParams(searchParams)
    next.delete('griid')
    setSearchParams(next, { replace: true })
    const t = setTimeout(() => setImportBanner(null), 6000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [griidParam])

  const status = RUN_STATUS[runState] || RUN_STATUS.idle

  return (
    <div className="flex h-screen w-screen flex-col bg-bg-main text-text-primary overflow-hidden">
      {/* Import Notification Banner */}
      {importBanner && (
        <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full border border-accent-teal/50 bg-bg-elevated/95 px-4 py-1.5 font-mono text-[11px] tracking-wide text-accent-teal shadow-xl backdrop-blur-md animate-in fade-in">
          {importBanner}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-secondary/95 px-3 sm:px-4 backdrop-blur z-30">
        <div className="flex items-center gap-3">
          {/* Mobile Drawer Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Platform Identity */}
          <Link to="/app" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded border border-accent-teal/30 bg-accent-teal/10 group-hover:border-accent-teal/50 transition-colors">
              <div className="h-2.5 w-2.5 rounded-full bg-accent-teal" />
            </div>
            <div className="flex flex-col">
              <div className="font-mono text-[13px] font-bold tracking-[0.14em] text-text-primary leading-none">
                CLIMATRIX <span className="text-accent-teal font-medium">INDIA</span>
              </div>
              <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-text-muted mt-0.5 hidden sm:inline">
                Climate Risk Intelligence
              </span>
            </div>
          </Link>

          <div className="hidden sm:block mx-1.5 h-4 w-px bg-border-subtle" />

          {/* Region Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setRegionMenuOpen(!regionMenuOpen)}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-bg-card px-2.5 py-1 text-left hover:border-text-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex flex-col">
                <span className="font-mono text-[8.5px] uppercase tracking-wider text-text-muted leading-tight">
                  REGION
                </span>
                <span className="font-mono text-[11px] font-semibold text-text-primary truncate max-w-[140px] sm:max-w-[190px]">
                  {REGION_LABEL[region]}
                </span>
              </div>
              <ChevronDown size={12} className="text-text-muted shrink-0 ml-1" />
            </button>

            {regionMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 rounded-lg border border-border-subtle bg-bg-elevated p-1.5 shadow-2xl z-50 backdrop-blur-md">
                <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-muted border-b border-border-subtle/50 mb-1">
                  Select Geographic Coverage
                </div>
                {(Object.keys(REGION_LABEL) as Region[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setRegion(r)
                      setRegionMenuOpen(false)
                    }}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors cursor-pointer ${
                      region === r
                        ? 'bg-accent-teal/15 text-accent-teal font-semibold'
                        : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                    }`}
                  >
                    <span>{REGION_LABEL[r]}</span>
                    {region === r && <span className="text-[10px]">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scenario Context Badge */}
          <div className="hidden lg:flex items-center gap-2 rounded border border-border-subtle bg-bg-card/70 px-2.5 py-1 font-mono text-[10.5px]">
            <span className="text-text-muted">SCENARIO:</span>
            <span className="font-semibold text-text-primary">{hazard}</span>
            <span className="text-border-subtle">·</span>
            <span className="text-critical-coral font-medium">{severity}% SEV</span>
            <span className="text-border-subtle">·</span>
            <span className="text-text-muted">{durationMonths}M</span>
          </div>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* User Mode: Bank vs Investor */}
          <div className="flex items-center rounded-md border border-border-subtle bg-bg-card p-0.5">
            <button
              onClick={() => setUserMode('bank')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider transition-colors cursor-pointer ${
                userMode === 'bank'
                  ? 'bg-accent-teal/15 text-accent-teal shadow-xs'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Landmark size={11} />
              <span>BANK</span>
            </button>
            <button
              onClick={() => setUserMode('investor')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider transition-colors cursor-pointer ${
                userMode === 'investor'
                  ? 'bg-accent-blue/15 text-accent-blue shadow-xs'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <LineChart size={11} />
              <span>INVESTOR</span>
            </button>
          </div>

          {/* Simulation Engine Status */}
          <div className="hidden xl:flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded bg-bg-card border border-border-subtle">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <span className={status.text}>{status.label}</span>
          </div>

          {/* Presentation Mode */}
          <button
            onClick={startPresentation}
            className="flex items-center gap-1.5 rounded border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-accent-teal hover:bg-accent-teal/20 transition-colors cursor-pointer"
            title="Launch Fullscreen Presentation Mode"
          >
            <Play size={10} className="fill-current" />
            <span className="hidden sm:inline">PRESENTATION</span>
          </button>
        </div>
      </header>

      {/* Main Workspace with Sidebar */}
      <div className="flex min-h-0 flex-1 relative">
        {/* Sidebar Navigation */}
        <aside
          className={`hidden md:flex flex-col border-r border-border-subtle bg-bg-secondary transition-all duration-200 z-20 shrink-0 ${
            collapsed ? 'w-16' : 'w-56'
          }`}
        >
          {/* Collapse Toggle */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle/50">
            {!collapsed && (
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
                NAVIGATION
              </span>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors ml-auto cursor-pointer"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.group} className="space-y-0.5">
                {!collapsed && (
                  <div className="px-2.5 py-1 font-mono text-[8.5px] font-semibold uppercase tracking-[0.16em] text-text-muted/70">
                    {group.group}
                  </div>
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 font-mono text-[11px] font-medium transition-all ${
                        isActive
                          ? 'border-l-2 border-accent-teal bg-bg-elevated/70 text-accent-teal font-semibold shadow-xs'
                          : 'text-text-secondary hover:bg-bg-card hover:text-text-primary border-l-2 border-transparent'
                      } ${collapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    <item.icon size={15} className="shrink-0 transition-transform group-hover:scale-105" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          {/* Bottom Landing Link */}
          <div className="p-2 border-t border-border-subtle/50">
            <Link
              to="/"
              className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[10.5px] text-text-muted hover:text-accent-teal hover:bg-bg-elevated transition-colors ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              title="Return to Public Landing Page"
            >
              <ArrowLeft size={13} className="shrink-0" />
              {!collapsed && <span>Public Overview</span>}
            </Link>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-13 z-40 flex bg-black/70 backdrop-blur-sm md:hidden">
            <nav className="w-64 max-w-[80%] bg-bg-secondary border-r border-border-subtle p-3 overflow-y-auto space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.group} className="space-y-1">
                  <div className="px-2 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    {group.group}
                  </div>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded px-2.5 py-2 font-mono text-[12px] ${
                          isActive
                            ? 'bg-accent-teal/15 text-accent-teal font-semibold'
                            : 'text-text-secondary hover:bg-bg-card hover:text-text-primary'
                        }`
                      }
                    >
                      <item.icon size={15} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
              <div className="pt-2 border-t border-border-subtle">
                <Link
                  to="/"
                  className="flex items-center gap-2 px-2.5 py-2 font-mono text-[11px] text-text-muted hover:text-accent-teal"
                >
                  <ArrowLeft size={13} />
                  <span>Public Overview</span>
                </Link>
              </div>
            </nav>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* Active Page Viewport */}
        <main className="flex min-w-0 flex-1 flex-col bg-bg-main overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* Global Overlays */}
      {presentationActive && <PresentationOverlay />}
      <CopilotPanel />
    </div>
  )
}
