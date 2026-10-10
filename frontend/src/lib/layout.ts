import { companies } from '@/engine/graph';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Degrees between adjacent markers in a city rosette. */
const STEP_DEG = 0.34;

export interface Placement {
  id: string;
  lat: number;
  lon: number;
  /** True where the marker has been offset from its city's real coordinates. */
  offset: boolean;
}

/**
 * Marker placement.
 *
 * Thirty companies share a Mumbai HQ coordinate, so drawn literally they collapse into
 * one dot. Each city's companies are instead arranged in a phyllotaxis rosette around
 * the real coordinate - deterministic, evenly spaced, and it reads as a deliberate
 * cluster rather than overlapping noise.
 *
 * The offset is cosmetic and never reaches the model: hazard intensity is always
 * evaluated at the true city coordinate in graph.ts, not at the drawn position.
 */
let cache: Map<string, Placement> | null = null;

/** Placements are deterministic, so compute once and share. */
export function getPlacements(): Map<string, Placement> {
  if (!cache) cache = computePlacements();
  return cache;
}

function computePlacements(): Map<string, Placement> {
  const byCity = new Map<string, typeof companies>();
  for (const c of companies) {
    const key = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if (!byCity.has(key)) byCity.set(key, []);
    byCity.get(key)!.push(c);
  }

  const out = new Map<string, Placement>();
  for (const group of byCity.values()) {
    // Stable ordering so the rosette never reshuffles between runs.
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const single = sorted.length === 1;

    sorted.forEach((c, i) => {
      if (single) {
        out.set(c.id, { id: c.id, lat: c.lat, lon: c.lon, offset: false });
        return;
      }
      const r = STEP_DEG * Math.sqrt(i);
      const a = i * GOLDEN_ANGLE;
      const latScale = Math.max(0.2, Math.cos((c.lat * Math.PI) / 180));
      out.set(c.id, {
        id: c.id,
        lat: c.lat + r * Math.sin(a),
        lon: c.lon + (r * Math.cos(a)) / latScale,
        offset: i > 0,
      });
    });
  }
  return out;
}
