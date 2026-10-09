// Satellite location preview card — Feature B from the imagery audit:
// "satellite thumbnails on infrastructure nodes." Shown wherever a node
// has real coordinates (infra/supplier/company/hazard), with the
// coordinate, source attribution and a link to inspect the full Digital
// Twin, per the audit's own caution: a generic photo beside a node is
// decoration, a coordinate-linked, attributed, dated one is verified
// location context.

import { ExternalLink, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { satelliteThumbnailUrl } from '../lib/satelliteThumbnail'
import { useScenarioStore, type Region } from '../store/useScenarioStore'

export default function LocationThumbnail({
  lng,
  lat,
  region,
  label,
}: {
  lng: number
  lat: number
  region?: Region
  label: string
}) {
  const [failed, setFailed] = useState(false)
  const navigate = useNavigate()
  const setRegion = useScenarioStore((s) => s.setRegion)
  const url = satelliteThumbnailUrl(lng, lat)

  return (
    <div className="mb-3 overflow-hidden rounded border border-line bg-panel-2">
      {failed ? (
        <div className="flex h-[140px] items-center justify-center text-[10.5px] text-slate-600">Satellite preview unavailable</div>
      ) : (
        <img
          src={url}
          alt={`Satellite view near ${label}`}
          className="h-[140px] w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1 font-mono text-[9px] text-slate-500">
          <MapPin size={10} className="shrink-0" />
          <span className="truncate">
            {lat.toFixed(3)}°N, {lng.toFixed(3)}°E · Esri World Imagery (Esri, Maxar, Earthstar Geographics)
          </span>
        </div>
        {region && (
          <button
            onClick={() => {
              setRegion(region)
              navigate('/twin')
            }}
            className="flex shrink-0 items-center gap-1 font-mono text-[9px] text-cyan hover:underline"
            title="Open the full Digital Twin for this region"
          >
            TWIN <ExternalLink size={9} />
          </button>
        )}
      </div>
      <p className="border-t border-line px-2.5 py-1 text-[8.5px] leading-snug text-slate-600">
        This graph's own coordinate for this node — a real-place approximation, not a surveyed facility footprint.
      </p>
    </div>
  )
}
