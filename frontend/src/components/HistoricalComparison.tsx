// Before/after satellite comparison modal — swipe divider between two
// dated NASA GIBS captures of the same area. See lib/historicalImagery.ts
// for the data source and the honesty caveat this component always shows.

import { Satellite, X } from 'lucide-react'
import { useState } from 'react'
import { nasaSnapshotUrl, type HistoricalComparison as ComparisonData } from '../lib/historicalImagery'

export default function HistoricalComparison({ data, onClose }: { data: ComparisonData; onClose: () => void }) {
  const [split, setSplit] = useState(50)
  const beforeUrl = nasaSnapshotUrl(data.bbox, data.before.date)
  const afterUrl = nasaSnapshotUrl(data.bbox, data.after.date)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Satellite size={14} className="text-cyan" />
            <span className="text-[13px] font-semibold text-white">{data.title}</span>
          </div>
          <button onClick={onClose} className="rounded border border-line p-1 text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>

        <div className="relative select-none overflow-hidden" style={{ aspectRatio: '600 / 520' }}>
          <img src={afterUrl} alt={data.after.label} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${split}%` }}>
            <img src={beforeUrl} alt={data.before.label} className="h-full w-full object-cover" style={{ width: `${10000 / split}%`, maxWidth: 'none' }} draggable={false} />
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan" style={{ left: `${split}%` }} />
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="absolute inset-x-0 bottom-2 mx-4 accent-cyan"
            style={{ width: 'calc(100% - 2rem)' }}
          />
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-cyan-200">{data.before.label}</span>
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-amber-300">{data.after.label}</span>
        </div>

        <div className="space-y-1.5 border-t border-line px-4 py-3">
          <p className="text-[11px] leading-relaxed text-slate-400">{data.context}</p>
          <p className="text-[9.5px] leading-relaxed text-slate-600">
            Source: NASA GIBS / MODIS Terra Corrected Reflectance (True Color), via NASA Worldview Snapshots — public,
            dated imagery, no processing beyond NASA’s own true-color composite.
          </p>
        </div>
      </div>
    </div>
  )
}
