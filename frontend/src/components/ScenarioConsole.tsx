import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import {
  REGION_LABEL,
  SCENARIO_PROFILES,
  useScenarioStore,
  type Hazard,
  type Region,
  type ScenarioProfile,
  type Substitutability,
} from '../store/useScenarioStore'

const REGIONS: Region[] = ['HP', 'KL', 'MH', 'UK', 'MB']
const HAZARDS: Hazard[] = ['Flood', 'Drought', 'Cyclone', 'Heatwave', 'Landslide']
const SUBS: Substitutability[] = ['Limited', 'Moderate', 'Strong']
const PROFILES: ScenarioProfile[] = ['Baseline', 'Moderate', 'Severe', 'Compound']

function Seg<T extends string>({
  value,
  options,
  onChange,
  labels,
}: {
  value: T
  options: T[]
  onChange: (v: T) => void
  labels?: Partial<Record<T, string>>
}) {
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wide transition-colors ${
            value === opt
              ? 'border-cyan/50 bg-cyan/10 text-cyan'
              : 'border-line text-slate-500 hover:border-slate-600 hover:text-slate-300'
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}

export default function ScenarioConsole({
  compact = false,
  onRunSimulation,
}: {
  compact?: boolean
  /** Called right after RUN SIMULATION starts the clock — lets a page that
   * has nowhere visually dynamic to show the run (Scenario Lab has no map,
   * no graph) send the user somewhere that does, instead of leaving them
   * staring at a thin progress bar. Pages with their own live content
   * (Digital Twin, Dependency Explorer) simply don't pass this. */
  onRunSimulation?: () => void
}) {
  const {
    region,
    hazard,
    severity,
    durationMonths,
    substitutability,
    runState,
    timelineMonth,
    setRegion,
    setHazard,
    setSeverity,
    setDuration,
    setSubstitutability,
    run,
    pause,
    resume,
    replay,
    reset,
    applyProfile,
  } = useScenarioStore()

  return (
    <div className={`flex flex-wrap items-end gap-4 ${compact ? '' : 'p-4'}`}>
      <div>
        <div className="mb-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">CONDITIONS</div>
        <div className="flex gap-1">
          {PROFILES.map((p) => (
            <button
              key={p}
              title={SCENARIO_PROFILES[p].desc}
              onClick={() => applyProfile(p)}
              className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wide transition-colors ${
                severity === SCENARIO_PROFILES[p].severity && durationMonths === SCENARIO_PROFILES[p].durationMonths
                  ? 'border-risk-med/50 bg-risk-med/10 text-risk-med'
                  : 'border-line text-slate-500 hover:border-slate-600 hover:text-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">REGION</div>
        <Seg value={region} options={REGIONS} onChange={setRegion} labels={REGION_LABEL as Record<Region, string>} />
      </div>

      <div>
        <div className="mb-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">HAZARD</div>
        <Seg value={hazard} options={HAZARDS} onChange={setHazard} />
      </div>

      <div className="min-w-[130px]">
        <div className="mb-1 flex justify-between font-mono text-[9px] tracking-[0.15em] text-slate-500">
          <span>SEVERITY</span>
          <span className="text-cyan">{severity}/100</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={severity}
          onChange={(e) => setSeverity(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-cyan"
        />
      </div>

      <div className="min-w-[110px]">
        <div className="mb-1 flex justify-between font-mono text-[9px] tracking-[0.15em] text-slate-500">
          <span>DURATION</span>
          <span className="text-cyan">{durationMonths} mo</span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          value={durationMonths}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-cyan"
        />
      </div>

      <div>
        <div className="mb-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">SUBSTITUTABILITY</div>
        <Seg value={substitutability} options={SUBS} onChange={setSubstitutability} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {runState === 'idle' && (
          <button
            onClick={() => {
              run()
              onRunSimulation?.()
            }}
            className="flex items-center gap-1.5 rounded border border-risk-high/50 bg-risk-high/10 px-3 py-1.5 font-mono text-[10.5px] font-semibold tracking-wide text-risk-high hover:bg-risk-high/20"
          >
            <Play size={12} /> RUN SIMULATION
          </button>
        )}
        {runState === 'running' && (
          <button
            onClick={pause}
            className="flex items-center gap-1.5 rounded border border-risk-med/50 bg-risk-med/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-risk-med"
          >
            <Pause size={12} /> PAUSE
          </button>
        )}
        {runState === 'paused' && (
          <button
            onClick={resume}
            className="flex items-center gap-1.5 rounded border border-risk-low/50 bg-risk-low/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-risk-low"
          >
            <Play size={12} /> RESUME
          </button>
        )}
        {runState === 'done' && (
          <button
            onClick={replay}
            className="flex items-center gap-1.5 rounded border border-cyan/50 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan"
          >
            <RotateCw size={12} /> REPLAY
          </button>
        )}
        {runState !== 'idle' && (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-slate-500 hover:text-slate-300"
          >
            <RotateCcw size={11} /> RESET
          </button>
        )}
      </div>

      {runState !== 'idle' && (
        <div className="order-last w-full">
          <div className="mb-1 flex justify-between font-mono text-[9px] tracking-wide text-slate-500">
            <span>MONTH 0</span>
            <span className="text-slate-300">
              T+{timelineMonth.toFixed(1)} MO — {runState === 'done' ? 'RECOVERY' : 'PROPAGATING'}
            </span>
            <span>MONTH {durationMonths}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="h-full rounded-full bg-cyan transition-all duration-200"
              style={{ width: `${Math.min((timelineMonth / durationMonths) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
