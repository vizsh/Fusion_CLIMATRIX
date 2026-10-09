// CLIMATRIX India — synthetic national exposure graph.
//
// This dataset is an illustrative, India-flavored construction for the FIN-04
// prototype ("construct a dynamic graph connecting company, facility,
// supplier, transport route, commodity, region, climate hazard and financial
// exposure; simulate second- and third-order effects; identify hidden
// climate exposures across an investment portfolio"). Place names, district
// anchors and sector mix are realistic; company names, loan exposures and
// relationships are fictional/synthetic and must not be read as real Indian
// borrower, bank or supplier records. Coordinates are real-place
// approximations (town/district centroids) for the digital twin, not
// facility-level survey data.

import { type EvidenceClass } from './evidence'

export type NodeKind = 'hazard' | 'infra' | 'supplier' | 'company' | 'bank' | 'govt' | 'insurer'
export type EdgeType =
  | 'AFFECTED_BY'
  | 'DEPENDS_ON'
  | 'SUPPLIES'
  | 'TRANSPORTS_VIA'
  | 'FINANCED_BY'
  | 'INSURED_BY'

export interface GNode {
  id: string
  label: string
  kind: NodeKind
  region?: 'HP' | 'KL' | 'MH' | 'UK' | 'National'
  sector?: string
  note?: string
  coords?: [number, number] // [lng, lat]
  // Financial fields — only meaningful on company/bank/govt/insurer nodes.
  eadCr?: number
  baselinePd?: number
  baselineLgd?: number
  /** Illustrative annual revenue (₹ cr), for the equity/investor lens only.
   * Set explicitly on the flagship company; elsewhere derived from EAD via
   * a disclosed assumption (see sectorVulnerability.ts estimateRevenue). */
  annualRevenueCr?: number
  // Insurance economics — only meaningful on the subset of companies that
  // carry a policy (via an INSURED_BY edge) and on insurer nodes. Disclosed
  // illustrative figures, not real policy data — see lib/insurance.ts.
  /** Property/business-interruption sum insured (₹ cr), company-level. */
  sumInsuredCr?: number
  /** Annualized premium rate, basis points of sum insured. */
  premiumRateBps?: number
  /** Policyholder-retained share of a claim before the insurer pays (0-1). */
  deductiblePct?: number
  /** Insurer-level: share of its own net claims ceded to a reinsurance treaty (0-100). */
  cededReinsuranceSharePct?: number
  /** Insurer-level: name of the treaty/reinsurer claims are ceded to — disclosed as a field, not a separately graphed entity. */
  reinsurerName?: string
}

export interface GEdge {
  id: string
  from: string
  to: string
  type: EdgeType
  evidence: EvidenceClass
  weight: number // 1 (minor) – 3 (critical) financial/operational relevance
}

export const NODES: GNode[] = [
  // ---- Hazards -----------------------------------------------------------
  {
    id: 'hz-hp',
    label: 'Himachal Pradesh — Flood & Landslide (2023)',
    kind: 'hazard',
    region: 'HP',
    coords: [77.15, 31.98],
    note: 'Retrospective scenario anchor · 2023 monsoon disaster',
  },
  {
    id: 'hz-kl',
    label: 'Kerala — Monsoon Flood (2018)',
    kind: 'hazard',
    region: 'KL',
    coords: [76.27, 10.85],
    note: 'Retrospective scenario anchor · 2018 flood',
  },
  {
    id: 'hz-mh',
    label: 'Marathwada — Deficient Monsoon Drought',
    kind: 'hazard',
    region: 'MH',
    coords: [76.5, 19.0],
    note: 'Slow-onset scenario anchor · agricultural drought',
  },

  // ---- Infrastructure -----------------------------------------------------
  { id: 'infra-hp-nh5', label: 'NH-5 Kullu–Manali Corridor', kind: 'infra', region: 'HP', sector: 'Road', coords: [77.15, 32.05] },
  { id: 'infra-hp-grid', label: 'Kangra Grid Substation', kind: 'infra', region: 'HP', sector: 'Power', coords: [76.27, 32.1] },
  { id: 'infra-hp-beas', label: 'Beas River Bridge Network', kind: 'infra', region: 'HP', sector: 'Bridge', coords: [77.16, 32.0] },

  { id: 'infra-kl-idukki', label: 'Idukki Dam Catchment Road', kind: 'infra', region: 'KL', sector: 'Road', coords: [76.97, 9.85] },
  { id: 'infra-kl-port', label: 'Kochi Port Access Corridor', kind: 'infra', region: 'KL', sector: 'Port', coords: [76.26, 9.97] },
  { id: 'infra-kl-rail', label: 'Ernakulam–Alappuzha Rail Link', kind: 'infra', region: 'KL', sector: 'Rail', coords: [76.35, 9.75] },

  { id: 'infra-mh-canal', label: 'Marathwada Irrigation Canal System', kind: 'infra', region: 'MH', sector: 'Irrigation', coords: [76.4, 18.9] },
  { id: 'infra-mh-grid', label: 'Solapur Regional Power Grid', kind: 'infra', region: 'MH', sector: 'Power', coords: [75.9, 17.66] },
  { id: 'infra-mh-road', label: 'Latur–Osmanabad Highway Link', kind: 'infra', region: 'MH', sector: 'Road', coords: [76.5, 18.4] },

  // ---- Suppliers / logistics ----------------------------------------------
  { id: 'sup-hp-horti', label: 'Kullu Valley Horticulture Packhouse', kind: 'supplier', region: 'HP', sector: 'Agri cold-chain', coords: [77.11, 31.96] },
  { id: 'sup-hp-logistics', label: 'Manali Logistics & Freight Hub', kind: 'supplier', region: 'HP', sector: 'Logistics', coords: [77.18, 32.23] },
  { id: 'sup-hp-component', label: 'Baddi Pharma Component Supplier', kind: 'supplier', region: 'HP', sector: 'Pharma inputs', coords: [76.79, 30.96] },

  { id: 'sup-kl-spice', label: 'Wayanad Spice & Plantation Collective', kind: 'supplier', region: 'KL', sector: 'Agri inputs', coords: [76.13, 11.68] },
  { id: 'sup-kl-seafood', label: 'Kochi Seafood Export Processor', kind: 'supplier', region: 'KL', sector: 'Seafood processing', coords: [76.24, 9.97] },
  { id: 'sup-kl-rubber', label: 'Kottayam Rubber & Latex Supplier', kind: 'supplier', region: 'KL', sector: 'Rubber inputs', coords: [76.52, 9.59] },

  { id: 'sup-mh-sugar', label: 'Latur Sugar Mill Cooperative', kind: 'supplier', region: 'MH', sector: 'Agri processing', coords: [76.56, 18.4] },
  { id: 'sup-mh-cotton', label: 'Jalna Cotton Ginning Unit', kind: 'supplier', region: 'MH', sector: 'Textile inputs', coords: [75.88, 19.84] },
  { id: 'sup-mh-seed', label: 'Parbhani Seed & Agri-Input Distributor', kind: 'supplier', region: 'MH', sector: 'Agri inputs', coords: [76.78, 19.27] },

  {
    id: 'sup-national-logistics',
    label: 'Pan-India Cold Chain Logistics Pvt. Ltd.',
    kind: 'supplier',
    region: 'National',
    sector: 'Logistics',
    coords: [79.09, 21.15],
    note: 'Shared cross-regional dependency — feeds HP, KL and MH-linked companies.',
  },
  {
    id: 'sup-national-component',
    label: 'National Auto Components Distributor',
    kind: 'supplier',
    region: 'National',
    sector: 'Industrial inputs',
    coords: [73.8, 18.56],
    note: 'Single national distributor for multiple manufacturers — concentration point.',
  },

  // ---- Companies / borrowers -----------------------------------------------
  { id: 'co-hp-auto', label: 'Himalayan Auto Components Ltd.', kind: 'company', region: 'HP', sector: 'Manufacturing', coords: [76.8, 30.95], eadCr: 210, baselinePd: 0.018, baselineLgd: 0.32 },
  { id: 'co-hp-pharma', label: 'Baddi Pharmaceuticals Pvt. Ltd.', kind: 'company', region: 'HP', sector: 'Pharmaceuticals', coords: [76.78, 30.94], eadCr: 340, baselinePd: 0.012, baselineLgd: 0.28 },
  { id: 'co-hp-tourism', label: 'Manali Hill Tourism Cooperative', kind: 'company', region: 'HP', sector: 'Tourism', coords: [77.19, 32.25], eadCr: 95, baselinePd: 0.03, baselineLgd: 0.4, sumInsuredCr: 70, premiumRateBps: 180, deductiblePct: 0.1 },
  { id: 'co-hp-agri', label: 'Kullu Apple Growers Federation', kind: 'company', region: 'HP', sector: 'Agriculture', coords: [77.1, 31.98], eadCr: 65, baselinePd: 0.028, baselineLgd: 0.38 },

  { id: 'co-kl-tourism', label: 'Alleppey Backwater Resorts Ltd.', kind: 'company', region: 'KL', sector: 'Tourism', coords: [76.35, 9.49], eadCr: 120, baselinePd: 0.027, baselineLgd: 0.37, sumInsuredCr: 90, premiumRateBps: 160, deductiblePct: 0.1 },
  { id: 'co-kl-agri', label: 'Wayanad Plantation Exports Ltd.', kind: 'company', region: 'KL', sector: 'Agriculture', coords: [76.13, 11.6], eadCr: 150, baselinePd: 0.022, baselineLgd: 0.35, sumInsuredCr: 110, premiumRateBps: 220, deductiblePct: 0.15 },
  { id: 'co-kl-seafood', label: 'Kochi Marine Exports Pvt. Ltd.', kind: 'company', region: 'KL', sector: 'Seafood export', coords: [76.24, 9.95], eadCr: 180, baselinePd: 0.02, baselineLgd: 0.33 },
  { id: 'co-kl-rubber', label: 'Kottayam Rubber Processing Co.', kind: 'company', region: 'KL', sector: 'Rubber processing', coords: [76.52, 9.6], eadCr: 85, baselinePd: 0.024, baselineLgd: 0.34 },

  { id: 'co-mh-textile', label: 'Marathwada Textile Mills', kind: 'company', region: 'MH', sector: 'Textiles', coords: [76.5, 19.0], eadCr: 230, baselinePd: 0.025, baselineLgd: 0.36 },
  { id: 'co-mh-agri', label: 'Marathwada Agro Processors Ltd.', kind: 'company', region: 'MH', sector: 'Agro processing', coords: [76.56, 18.41], eadCr: 140, baselinePd: 0.03, baselineLgd: 0.4, sumInsuredCr: 95, premiumRateBps: 240, deductiblePct: 0.15 },
  { id: 'co-mh-cotton', label: 'Jalna Cotton & Yarn Mills', kind: 'company', region: 'MH', sector: 'Textiles', coords: [75.89, 19.85], eadCr: 110, baselinePd: 0.026, baselineLgd: 0.35 },
  { id: 'co-mh-dairy', label: 'Solapur Dairy Cooperative', kind: 'company', region: 'MH', sector: 'Dairy', coords: [75.91, 17.68], eadCr: 55, baselinePd: 0.032, baselineLgd: 0.42 },

  { id: 'co-generic-engg', label: 'Deccan Engineering Works', kind: 'company', region: 'National', sector: 'Manufacturing', coords: [73.85, 18.5], eadCr: 175, baselinePd: 0.014, baselineLgd: 0.3 },
  { id: 'co-generic-logistics', label: 'Western Corridor Freight Carriers', kind: 'company', region: 'National', sector: 'Logistics', coords: [72.87, 19.12], eadCr: 90, baselinePd: 0.016, baselineLgd: 0.31 },
  { id: 'co-generic-it', label: 'NeoTech Services (Pune)', kind: 'company', region: 'National', sector: 'IT / BPO', coords: [73.91, 18.56], eadCr: 60, baselinePd: 0.008, baselineLgd: 0.25 },
  { id: 'co-generic-fmcg', label: 'Sahyadri Consumer Goods Ltd.', kind: 'company', region: 'National', sector: 'FMCG', coords: [72.9, 19.2], eadCr: 130, baselinePd: 0.013, baselineLgd: 0.29 },

  // ---- Financial institutions ---------------------------------------------
  { id: 'bank-1', label: 'Bank of Bharat', kind: 'bank', region: 'National', sector: 'Public-sector bank', coords: [72.88, 19.08] },
  { id: 'bank-2', label: 'Union Pradesh Bank', kind: 'bank', region: 'National', sector: 'Public-sector bank', coords: [72.84, 19.05] },
  { id: 'bank-3', label: 'Kerala Gramin Bank', kind: 'bank', region: 'KL', sector: 'Regional rural bank', coords: [76.26, 10.85] },
  { id: 'nbfc-1', label: 'Deccan Rural Finance NBFC', kind: 'bank', region: 'MH', sector: 'NBFC / agri lender', coords: [73.86, 18.52] },
  { id: 'govt-1', label: 'National Infrastructure Resilience Fund', kind: 'govt', region: 'National', sector: 'Public finance', coords: [77.21, 28.61] },
  { id: 'govt-2', label: 'State Disaster Recovery Fund — HP', kind: 'govt', region: 'HP', sector: 'Public finance', coords: [77.17, 31.1] },
  {
    id: 'insurer-1',
    label: 'Bharat General Insurance Co.',
    kind: 'insurer',
    region: 'National',
    sector: 'Insurance',
    coords: [72.83, 19.02],
    cededReinsuranceSharePct: 40,
    reinsurerName: 'Himalaya Re Catastrophe Treaty',
  },

  // ---- Flagship: Uttarakhand construction company (bank + investor scenario) ----
  {
    id: 'hz-uk',
    label: 'Chamoli–Joshimath Corridor — Landslide Susceptibility',
    kind: 'hazard',
    region: 'UK',
    coords: [79.56, 30.55],
    note: 'Illustrative susceptibility zone for this demonstration — not an engineering-grade landslide hazard map or a prediction that a landslide will occur.',
  },
  { id: 'infra-uk-road', label: 'Rishikesh–Badrinath Access Road (NH-58)', kind: 'infra', region: 'UK', sector: 'Road', coords: [79.49, 30.42] },
  { id: 'infra-uk-bridge', label: 'Alaknanda River Crossing', kind: 'infra', region: 'UK', sector: 'Bridge', coords: [79.57, 30.52] },
  { id: 'sup-uk-cement', label: 'Uttarakhand Cement & Steel Depot', kind: 'supplier', region: 'UK', sector: 'Construction inputs', coords: [79.32, 30.08] },
  {
    id: 'co-uk-construction',
    label: 'Himalaya Infra Builders Pvt. Ltd.',
    kind: 'company',
    region: 'UK',
    sector: 'Construction',
    coords: [79.58, 30.57],
    eadCr: 100,
    baselinePd: 0.022,
    baselineLgd: 0.4,
    annualRevenueCr: 260,
    note: 'Fictional construction/infrastructure company under consideration for a new ₹100 cr credit facility — the FIN-04 flagship bank-and-investor demonstration.',
  },
]

// Evidence mapping follows the type of relationship, not a per-edge guess:
//  - AFFECTED_BY (hazard -> infra): grounded in which districts documented
//    disasters actually struck -> SOURCED.
//  - DEPENDS_ON / TRANSPORTS_VIA (infra -> supplier/company): an asserted
//    operational dependency this product's logic infers -> MODELLED.
//  - SUPPLIES / FINANCED_BY / INSURED_BY (company/bank relationships):
//    fabricated for the demo, since no real borrower book is available -> SYNTHETIC.
export const EDGES: GEdge[] = [
  // Hazard -> infrastructure
  { id: 'e-hz-hp-nh5', from: 'hz-hp', to: 'infra-hp-nh5', type: 'AFFECTED_BY', evidence: 'sourced', weight: 3 },
  { id: 'e-hz-hp-grid', from: 'hz-hp', to: 'infra-hp-grid', type: 'AFFECTED_BY', evidence: 'sourced', weight: 2 },
  { id: 'e-hz-hp-beas', from: 'hz-hp', to: 'infra-hp-beas', type: 'AFFECTED_BY', evidence: 'sourced', weight: 3 },

  { id: 'e-hz-kl-idukki', from: 'hz-kl', to: 'infra-kl-idukki', type: 'AFFECTED_BY', evidence: 'sourced', weight: 2 },
  { id: 'e-hz-kl-port', from: 'hz-kl', to: 'infra-kl-port', type: 'AFFECTED_BY', evidence: 'sourced', weight: 3 },
  { id: 'e-hz-kl-rail', from: 'hz-kl', to: 'infra-kl-rail', type: 'AFFECTED_BY', evidence: 'sourced', weight: 2 },

  { id: 'e-hz-mh-canal', from: 'hz-mh', to: 'infra-mh-canal', type: 'AFFECTED_BY', evidence: 'sourced', weight: 3 },
  { id: 'e-hz-mh-grid', from: 'hz-mh', to: 'infra-mh-grid', type: 'AFFECTED_BY', evidence: 'modelled', weight: 1 },
  { id: 'e-hz-mh-road', from: 'hz-mh', to: 'infra-mh-road', type: 'AFFECTED_BY', evidence: 'modelled', weight: 1 },

  // Infra -> supplier
  { id: 'e-nh5-horti', from: 'infra-hp-nh5', to: 'sup-hp-horti', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-nh5-logistics', from: 'infra-hp-nh5', to: 'sup-hp-logistics', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-grid-component', from: 'infra-hp-grid', to: 'sup-hp-component', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 'e-beas-logistics', from: 'infra-hp-beas', to: 'sup-hp-logistics', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },

  { id: 'e-idukki-spice', from: 'infra-kl-idukki', to: 'sup-kl-spice', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 'e-port-seafood', from: 'infra-kl-port', to: 'sup-kl-seafood', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-rail-rubber', from: 'infra-kl-rail', to: 'sup-kl-rubber', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },

  { id: 'e-canal-sugar', from: 'infra-mh-canal', to: 'sup-mh-sugar', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-canal-seed', from: 'infra-mh-canal', to: 'sup-mh-seed', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 'e-road-cotton', from: 'infra-mh-road', to: 'sup-mh-cotton', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },

  // Infra -> national logistics (cross-regional bottleneck)
  { id: 'e-nh5-natlog', from: 'infra-hp-nh5', to: 'sup-national-logistics', type: 'TRANSPORTS_VIA', evidence: 'modelled', weight: 2 },
  { id: 'e-port-natlog', from: 'infra-kl-port', to: 'sup-national-logistics', type: 'TRANSPORTS_VIA', evidence: 'modelled', weight: 2 },
  { id: 'e-road-natlog', from: 'infra-mh-road', to: 'sup-national-logistics', type: 'TRANSPORTS_VIA', evidence: 'modelled', weight: 1 },
  { id: 'e-grid-natcomp', from: 'infra-hp-grid', to: 'sup-national-component', type: 'TRANSPORTS_VIA', evidence: 'modelled', weight: 1 },

  // Infra -> company (direct access dependency, e.g. tourism needs the road itself)
  { id: 'e-nh5-tourism', from: 'infra-hp-nh5', to: 'co-hp-tourism', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-idukki-kltourism', from: 'infra-kl-idukki', to: 'co-kl-tourism', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 'e-grid-pharma', from: 'infra-hp-grid', to: 'co-hp-pharma', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },

  // Supplier -> company
  { id: 's-horti-agri', from: 'sup-hp-horti', to: 'co-hp-agri', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-logistics-auto', from: 'sup-hp-logistics', to: 'co-hp-auto', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-logistics-tourism', from: 'sup-hp-logistics', to: 'co-hp-tourism', type: 'SUPPLIES', evidence: 'synthetic', weight: 1 },
  { id: 's-component-pharma', from: 'sup-hp-component', to: 'co-hp-pharma', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-natcomp-auto', from: 'sup-national-component', to: 'co-hp-auto', type: 'SUPPLIES', evidence: 'synthetic', weight: 2 },
  { id: 's-natcomp-engg', from: 'sup-national-component', to: 'co-generic-engg', type: 'SUPPLIES', evidence: 'synthetic', weight: 2 },

  { id: 's-spice-klagri', from: 'sup-kl-spice', to: 'co-kl-agri', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-seafood-klseafood', from: 'sup-kl-seafood', to: 'co-kl-seafood', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-rubber-klrubber', from: 'sup-kl-rubber', to: 'co-kl-rubber', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-natlog-kltourism', from: 'sup-national-logistics', to: 'co-kl-tourism', type: 'SUPPLIES', evidence: 'synthetic', weight: 1 },
  { id: 's-natlog-hptourism', from: 'sup-national-logistics', to: 'co-hp-tourism', type: 'SUPPLIES', evidence: 'synthetic', weight: 1 },
  { id: 's-natlog-genlog', from: 'sup-national-logistics', to: 'co-generic-logistics', type: 'SUPPLIES', evidence: 'synthetic', weight: 2 },
  { id: 's-natlog-fmcg', from: 'sup-national-logistics', to: 'co-generic-fmcg', type: 'SUPPLIES', evidence: 'synthetic', weight: 2 },

  { id: 's-sugar-mhagri', from: 'sup-mh-sugar', to: 'co-mh-agri', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-cotton-mhtextile', from: 'sup-mh-cotton', to: 'co-mh-textile', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-cotton-mhcotton', from: 'sup-mh-cotton', to: 'co-mh-cotton', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 's-seed-mhagri', from: 'sup-mh-seed', to: 'co-mh-agri', type: 'SUPPLIES', evidence: 'synthetic', weight: 1 },
  { id: 's-seed-mhdairy', from: 'sup-mh-seed', to: 'co-mh-dairy', type: 'SUPPLIES', evidence: 'synthetic', weight: 1 },

  // Company -> bank / govt / insurer (financing + insurance)
  { id: 'f-auto-bank1', from: 'co-hp-auto', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },
  { id: 'f-pharma-bank1', from: 'co-hp-pharma', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },
  { id: 'f-hptourism-bank2', from: 'co-hp-tourism', to: 'bank-2', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-hpagri-govt2', from: 'co-hp-agri', to: 'govt-2', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-nh5-govt1', from: 'infra-hp-nh5', to: 'govt-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },

  { id: 'f-kltourism-bank3', from: 'co-kl-tourism', to: 'bank-3', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-klagri-bank3', from: 'co-kl-agri', to: 'bank-3', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },
  { id: 'f-klseafood-bank1', from: 'co-kl-seafood', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-klrubber-bank3', from: 'co-kl-rubber', to: 'bank-3', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'f-port-govt1', from: 'infra-kl-port', to: 'govt-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },

  { id: 'f-mhtextile-bank2', from: 'co-mh-textile', to: 'bank-2', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },
  { id: 'f-mhagri-nbfc1', from: 'co-mh-agri', to: 'nbfc-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-mhcotton-nbfc1', from: 'co-mh-cotton', to: 'nbfc-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },
  { id: 'f-mhdairy-nbfc1', from: 'co-mh-dairy', to: 'nbfc-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'f-canal-govt1', from: 'infra-mh-canal', to: 'govt-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 2 },

  { id: 'f-engg-bank2', from: 'co-generic-engg', to: 'bank-2', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'f-genlog-bank1', from: 'co-generic-logistics', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'f-it-bank1', from: 'co-generic-it', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'f-fmcg-bank2', from: 'co-generic-fmcg', to: 'bank-2', type: 'FINANCED_BY', evidence: 'synthetic', weight: 1 },

  { id: 'i-hptourism', from: 'co-hp-tourism', to: 'insurer-1', type: 'INSURED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'i-kltourism', from: 'co-kl-tourism', to: 'insurer-1', type: 'INSURED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'i-klagri', from: 'co-kl-agri', to: 'insurer-1', type: 'INSURED_BY', evidence: 'synthetic', weight: 1 },
  { id: 'i-mhagri', from: 'co-mh-agri', to: 'insurer-1', type: 'INSURED_BY', evidence: 'synthetic', weight: 1 },

  // Uttarakhand flagship: hazard -> road/bridge -> supplier/company -> bank
  { id: 'e-hz-uk-road', from: 'hz-uk', to: 'infra-uk-road', type: 'AFFECTED_BY', evidence: 'assumption', weight: 3 },
  { id: 'e-hz-uk-bridge', from: 'hz-uk', to: 'infra-uk-bridge', type: 'AFFECTED_BY', evidence: 'assumption', weight: 2 },
  { id: 'e-ukroad-cement', from: 'infra-uk-road', to: 'sup-uk-cement', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 'e-ukroad-construction', from: 'infra-uk-road', to: 'co-uk-construction', type: 'DEPENDS_ON', evidence: 'modelled', weight: 3 },
  { id: 'e-ukbridge-construction', from: 'infra-uk-bridge', to: 'co-uk-construction', type: 'DEPENDS_ON', evidence: 'modelled', weight: 2 },
  { id: 's-ukcement-construction', from: 'sup-uk-cement', to: 'co-uk-construction', type: 'SUPPLIES', evidence: 'synthetic', weight: 3 },
  { id: 'f-ukconstruction-bank1', from: 'co-uk-construction', to: 'bank-1', type: 'FINANCED_BY', evidence: 'synthetic', weight: 3 },
]

export const KIND_META: Record<NodeKind, { color: string; label: string }> = {
  hazard: { color: '#fb3a4a', label: 'Climate hazard' },
  infra: { color: '#f5a524', label: 'Infrastructure' },
  supplier: { color: '#a78bfa', label: 'Supplier / logistics' },
  company: { color: '#22d3ee', label: 'Company / borrower' },
  bank: { color: '#2dd4a7', label: 'Bank / NBFC' },
  govt: { color: '#34d399', label: 'Government finance' },
  insurer: { color: '#38bdf8', label: 'Insurer' },
}

export { EVIDENCE_META, type EvidenceClass } from './evidence'
