// Satellite location thumbnails — reuses the EXACT same Esri World
// Imagery source the Digital Twin's terrain already renders
// (digitalTwinMap.ts's terrainSatelliteStyle), via ArcGIS Server's
// standard "export" REST operation instead of a full tile-by-tile map,
// so a static thumbnail needs no new licensing question, no API key, and
// no embedded MapLibre instance per node card. Esri, Maxar, Earthstar
// Geographics attribution (same as the Digital Twin) applies here too.
//
// This is deliberately a coordinate preview, not verified asset
// intelligence: the pin marks this graph's own coordinate for the node
// (a real-place approximation — see indiaGraphData.ts's header comment),
// not a surveyed facility footprint.

const EXPORT_URL = 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export'

/** `spanDeg` controls zoom: ~0.01deg is a tight facility-level crop, ~0.05
 * a wider corridor/area view. Width/height in px. */
export function satelliteThumbnailUrl(lng: number, lat: number, spanDeg = 0.015, width = 480, height = 260): string {
  const bbox = [lng - spanDeg, lat - spanDeg, lng + spanDeg, lat + spanDeg].join(',')
  const params = new URLSearchParams({
    bbox,
    bboxSR: '4326',
    imageSR: '4326',
    size: `${width},${height}`,
    format: 'png24',
    f: 'image',
  })
  return `${EXPORT_URL}?${params.toString()}`
}
