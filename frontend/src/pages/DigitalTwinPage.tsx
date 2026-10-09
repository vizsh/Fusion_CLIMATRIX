import 'maplibre-gl/dist/maplibre-gl.css'

import type { FeatureCollection } from 'geojson'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Layers, Satellite } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { Layer, Map as GLMap, Marker, NavigationControl, Popup, Source } from 'react-map-gl/maplibre'
import EntityInspector from '../components/graph/EntityInspector'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import {
  CAMERA_PRESETS,
  GEO_FILE_BY_REGION,
  HP_FLOOD_EXTENT,
  HP_NH5_ROUTE,
  institutionalStyle,
  SKY_PAINT,
  terrainSatelliteStyle,
} from '../lib/digitalTwinMap'
import { cleanDistrictName, getDistrictRisk } from '../lib/districtRisk'
import { KIND_META, NODES } from '../lib/indiaGraphData'
import { useScenarioStore } from '../store/useScenarioStore'

type CameraLevel = 'india' | 'region' | 'valley'

export default function DigitalTwinPage() {
  const mapRef = useRef<MapRef | null>(null)
  const { region, runState, selectedEntityId, setSelectedEntity } = useScenarioStore()

  const [styleMode, setStyleMode] = useState<'satellite' | 'institutional'>('satellite')
  const [showDistricts, setShowDistricts] = useState(true)
  const [cameraLevel, setCameraLevel] = useState<CameraLevel>('india')
  const [districtData, setDistrictData] = useState<FeatureCollection | null>(null)
  const [districtPopup, setDistrictPopup] = useState<{ lng: number; lat: number; name: string; risk: number } | null>(
    null,
  )

  const simulated = runState !== 'idle'

  function flyTo(preset: (typeof CAMERA_PRESETS)[keyof typeof CAMERA_PRESETS], level: CameraLevel) {
    mapRef.current?.getMap().flyTo({
      center: preset.center,
      zoom: preset.zoom,
      pitch: preset.pitch,
      bearing: preset.bearing,
      duration: 2200,
      curve: 1.3,
    })
    setCameraLevel(level)
  }

  // Region switch (from the scenario console) re-centers the camera and
  // reloads that region's real district boundaries.
  useEffect(() => {
    flyTo(CAMERA_PRESETS[region], 'region')
    let cancelled = false
    fetch(GEO_FILE_BY_REGION[region])
      .then((r) => r.json())
      .then((raw: FeatureCollection) => {
        if (cancelled) return
        setDistrictData({
          ...raw,
          features: raw.features.map((f) => {
            const rawName = (f.properties?.district as string) ?? ''
            return {
              ...f,
              properties: { ...f.properties, district: cleanDistrictName(rawName), risk: getDistrictRisk(region, rawName) },
            }
          }),
        })
      })
      .catch(() => setDistrictData(null))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region])

  // Selecting any entity anywhere in the app (graph, company page, map
  // marker) re-centers the Digital Twin on it, if it has real coordinates.
  useEffect(() => {
    if (!selectedEntityId) return
    const node = NODES.find((n) => n.id === selectedEntityId)
    if (!node?.coords) return
    mapRef.current?.getMap().flyTo({ center: node.coords, zoom: 11.2, pitch: 60, bearing: 10, duration: 1800 })
    setCameraLevel('valley')
  }, [selectedEntityId])

  function handleMapClick(e: MapLayerMouseEvent) {
    const feature = e.features?.[0]
    if (feature && feature.layer?.id === 'district-fill') {
      setDistrictPopup({
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
        name: (feature.properties?.district as string) ?? 'Unknown district',
        risk: (feature.properties?.risk as number) ?? 0,
      })
    } else {
      setDistrictPopup(null)
    }
  }

  const style = styleMode === 'satellite' ? terrainSatelliteStyle : institutionalStyle

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="DIGITAL TWIN"
        subtitle="HIMALAYAN TERRAIN · REAL ELEVATION · FLAGSHIP HIMACHAL PRADESH SCENARIO"
        tag="CLICK ANY ASSET TO TRACE ITS DEPENDENCY CHAIN"
      />

      <div className={`relative min-h-0 flex-1 ${styleMode === 'institutional' ? 'map-dark' : ''}`}>
        <GLMap
          ref={mapRef}
          initialViewState={{ ...CAMERA_PRESETS.india }}
          mapStyle={style}
          style={{ width: '100%', height: '100%' }}
          interactiveLayerIds={showDistricts ? ['district-fill'] : []}
          onClick={handleMapClick}
          maxPitch={75}
          onLoad={(e) => {
            const map = e.target
            if (styleMode === 'satellite' && typeof map.setSky === 'function') {
              map.setSky(SKY_PAINT)
            }
          }}
        >
          <NavigationControl position="top-right" visualizePitch />

          {districtData && showDistricts && (
            <Source type="geojson" data={districtData}>
              <Layer
                id="district-fill"
                type="fill"
                paint={{ 'fill-color': ['step', ['get', 'risk'], '#2dd4a7', 45, '#f5a524', 70, '#fb3a4a'], 'fill-opacity': 0.3 }}
              />
              <Layer id="district-outline" type="line" paint={{ 'line-color': '#05070a', 'line-width': 1 }} />
            </Source>
          )}

          {region === 'HP' && (
            <Source type="geojson" data={HP_FLOOD_EXTENT}>
              <Layer
                id="flood-extent"
                type="fill"
                paint={{ 'fill-color': '#22d3ee', 'fill-opacity': simulated ? 0.22 : 0.06 }}
              />
              <Layer
                id="flood-extent-outline"
                type="line"
                paint={{ 'line-color': '#22d3ee', 'line-width': simulated ? 1.6 : 0.6, 'line-opacity': simulated ? 0.8 : 0.3 }}
              />
            </Source>
          )}

          {region === 'HP' && (
            <Source type="geojson" data={HP_NH5_ROUTE}>
              <Layer
                id="nh5-route"
                type="line"
                paint={{
                  'line-color': simulated ? '#fb3a4a' : '#64748b',
                  'line-width': simulated ? 3.5 : 2,
                  'line-dasharray': simulated ? [1, 1.4] : [1, 0],
                }}
              />
            </Source>
          )}

          {NODES.filter((n) => n.coords).map((n) => {
            const meta = KIND_META[n.kind]
            const active = n.id === selectedEntityId
            return (
              <Marker
                key={n.id}
                longitude={n.coords![0]}
                latitude={n.coords![1]}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation()
                  setDistrictPopup(null)
                  setSelectedEntity(active ? null : n.id)
                }}
              >
                <div className="group relative cursor-pointer">
                  {active && (
                    <div
                      className="absolute inset-0 -m-1.5 animate-pulse-ring rounded-full"
                      style={{ background: meta.color }}
                    />
                  )}
                  <div
                    className="relative rounded-full border-2 transition-transform group-hover:scale-125"
                    style={{
                      width: n.kind === 'hazard' ? 14 : 9,
                      height: n.kind === 'hazard' ? 14 : 9,
                      background: meta.color,
                      borderColor: active ? '#fff' : '#05070a',
                    }}
                  />
                </div>
              </Marker>
            )
          })}

          {districtPopup && (
            <Popup longitude={districtPopup.lng} latitude={districtPopup.lat} anchor="bottom" closeButton={false} offset={10}>
              <div className="w-40 font-sans">
                <div className="font-mono text-[11px] font-semibold text-slate-900">{districtPopup.name}</div>
                <div className="text-[10px] text-slate-600">Risk {districtPopup.risk}/100</div>
              </div>
            </Popup>
          )}
        </GLMap>

        {/* Breadcrumb camera control */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded border border-line bg-panel/85 px-2.5 py-1.5 font-mono text-[10px] tracking-wide backdrop-blur">
          <button
            className={`pointer-events-auto ${cameraLevel === 'india' ? 'text-cyan' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => flyTo(CAMERA_PRESETS.india, 'india')}
          >
            INDIA
          </button>
          <ChevronRight size={11} className="text-slate-700" />
          <button
            className={`pointer-events-auto ${cameraLevel === 'region' ? 'text-cyan' : 'text-slate-500 hover:text-slate-300'}`}
            onClick={() => flyTo(CAMERA_PRESETS[region], 'region')}
          >
            {CAMERA_PRESETS[region].label.toUpperCase()}
          </button>
          {region === 'HP' && (
            <>
              <ChevronRight size={11} className="text-slate-700" />
              <button
                className={`pointer-events-auto ${cameraLevel === 'valley' ? 'text-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                onClick={() => flyTo(CAMERA_PRESETS.valley, 'valley')}
              >
                KULLU–MANALI VALLEY
              </button>
            </>
          )}
        </div>

        {/* Layer toggles */}
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <button
            onClick={() => {
              const next = styleMode === 'satellite' ? 'institutional' : 'satellite'
              setStyleMode(next)
              if (next === 'satellite') {
                setTimeout(() => {
                  const map = mapRef.current?.getMap()
                  if (map && typeof map.setSky === 'function') map.setSky(SKY_PAINT)
                }, 300)
              }
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded border border-line bg-panel/85 px-2.5 py-1.5 font-mono text-[9.5px] tracking-wide text-slate-400 backdrop-blur hover:text-slate-200"
          >
            <Satellite size={11} />
            {styleMode === 'satellite' ? 'CINEMATIC TERRAIN' : 'INSTITUTIONAL VIEW'}
          </button>
          <button
            onClick={() => setShowDistricts((v) => !v)}
            className={`pointer-events-auto flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[9.5px] tracking-wide backdrop-blur ${
              showDistricts ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-line bg-panel/85 text-slate-400'
            }`}
          >
            <Layers size={11} /> DISTRICT RISK
          </button>
        </div>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-line bg-panel/85 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-3 text-[9.5px]">
            {Object.entries(KIND_META).map(([kind, meta]) => (
              <span key={kind} className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} /> {meta.label}
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selectedEntityId && (
            <motion.div
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute right-0 top-0 h-full w-[340px] overflow-y-auto border-l border-line bg-panel/95 p-4 backdrop-blur"
            >
              <EntityInspector nodeId={selectedEntityId} onClose={() => setSelectedEntity(null)} onSelect={setSelectedEntity} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-line bg-panel/90">
        <ScenarioConsole compact />
      </div>
    </div>
  )
}
