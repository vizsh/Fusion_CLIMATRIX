export interface Intervention {
  id: string
  label: string
  description: string
  costCr: number
  lossReductionShare: number // fraction of the stress-induced loss this is modeled to avoid
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
]

export function totalInterventionCost(enabledIds: string[]) {
  return INTERVENTIONS.filter((i) => enabledIds.includes(i.id)).reduce((s, i) => s + i.costCr, 0)
}

/** Compound the loss-reduction shares of every enabled intervention. */
export function combinedReductionShare(enabledIds: string[]) {
  const enabled = INTERVENTIONS.filter((i) => enabledIds.includes(i.id))
  if (!enabled.length) return 0
  let remaining = 1
  for (const i of enabled) remaining *= 1 - i.lossReductionShare
  return 1 - remaining
}
