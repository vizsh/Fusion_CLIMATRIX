// Transition-risk lens — deliberately separate from the physical-hazard
// vulnerability in sectorVulnerability.ts. Physical risk asks "how exposed
// is this sector to a flood/drought/cyclone"; transition risk asks "how
// exposed is this sector's business model to decarbonisation policy,
// carbon pricing, and stranded-asset risk" — a cement plant can be a
// physical-risk beneficiary (reconstruction demand after a flood) while
// carrying high transition risk (carbon-intensive process emissions), and
// an IT services firm is near-zero on both. Keeping them as two separate,
// disclosed numbers instead of blending into one "climate score" is the
// same evidence-integrity discipline the rest of this app uses.
//
// SECTOR_TRANSITION_SENSITIVITY is a disclosed modelling assumption
// (loosely ordered by real-world process/fuel carbon intensity — cement,
// steel, shipping and logistics high; services and finance low), not a
// calibrated emissions-intensity or carbon-price pass-through model.

export const SECTOR_TRANSITION_SENSITIVITY: Record<string, number> = {
  'Port & Shipping': 0.8,
  Construction: 0.7,
  Logistics: 0.7,
  'Rubber processing': 0.6,
  Manufacturing: 0.6,
  Textiles: 0.5,
  'Real Estate / REIT': 0.5,
  'Agro processing': 0.45,
  Agriculture: 0.4,
  Dairy: 0.4,
  FMCG: 0.3,
  'Seafood export': 0.3,
  Pharmaceuticals: 0.25,
  'BFSI / Capital Markets': 0.2,
  Tourism: 0.2,
  'IT / BPO': 0.1,
}

export const DEFAULT_TRANSITION_SENSITIVITY = 0.4

export function transitionSensitivity(sector: string | undefined): number {
  if (!sector) return DEFAULT_TRANSITION_SENSITIVITY
  return SECTOR_TRANSITION_SENSITIVITY[sector] ?? DEFAULT_TRANSITION_SENSITIVITY
}

export interface TransitionExposureResult {
  eadCr: number
  transitionAtRiskCr: number
  bySector: { sector: string; eadCr: number; transitionAtRiskCr: number }[]
}

// Disclosed illustrative dampening factor — a policy-stringency dial at
// 100 does not mean "100% of EAD is lost to transition risk," it means
// "the most carbon-intensive borrowers could see a materially higher cost
// of capital / stranded-asset writedown." Same spirit as the physical-risk
// severity dial: a stress-test input, not a probability or measured loss.
const TRANSITION_ILLUSTRATIVE_FACTOR = 0.35

/** Policy stringency is a 0-100 dial, same shape as the physical severity
 * dial, but an independent axis — a region's flood severity and national
 * carbon-policy stringency do not move together. */
export function computeTransitionExposure(
  companies: { sector?: string; eadCr?: number }[],
  policyStringency: number,
): TransitionExposureResult {
  const bySectorMap = new Map<string, { sector: string; eadCr: number; transitionAtRiskCr: number }>()
  let eadCr = 0
  let transitionAtRiskCr = 0

  for (const c of companies) {
    const ead = c.eadCr ?? 0
    const sensitivity = transitionSensitivity(c.sector)
    const atRisk = ead * sensitivity * (policyStringency / 100) * TRANSITION_ILLUSTRATIVE_FACTOR
    eadCr += ead
    transitionAtRiskCr += atRisk

    const key = c.sector ?? 'Other'
    const existing = bySectorMap.get(key) ?? { sector: key, eadCr: 0, transitionAtRiskCr: 0 }
    existing.eadCr += ead
    existing.transitionAtRiskCr += atRisk
    bySectorMap.set(key, existing)
  }

  return {
    eadCr,
    transitionAtRiskCr,
    bySector: Array.from(bySectorMap.values()).sort((a, b) => b.transitionAtRiskCr - a.transitionAtRiskCr),
  }
}
