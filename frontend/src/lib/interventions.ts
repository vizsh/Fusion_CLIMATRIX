export interface Intervention {
  id: string
  label: string
  description: string
  costCr: number
  /** 'physical' (default): a smooth loss-reduction share, regardless of how
   * severe the scenario gets. 'parametric': an index-insurance-style lever
   * that pays a FIXED amount once severity crosses a threshold — and pays
   * nothing at all if it doesn't, no matter how much real damage occurred
   * just under the line. That all-or-nothing behavior (basis risk) is the
   * defining tradeoff of parametric products against traditional indemnity
   * cover, and is modeled faithfully here, not smoothed away. */
  kind?: 'physical' | 'parametric'
  lossReductionShare?: number // physical levers: fraction of stress-induced loss avoided
  triggerSeverityThreshold?: number // parametric levers: severity (0-100) at which the payout fires
  payoutCr?: number // parametric levers: fixed payout once triggered
}

// Illustrative mitigation levers — cost and effectiveness are scenario
// assumptions for this prototype, not validated engineering/finance estimates.
export const INTERVENTIONS: Intervention[] = [
  {
    id: 'alt-route',
    label: 'Alternate access route',
    description: 'Fund a secondary road link so a single bridge/road failure no longer isolates dependent facilities.',
    costCr: 18,
    lossReductionShare: 0.22,
  },
  {
    id: 'supplier-diversification',
    label: 'Supplier diversification',
    description: 'Qualify a second supplier for single-sourced components to cut switching delay under disruption.',
    costCr: 9,
    lossReductionShare: 0.15,
  },
  {
    id: 'resilience-infra',
    label: 'Infrastructure resilience upgrade',
    description: 'Flood-proof the grid substation and canal embankment serving multiple dependent businesses.',
    costCr: 34,
    lossReductionShare: 0.34,
  },
  {
    id: 'early-engagement',
    label: 'Early borrower engagement',
    description: 'Pre-emptive liquidity review and restructuring readiness for the most sensitive borrowers.',
    costCr: 4,
    lossReductionShare: 0.12,
  },
  {
    id: 'parametric-trigger',
    label: 'Parametric severity-trigger cover',
    description:
      'A pre-agreed payout that fires automatically the moment modeled severity crosses a threshold — days not months, no claims adjustment. The tradeoff: it pays nothing if severity stays just under the line, even if real damage occurred.',
    costCr: 6, // annual premium — paid whether or not the trigger fires
    kind: 'parametric',
    triggerSeverityThreshold: 70,
    payoutCr: 40,
  },
]

export function totalInterventionCost(enabledIds: string[]) {
  return INTERVENTIONS.filter((i) => enabledIds.includes(i.id)).reduce((s, i) => s + i.costCr, 0)
}

/** Compound the loss-reduction shares of every enabled PHYSICAL intervention.
 * Parametric levers don't participate — they pay a fixed amount instead of
 * smoothly reducing loss; see parametricPayout(). */
export function combinedReductionShare(enabledIds: string[]) {
  const enabled = INTERVENTIONS.filter((i) => enabledIds.includes(i.id) && i.kind !== 'parametric')
  if (!enabled.length) return 0
  let remaining = 1
  for (const i of enabled) remaining *= 1 - (i.lossReductionShare ?? 0)
  return 1 - remaining
}

/** Sum of fixed payouts from every enabled parametric intervention whose
 * trigger threshold the current severity has crossed. All-or-nothing by
 * design — a scenario one point under the threshold pays ₹0, which is the
 * basis risk a parametric buyer accepts in exchange for fast, dispute-free
 * payout once it does fire. */
export function parametricPayout(enabledIds: string[], severity: number): number {
  return INTERVENTIONS.filter(
    (i) => i.kind === 'parametric' && enabledIds.includes(i.id) && severity >= (i.triggerSeverityThreshold ?? Infinity),
  ).reduce((s, i) => s + (i.payoutCr ?? 0), 0)
}

export function isParametricTriggered(intervention: Intervention, severity: number): boolean {
  return intervention.kind === 'parametric' && severity >= (intervention.triggerSeverityThreshold ?? Infinity)
}
