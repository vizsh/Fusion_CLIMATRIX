import { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import type { FeatureCollection, LineString } from 'geojson'
import { getOsmInfrastructure } from '../lib/api'
import type { Region } from '../store/useScenarioStore'
import { REGION_BBOX } from '../lib/digitalTwinMap'

/** Real OSM road/bridge geometry for the active region's bbox — the sourced
 * replacement for hand-placed infra points (docs/DATA_STRATEGY.md item 2).
 * Fails silently (no layer) if Overpass is unreachable, matching the other
 * live-data badges' pattern rather than blocking the map. */
export default function OsmRoadsLayer({ region }: { region: Region }) {
  const [data, setData] = useState<FeatureCollection<LineString> | null>(null)

  useEffect(() => {
    setData(null)
    const [latMin, lngMin, latMax, lngMax] = REGION_BBOX[region]
    let cancelled = false
    getOsmInfrastructure(latMin, lngMin, latMax, lngMax)
      .then((res) => {
        if (cancelled) return
        setData({
          type: 'FeatureCollection',
          features: res.ways.map((w) => ({
            type: 'Feature',
            properties: { bridge: w.bridge, highway: w.highway ?? '', name: w.name },
            geometry: { type: 'LineString', coordinates: w.geometry.map(([lat, lng]) => [lng, lat]) },
          })),
        })
      })
      .catch(() => !cancelled && setData(null))
    return () => {
      cancelled = true
    }
  }, [region])

  if (!data) return null

  return (
    <Source id="osm-roads" type="geojson" data={data}>
      <Layer
        id="osm-roads-line"
        type="line"
        filter={['!=', ['get', 'bridge'], true]}
        paint={{ 'line-color': '#4ade80', 'line-width': 1.4, 'line-opacity': 0.55 }}
      />
      <Layer
        id="osm-bridges-line"
        type="line"
        filter={['==', ['get', 'bridge'], true]}
        paint={{ 'line-color': '#4ade80', 'line-width': 3, 'line-opacity': 0.9 }}
      />
    </Source>
  )
}
