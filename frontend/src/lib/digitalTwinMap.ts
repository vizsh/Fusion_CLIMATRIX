import type { StyleSpecification } from 'maplibre-gl'
import type { Region } from '../store/useScenarioStore'

// Cinematic mode: free Esri satellite imagery draped over free AWS/Terrarium
// elevation tiles — real 3D terrain, no API key, no Cesium dependency.
export const terrainSatelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
      maxzoom: 17,
    },
    terrainSource: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      encoding: 'terrarium',
      maxzoom: 14,
    },
  },
  layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite' }],
  terrain: { source: 'terrainSource', exaggeration: 1.5 },
  // `sky` is intentionally NOT declared here: @vis.gl/react-maplibre (the
  // react-map-gl/maplibre wrapper) bundles an older style-spec (v19) that
  // predates sky support, and silently fails style validation if it's
  // present in the declarative style object. Set it imperatively instead
  // via map.setSky() in the Map's onLoad handler, which talks to the real
  // maplibre-gl instance directly and bypasses that wrapper's validation.
}

export const SKY_PAINT = {
  'sky-color': '#0a1220',
  'sky-horizon-blend': 0.55,
  'horizon-color': '#16263a',
  'horizon-fog-blend': 0.55,
  'fog-color': '#05070a',
  'fog-ground-blend': 0.4,
} as const

// Institutional mode: restrained dark schematic basemap for committee-room
// legibility — same OSM raster tiles as the rest of the product, CSS-inverted.
export const institutionalStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
}

export interface CameraPreset {
  label: string
  center: [number, number]
  zoom: number
  pitch: number
  bearing: number
}

export const CAMERA_PRESETS: Record<'india' | 'HP' | 'KL' | 'MH' | 'valley', CameraPreset> = {
  india: { label: 'India', center: [79, 22.5], zoom: 4.2, pitch: 0, bearing: 0 },
  HP: { label: 'Himachal Pradesh', center: [77.05, 31.85], zoom: 7.6, pitch: 45, bearing: -12 },
  KL: { label: 'Kerala', center: [76.4, 10.3], zoom: 7.3, pitch: 40, bearing: 0 },
  MH: { label: 'Marathwada', center: [76.4, 18.9], zoom: 7.3, pitch: 35, bearing: 0 },
  valley: { label: 'Kullu–Manali Valley', center: [77.16, 32.05], zoom: 10.6, pitch: 66, bearing: 18 },
}

export const GEO_FILE_BY_REGION: Record<Region, string> = {
  HP: '/geo/himachal_pradesh.geojson',
  KL: '/geo/kerala.geojson',
  MH: '/geo/maharashtra.geojson',
}

// Illustrative flood extent tracing the Beas river corridor between Kullu
// and Manali — a hand-authored demonstration shape, not a hydrological model
// output. Only shown once a scenario has been run.
export const HP_FLOOD_EXTENT: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [77.08, 31.92],
        [77.21, 31.94],
        [77.23, 32.02],
        [77.21, 32.12],
        [77.22, 32.22],
        [77.18, 32.28],
        [77.14, 32.27],
        [77.13, 32.14],
        [77.1, 32.02],
        [77.07, 31.95],
        [77.08, 31.92],
      ],
    ],
  },
}

// The NH-5 corridor spine, used to render the "disrupted route" line.
export const HP_NH5_ROUTE: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [77.11, 31.96],
      [77.13, 32.0],
      [77.15, 32.04],
      [77.16, 32.1],
      [77.17, 32.17],
      [77.19, 32.23],
    ],
  },
}
