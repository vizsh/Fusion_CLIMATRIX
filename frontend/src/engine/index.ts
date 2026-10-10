import {
  CREDIT_RISK_HORIZON_MONTHS,
  HIDDEN_DIRECT_CEILING,
  HIDDEN_INDIRECT_FLOOR,
  LGD_BETA,
  MAX_HOPS,
  PD_ALPHA,
  RECOVERY_LAMBDA,
} from './constants';
import {
  aggregateByBank,
  companyFinancials,
  portfolioImpact,
  publicReconstruction,
  stressExposures,
} from './finance';
import { companies, hazardById, infrastructure } from './graph';
import { propagate } from './propagate';
import type {
  CompanyResult,
  RiskChannels,
  SimulateRequest,
  SimulateResponse,
} from './types';

export const DEFAULT_REQUEST: SimulateRequest = {
  hazardId: 'IN-FLOOD-HP-2023',
  severity: 90,
  durationMonths: 6,
  substitutability: 'moderate',
  interventions: {
    altRoutes: false,
    supplierDiversification: false,
    resilienceCapex: false,
    borrowerLiquidity: false,
  },
};

const AGRI_WATER_IDS = ['hp-kullu-horti', 'hp-kangra-agro', 'hp-mandi-hydro'];

/**
 * The single boundary between the UI and the model.
 *
 * Deliberately async: when this moves to a FastAPI backend, only the body of this
 * function changes and every loading state in the interface already works.
 */
export async function simulate(req: SimulateRequest): Promise<SimulateResponse> {
  const started = performance.now();

  const hazard = hazardById.get(req.hazardId);
  if (!hazard) throw new Error(`Unknown hazard: ${req.hazardId}`);

  const prop = propagate(hazard, req);
  const horizon = Math.max(1, Math.round(req.durationMonths));

  /* ---- company level ---- */

  const contributionLossById = new Map<string, number>();
  const hiddenIds = new Set<string>();
  const companyResults: Record<string, CompanyResult> = {};

  for (const c of companies) {
    const meanD = prop.meanD.get(c.id) ?? 0;
    const peakDirect = prop.peakDirect.get(c.id) ?? 0;
    const peakIndirect = prop.peakIndirect.get(c.id) ?? 0;
    const fin = companyFinancials(c.id, meanD, horizon);
    contributionLossById.set(c.id, fin.contributionLoss_cr);

    const hidden =
      peakDirect < HIDDEN_DIRECT_CEILING &&
      peakIndirect >= HIDDEN_INDIRECT_FLOOR &&
      peakIndirect > peakDirect * 2;
    if (hidden) hiddenIds.add(c.id);

    companyResults[c.id] = {
      id: c.id,
      peakD: prop.peakD.get(c.id) ?? 0,
      meanD,
      peakDirect,
      peakIndirect,
      hop: prop.hop.get(c.id) ?? null,
      revenueAtRisk_cr: fin.revenueAtRisk_cr,
      contributionLoss_cr: fin.contributionLoss_cr,
      paths: prop.paths.get(c.id) ?? [],
      hidden,
    };
  }

  /* ---- bank and public layers, kept apart ---- */

  const exposureResults = stressExposures(prop, req, contributionLossById);
  const banks = aggregateByBank(exposureResults);
  const publicCost = publicReconstruction(prop);
  const portfolio = portfolioImpact(contributionLossById, prop.meanD, prop.hop, hiddenIds);

  /* ---- headline channels ---- */

  const affected = companies.filter((c) => (prop.peakD.get(c.id) ?? 0) > 0.01);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const transportAssets = infrastructure.filter((i) => i.type === 'road' || i.type === 'bridge');
  const channels: RiskChannels = {
    physical: Math.round(
      100 * mean(affected.map((c) => prop.peakDirect.get(c.id) ?? 0)),
    ),
    supplier: Math.round(
      100 * mean(affected.map((c) => prop.peakIndirect.get(c.id) ?? 0)),
    ),
    transport: Math.round(
      100 * mean(transportAssets.map((i) => prop.peakInfra.get(i.id) ?? 0)),
    ),
    agriWater: Math.round(100 * mean(AGRI_WATER_IDS.map((id) => prop.peakD.get(id) ?? 0))),
  };

  const totals = {
    deltaEl_cr: exposureResults.reduce((a, e) => a + e.deltaEl_cr, 0),
    contributionLoss_cr: [...contributionLossById.values()].reduce((a, b) => a + b, 0),
    publicReconstruction_cr: publicCost,
    directlyHitEntities: prop.directlyHit.length,
    affectedEntities: affected.length,
    maxHopDepth: Math.max(0, ...[...prop.hop.values()]),
    hiddenExposureCount: hiddenIds.size,
  };

  const assumptions = [
    {
      key: 'Hazard severity',
      value: `${req.severity}/100`,
      note: 'Scenario control that scales the footprint. Not a probability, a flood depth or a damage rate.',
    },
    {
      key: 'Disruption horizon',
      value: `${horizon} months`,
      note: 'Modelled operational disruption window, distinct from the credit-risk horizon.',
    },
    {
      key: 'Credit-risk horizon',
      value: `${CREDIT_RISK_HORIZON_MONTHS} months`,
      note: 'PD is measured over 12 months. It is not the same window as the disruption horizon.',
    },
    {
      key: 'Max dependency depth',
      value: `${MAX_HOPS} hops per month`,
      note: 'Second- and third-order effects are traversed within each month. Because inventory buffers make a customer read its supplier’s earlier state, effects can carry further than three hops across the horizon. Reported hop distance is the shortest same-month chain.',
    },
    {
      key: 'Substitutability stance',
      value: req.substitutability,
      note: 'Shifts every edge one class. Relief ramps over each edge’s switching time and is capped at 95%.',
    },
    {
      key: 'PD sensitivity (alpha)',
      value: String(PD_ALPHA),
      note: 'PD_stressed = PD_base x (1 + alpha x lost contribution share), capped at 6x baseline. Uncalibrated.',
    },
    {
      key: 'LGD sensitivity (beta)',
      value: String(LGD_BETA),
      note: 'Applies only where pledged collateral sits inside the hazard footprint. Uncalibrated.',
    },
    {
      key: 'Recovery decay',
      value: String(RECOVERY_LAMBDA),
      note: 'Disruption peaks at month 1 and decays exponentially. Not calibrated to restoration records.',
    },
    {
      key: 'Path combination',
      value: 'noisy-OR',
      note: 'Parallel supplier disruptions combine sub-additively and cannot exceed total shutdown.',
    },
    {
      key: 'Financial layers',
      value: 'kept separate',
      note: 'Company contribution loss, bank expected credit loss and public reconstruction are never summed.',
    },
  ];

  // Engine runs locally today. The await keeps the call shape identical to the
  // FastAPI version so no loading state has to be retrofitted later.
  await Promise.resolve();

  return {
    scenarioId: `${hazard.id}-S${req.severity}-D${horizon}-${req.substitutability.toUpperCase()}`,
    request: req,
    hazard,
    months: prop.months,
    companies: companyResults,
    exposures: exposureResults,
    banks,
    portfolio,
    totals,
    channels,
    assumptions,
    generatedAt: new Date().toISOString(),
    computeMs: performance.now() - started,
  };
}

export * from './types';
export { companies, companyById, hazards, portfolio as portfolioData } from './graph';
