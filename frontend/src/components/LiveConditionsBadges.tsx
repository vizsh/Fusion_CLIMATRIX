import { Thermometer, Waves as WavesIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCurrentConditions, getFloodDischarge, type CurrentConditions, type FloodResult } from '../lib/api'

/** Live "what's happening right now" badge via Tomorrow.io — distinct from
 * the historical/modelled badges elsewhere on this page. Fails silently
 * into an unobtrusive "unavailable" state rather than blocking the map. */
export function CurrentConditionsBadge({ lat, lng }: { lat: number; lng: number }) {
  const [data, setData] = useState<CurrentConditions | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getCurrentConditions(lat, lng)
      .then((d) => !cancelled && (setData(d), setStatus('ready')))
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (status === 'error') return null // don't clutter the twin if the backend/key isn't available

  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded border border-cyan/30 bg-panel/85 px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-cyan backdrop-blur">
      <Thermometer size={11} />
      {status === 'loading' ? (
        'LOADING LIVE CONDITIONS…'
      ) : (
        <>
          NOW: {data!.temperature_c?.toFixed(1)}°C · {data!.humidity_pct}% RH
          {data!.rain_intensity_mm_hr ? ` · ${data!.rain_intensity_mm_hr}mm/hr rain` : ''}
          <span className="text-slate-600">(Tomorrow.io)</span>
        </>
      )}
    </div>
  )
}

/** Real GloFAS river discharge via Open-Meteo — forecast + recent window,
 * not deep historical (see backend connector docstring). Only meaningful
 * where a scenario is explicitly tied to a river corridor (HP/Beas). */
export function RiverDischargeBadge({ lat, lng }: { lat: number; lng: number }) {
  const [data, setData] = useState<FloodResult | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    getFloodDischarge(lat, lng)
      .then((d) => !cancelled && (setData(d), setStatus('ready')))
      .catch(() => !cancelled && setStatus('error'))
    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (status === 'error') return null

  const latest = data?.days[data.days.length - 1]

  return (
    <div className="pointer-events-none flex items-center gap-1.5 rounded border border-cyan/30 bg-panel/85 px-2.5 py-1.5 font-mono text-[9px] tracking-wide text-cyan backdrop-blur">
      <WavesIcon size={11} />
      {status === 'loading' ? (
        'LOADING RIVER DATA…'
      ) : (
        <>
          BEAS RIVER DISCHARGE: {latest?.river_discharge_m3s?.toFixed(1)} m³/s
          <span className="text-slate-600">(Open-Meteo/GloFAS)</span>
        </>
      )}
    </div>
  )
}
