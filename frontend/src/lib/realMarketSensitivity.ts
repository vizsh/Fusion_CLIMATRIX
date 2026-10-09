// Real listed-company climate sensitivity — deliberately separate from the
// rest of this prototype's synthetic portfolio. Every name, ticker and
// sector here is REAL (no fabricated company identity, unlike the
// synthetic borrower book), but the sensitivity classification itself —
// direction, multiplier, worst-case and favorable narratives — is a
// disclosed illustrative framework this project built, not a sourced
// ESG/climate-risk rating from an agency. Never presented as investment
// advice; see the evidence banner on RealMarketSensitivityPage.
//
// The multiplier reuses the exact same mechanic as SECTOR_VULNERABILITY
// (lib/sectorVulnerability.ts) for continuity with the rest of the app's
// methodology, extended here with a `direction` so a sector that's
// structurally a climate BENEFICIARY (reconstruction demand, insurance
// premium growth, renewable-energy policy tailwinds) isn't forced into
// the same "higher multiplier = worse" framing that fits an exposed
// tourism or agriculture name.

export type SensitivityDirection = 'exposed' | 'beneficiary' | 'mixed' | 'resilient'

export const DIRECTION_META: Record<SensitivityDirection, { label: string; color: string; desc: string }> = {
  exposed: { label: 'Exposed', color: '#fb3a4a', desc: 'Physical/operational climate risk is a net negative for this business.' },
  beneficiary: { label: 'Beneficiary', color: '#2dd4a7', desc: 'Climate stress or the transition response creates a net revenue tailwind.' },
  mixed: { label: 'Mixed', color: '#f5a524', desc: 'Carries real exposure AND a plausible offsetting tailwind — direction depends on which dominates.' },
  resilient: { label: 'Resilient', color: '#22d3ee', desc: 'Operations are largely indoor/substitutable — low direct physical climate sensitivity either way.' },
}

export interface RealMarketEntity {
  id: string
  name: string
  nseSymbol: string
  sector: string
  direction: SensitivityDirection
  /** Same mechanic as SECTOR_VULNERABILITY: >1 scales the severity factor
   * up (more sensitive), <1 scales it down (more resilient). */
  vulnerabilityMultiplier: number
  worstCase: string
  favorable: string
}

export const REAL_MARKET_ENTITIES: RealMarketEntity[] = [
  {
    id: 'indhotel', name: 'Indian Hotels Company Ltd. (Taj Group)', nseSymbol: 'INDHOTEL', sector: 'Tourism / Hospitality',
    direction: 'exposed', vulnerabilityMultiplier: 1.45,
    worstCase: 'A severe monsoon/cyclone season disrupting access routes to coastal and hill-station properties — occupancy and ADR both fall in exactly the quarters leisure travel is seasonally strongest.',
    favorable: 'Limited — resilience capex (flood-proofing, backup power) is a cost, not a revenue line, for a pure hospitality operator.',
  },
  {
    id: 'mhril', name: 'Mahindra Holidays & Resorts India Ltd.', nseSymbol: 'MHRIL', sector: 'Tourism / Hospitality',
    direction: 'exposed', vulnerabilityMultiplier: 1.45,
    worstCase: 'Vacation-ownership resorts concentrated in hill/coastal micro-markets face the same access-route and extreme-weather cancellation risk as any tourism operator, compounded by membership-fee revenue being front-loaded against future stays it must still deliver.',
    favorable: 'Limited direct upside; diversified resort locations across regions is the main structural mitigant, not a climate tailwind.',
  },
  {
    id: 'upl', name: 'UPL Ltd.', nseSymbol: 'UPL', sector: 'Agrochemicals / Agri inputs',
    direction: 'mixed', vulnerabilityMultiplier: 1.2,
    worstCase: 'A severe drought or flood season collapses farmer cash flow and input-purchase volume in the same season demand would otherwise peak.',
    favorable: 'Climate-stressed farmers also raise demand for drought/flood-tolerant seed treatments and crop-protection products — the same hazard that hurts volume in a bad season can grow the addressable product category over time.',
  },
  {
    id: 'rallis', name: 'Rallis India Ltd.', nseSymbol: 'RALLIS', sector: 'Agrochemicals / Agri inputs',
    direction: 'mixed', vulnerabilityMultiplier: 1.15,
    worstCase: 'Regional crop failure directly reduces the farmer base able to afford inputs the following season.',
    favorable: 'A Tata-group agri-input company is well positioned to sell resilience-oriented products (seed treatment, bio-stimulants) as climate-adjusted farming practice spreads.',
  },
  {
    id: 'adanigreen', name: 'Adani Green Energy Ltd.', nseSymbol: 'ADANIGREEN', sector: 'Renewable energy',
    direction: 'beneficiary', vulnerabilityMultiplier: 0.6,
    worstCase: 'Extreme heat can reduce solar-panel efficiency and an unusually weak monsoon reduces wind-resource output in some states — a real but secondary operating risk versus the policy tailwind below.',
    favorable: "India's renewable capacity targets and climate-transition policy are a structural multi-year revenue tailwind — a severe-weather narrative nationally tends to accelerate policy support, not reduce it.",
  },
  {
    id: 'tatapower', name: 'Tata Power Company Ltd.', nseSymbol: 'TATAPOWER', sector: 'Power (transitioning to renewables)',
    direction: 'mixed', vulnerabilityMultiplier: 0.8,
    worstCase: 'Its legacy thermal and distribution assets still carry real extreme-weather outage/damage risk in the near term.',
    favorable: 'Its renewable energy pivot captures the same transition tailwind as a pure-play — a partial hedge against the legacy-asset exposure.',
  },
  {
    id: 'icicigi', name: 'ICICI Lombard General Insurance Co. Ltd.', nseSymbol: 'ICICIGI', sector: 'General insurance',
    direction: 'mixed', vulnerabilityMultiplier: 1.0,
    worstCase: 'A severe, correlated catastrophe season (the exact mechanic this prototype\'s own Insurance & Protection Gap page models) raises claims/loss ratios across its book simultaneously.',
    favorable: 'A closing protection gap (see this prototype\'s own protection-gap findings) is a real premium-growth opportunity for an insurer positioned to underwrite climate-linked cover, not only a liability.',
  },
  {
    id: 'niacl', name: 'The New India Assurance Co. Ltd.', nseSymbol: 'NIACL', sector: 'General insurance (PSU)',
    direction: 'mixed', vulnerabilityMultiplier: 1.0,
    worstCase: 'Same correlated-catastrophe claims risk as any general insurer, with added PSU exposure to state-subsidized crop-insurance schemes (the same PMFBY mechanic modeled elsewhere in this prototype) during a bad season.',
    favorable: 'Scheme-backed crop and disaster insurance is a growing, policy-supported book for a PSU insurer with national reach.',
  },
  {
    id: 'ultracemco', name: 'UltraTech Cement Ltd.', nseSymbol: 'ULTRACEMCO', sector: 'Construction materials',
    direction: 'beneficiary', vulnerabilityMultiplier: 0.85,
    worstCase: 'Logistics disruption (the same road/bridge-corridor mechanic this prototype\'s Dependency Explorer traces) can delay dispatch out of plants in an affected region.',
    favorable: 'Post-disaster reconstruction and resilience-infrastructure build-out is a direct demand driver for cement — the same severe event that disrupts logistics short-term typically raises multi-quarter order volume.',
  },
  {
    id: 'lt', name: 'Larsen & Toubro Ltd.', nseSymbol: 'LT', sector: 'Infrastructure / Construction / Engineering',
    direction: 'beneficiary', vulnerabilityMultiplier: 0.85,
    worstCase: 'Project sites and supply logistics in an affected region face delay/cost overrun risk during the event itself.',
    favorable: 'Resilience and reconstruction infrastructure spend (flood defenses, hardened grids, transport corridors — literally the asset types this prototype\'s own graph models) is a core order-book driver for a diversified EPC major.',
  },
  {
    id: 'itc', name: 'ITC Ltd.', nseSymbol: 'ITC', sector: 'FMCG / Agri-linked consumer goods',
    direction: 'mixed', vulnerabilityMultiplier: 0.9,
    worstCase: 'Agri-linked divisions (foods, agribusiness) face the same input-cost and sourcing-disruption risk as any agriculture-adjacent business during a severe season.',
    favorable: 'Scale and diversification across FMCG categories absorbs a regional shock better than a single-crop or single-region exposed peer.',
  },
  {
    id: 'hindunilvr', name: 'Hindustan Unilever Ltd.', nseSymbol: 'HINDUNILVR', sector: 'FMCG',
    direction: 'mixed', vulnerabilityMultiplier: 0.9,
    worstCase: 'Rural demand (a meaningful revenue share) is sensitive to agricultural income, which a severe drought or flood season directly depresses.',
    favorable: 'National distribution scale and a broad category mix limit how much any single regional event can move consolidated results.',
  },
  {
    id: 'avantifeed', name: 'Avanti Feeds Ltd.', nseSymbol: 'AVANTIFEED', sector: 'Seafood / aquaculture export',
    direction: 'exposed', vulnerabilityMultiplier: 1.2,
    worstCase: 'Coastal flooding or a cyclone directly damages aquaculture ponds and processing/export infrastructure — the same mechanic this prototype\'s Kerala seafood-export company models, applied to a real listed peer.',
    favorable: 'Limited — a severe coastal event is close to a pure downside for pond-based aquaculture.',
  },
  {
    id: 'reliance', name: 'Reliance Industries Ltd.', nseSymbol: 'RELIANCE', sector: 'Conglomerate (energy, retail, telecom)',
    direction: 'mixed', vulnerabilityMultiplier: 1.0,
    worstCase: 'Refining/petrochemical assets and coastal logistics carry real physical climate exposure during an extreme event.',
    favorable: 'Retail, telecom and its own renewable-energy investment arm diversify the group away from pure physical-asset risk, and climate-transition capex is itself a stated multi-year growth bet.',
  },
  {
    id: 'ongc', name: 'Oil and Natural Gas Corporation Ltd.', nseSymbol: 'ONGC', sector: 'Oil & gas (upstream)',
    direction: 'exposed', vulnerabilityMultiplier: 1.1,
    worstCase: 'Offshore and coastal production assets face direct cyclone/storm-surge operational risk, with output disruption translating straight to revenue.',
    favorable: 'Limited — upstream production has little structural climate upside to offset the physical-asset risk.',
  },
  {
    id: 'mahindra', name: 'Mahindra & Mahindra Ltd.', nseSymbol: 'M&M', sector: 'Automotive / Manufacturing',
    direction: 'exposed', vulnerabilityMultiplier: 1.0,
    worstCase: 'Plant and dealership disruption in an affected region, plus a meaningful rural/agri-linked demand base (tractors) that a bad agricultural season directly softens.',
    favorable: 'Its tractor and farm-equipment business can see a replacement-demand bump as agricultural rebuilding follows a bad season, partially offsetting the near-term disruption.',
  },
  {
    id: 'tcs', name: 'Tata Consultancy Services Ltd.', nseSymbol: 'TCS', sector: 'IT / BPO',
    direction: 'resilient', vulnerabilityMultiplier: 0.5,
    worstCase: 'Office/campus disruption in one city is rarely material against a global, largely remote-deliverable service model — this prototype\'s own sector table already scores IT/BPO lowest among all modeled sectors.',
    favorable: 'Climate-transition advisory and ESG-reporting software/services are a real, if secondary, growth line for a large IT services major.',
  },
  {
    id: 'sunpharma', name: 'Sun Pharmaceutical Industries Ltd.', nseSymbol: 'SUNPHARMA', sector: 'Pharmaceuticals',
    direction: 'resilient', vulnerabilityMultiplier: 0.7,
    worstCase: 'A specific plant in an affected region could face temporary disruption, but a multi-site manufacturing footprint limits single-event impact — the same low-vulnerability logic this prototype already applies to Baddi Pharmaceuticals.',
    favorable: 'Limited direct upside — pharma demand is not meaningfully climate-driven either way.',
  },
]

export interface SensitivityResult {
  entity: RealMarketEntity
  /** 0-100 illustrative comparative index — severity scaled by the
   * disclosed multiplier, capped at 100. NOT a probability, NOT a
   * financial-loss estimate for a real company (that would require real
   * facility-level data this prototype doesn't have) — a ranking aid
   * only, same spirit as the WhatIf engine's likelihoodScore. */
  sensitivityIndex: number
}

export function computeSensitivityIndex(entity: RealMarketEntity, severity: number): SensitivityResult {
  return { entity, sensitivityIndex: Math.min(100, Math.round(severity * entity.vulnerabilityMultiplier)) }
}

export function rankBySensitivity(severity: number): SensitivityResult[] {
  return REAL_MARKET_ENTITIES.map((e) => computeSensitivityIndex(e, severity)).sort((a, b) => b.sensitivityIndex - a.sensitivityIndex)
}

export function findRealEntityByName(query: string): RealMarketEntity | null {
  const lower = query.toLowerCase()
  return (
    REAL_MARKET_ENTITIES.find((e) => lower.includes(e.name.toLowerCase()) || lower.includes(e.nseSymbol.toLowerCase())) ?? null
  )
}
