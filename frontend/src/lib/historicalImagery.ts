// Historical before/after satellite imagery — Feature A from the imagery
// audit. Uses NASA's own free, public GIBS Worldview Snapshot API (no key,
// documented at https://wvs.earthdata.nasa.gov), which serves a specific
// PAST date's MODIS true-color capture for a bounding box — this is real,
// dated NASA imagery, not a generated or illustrative graphic. Verified
// directly (curl) before wiring in: both dates return real JPEGs.

const SNAPSHOT_URL = 'https://wvs.earthdata.nasa.gov/api/v1/snapshot'

export function nasaSnapshotUrl(bbox: [number, number, number, number], date: string, width = 600, height = 520): string {
  const params = new URLSearchParams({
    REQUEST: 'GetSnapshot',
    LAYERS: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    CRS: 'EPSG:4326',
    TIME: date,
    BBOX: bbox.join(','),
    FORMAT: 'image/jpeg',
    WIDTH: String(width),
    HEIGHT: String(height),
  })
  return `${SNAPSHOT_URL}?${params.toString()}`
}

export interface HistoricalComparison {
  id: string
  title: string
  bbox: [number, number, number, number] // [minLat, minLon, maxLat, maxLon]
  before: { date: string; label: string }
  after: { date: string; label: string }
  context: string
}

// The documented 2018 Kerala flood — the exact before/after window cited
// in NASA Earth Observatory's own published comparison (reproduced by
// The National): 6 Feb 2018 (dry-season baseline) vs. 22 Aug 2018 (after
// the flood's peak). Same retrospective anchor WEATHER_WINDOWS already
// uses for Kerala elsewhere in this app.
export const HISTORICAL_COMPARISONS: Record<string, HistoricalComparison> = {
  KL: {
    id: 'kerala-2018',
    title: 'Kerala, August 2018 flood',
    bbox: [9.3, 76.0, 10.6, 77.3],
    before: { date: '2018-02-06', label: '6 Feb 2018 — dry-season baseline' },
    after: { date: '2018-08-22', label: '22 Aug 2018 — after the flood’s peak' },
    context:
      'MODIS true-color capture over the Periyar/Idukki catchment. Water extent and turbidity visibly increase between the two dates — this documents historical physical conditions, it does not prove the current hazard in this app’s active scenario or any company’s financial loss.',
  },
}
