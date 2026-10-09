// Real, DEM-derived flood extent for the Kullu-Manali valley.
//
// Rather than a fixed hand-drawn polygon, this decodes actual elevation
// from the same free Terrarium tiles used for 3D terrain, then grows a
// water-level ribbon outward from the valley's river/road corridor until
// the terrain rises above the modeled flood level. The flood level itself
// is a simple, disclosed function of the user's severity dial — not a
// calibrated hydrological simulation, but a real computation over real
// elevation data rather than an illustrative shape.

export interface TileRef {
  z: number
  x: number
  y: number
}

// Covers the Kullu-Manali valley (~77.0-77.3E, 31.85-32.35N) at zoom 10 —
// coarse enough to need only two tiles, fine enough (~150m/px) for a
// valley-scale flood ribbon. Computed via standard slippy-map tile math.
export const HP_VALLEY_TILES: TileRef[] = [
  { z: 10, x: 731, y: 415 },
  { z: 10, x: 731, y: 416 },
]

interface DecodedTile extends TileRef {
  data: Uint8ClampedArray
  size: number
}

function terrariumElevation(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768
}

async function decodeTile(ref: TileRef): Promise<DecodedTile> {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ref.z}/${ref.x}/${ref.y}.png`
  const res = await fetch(url)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return { ...ref, data, size: bitmap.width }
}

function lngLatToTileFrac(lng: number, lat: number, z: number) {
  const n = 2 ** z
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

export type ElevationSampler = (lng: number, lat: number) => number | null

export async function loadElevationSampler(tiles: TileRef[] = HP_VALLEY_TILES): Promise<ElevationSampler> {
  const decoded = await Promise.all(tiles.map(decodeTile))

  return (lng, lat) => {
    const z = decoded[0].z
    const { x: tx, y: ty } = lngLatToTileFrac(lng, lat, z)
    const tileX = Math.floor(tx)
    const tileY = Math.floor(ty)
    const tile = decoded.find((t) => t.x === tileX && t.y === tileY)
    if (!tile) return null
    const px = Math.min(tile.size - 1, Math.max(0, Math.floor((tx - tileX) * tile.size)))
    const py = Math.min(tile.size - 1, Math.max(0, Math.floor((ty - tileY) * tile.size)))
    const i = (py * tile.size + px) * 4
    return terrariumElevation(tile.data[i], tile.data[i + 1], tile.data[i + 2])
  }
}

// The NH-5 corridor doubles as the river-valley centerline — the road and
// the Beas river run the same course through this stretch of the valley.
export const VALLEY_CENTERLINE: [number, number][] = [
  [77.11, 31.96],
  [77.13, 32.0],
  [77.15, 32.04],
  [77.16, 32.1],
  [77.17, 32.17],
  [77.19, 32.23],
]

const MAX_RISE_M = 140 // modeled water-level rise at severity 100/100
const MAX_HALF_WIDTH_KM = 7
const STEP_KM = 0.3

function destinationPoint(lng: number, lat: number, bearingRad: number, distanceKm: number): [number, number] {
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180)
  const dEastM = distanceKm * 1000 * Math.sin(bearingRad)
  const dNorthM = distanceKm * 1000 * Math.cos(bearingRad)
  return [lng + dEastM / metersPerDegLng, lat + dNorthM / metersPerDegLat]
}

function bearing(a: [number, number], b: [number, number]) {
  const dLng = b[0] - a[0]
  const dLat = b[1] - a[1]
  return Math.atan2(dLng, dLat) // radians, 0 = north
}

/** Grows a flood ribbon outward from the valley centerline using real
 * sampled elevation, stopping where terrain rises above the modeled
 * water level. Returns null if elevation data hasn't loaded yet. */
export function computeFloodRibbon(
  sampler: ElevationSampler | null,
  severity: number,
  centerline: [number, number][] = VALLEY_CENTERLINE,
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  if (!sampler) return null

  const floodRise = (severity / 100) * MAX_RISE_M
  const left: [number, number][] = []
  const right: [number, number][] = []

  for (let i = 0; i < centerline.length; i++) {
    const pt = centerline[i]
    const prev = centerline[Math.max(0, i - 1)]
    const next = centerline[Math.min(centerline.length - 1, i + 1)]
    const dir = bearing(prev, next)
    const baseElevation = sampler(pt[0], pt[1])
    if (baseElevation == null) continue
    const floodLevel = baseElevation + floodRise

    for (const side of [1, -1] as const) {
      const perpBearing = dir + (side * Math.PI) / 2
      let boundary: [number, number] = pt
      for (let d = STEP_KM; d <= MAX_HALF_WIDTH_KM; d += STEP_KM) {
        const probe = destinationPoint(pt[0], pt[1], perpBearing, d)
        const el = sampler(probe[0], probe[1])
        if (el == null || el > floodLevel) break
        boundary = probe
      }
      ;(side === 1 ? right : left).push(boundary)
    }
  }

  if (left.length < 2 || right.length < 2) return null

  const ring = [...left, ...right.reverse(), left[0]]
  return {
    type: 'Feature',
    properties: { severity, floodRiseM: Math.round(floodRise) },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}
