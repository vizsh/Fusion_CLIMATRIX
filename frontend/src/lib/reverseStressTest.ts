// Reverse stress testing — "what severity would it take to breach ₹X cr of
// loss" instead of only "what's the loss at severity Y." This is the one
// genuinely new, not-yet-built feature identified from reviewing
// shreyascoder2006/fusion_earth's docs/PROTOTYPE_PLAN.md (a separate
// teammate's alternate build of this same FIN-04 problem statement) — its
// own plan listed "Reverse stress testing: search for scenarios that
// breach a threshold" as a P2 feature it never built. It needs no new
// data: it's a search over the exact same deterministic engine every
// other page already calls (computeImpact), so it's implemented as a
// binary search, not a new model.

import { computeImpact, type Region, type Substitutability } from '../store/useScenarioStore'

export interface ReverseStressTestResult {
  region: Region
  targetLossCr: number
  durationMonths: number
  substitutability: Substitutability
  /** null if even severity 100 doesn't reach the target — the scenario is
   * out of reach at this duration/substitutability, not a search failure. */
  breachingSeverity: number | null
  lossAtMaxSeverity: number
}

/** Binary search over severity (0-100, integer steps) for the minimum
 * severity at which stressedEl >= targetLossCr, holding duration and
 * substitutability fixed. computeImpact's stressedEl is monotonically
 * non-decreasing in severity (stressPdLgd scales both PD and LGD up with
 * severity, never down), so binary search is valid — not just a
 * convenient approximation. */
export function findBreachingSeverity(
  region: Region,
  targetLossCr: number,
  durationMonths: number,
  substitutability: Substitutability,
): ReverseStressTestResult {
  const impactAt = (severity: number) => computeImpact({ region, severity, durationMonths, substitutability, interventions: [] })

  const atMax = impactAt(100)
  if (atMax.stressedEl < targetLossCr) {
    return { region, targetLossCr, durationMonths, substitutability, breachingSeverity: null, lossAtMaxSeverity: atMax.stressedEl }
  }

  let lo = 0
  let hi = 100
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (impactAt(mid).stressedEl >= targetLossCr) hi = mid
    else lo = mid + 1
  }

  return { region, targetLossCr, durationMonths, substitutability, breachingSeverity: lo, lossAtMaxSeverity: atMax.stressedEl }
}
