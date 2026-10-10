export type Evidence = 'verified' | 'sourced' | 'inferred' | 'assumed' | 'synthetic';
export type Substitutability = 'low' | 'moderate' | 'high';

export interface Company {
  id: string;
  ticker: string | null;
  name: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  sector: string;
  segment: string;
  listed: boolean;
  revenue_cr: number;
  margin: number;
  evidence: Evidence;
}

export interface Relation {
  supplier: string;
  customer: string;
  what: string;
  criticality: number;
  substitutability: Substitutability;
  switching_months: number;
  inventory_months: number;
  evidence: Evidence;
}

export interface InfraServed {
  id: string;
  criticality_to_served: number;
}

export interface Infrastructure {
  id: string;
  name: string;
  type: 'road' | 'bridge' | 'substation' | 'utility';
  district: string;
  lat: number;
  lon: number;
  vulnerability: number;
  protection: number;
  alt_route_available: boolean;
  alt_capacity: number;
  replacement_cr: number;
  serves: InfraServed[];
  evidence: Evidence;
}

export interface HazardCentroid {
  district: string;
  lat: number;
  lon: number;
  intensity: number;
  radius_km: number;
}

export interface Hazard {
  id: string;
  name: string;
  short: string;
  type: string;
  year: number | null;
  region: string;
  evidence: Evidence;
  source: string;
  narrative: string;
  centroids: HazardCentroid[];
}

export interface Exposure {
  id: string;
  lender: string;
  borrower: string;
  ead_cr: number;
  pd_base: number;
  lgd_base: number;
  collateral_type: string;
  collateral_hazard_exposed: boolean;
}

export interface Position {
  company: string;
  weight_bps: number;
}

/* ---------- request ---------- */

export interface Interventions {
  altRoutes: boolean;
  supplierDiversification: boolean;
  resilienceCapex: boolean;
  borrowerLiquidity: boolean;
}

export interface SimulateRequest {
  hazardId: string;
  /** Scenario control, 0-100. NOT a probability, flood depth or damage rate. */
  severity: number;
  /** Operational disruption horizon in months. */
  durationMonths: number;
  /** Global substitutability stance; shifts every edge's relief rate. */
  substitutability: Substitutability;
  interventions: Interventions;
}

/* ---------- response ---------- */

export interface NodeMonthState {
  /** Total operational disruption 0-1 at this month. */
  d: number;
  /** Portion attributable to the hazard hitting this entity or its own infrastructure. */
  direct: number;
  /** Portion arriving through supplier dependencies. */
  indirect: number;
}

export interface MonthSnapshot {
  month: number;
  nodes: Record<string, NodeMonthState>;
  infra: Record<string, number>;
}

export interface ExposurePath {
  /** Ordered chain, origin first: [hazard-hit entity, ..., target]. */
  chain: string[];
  /** Via infrastructure asset id, when the first link is an access/utility failure. */
  viaInfra?: string;
  hops: number;
  /** Disruption delivered to the target through this path at peak. */
  contribution: number;
}

export interface CompanyResult {
  id: string;
  peakD: number;
  meanD: number;
  peakDirect: number;
  peakIndirect: number;
  /** Shortest hop distance from any directly hit entity. 0 = directly hit. */
  hop: number | null;
  revenueAtRisk_cr: number;
  contributionLoss_cr: number;
  /** Highest-contribution paths that explain this company's indirect exposure. */
  paths: ExposurePath[];
  /** True when indirect exposure dominates and direct exposure is negligible. */
  hidden: boolean;
}

export interface ExposureResult {
  id: string;
  lender: string;
  borrower: string;
  ead_cr: number;
  pdBase: number;
  pdStressed: number;
  lgdBase: number;
  lgdStressed: number;
  elBase_cr: number;
  elStressed_cr: number;
  deltaEl_cr: number;
  cashflowShortfall: number;
  collateralImpairment: number;
}

export interface BankResult {
  lender: string;
  ead_cr: number;
  elBase_cr: number;
  elStressed_cr: number;
  deltaEl_cr: number;
  exposureCount: number;
}

export interface PortfolioPositionResult {
  company: string;
  weight_bps: number;
  value_cr: number;
  meanD: number;
  valueAtRisk_cr: number;
  hop: number | null;
  hidden: boolean;
}

export interface RiskChannels {
  physical: number;
  supplier: number;
  transport: number;
  agriWater: number;
}

export interface SimulateResponse {
  scenarioId: string;
  request: SimulateRequest;
  hazard: Hazard;
  months: MonthSnapshot[];
  companies: Record<string, CompanyResult>;
  exposures: ExposureResult[];
  banks: BankResult[];
  portfolio: {
    aum_cr: number;
    valueAtRisk_cr: number;
    positions: PortfolioPositionResult[];
  };
  totals: {
    /** Bank bucket. Never summed with the other two. */
    deltaEl_cr: number;
    /** Company bucket. */
    contributionLoss_cr: number;
    /** Public bucket. */
    publicReconstruction_cr: number;
    directlyHitEntities: number;
    affectedEntities: number;
    maxHopDepth: number;
    hiddenExposureCount: number;
  };
  channels: RiskChannels;
  assumptions: { key: string; value: string; note: string }[];
  generatedAt: string;
  computeMs: number;
}
