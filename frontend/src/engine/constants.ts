import type { Substitutability } from './types';

/**
 * Every tunable in the model lives here so the Evidence Drawer can display them.
 * None of these are calibrated. They are stated assumptions, not measurements.
 */

/** Maximum dependency hops traversed. The problem statement asks for second- and third-order effects. */
export const MAX_HOPS = 3;

/** How much of an infrastructure asset's disruption transfers to the entities it serves. */
export const INFRA_TRANSFER = 0.85;

/** Recovery decay rate per month after peak. Higher = faster restoration. */
export const RECOVERY_LAMBDA = 0.35;

/** Disruption realised at month 0, before full operational effects are felt. */
export const MONTH_ZERO_RAMP = 0.6;

/** Fraction of disruption that substitution can ultimately relieve, by substitutability class. */
export const SUB_RELIEF: Record<Substitutability, number> = {
  low: 0.2,
  moderate: 0.5,
  high: 0.8,
};

/** Global stance shifts every edge's substitutability by this many steps. */
export const SUB_STANCE_SHIFT: Record<Substitutability, number> = {
  low: -1,
  moderate: 0,
  high: 1,
};

/**
 * Asset vulnerability by segment: how badly a given hazard intensity translates into
 * operational disruption. Physical production is more exposed than service delivery.
 */
export const SEGMENT_VULNERABILITY: Record<string, number> = {
  api: 0.85,
  generics: 0.8,
  biotech: 0.72,
  cdmo: 0.82,
  component: 0.84,
  steel: 0.8,
  tyres: 0.78,
  oem: 0.74,
  cement: 0.8,
  construct: 0.86,
  power: 0.76,
  grid: 0.7,
  renew: 0.72,
  coal: 0.78,
  oilgas: 0.66,
  ports: 0.82,
  realty: 0.7,
  hospitals: 0.55,
  tools: 0.6,
  distribution: 0.5,
  bigpharma: 0.55,
  diabetes: 0.6,
  diagnostik: 0.55,
  medtech: 0.6,
  telecom: 0.45,
  datacentre: 0.4,
  cloud: 0.3,
  chips: 0.62,
  equip: 0.6,
  itserv: 0.25,
  product: 0.22,
  aisw: 0.2,
  data: 0.22,
  consult: 0.25,
  banks: 0.2,
  nbfc: 0.2,
  insurance: 0.18,
  capmkt: 0.18,
  payments: 0.18,
  betalinger: 0.18,
  investbank: 0.18,
  boers: 0.18,
  kapital: 0.18,
  platforms: 0.6,
  integrators: 0.55,
};
export const DEFAULT_VULNERABILITY = 0.5;

/**
 * Baseline protection already in place, by segment. Large listed operators are assumed to
 * run multi-site networks and continuity plans; single-site SMEs are not.
 */
export const LISTED_PROTECTION = 0.45;
export const UNLISTED_PROTECTION = 0.08;

/** Resilience capex intervention adds this much protection. */
export const RESILIENCE_CAPEX_PROTECTION = 0.2;

/** Supplier diversification intervention adds this much relief on top of the edge's own. */
export const DIVERSIFICATION_RELIEF_BONUS = 0.15;

/* ---------- credit risk ---------- */

/** Credit-risk measurement horizon, deliberately distinct from the disruption horizon. */
export const CREDIT_RISK_HORIZON_MONTHS = 12;

/** PD sensitivity to lost annual contribution margin. PD_stressed = PD_base * (1 + ALPHA * shortfall). */
export const PD_ALPHA = 6.0;

/** Borrower liquidity intervention dampens PD sensitivity by this factor. */
export const LIQUIDITY_ALPHA_DAMPING = 0.55;

/** Stressed PD is capped at this multiple of baseline, and at 1.0 absolute. */
export const PD_STRESS_CAP_MULTIPLE = 6.0;

/** LGD sensitivity to collateral impairment. LGD_stressed = LGD_base + BETA * impairment. */
export const LGD_BETA = 0.3;
export const LGD_CAP = 0.9;

/* ---------- hazard footprint ---------- */

/** Inside this fraction of a centroid's radius, intensity is at full strength. */
export const FOOTPRINT_CORE_FRACTION = 0.6;

/** Share of an asset's replacement cost assumed to need rebuilding at full disruption. */
export const PUBLIC_REPAIR_FRACTION = 0.6;

/** Baseline share of an available alternative route that is actually usable without planning. */
export const ALT_ROUTE_BASELINE_USE = 0.4;

/** Relief is capped below 1 - substitution is never perfect. */
export const MAX_RELIEF = 0.95;

/* ---------- hidden-exposure detection ---------- */

/** A company is "hidden" exposure when indirect dominates and direct is below this. */
export const HIDDEN_DIRECT_CEILING = 0.05;
export const HIDDEN_INDIRECT_FLOOR = 0.03;
