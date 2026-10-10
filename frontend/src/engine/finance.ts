import {
  LGD_BETA,
  LGD_CAP,
  LIQUIDITY_ALPHA_DAMPING,
  PD_ALPHA,
  PD_STRESS_CAP_MULTIPLE,
  PUBLIC_REPAIR_FRACTION,
} from './constants';
import { companyById, exposures, infraById, infrastructure, portfolio } from './graph';
import type { PropagationResult } from './propagate';
import type {
  BankResult,
  ExposureResult,
  PortfolioPositionResult,
  SimulateRequest,
} from './types';

/**
 * Revenue at risk is a screening approximation:
 *   revenue x mean disruption over the horizon x (horizon / 12)
 *
 * It is not a cash-flow model. Lost revenue is not lost profit, which is why the
 * contribution-margin figure is carried separately and is the one fed into credit risk.
 */
export function companyFinancials(
  id: string,
  meanD: number,
  horizonMonths: number,
): { revenueAtRisk_cr: number; contributionLoss_cr: number } {
  const c = companyById.get(id);
  if (!c) return { revenueAtRisk_cr: 0, contributionLoss_cr: 0 };
  const revenueAtRisk_cr = c.revenue_cr * meanD * (horizonMonths / 12);
  return { revenueAtRisk_cr, contributionLoss_cr: revenueAtRisk_cr * c.margin };
}

/** Share of the borrower's annual contribution margin lost under the scenario. */
function cashflowShortfall(id: string, contributionLoss_cr: number): number {
  const c = companyById.get(id);
  if (!c) return 0;
  const annualContribution = c.revenue_cr * c.margin;
  if (annualContribution <= 0) return 0;
  return Math.max(0, Math.min(1, contributionLoss_cr / annualContribution));
}

/**
 * Credit stress.
 *
 * PD is driven by the borrower's lost contribution margin, never by hazard severity
 * directly - a flood severity score is not a probability of default. LGD moves only
 * where the pledged collateral is itself in the hazard footprint.
 */
export function stressExposures(
  prop: PropagationResult,
  req: SimulateRequest,
  contributionLossById: Map<string, number>,
): ExposureResult[] {
  const alpha = req.interventions.borrowerLiquidity ? PD_ALPHA * LIQUIDITY_ALPHA_DAMPING : PD_ALPHA;

  return exposures.map((e) => {
    const loss = contributionLossById.get(e.borrower) ?? 0;
    const shortfall = cashflowShortfall(e.borrower, loss);

    const pdStressed = Math.min(
      1,
      e.pd_base * PD_STRESS_CAP_MULTIPLE,
      e.pd_base * (1 + alpha * shortfall),
    );

    const collateralImpairment = e.collateral_hazard_exposed
      ? (prop.peakDirect.get(e.borrower) ?? 0)
      : 0;
    const lgdStressed = Math.min(LGD_CAP, e.lgd_base + LGD_BETA * collateralImpairment);

    const elBase_cr = e.ead_cr * e.pd_base * e.lgd_base;
    const elStressed_cr = e.ead_cr * pdStressed * lgdStressed;

    return {
      id: e.id,
      lender: e.lender,
      borrower: e.borrower,
      ead_cr: e.ead_cr,
      pdBase: e.pd_base,
      pdStressed,
      lgdBase: e.lgd_base,
      lgdStressed,
      elBase_cr,
      elStressed_cr,
      deltaEl_cr: elStressed_cr - elBase_cr,
      cashflowShortfall: shortfall,
      collateralImpairment,
    };
  });
}

/**
 * Aggregate by lender.
 *
 * Each exposure is counted exactly once. Where one disrupted supplier drives several
 * borrowers, each borrower's own credit effect is counted, but the supplier's original
 * disruption is never re-added as a separate loss.
 */
export function aggregateByBank(results: ExposureResult[]): BankResult[] {
  const byLender = new Map<string, BankResult>();
  for (const r of results) {
    let b = byLender.get(r.lender);
    if (!b) {
      b = {
        lender: r.lender,
        ead_cr: 0,
        elBase_cr: 0,
        elStressed_cr: 0,
        deltaEl_cr: 0,
        exposureCount: 0,
      };
      byLender.set(r.lender, b);
    }
    b.ead_cr += r.ead_cr;
    b.elBase_cr += r.elBase_cr;
    b.elStressed_cr += r.elStressed_cr;
    b.deltaEl_cr += r.deltaEl_cr;
    b.exposureCount += 1;
  }
  return [...byLender.values()].sort((a, b) => b.deltaEl_cr - a.deltaEl_cr);
}

/**
 * Public reconstruction requirement.
 *
 * Kept strictly separate from bank losses. A damaged state highway is a public
 * expenditure, not a credit loss, and the two must never be summed.
 */
export function publicReconstruction(prop: PropagationResult): number {
  let total = 0;
  for (const i of infrastructure) {
    total += i.replacement_cr * (prop.peakInfra.get(i.id) ?? 0) * PUBLIC_REPAIR_FRACTION;
  }
  return total;
}

export function infraDamageBreakdown(prop: PropagationResult) {
  return [...prop.peakInfra.entries()]
    .map(([id, d]) => {
      const i = infraById.get(id)!;
      return {
        id,
        name: i.name,
        type: i.type,
        district: i.district,
        peakDisruption: d,
        reconstruction_cr: i.replacement_cr * d * PUBLIC_REPAIR_FRACTION,
      };
    })
    .filter((x) => x.peakDisruption > 0.001)
    .sort((a, b) => b.reconstruction_cr - a.reconstruction_cr);
}

/**
 * Portfolio value at risk.
 *
 * Crude screening proxy: position value scaled by the share of the holding's annual
 * contribution margin lost. This is not a valuation or discounted cash-flow model and
 * should not be read as an expected price move.
 */
export function portfolioImpact(
  contributionLossById: Map<string, number>,
  meanD: Map<string, number>,
  hop: Map<string, number>,
  hiddenIds: Set<string>,
): { aum_cr: number; valueAtRisk_cr: number; positions: PortfolioPositionResult[] } {
  const positions: PortfolioPositionResult[] = portfolio.positions.map((p) => {
    const value_cr = (portfolio.aum_cr * p.weight_bps) / 10000;
    const shortfall = cashflowShortfall(p.company, contributionLossById.get(p.company) ?? 0);
    return {
      company: p.company,
      weight_bps: p.weight_bps,
      value_cr,
      meanD: meanD.get(p.company) ?? 0,
      valueAtRisk_cr: value_cr * shortfall,
      hop: hop.get(p.company) ?? null,
      hidden: hiddenIds.has(p.company),
    };
  });

  return {
    aum_cr: portfolio.aum_cr,
    valueAtRisk_cr: positions.reduce((a, p) => a + p.valueAtRisk_cr, 0),
    positions: positions.sort((a, b) => b.valueAtRisk_cr - a.valueAtRisk_cr),
  };
}
