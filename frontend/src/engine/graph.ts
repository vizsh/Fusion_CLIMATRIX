import companiesData from '../data/companies.json';
import relationsData from '../data/relations.json';
import infraData from '../data/infrastructure.json';
import hazardsData from '../data/hazards.json';
import exposuresData from '../data/exposures.json';
import holdingsData from '../data/holdings.json';

import {
  DEFAULT_VULNERABILITY,
  FOOTPRINT_CORE_FRACTION,
  LISTED_PROTECTION,
  SEGMENT_VULNERABILITY,
  UNLISTED_PROTECTION,
} from './constants';
import type {
  Company,
  Exposure,
  Hazard,
  Infrastructure,
  Position,
  Relation,
} from './types';

export const companies = companiesData.companies as Company[];
export const relations = relationsData.relations as Relation[];
export const infrastructure = infraData.infrastructure as Infrastructure[];
export const hazards = hazardsData.hazards as Hazard[];
export const exposures = exposuresData.exposures as Exposure[];
export const portfolio = holdingsData.portfolio as {
  name: string;
  aum_cr: number;
  base_currency: string;
  positions: Position[];
};

export const companyById = new Map(companies.map((c) => [c.id, c]));
export const infraById = new Map(infrastructure.map((i) => [i.id, i]));
export const hazardById = new Map(hazards.map((h) => [h.id, h]));

/** supplier -> outgoing edges (to its customers) */
export const outEdges = new Map<string, Relation[]>();
/** customer -> incoming edges (from its suppliers) */
export const inEdges = new Map<string, Relation[]>();

for (const r of relations) {
  if (!outEdges.has(r.supplier)) outEdges.set(r.supplier, []);
  outEdges.get(r.supplier)!.push(r);
  if (!inEdges.has(r.customer)) inEdges.set(r.customer, []);
  inEdges.get(r.customer)!.push(r);
}

/** company id -> infrastructure assets it depends on */
export const infraServing = new Map<string, { infra: Infrastructure; criticality: number }[]>();
for (const i of infrastructure) {
  for (const s of i.serves) {
    if (!infraServing.has(s.id)) infraServing.set(s.id, []);
    infraServing.get(s.id)!.push({ infra: i, criticality: s.criticality_to_served });
  }
}

export function vulnerabilityOf(c: Company): number {
  return SEGMENT_VULNERABILITY[c.segment] ?? DEFAULT_VULNERABILITY;
}

export function protectionOf(c: Company): number {
  return c.listed ? LISTED_PROTECTION : UNLISTED_PROTECTION;
}

const EARTH_R_KM = 6371;

export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(s));
}

/**
 * Hazard intensity at a point, 0-1.
 *
 * Full strength inside the inner FOOTPRINT_CORE_FRACTION of a centroid's radius, then
 * falling linearly to zero at the edge. Overlapping centroids take the maximum, not the
 * sum - two nearby districts both flooding does not make a place more than fully flooded.
 *
 * This is a coarse screening footprint. It is not an inundation model and says nothing
 * about flood depth or structural damage.
 */
export function hazardIntensityAt(hazard: Hazard, lat: number, lon: number): number {
  let best = 0;
  for (const c of hazard.centroids) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d >= c.radius_km) continue;
    const core = c.radius_km * FOOTPRINT_CORE_FRACTION;
    const falloff =
      d <= core ? 1 : 1 - (d - core) / (c.radius_km - core);
    best = Math.max(best, c.intensity * falloff);
  }
  return best;
}

