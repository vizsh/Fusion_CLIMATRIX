import { EDGES, NODES, type GEdge, type GNode } from './indiaGraphData'

const nodeById = new Map<string, GNode>(NODES.map((n) => [n.id, n]))

function buildAdjacency(edges: GEdge[]) {
  const forward = new Map<string, GEdge[]>()
  const reverse = new Map<string, GEdge[]>()
  for (const e of edges) {
    if (!forward.has(e.from)) forward.set(e.from, [])
    forward.get(e.from)!.push(e)
    if (!reverse.has(e.to)) reverse.set(e.to, [])
    reverse.get(e.to)!.push(e)
  }
  return { forward, reverse }
}

const { forward, reverse } = buildAdjacency(EDGES)

function bfs(startId: string, adjacency: Map<string, GEdge[]>) {
  const visitedNodes = new Set<string>([startId])
  const visitedEdges = new Set<string>()
  const queue = [startId]
  while (queue.length) {
    const cur = queue.shift()!
    for (const e of adjacency.get(cur) ?? []) {
      visitedEdges.add(e.id)
      const next = adjacency === forward ? e.to : e.from
      if (!visitedNodes.has(next)) {
        visitedNodes.add(next)
        queue.push(next)
      }
    }
  }
  return { nodes: visitedNodes, edges: visitedEdges }
}

export function getDescendants(nodeId: string) {
  return bfs(nodeId, forward)
}

export function getAncestors(nodeId: string) {
  return bfs(nodeId, reverse)
}

/** Full connected chain (ancestors + self + descendants) for highlighting. */
export function getConnectedChain(nodeId: string) {
  const desc = getDescendants(nodeId)
  const anc = getAncestors(nodeId)
  const nodes = new Set<string>([...desc.nodes, ...anc.nodes])
  const edges = new Set<string>([...desc.edges, ...anc.edges])
  return { nodes, edges }
}

const ALL_COMPANIES = NODES.filter((n) => n.kind === 'company')
const TOTAL_PORTFOLIO_EAD = ALL_COMPANIES.reduce((s, c) => s + (c.eadCr ?? 0), 0)

export function downstreamCompanies(nodeId: string) {
  const { nodes } = getDescendants(nodeId)
  return ALL_COMPANIES.filter((c) => nodes.has(c.id))
}

export function downstreamEAD(nodeId: string) {
  return downstreamCompanies(nodeId).reduce((s, c) => s + (c.eadCr ?? 0), 0)
}

export interface Bottleneck {
  node: GNode
  reachedCompanies: GNode[]
  reachedEAD: number
}

/** Shared infrastructure/supplier nodes whose disruption reaches multiple
 * companies — the "hidden concentration risk" the spec asks the product to surface. */
export function computeBottlenecks(limit = 6): Bottleneck[] {
  const candidates = NODES.filter((n) => n.kind === 'infra' || n.kind === 'supplier')
  const scored = candidates
    .map((node) => {
      const reachedCompanies = downstreamCompanies(node.id)
      const reachedEAD = reachedCompanies.reduce((s, c) => s + (c.eadCr ?? 0), 0)
      return { node, reachedCompanies, reachedEAD }
    })
    .filter((b) => b.reachedCompanies.length > 1)
    .sort((a, b) => b.reachedEAD - a.reachedEAD)
  return scored.slice(0, limit)
}

export interface BankConcentration {
  node: GNode
  exposedEAD: number
  totalEAD: number
  share: number
  companyCount: number
}

/** For each financial institution, sum the EAD of companies financed/insured
 * by it (via reverse graph traversal), as a share of its own book. */
export function computeBankConcentration(): BankConcentration[] {
  const institutions = NODES.filter((n) => n.kind === 'bank' || n.kind === 'govt' || n.kind === 'insurer')
  return institutions
    .map((node) => {
      const { nodes } = getAncestors(node.id)
      const companies = ALL_COMPANIES.filter((c) => nodes.has(c.id))
      const exposedEAD = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0)
      return { node, exposedEAD, totalEAD: exposedEAD, share: 1, companyCount: companies.length }
    })
    .filter((b) => b.companyCount > 0)
    .sort((a, b) => b.exposedEAD - a.exposedEAD)
}

export interface HazardReach {
  hazardId: string
  companies: GNode[]
  companyEAD: number
  institutions: GNode[]
  portfolioShare: number
}

/** What a given hazard can financially reach, following the full forward chain. */
export function computeHazardReach(hazardId: string): HazardReach {
  const { nodes } = getDescendants(hazardId)
  const companies = ALL_COMPANIES.filter((c) => nodes.has(c.id))
  const companyEAD = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0)
  const institutions = NODES.filter(
    (n) => (n.kind === 'bank' || n.kind === 'govt' || n.kind === 'insurer') && nodes.has(n.id),
  )
  return {
    hazardId,
    companies,
    companyEAD,
    institutions,
    portfolioShare: TOTAL_PORTFOLIO_EAD ? companyEAD / TOTAL_PORTFOLIO_EAD : 0,
  }
}

export function totalPortfolioEAD() {
  return TOTAL_PORTFOLIO_EAD
}

export function getNode(id: string) {
  return nodeById.get(id)
}

export const REGION_HAZARD: Record<'HP' | 'KL' | 'MH' | 'UK', string> = {
  HP: 'hz-hp',
  KL: 'hz-kl',
  MH: 'hz-mh',
  UK: 'hz-uk',
}

/** Ordered hop-by-hop propagation stages for the causal replay timeline —
 * derived from the actual graph (BFS by hop), not a hardcoded disaster
 * script, so it reflects whatever this scenario's dependency chain is. */
export interface ReplayStage {
  hop: number
  label: string
  nodes: GNode[]
}

export function graphStages(hazardId: string, maxHops = 4): ReplayStage[] {
  const start = getNode(hazardId)
  if (!start) return []
  const visited = new Set<string>([hazardId])
  let frontier = [hazardId]
  const stages: ReplayStage[] = [{ hop: 0, label: 'Hazard conditions intensify', nodes: [start] }]
  const HOP_LABELS = [
    '',
    'Directly exposed infrastructure',
    'Dependent suppliers and access routes',
    'Affected companies and borrowers',
    'Financial institutions exposed',
  ]
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const e of forward.get(id) ?? []) {
        if (!visited.has(e.to)) {
          visited.add(e.to)
          next.push(e.to)
        }
      }
    }
    if (!next.length) break
    const nodes = next.map((id) => getNode(id)).filter((n): n is GNode => !!n)
    stages.push({ hop, label: HOP_LABELS[Math.min(hop, HOP_LABELS.length - 1)], nodes })
    frontier = next
  }
  return stages
}

export interface PortfolioStats {
  eadCr: number
  baselinePd: number
  baselineLgd: number
  companyCount: number
}

/** EAD-weighted baseline PD/LGD across every company reachable from a hazard —
 * the real, graph-derived portfolio this scenario's financial engine stresses. */
export function hazardPortfolioStats(hazardId: string): PortfolioStats {
  const { companies, companyEAD } = computeHazardReach(hazardId)
  if (!companies.length || companyEAD === 0) {
    return { eadCr: 0, baselinePd: 0, baselineLgd: 0, companyCount: 0 }
  }
  const baselinePd = companies.reduce((s, c) => s + (c.baselinePd ?? 0) * (c.eadCr ?? 0), 0) / companyEAD
  const baselineLgd = companies.reduce((s, c) => s + (c.baselineLgd ?? 0) * (c.eadCr ?? 0), 0) / companyEAD
  return { eadCr: companyEAD, baselinePd, baselineLgd, companyCount: companies.length }
}

/** The financing institution(s) directly reachable one FINANCED_BY/INSURED_BY hop downstream of a node. */
export function directFinanciers(nodeId: string) {
  return (forward.get(nodeId) ?? [])
    .filter((e) => e.type === 'FINANCED_BY' || e.type === 'INSURED_BY')
    .map((e) => nodeById.get(e.to))
    .filter((n): n is GNode => !!n)
}

export interface CompanyExposureDetail {
  hazards: GNode[]
  /** Infrastructure with a direct (one-hop) edge into this company. */
  directInfra: GNode[]
  /** Infrastructure reached only via a supplier or a shared multi-region
   * node (e.g. a national logistics supplier) — real graph ancestors, but
   * not a direct operational dependency, so kept visually separate to
   * avoid implying a Himachal company directly depends on a Kerala port. */
  indirectInfra: GNode[]
  suppliers: GNode[]
  directInfraParent: boolean
}

/** A company's upstream exposure structure — which hazards, infrastructure
 * and suppliers sit in its ancestor chain, with direct vs indirect
 * infrastructure dependency kept distinct. */
export function companyExposureDetail(companyId: string): CompanyExposureDetail {
  const { nodes: ancestorIds } = getAncestors(companyId)
  const hazards = NODES.filter((n) => n.kind === 'hazard' && ancestorIds.has(n.id))
  const allInfra = NODES.filter((n) => n.kind === 'infra' && ancestorIds.has(n.id))
  const suppliers = NODES.filter((n) => n.kind === 'supplier' && ancestorIds.has(n.id))
  const directInfraIds = new Set(
    EDGES.filter((e) => e.to === companyId && nodeById.get(e.from)?.kind === 'infra').map((e) => e.from),
  )
  const directInfra = allInfra.filter((n) => directInfraIds.has(n.id))
  const indirectInfra = allInfra.filter((n) => !directInfraIds.has(n.id))
  return { hazards, directInfra, indirectInfra, suppliers, directInfraParent: directInfra.length > 0 }
}

export interface InstitutionScenarioExposure {
  totalBorrowers: GNode[]
  exposedBorrowers: GNode[]
  unexposedBorrowers: GNode[]
  totalEAD: number
  exposedEAD: number
}

/** The question "how would [this hazard] affect [this bank]?" answered
 * structurally: intersect everything financing this institution with
 * everything reachable from the given hazard. */
export function institutionExposureToHazard(institutionId: string, hazardId: string): InstitutionScenarioExposure {
  const { nodes: borrowerAncestorIds } = getAncestors(institutionId)
  const totalBorrowers = ALL_COMPANIES.filter((c) => borrowerAncestorIds.has(c.id))
  const { nodes: hazardDescendantIds } = getDescendants(hazardId)
  const exposedBorrowers = totalBorrowers.filter((c) => hazardDescendantIds.has(c.id))
  const unexposedBorrowers = totalBorrowers.filter((c) => !hazardDescendantIds.has(c.id))
  return {
    totalBorrowers,
    exposedBorrowers,
    unexposedBorrowers,
    totalEAD: totalBorrowers.reduce((s, c) => s + (c.eadCr ?? 0), 0),
    exposedEAD: exposedBorrowers.reduce((s, c) => s + (c.eadCr ?? 0), 0),
  }
}
