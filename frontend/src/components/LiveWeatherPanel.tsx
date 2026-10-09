import { CloudRain, ExternalLink, RefreshCw, Satellite } from 'lucide-react'
import { useState } from 'react'
import { ApiError, queryWeather, type WeatherQueryResult } from '../lib/api'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'
import { WEATHER_WINDOWS } from '../lib/weatherWindows'

type FetchState = 'idle' | 'loading' | 'error' | 'done'

export default function LiveWeatherPanel() {
  const region = useScenarioStore((s) => s.region)
  const [state, setState] = useState<FetchState>('idle')
  const [result, setResult] = useState<WeatherQueryResult | null>(null)
  const [error, setError] = useState<string>('')

  const window_ = WEATHER_WINDOWS[region]

  async function run() {
    setState('loading')
    setError('')
    try {
      const res = await queryWeather(window_.lat, window_.lng, window_.start, window_.end)
      setResult(res)
      setState('done')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unknown error')
      setState('error')
    }
  }

  const maxPrecip = result ? Math.max(1, ...result.observations.map((o) => o.precipitation_mm ?? 0)) : 1

  return (
    <div className="rounded-lg border border-line bg-panel-2 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-cyan">
          <Satellite size={14} />
          <span className="font-mono text-[11px] tracking-wide">LIVE DATA CHECK — NASA POWER</span>
        </div>
        <button
          onClick={run}
          disabled={state === 'loading'}
          className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-cyan hover:bg-cyan/20 disabled:opacity-50"
        >
          <RefreshCw size={11} className={state === 'loading' ? 'animate-spin' : ''} />
          {state === 'loading' ? 'FETCHING…' : 'FETCH LIVE DATA'}
        </button>
      </div>

      <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
        Calls the CLIMATRIX backend, which calls NASA POWER live for real historical daily
        precipitation and temperature at {REGION_LABEL[region]}'s hazard coordinates (
        {window_.lat.toFixed(2)}, {window_.lng.toFixed(2)}), {window_.label}. This is observed
        reanalysis data, not a live flood feed or a forecast — a genuine external API call, not a
        synthetic illustration.
      </p>

      {state === 'idle' && (
        <div className="rounded border border-line px-3 py-4 text-center text-[10.5px] text-slate-600">
          Not fetched yet. Requires the backend running locally (see backend/README.md).
        </div>
      )}

      {state === 'error' && (
        <div className="rounded border border-risk-high/40 bg-risk-high/[0.06] px-3 py-3 text-[11px] text-risk-high">
          {error}
        </div>
      )}

      {state === 'done' && result && (
        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              {result.observations.length} day(s) · {result.cached ? 'from cache' : 'freshly fetched'} ·{' '}
              {new Date(result.retrieved_at).toLocaleString()}
            </span>
            <a
              href={result.source_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-cyan hover:underline"
            >
              Source <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex items-end gap-1" style={{ height: 80 }}>
            {result.observations.map((o) => (
              <div key={o.id} className="group relative flex flex-1 flex-col items-center justify-end" title={`${o.date}: ${o.precipitation_mm ?? '—'}mm`}>
                <div
                  className="w-full rounded-t bg-cyan/70 transition-all group-hover:bg-cyan"
                  style={{ height: `${Math.max(2, ((o.precipitation_mm ?? 0) / maxPrecip) * 70)}px` }}
                />
                <span className="mt-1 text-[8px] text-slate-600">{o.date.slice(6, 8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-slate-500">
            <CloudRain size={10} /> Daily precipitation (mm) — hover a bar for the exact value and date.
          </div>
        </div>
      )}
    </div>
  )
}
