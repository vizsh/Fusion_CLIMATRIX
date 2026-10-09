import {
  Building2,
  FileCheck2,
  Globe2,
  Landmark,
  LayoutGrid,
  Leaf,
  LineChart,
  Network,
  PieChart,
  Play,
  Shield,
  Workflow,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import PresentationOverlay from '../components/PresentationOverlay'
import { REGION_LABEL, useScenarioStore, useSimulationClock } from '../store/useScenarioStore'

const NAV = [
  { to: '/', label: 'Command Centre', icon: LayoutGrid, end: true },
  { to: '/twin', label: 'Digital Twin', icon: Globe2 },
  { to: '/scenario', label: 'Scenario Lab', icon: Workflow },
  { to: '/dependency', label: 'Dependency Explorer', icon: Network },
  { to: '/company', label: 'Company Investigation', icon: Building2 },
  { to: '/portfolio', label: 'Portfolio Impact', icon: PieChart },
  { to: '/mitigation', label: 'Mitigation Studio', icon: Shield },
  { to: '/evidence', label: 'Evidence & Reports', icon: FileCheck2 },
]

const RUN_LABEL: Record<string, string> = {
  idle: 'STANDBY',
  running: 'SIMULATION RUNNING',
  paused: 'PAUSED',
  done: 'SIMULATION COMPLETE',
}

const RUN_COLOR: Record<string, string> = {
  idle: 'text-slate-500',
  running: 'text-risk-low',
  paused: 'text-risk-med',
  done: 'text-cyan',
}

export default function AppShell() {
  useSimulationClock()
  const region = useScenarioStore((s) => s.region)
  const runState = useScenarioStore((s) => s.runState)
  const startPresentation = useScenarioStore((s) => s.startPresentation)
  const presentationActive = useScenarioStore((s) => s.presentationActive)
  const userMode = useScenarioStore((s) => s.userMode)
  const setUserMode = useScenarioStore((s) => s.setUserMode)

  return (
    <div className="flex h-screen w-screen flex-col bg-base">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel/90 px-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded border border-cyan/30 bg-cyan/[0.08]">
            <Leaf size={14} className="text-cyan" />
          </div>
          <div className="font-mono text-[12px] font-semibold tracking-[0.1em] text-white">
            CLIMATRIX <span className="text-cyan">INDIA</span>
          </div>
          <div className="mx-2 h-4 w-px bg-line" />
          <div className="font-mono text-[10px] tracking-wide text-slate-500">
            REGION <span className="text-slate-300">{REGION_LABEL[region]}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center rounded border border-line bg-panel-2 p-0.5">
            <button
              onClick={() => setUserMode('bank')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors ${
                userMode === 'bank' ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Landmark size={11} /> BANK
            </button>
            <button
              onClick={() => setUserMode('investor')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors ${
                userMode === 'investor' ? 'bg-cyan/15 text-cyan' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LineChart size={11} /> INVESTOR
            </button>
          </div>
          <div className={`font-mono text-[10px] tracking-[0.1em] ${RUN_COLOR[runState]}`}>
            {RUN_LABEL[runState]}
          </div>
          <div className="hidden font-mono text-[9.5px] tracking-wide text-slate-600 md:block">
            SYNTHETIC DATA · OCT 2026
          </div>
          <button
            onClick={startPresentation}
            className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-cyan hover:bg-cyan/20"
          >
            <Play size={11} /> PRESENTATION MODE
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-panel/80 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex w-16 flex-col items-center gap-1 rounded py-2.5 text-center transition-colors ${
                  isActive ? 'bg-cyan/10 text-cyan' : 'text-slate-500 hover:bg-panel-2 hover:text-slate-300'
                }`
              }
            >
              <item.icon size={17} />
              <span className="px-0.5 text-[7.5px] leading-tight tracking-wide">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>

      {presentationActive && <PresentationOverlay />}
    </div>
  )
}
