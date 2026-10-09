import 'maplibre-gl/dist/maplibre-gl.css'

import type { FeatureCollection } from 'geojson'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Landmark,
  Layers,
  Package,
  Satellite,
  ShieldCheck,
  Waves,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre'
import { Layer, Map as GLMap, Marker, NavigationControl, Popup, Source } from 'react-map-gl/maplibre'
import EntityInspector from '../components/graph/EntityInspector'
import OsmRoadsLayer from '../components/OsmRoadsLayer'
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
  UK_HAZARD_ZONE,
} from '../lib/digitalTwinMap'
import { cleanDistrictName, getDistrictRisk } from '../lib/districtRisk'
import { computeFloodRibbon, loadElevationSampler, type ElevationSampler } from '../lib/floodModel'
import { CurrentConditionsBadge, RiverDischargeBadge } from '../components/LiveConditionsBadges'
import { graphStages, REGION_HAZARD } from '../lib/graphAnalytics'
import { KIND_META, NODES, type NodeKind } from '../lib/indiaGraphData'
import { useScenarioStore, type Region } from '../store/useScenarioStore'
import { Film } from 'lucide-react'

const KIND_ICON: Record<NodeKind, typeof AlertTriangle> = {
  hazard: AlertTriangle,
  infra: Zap,
  supplier: Package,
  company: Building2,
  bank: Landmark,
  govt: Landmark,
  insurer: ShieldCheck,
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Interpolates a position along a polyline at fraction t (0-1). */
function pointAlong(line: [number, number][], t: number): [number, number] {
  const segCount = line.length - 1
  const segT = t * segCount
  const i = Math.min(segCount - 1, Math.floor(segT))
  const localT = segT - i
  const a = line[i]
  const b = line[i + 1]
  return [lerp(a[0], b[0], localT), lerp(a[1], b[1], localT)]
}

type CameraLevel = 'india' | 'region' | 'valley'

export default function DigitalTwinPage() {
  const mapRef = useRef<MapRef | null>(null)
  const { region, severity, runState, selectedEntityId, setSelectedEntity } = useScenarioStore()

  const [styleMode, setStyleMode] = useState<'satellite' | 'institutional'>('satellite')
  const [showDistricts, setShowDistricts] = useState(true)
  const [showOsmRoads, setShowOsmRoads] = useState(false)
  const [cameraLevel, setCameraLevel] = useState<CameraLevel>('india')
  const [districtData, setDistrictData] = useState<FeatureCollection | null>(null)
  const [districtPopup, setDistrictPopup] = useState<{ lng: number; lat: number; name: string; risk: number } | null>(
    null,
  )
  const [elevationSampler, setElevationSampler] = useState<ElevationSampler | null>(null)
  const [elevationStatus, setElevationStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const simulated = runState !== 'idle'
  const activeHazardNode = NODES.find((n) => n.id === REGION_HAZARD[region])

  // Decode the real DEM tiles once — used both by the 3D terrain (already
  // handled by MapLibre natively) and by our own flood-ribbon computation.
  useEffect(() => {
    let cancelled = false
    loadElevationSampler()
      .then((sampler) => {
        if (!cancelled) {
          setElevationSampler(() => sampler)
          setElevationStatus('ready')
        }
      })
      .catch(() => !cancelled && setElevationStatus('error'))
    return () => {
      cancelled = true
    }
  }, [])

  const computedFlood = useMemo(
    () => computeFloodRibbon(elevationSampler, severity),
    [elevationSampler, severity],
  )
  const floodGeometry = computedFlood ?? HP_FLOOD_EXTENT

  // Traveling pulse along the disrupted corridor — makes the propagation
  // feel active rather than a static red line once a scenario is running.
  const [pulseT, setPulseT] = useState(0)
  useEffect(() => {
    if (!simulated || region !== 'HP') return
    let raf: number
    const CYCLE_MS = 3200
    const loop = (now: number) => {
      setPulseT((now % CYCLE_MS) / CYCLE_MS)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simulated, region])
  const pulsePos = useMemo(
    () => (simulated && region === 'HP' ? pointAlong(HP_NH5_ROUTE.geometry.coordinates as [number, number][], pulseT) : null),
    [simulated, region, pulseT],
  )

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
    const geoFile = GEO_FILE_BY_REGION[region]
    if (!geoFile) {
      setDistrictData(null)
      return
    }
    let cancelled = false
    fetch(geoFile)
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
        subtitle="HIMALAYAN TERRAIN · REAL ELEVATION · SELECT A REGION BELOW"
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
            <Source type="geojson" data={floodGeometry}>
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

          {showOsmRoads && <OsmRoadsLayer region={region} />}

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

          {region === 'UK' && (
            <Source type="geojson" data={UK_HAZARD_ZONE}>
              <Layer
                id="uk-hazard-zone"
                type="fill"
                paint={{ 'fill-color': '#f5a524', 'fill-opacity': simulated ? 0.22 : 0.08 }}
              />
              <Layer
                id="uk-hazard-zone-outline"
                type="line"
                paint={{ 'line-color': '#f5a524', 'line-width': simulated ? 1.6 : 0.6, 'line-opacity': simulated ? 0.85 : 0.35 }}
              />
            </Source>
          )}

          {NODES.filter((n) => n.coords).map((n) => {
            const meta = KIND_META[n.kind]
            const Icon = KIND_ICON[n.kind]
            const active = n.id === selectedEntityId
            const size = n.kind === 'hazard' ? 26 : 20
            return (
              <Marker
                key={n.id}
                longitude={n.coords![0]}
                latitude={n.coords![1]}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation()
                  setDistrictPopup(null)
                  setSelectedEntity(active ? null : n.id)
                }}
              >
                <div className="group relative flex cursor-pointer flex-col items-center">
                  {active && (
                    <div
                      className="absolute top-0 animate-pulse-ring rounded-full"
                      style={{ width: size, height: size, background: meta.color }}
                    />
                  )}
                  <div
                    className="relative flex items-center justify-center rounded-full border-2 shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-125"
                    style={{
                      width: size,
                      height: size,
                      background: meta.color,
                      borderColor: active ? '#fff' : 'rgba(5,7,10,0.6)',
                    }}
                  >
                    <Icon size={size * 0.55} color="#05070a" strokeWidth={2.4} />
                  </div>
                  <div className="h-2 w-px bg-white/50" />
                </div>
              </Marker>
            )
          })}

          {pulsePos && (
            <Marker longitude={pulsePos[0]} latitude={pulsePos[1]} anchor="center">
              <div className="relative">
                <div className="absolute inset-0 -m-2 animate-pulse-ring rounded-full bg-risk-high" />
                <div className="h-2.5 w-2.5 rounded-full bg-risk-high shadow-[0_0_10px_3px_rgba(251,58,74,0.7)]" />
              </div>
            </Marker>
          )}

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
          <button
            onClick={() => setShowOsmRoads((v) => !v)}
            className={`pointer-events-auto flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[9.5px] tracking-wide backdrop-blur ${
              showOsmRoads ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-line bg-panel/85 text-slate-400'
            }`}
          >
            <Layers size={11} /> REAL ROAD DATA (OSM)
          </button>
          {region === 'HP' && (
            <div
              className={`pointer-events-none flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[9px] tracking-wide backdrop-blur ${
                elevationStatus === 'ready'
                  ? 'border-cyan/30 bg-panel/85 text-cyan'
                  : elevationStatus === 'error'
                    ? 'border-risk-high/30 bg-panel/85 text-risk-high'
                    : 'border-line bg-panel/85 text-slate-500'
              }`}
            >
              <Waves size={11} />
              {elevationStatus === 'ready'
                ? `DEM FLOOD MODEL · +${computedFlood?.properties?.floodRiseM ?? 0}m`
                : elevationStatus === 'error'
                  ? 'DEM UNAVAILABLE — ILLUSTRATIVE EXTENT'
                  : 'LOADING ELEVATION DATA…'}
            </div>
          )}
          {activeHazardNode?.coords && (
            <CurrentConditionsBadge lat={activeHazardNode.coords[1]} lng={activeHazardNode.coords[0]} />
          )}
          {region === 'HP' && activeHazardNode?.coords && (
            <RiverDischargeBadge lat={activeHazardNode.coords[1]} lng={activeHazardNode.coords[0]} />
          )}
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
          {selectedEntityId ? (
            <motion.div
              key="inspector"
              initial={{ x: 340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 340, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute right-0 top-0 h-full w-[340px] overflow-y-auto border-l border-line bg-panel/95 p-4 backdrop-blur"
            >
              <EntityInspector nodeId={selectedEntityId} onClose={() => setSelectedEntity(null)} onSelect={setSelectedEntity} />
            </motion.div>
          ) : (
            simulated && (
              <motion.div
                key="replay"
                initial={{ x: 340, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 340, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute right-0 top-0 h-full w-[340px] overflow-y-auto border-l border-line bg-panel/95 p-4 backdrop-blur"
              >
                <CausalReplayPanel region={region} onSelect={setSelectedEntity} />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-line bg-panel/90">
        <ScenarioConsole compact />
      </div>
    </div>
  )
}

/** Causal replay — the propagation sequence derived live from the actual
 * dependency graph (BFS by hop from the active hazard), not a hardcoded
 * disaster script. Clicking a stage selects its first asset. */
function CausalReplayPanel({ region, onSelect }: { region: Region; onSelect: (id: string) => void }) {
  const hazardId = REGION_HAZARD[region]
  const stages = useMemo(() => graphStages(hazardId), [hazardId])

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-cyan">
        <Film size={14} />
        <span className="font-mono text-[11px] tracking-wide">CAUSAL REPLAY</span>
      </div>
      <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
        The propagation sequence for this scenario, derived from the dependency graph — click a
        stage to inspect it.
      </p>
      <div className="space-y-3">
        {stages.map((stage) => (
          <div key={stage.hop} className="border-l-2 border-cyan/30 pl-3">
            <div className="font-mono text-[9px] tracking-wide text-slate-500">
              STAGE {stage.hop} · {stage.label.toUpperCase()}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {stage.nodes.map((n) => {
                const meta = KIND_META[n.kind]
                return (
                  <button
                    key={n.id}
                    onClick={() => onSelect(n.id)}
                    className="rounded border px-2 py-1 text-left text-[10.5px] transition-colors hover:brightness-125"
                    style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}0f` }}
                  >
                    {n.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
