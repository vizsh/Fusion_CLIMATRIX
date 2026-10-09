// Protection-gap and insurer-book calculations — the insurance lens on the
// same exposure graph the bank/investor lenses already read. Deliberately
// only ~1/4 of companies carry a policy (see indiaGraphData.ts) so the
// protection gap stays a real finding, not an artifact of insuring
// everything. All figures here are disclosed, severity-scaled estimates
// (the same mechanic as the equity lens's revenue-at-risk formula in
// useScenarioStore.ts), never a calibrated actuarial loss model.

import { EDGES, NODES, type GNode } from './indiaGraphData'
import { computeHazardReach } from './graphAnalytics'
import { sectorVulnerability } from './sectorVulnerability'

const nodeById = new Map(NODES.map((n) => [n.id, n]))

function insurerFor(companyId: string): GNode | undefined {
  const edge = EDGES.find((e) => e.from === companyId && e.type === 'INSURED_BY')
  return edge ? nodeById.get(edge.to) : undefined
}

interface ClaimEstimate {
  disruptionFraction: number
  grossClaimCr: number
  deductibleCr: number
  netClaimCr: number
  premiumCr: number
}

function estimateClaim(company: GNode, severity: number, durationMonths: number): ClaimEstimate | null {
  if (!company.sumInsuredCr) return null
  const vulnerability = sectorVulnerability(company.sector)
  const monthsFraction = Math.min(durationMonths / 12, 1)
  const disruptionFraction = Math.min((severity / 100) * vulnerability * monthsFraction, 1)
  const grossClaimCr = company.sumInsuredCr * disruptionFraction
  const deductibleCr = grossClaimCr * (company.deductiblePct ?? 0)
  const netClaimCr = Math.max(0, grossClaimCr - deductibleCr)
  const premiumCr = company.sumInsuredCr * ((company.premiumRateBps ?? 0) / 10000)
  return { disruptionFraction, grossClaimCr, deductibleCr, netClaimCr, premiumCr }
}

export interface InsuredCompanyImpact {
  company: GNode
  insurer: GNode
  sumInsuredCr: number
  premiumCr: number
  disruptionFraction: number
  grossClaimCr: number
  deductibleCr: number
  netClaimCr: number
}

export interface ProtectionGapResult {
  exposedCompanies: GNode[]
  exposedEADCr: number
  insured: InsuredCompanyImpact[]
  uninsuredExposed: GNode[]
  insuredEADCr: number
  uninsuredEADCr: number
  protectionGapShare: number // uninsured EAD / exposed EAD
  totalSumInsuredCr: number
  totalPremiumCr: number
  totalNetClaimsCr: number
  portfolioLossRatio: number // claims / premium, across the insured-exposed subset
}

/** For every company the active hazard reaches, splits insured vs
 * structurally uninsured exposure and estimates the claim an insured
 * company would file. The headline number — protectionGapShare — is the
 * single most actionable output: what fraction of the exposed book has
 * zero coverage against this scenario. */
export function computeProtectionGap(hazardId: string, severity: number, durationMonths: number): ProtectionGapResult {
  const { companies: exposedCompanies, companyEAD: exposedEADCr } = computeHazardReach(hazardId)

  const insured: InsuredCompanyImpact[] = []
  const uninsuredExposed: GNode[] = []

  for (const company of exposedCompanies) {
    const insurer = insurerFor(company.id)
    const claim = insurer ? estimateClaim(company, severity, durationMonths) : null
    if (!insurer || !claim) {
      uninsuredExposed.push(company)
      continue
    }
    insured.push({
      company,
      insurer,
      sumInsuredCr: company.sumInsuredCr!,
      premiumCr: claim.premiumCr,
      disruptionFraction: claim.disruptionFraction,
      grossClaimCr: claim.grossClaimCr,
      deductibleCr: claim.deductibleCr,
      netClaimCr: claim.netClaimCr,
    })
  }

  const insuredEADCr = insured.reduce((s, i) => s + (i.company.eadCr ?? 0), 0)
  const uninsuredEADCr = uninsuredExposed.reduce((s, c) => s + (c.eadCr ?? 0), 0)
  const totalSumInsuredCr = insured.reduce((s, i) => s + i.sumInsuredCr, 0)
  const totalPremiumCr = insured.reduce((s, i) => s + i.premiumCr, 0)
  const totalNetClaimsCr = insured.reduce((s, i) => s + i.netClaimCr, 0)

  return {
    exposedCompanies,
    exposedEADCr,
    insured,
    uninsuredExposed,
    insuredEADCr,
    uninsuredEADCr,
    protectionGapShare: exposedEADCr ? uninsuredEADCr / exposedEADCr : 0,
    totalSumInsuredCr,
    totalPremiumCr,
    totalNetClaimsCr,
    portfolioLossRatio: totalPremiumCr ? totalNetClaimsCr / totalPremiumCr : 0,
  }
}

export interface InsurerBookResult {
  insurer: GNode
  policyCount: number
  totalSumInsuredCr: number
  totalPremiumCr: number
  expectedNetClaimsCr: number
  grossLossRatio: number
  cededSharePct: number
  cededClaimsCr: number
  retainedClaimsCr: number
  /** Set only for a subsidized scheme (e.g. PMFBY): how the actuarial
   * premium above actually gets paid for. */
  govtSubsidyPct: number
  farmerPaidPremiumCr: number
  govtSubsidyCr: number
}

/** One insurer's book under the active scenario, plus how much of its
 * claims burden it cedes to its reinsurance treaty — the insurer-side
 * mirror of computeBankConcentration's credit view, but for underwriting
 * (cat concentration) risk. */
export function computeInsurerBook(
  insurerId: string,
  hazardId: string,
  severity: number,
  durationMonths: number,
): InsurerBookResult | null {
  const insurer = nodeById.get(insurerId)
  if (!insurer || insurer.kind !== 'insurer') return null
  const gap = computeProtectionGap(hazardId, severity, durationMonths)
  const book = gap.insured.filter((i) => i.insurer.id === insurerId)
  const totalSumInsuredCr = book.reduce((s, i) => s + i.sumInsuredCr, 0)
  const totalPremiumCr = book.reduce((s, i) => s + i.premiumCr, 0)
  const expectedNetClaimsCr = book.reduce((s, i) => s + i.netClaimCr, 0)
  const cededSharePct = insurer.cededReinsuranceSharePct ?? 0
  const cededClaimsCr = expectedNetClaimsCr * (cededSharePct / 100)
  const govtSubsidyPct = insurer.govtSubsidyPct ?? 0
  const govtSubsidyCr = totalPremiumCr * (govtSubsidyPct / 100)
  return {
    insurer,
    policyCount: book.length,
    totalSumInsuredCr,
    totalPremiumCr,
    expectedNetClaimsCr,
    grossLossRatio: totalPremiumCr ? expectedNetClaimsCr / totalPremiumCr : 0,
    cededSharePct,
    cededClaimsCr,
    retainedClaimsCr: expectedNetClaimsCr - cededClaimsCr,
    govtSubsidyPct,
    farmerPaidPremiumCr: totalPremiumCr - govtSubsidyCr,
    govtSubsidyCr,
  }
}

export function allInsurers(): GNode[] {
  return NODES.filter((n) => n.kind === 'insurer')
}

/** A catastrophic scenario can legitimately produce claims many times a
 * single year's premium (that's the entire reason catastrophe reinsurance
 * exists) — a true "4639%" is not a calculation error, but displaying it
 * as a bare percentage reads as one. Real insurers report a stressed-year
 * loss ratio like this as a multiple of premium past a sane percentage
 * range; this is purely a display-formatting fix, not a change to the
 * underlying claim or premium model. */
export function formatLossRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%'
  if (ratio >= 5) return `${ratio.toFixed(1)}× premium`
  return `${(ratio * 100).toFixed(0)}%`
}

export interface InsuranceAdjustedCredit {
  insurer: GNode
  insuranceOffsetCr: number
  effectiveLgd: number
  effectiveEl: number
}

/** The bank-side payoff of the insurance graph: an insured, in-scenario
 * borrower's loss-given-default should be reduced by the claim payout it
 * would receive, dollar for dollar, up to the loss amount — insurance
 * proceeds are a real (if illustrative) recovery source a lender's credit
 * view currently ignores entirely. Returns null for an uninsured company,
 * so callers can fall back to the plain stressed LGD/EL. */
export function computeInsuranceAdjustedCredit(
  company: GNode,
  stressedPd: number,
  stressedLgd: number,
  severity: number,
  durationMonths: number,
): InsuranceAdjustedCredit | null {
  const insurer = insurerFor(company.id)
  const claim = insurer ? estimateClaim(company, severity, durationMonths) : null
  if (!insurer || !claim) return null
  const eadCr = company.eadCr ?? 0
  const lossAmountCr = eadCr * stressedLgd
  const insuranceOffsetCr = Math.min(claim.netClaimCr, lossAmountCr)
  const effectiveLgd = eadCr ? Math.max(0, (lossAmountCr - insuranceOffsetCr) / eadCr) : stressedLgd
  return { insurer, insuranceOffsetCr, effectiveLgd, effectiveEl: eadCr * stressedPd * effectiveLgd }
}
