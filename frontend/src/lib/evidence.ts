// Evidence vocabulary used everywhere in CLIMATRIX — every major result must
// declare which of these four classes it belongs to, so a reviewer can tell
// a documented fact apart from a demo convenience at a glance.
export type EvidenceClass = 'sourced' | 'modelled' | 'assumption' | 'synthetic'

export const EVIDENCE_META: Record<EvidenceClass, { label: string; color: string; dash?: string; desc: string }> = {
  sourced: {
    label: 'Sourced',
    color: '#22d3ee',
    desc: 'Supported by a cited source — an official dataset, report or disclosure.',
  },
  modelled: {
    label: 'Modelled',
    color: '#2dd4a7',
    dash: '6 4',
    desc: 'Calculated by this application from its inputs — a real computation, not a cited fact.',
  },
  assumption: {
    label: 'Assumption',
    color: '#f5a524',
    dash: '3 3',
    desc: 'An illustrative input or relationship chosen for this scenario, not independently verified.',
  },
  synthetic: {
    label: 'Synthetic',
    color: '#fb3a4a',
    dash: '1 4',
    desc: 'Fabricated data used to demonstrate the mechanism — names, figures or links invented for the prototype.',
  },
}
