import type { SimulateResponse } from '@/engine/types';

export interface ArcSpec {
  from: string;
  to: string;
  /** 1 = first link out of a directly hit entity. */
  hop: number;
  /** Strongest disruption delivered along this edge across all paths that use it. */
  contribution: number;
  /**
   * Lost contribution margin at the receiving end, in INR crore.
   *
   * Arc prominence is driven by this rather than by `contribution`, for the same
   * reason marker size is: the link into Pfizer carries a 0.1% disruption but twelve
   * crore of margin, and weighting it by percentage would render the single most
   * important arc in the demo as a hairline.
   */
  targetLoss_cr: number;
}

const MAX_ARCS = 130;

/**
 * Flatten the engine's explanatory paths into a set of drawable edges.
 *
 * The same supplier->customer link appears in many paths, so edges are deduplicated,
 * keeping the shallowest hop and the largest contribution. Without this the
 * transcontinental pharma chain alone would draw the same arc a dozen times.
 */
export function buildArcs(result: SimulateResponse | null): ArcSpec[] {
  if (!result) return [];

  const byKey = new Map<string, ArcSpec>();

  for (const company of Object.values(result.companies)) {
    for (const path of company.paths) {
      for (let i = 0; i < path.chain.length - 1; i++) {
        const from = path.chain[i];
        const to = path.chain[i + 1];
        const key = `${from}>${to}`;
        const hop = i + 1;

        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, {
            from,
            to,
            hop,
            contribution: path.contribution,
            targetLoss_cr: result.companies[to]?.contributionLoss_cr ?? 0,
          });
        } else {
          existing.hop = Math.min(existing.hop, hop);
          existing.contribution = Math.max(existing.contribution, path.contribution);
        }
      }
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.targetLoss_cr - a.targetLoss_cr)
    .slice(0, MAX_ARCS);
}
