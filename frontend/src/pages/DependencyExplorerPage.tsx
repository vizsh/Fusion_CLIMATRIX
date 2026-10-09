import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { AlertTriangle, Calculator, ChevronRight, Flame, Network, Search, ShieldAlert, SlidersHorizontal, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import EntityInspector from '../components/graph/EntityInspector'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import { layoutGraph } from '../lib/dagreLayout'
import { EVIDENCE_META, type EvidenceClass } from '../lib/evidence'
import {
  computeBankConcentration,
  computeBottlenecks,
  computeHazardReach,
  getConnectedChain,
  getDescendants,
  REGION_HAZARD,
  totalPortfolioEAD,
} from '../lib/graphAnalytics'
import { computeProtectionGap } from '../lib/insurance'
import { EDGES, KIND_META, NODES, type EdgeType, type GEdge, type GNode } from '../lib/indiaGraphData'
import { sectorVulnerability } from '../lib/sectorVulnerability'
import GraphNode from '../components/graph/GraphNode'
import { computeImpact, REGION_LABEL, stressPdLgd, type Region, useScenarioStore } from '../store/useScenarioStore'

const NODE_TYPES = { ind: GraphNode }
const BASE_LAYOUT = layoutGraph(NODES, EDGES)
const BOTTLENECKS = computeBottlenecks(5)
const BANK_CONCENTRATION = computeBankConcentration()
const TOTAL_EAD = totalPortfolioEAD()
const HAZARDS = NODES.filter((n) => n.kind === 'hazard')
const nodeById = new Map(NODES.map((n) => [n.id, n]))

// Plain-language meaning of each typed relationship — the "what does this
// edge actually represent" question the graph itself can't answer just by
// being colored and dashed differently.
const EDGE_TYPE_META: Record<EdgeType, { verb: string; meaning: string }> = {
  AFFECTED_BY: { verb: 'is physically affected by', meaning: 'The hazard directly strikes this infrastructure — a documented geographic/historical fact, not an inference.' },
  DEPENDS_ON: { verb: 'operationally depends on', meaning: 'This node cannot function normally without the upstream node — an asserted operational dependency, not a contractual one.' },
  SUPPLIES: { verb: 'supplies inputs to', meaning: "A supplier/logistics node feeds this company's production — fabricated for this demo, not a real supply contract." },
  TRANSPORTS_VIA: { verb: 'routes through', meaning: 'Goods/logistics flow through this shared corridor — the mechanism behind cross-regional hidden concentration.' },
  FINANCED_BY: { verb: 'is financed by', meaning: 'A lender/government fund holds exposure to this entity — the credit-side relationship Bank mode stresses.' },
  INSURED_BY: { verb: 'is insured by', meaning: 'An insurer carries a policy on this entity — the relationship the Insurance & Protection Gap page stresses instead.' },
}

export default function DependencyExplorerPage() {
  const selectedId = useScenarioStore((s) => s.selectedEntityId)
  const setSelectedId = useScenarioStore((s) => s.setSelectedEntity)
  const setRegion = useScenarioStore((s) => s.setRegion)
  const scenario = useScenarioStore()
  const activeRegion = scenario.region
  const [query, setQuery] = useState('')
  const [showConsole, setShowConsole] = useState(true)
  const [hiddenEvidence, setHiddenEvidence] = useState<Set<EvidenceClass>>(new Set())
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [showMath, setShowMath] = useState(false)

  const chain = useMemo(() => (selectedId ? getConnectedChain(selectedId) : null), [selectedId])

  // What the ACTIVE SCENARIO reaches, independent of any click/search — this
  // is what makes changing region/hazard/severity visibly change the graph
  // even before the user selects anything, which is the whole point of a
  // scenario console: "what does this change affect" should be answerable
  // immediately, not only after drilling into one node.
  const hazardId = REGION_HAZARD[activeRegion]
  const scenarioReach = useMemo(() => getDescendants(hazardId), [hazardId])
  const impact = useMemo(
    () => computeImpact(scenario),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario.region, scenario.severity, scenario.durationMonths, scenario.substitutability, scenario.interventions],
  )
  const protectionGap = useMemo(
    () => computeProtectionGap(hazardId, scenario.severity, scenario.durationMonths),
    [hazardId, scenario.severity, scenario.durationMonths],
  )

  // Per-company stressed EL for the active scenario — computed once here
  // and (a) passed to the graph so canvas nodes show the real figure
  // instead of only a highlight color, and (b) backs the "show the math"
  // trace below, so the top driver's number is provably derived, not
  // just asserted.
  const { companies: reachedCompanies } = useMemo(() => computeHazardReach(hazardId), [hazardId])
  const companyCalc = useMemo(
    () =>
      reachedCompanies
        .map((c) => {
          const vulnerability = sectorVulnerability(c.sector)
          const { stressedPd, stressedLgd } = stressPdLgd(
            c.baselinePd ?? 0,
            c.baselineLgd ?? 0,
            scenario.severity,
            scenario.durationMonths,
            scenario.substitutability,
            vulnerability,
          )
          const eadCr = c.eadCr ?? 0
          return { company: c, vulnerability, stressedPd, stressedLgd, stressedElCr: eadCr * stressedPd * stressedLgd }
        })
        .sort((a, b) => b.stressedElCr - a.stressedElCr),
    [reachedCompanies, scenario.severity, scenario.durationMonths, scenario.substitutability],
  )
  const stressedElById = useMemo(() => new Map(companyCalc.map((c) => [c.company.id, c.stressedElCr])), [companyCalc])
  const topCompanyCalc = companyCalc[0] ?? null

  const matchedIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(NODES.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [query])

  const nodes: Node[] = useMemo(() => {
    return BASE_LAYOUT.nodes.map((n) => {
      const inChain = chain ? chain.nodes.has(n.id) : scenarioReach.nodes.has(n.id)
      const inMatch = matchedIds ? matchedIds.has(n.id) : true
      const stressedElCr = inChain && n.data.gnode.kind === 'company' ? stressedElById.get(n.id) : undefined
      return {
        ...n,
        data: { ...n.data, dimmed: !inChain || !inMatch, active: inChain, selected: n.id === selectedId, stressedElCr },
      }
    })
  }, [chain, scenarioReach, matchedIds, selectedId, stressedElById])

  const edges: Edge[] = useMemo(() => {
    return EDGES.map((e) => {
      const meta = EVIDENCE_META[e.evidence]
      const inChain = chain ? chain.edges.has(e.id) : scenarioReach.edges.has(e.id)
      const show = inChain && !hiddenEvidence.has(e.evidence)
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        animated: show,
        style: {
          stroke: show ? meta.color : '#1c2430',
          strokeWidth: show ? Math.max(1.4, e.weight * 0.9) : 1,
          strokeDasharray: meta.dash,
          opacity: show ? 0.9 : 0.08,
        },
      }
    })
  }, [chain, scenarioReach, hiddenEvidence])

  const selectedEdge: GEdge | undefined = selectedEdgeId ? EDGES.find((e) => e.id === selectedEdgeId) : undefined

  function toggleEvidence(cls: EvidenceClass) {
    setHiddenEvidence((prev) => {
      const next = new Set(prev)
      if (next.has(cls)) next.delete(cls)
      else next.add(cls)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="DEPENDENCY EXPLORER"
        subtitle="HAZARD → INFRASTRUCTURE → SUPPLIER → COMPANY → FINANCIAL EXPOSURE"
        tag={`${NODES.length} NODES · ${EDGES.length} EDGES · ₹${TOTAL_EAD} CR PORTFOLIO`}
      />

      <div className="border-b border-line bg-panel/40">
        <button
          onClick={() => setShowConsole((v) => !v)}
          className="flex w-full items-center gap-1.5 px-3 py-1.5 font-mono text-[9.5px] tracking-[0.15em] text-slate-500 hover:text-slate-300"
        >
          <SlidersHorizontal size={11} className="text-cyan" />
          BUILD A SCENARIO {showConsole ? '▾' : '▸'}
          <span className="ml-auto font-normal normal-case tracking-normal text-slate-600">
            Set a region, hazard and severity, then select or search any company, bank or asset to see how this scenario affects it.
          </span>
        </button>
        {showConsole && (
          <div className="border-t border-line-soft px-1 pb-1">
            <ScenarioConsole compact />
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel/60 p-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              <Search size={11} className="text-cyan" /> SEARCH GRAPH
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Union Pradesh Bank…"
              className="w-full rounded border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
            />
            {query.trim() && matchedIds && (
              <div className="mt-1.5 max-h-[160px] space-y-1 overflow-y-auto rounded border border-line bg-panel-2 p-1.5">
                {NODES.filter((n) => matchedIds.has(n.id)).length === 0 && (
                  <div className="px-1.5 py-1 text-[10.5px] text-slate-600">No matches</div>
                )}
                {NODES.filter((n) => matchedIds.has(n.id))
                  .slice(0, 12)
                  .map((n) => {
                    const meta = KIND_META[n.kind]
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setSelectedId(n.id)
                          setQuery('')
                        }}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[10.5px] text-slate-300 hover:bg-panel"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                        <span className="truncate">{n.label}</span>
                      </button>
                    )
                  })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              <Flame size={11} className="text-risk-high" /> SEED A HAZARD
            </div>
            <div className="space-y-1.5">
              {HAZARDS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    if (h.region) setRegion(h.region as Region)
                    setSelectedId(selectedId === h.id ? null : h.id)
                  }}
                  className={`w-full rounded border px-2 py-1.5 text-left text-[10.5px] transition-colors ${
                    activeRegion === h.region ? 'border-risk-high/50 bg-risk-high/10 text-risk-high' : 'border-line text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-600">
              Selecting a hazard also sets it as the active scenario region.
            </p>
          </div>

          <div>
            <div className="mb-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">NODE TYPES</div>
            <div className="space-y-1">
              {Object.entries(KIND_META).map(([kind, meta]) => (
                <div key={kind} className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              EDGE EVIDENCE — CLICK TO FILTER
            </div>
            <div className="space-y-1">
              {(Object.entries(EVIDENCE_META) as [EvidenceClass, (typeof EVIDENCE_META)[EvidenceClass]][]).map(([cls, meta]) => {
                const hidden = hiddenEvidence.has(cls)
                return (
                  <button
                    key={cls}
                    onClick={() => toggleEvidence(cls)}
                    className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[10px] transition-colors ${
                      hidden ? 'text-slate-700' : 'text-slate-400 hover:bg-panel-2'
                    }`}
                  >
                    <svg width="18" height="6" style={{ opacity: hidden ? 0.3 : 1 }}>
                      <line x1="0" y1="3" x2="18" y2="3" stroke={meta.color} strokeWidth="2" strokeDasharray={meta.dash} />
                    </svg>
                    {meta.label}
                    {hidden && <span className="ml-auto text-[8.5px] text-slate-600">HIDDEN</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-600">
              Hide a class to see exactly how much of the visible graph is backed by what — e.g. hide
              everything but "Sourced" to see only cited, documented relationships.
            </p>
          </div>

          <p className="mt-auto text-[9.5px] leading-relaxed text-slate-600">
            Synthetic India-centric exposure graph, shared with the Digital Twin and Company
            Investigation. Selecting a node here selects it everywhere.
          </p>
        </aside>

        <main className="relative min-w-0 flex-1 bg-grid">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodeClick={(_, n) => setSelectedId(n.id === selectedId ? null : n.id)}
            onEdgeClick={(_, e) => setSelectedEdgeId(e.id === selectedEdgeId ? null : e.id)}
            onPaneClick={() => {
              setSelectedId(null)
              setSelectedEdgeId(null)
            }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.3}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#141a24" />
            <Controls
              showInteractive={false}
              className="!border !border-line !bg-panel-2 [&>button]:!border-line [&>button]:!bg-panel-2 [&>button]:!fill-slate-400"
            />
            <MiniMap
              pannable
              zoomable
              maskColor="rgba(5,7,10,0.75)"
              className="!border !border-line !bg-panel-2"
              nodeColor={(n) => KIND_META[(n.data as { gnode: GNode }).gnode.kind].color}
            />
          </ReactFlow>

          {selectedEdge && (
            <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-lg border border-line bg-panel/95 p-3 backdrop-blur">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span
                  className="rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wide"
                  style={{ borderColor: EVIDENCE_META[selectedEdge.evidence].color, color: EVIDENCE_META[selectedEdge.evidence].color }}
                >
                  {EVIDENCE_META[selectedEdge.evidence].label.toUpperCase()}
                </span>
                <button
                  onClick={() => setSelectedEdgeId(null)}
                  className="pointer-events-auto font-mono text-[9px] text-slate-500 hover:text-slate-300"
                >
                  CLOSE
                </button>
              </div>
              <div className="text-[11.5px] leading-snug text-slate-300">
                <span className="text-slate-200">{nodeById.get(selectedEdge.from)?.label ?? selectedEdge.from}</span>{' '}
                <span className="text-cyan">{EDGE_TYPE_META[selectedEdge.type].verb}</span>{' '}
                <span className="text-slate-200">{nodeById.get(selectedEdge.to)?.label ?? selectedEdge.to}</span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{EDGE_TYPE_META[selectedEdge.type].meaning}</p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">
                {EVIDENCE_META[selectedEdge.evidence].desc} Relevance weight {selectedEdge.weight}/3.
              </p>
            </div>
          )}
        </main>

        <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-line bg-panel/60">
          {selectedId ? (
            <div className="border-b border-line p-4">
              <EntityInspector nodeId={selectedId} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
            </div>
          ) : (
            <div className="border-b border-line p-4">
              <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
                <Zap size={12} className="text-cyan" /> SCENARIO IMPACT — LIVE
              </div>
              <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
                {REGION_LABEL[scenario.region]} · {scenario.hazard}, severity {scenario.severity}/100. The
                highlighted nodes on the graph are exactly what this scenario reaches — change any dial above and
                both the graph and the numbers below update immediately.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded border border-line bg-panel-2 px-2.5 py-2 text-[11px]">
                  <span className="text-slate-500">Companies reached</span>
                  <span className="font-mono-tnum text-slate-200">{impact.companyCount}</span>
                </div>
                <div className="flex items-center justify-between rounded border border-line bg-panel-2 px-2.5 py-2 text-[11px]">
                  <span className="text-slate-500">EAD at risk</span>
                  <span className="font-mono-tnum text-slate-200">₹{impact.eadCr.toFixed(0)} cr</span>
                </div>
                <div className="flex items-center justify-between rounded border border-line bg-panel-2 px-2.5 py-2 text-[11px]">
                  <span className="text-slate-500">Baseline → stressed EL</span>
                  <span className="font-mono-tnum text-risk-high">
                    ₹{impact.baselineEl.toFixed(1)} cr → ₹{impact.stressedEl.toFixed(1)} cr
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border border-line bg-panel-2 px-2.5 py-2 text-[11px]">
                  <span className="text-slate-500">Protection gap (uninsured)</span>
                  <span className="font-mono-tnum text-risk-med">{(protectionGap.protectionGapShare * 100).toFixed(0)}%</span>
                </div>
              </div>
              {impact.bySector.length > 0 && (
                <>
                  <div className="mb-1.5 mt-3 font-mono text-[9px] tracking-[0.15em] text-slate-500">
                    WHICH SEGMENTS, AND WHY
                  </div>
                  <div className="space-y-1.5">
                    {impact.bySector.map((s) => (
                      <div key={s.sector} className="flex items-center justify-between text-[10.5px]">
                        <span className="text-slate-400">{s.sector}</span>
                        <span className="font-mono-tnum text-slate-300">₹{s.stressedEl.toFixed(1)} cr</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {topCompanyCalc && (
                <div className="mt-3 rounded border border-line bg-panel-2 p-2.5">
                  <button
                    onClick={() => setShowMath((v) => !v)}
                    className="flex w-full items-center justify-between font-mono text-[9px] tracking-[0.15em] text-slate-500 hover:text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <Calculator size={11} className="text-cyan" /> SHOW THE MATH — {topCompanyCalc.company.label.toUpperCase()}
                    </span>
                    <ChevronRight size={12} className={`transition-transform ${showMath ? 'rotate-90' : ''}`} />
                  </button>
                  {showMath && (
                    <div className="mt-2 space-y-1 text-[10.5px]">
                      <MathRow label="Baseline PD / LGD" value={`${((topCompanyCalc.company.baselinePd ?? 0) * 100).toFixed(1)}% / ${((topCompanyCalc.company.baselineLgd ?? 0) * 100).toFixed(1)}%`} />
                      <MathRow label={`Sector vulnerability (${topCompanyCalc.company.sector})`} value={`×${topCompanyCalc.vulnerability.toFixed(2)}`} />
                      <MathRow label={`Severity ${scenario.severity}/100, substitutability ${scenario.substitutability}`} value="→ severity factor" />
                      <MathRow label="Stressed PD / LGD" value={`${(topCompanyCalc.stressedPd * 100).toFixed(2)}% / ${(topCompanyCalc.stressedLgd * 100).toFixed(1)}%`} highlight />
                      <MathRow label={`EAD ₹${(topCompanyCalc.company.eadCr ?? 0).toFixed(0)} cr × stressed PD × stressed LGD`} value={`= ₹${topCompanyCalc.stressedElCr.toFixed(2)} cr`} highlight />
                    </div>
                  )}
                  <p className="mt-2 text-[9px] leading-relaxed text-slate-600">
                    Same disclosed formula as every other figure in the app (<code>stressPdLgd</code> in
                    useScenarioStore.ts) — no hidden adjustment, nothing the dashboard can't reproduce.
                  </p>
                </div>
              )}

              <p className="mt-3 text-[9.5px] leading-relaxed text-slate-600">
                <Network size={11} className="mb-0.5 mr-1 inline text-cyan" />
                Click or search any highlighted node for its own scenario-adjusted detail, or see Insurance &amp;
                Protection Gap for which of these borrowers are uninsured.
              </p>
            </div>
          )}

          <div className="border-b border-line p-4">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              <AlertTriangle size={12} className="text-risk-med" /> HIDDEN CONCENTRATION RISK
            </div>
            <div className="space-y-2.5">
              {BOTTLENECKS.map((b) => (
                <button
                  key={b.node.id}
                  onClick={() => setSelectedId(b.node.id)}
                  className="block w-full rounded border border-line bg-panel-2 p-2 text-left hover:border-risk-med/50"
                >
                  <div className="truncate text-[11px] text-slate-300">{b.node.label}</div>
                  <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-500">
                    <span>{b.reachedCompanies.length} companies downstream</span>
                    <span className="font-mono-tnum text-risk-med">₹{b.reachedEAD} cr</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-risk-med"
                      style={{ width: `${Math.min((b.reachedEAD / TOTAL_EAD) * 100, 100)}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
              <ShieldAlert size={12} className="text-cyan" /> INSTITUTION CONCENTRATION
            </div>
            <div className="space-y-2.5">
              {BANK_CONCENTRATION.map((b) => (
                <button
                  key={b.node.id}
                  onClick={() => setSelectedId(b.node.id)}
                  className="block w-full rounded border border-line bg-panel-2 p-2 text-left hover:border-cyan/50"
                >
                  <div className="truncate text-[11px] text-slate-300">{b.node.label}</div>
                  <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-500">
                    <span>{b.companyCount} borrowers linked</span>
                    <span className="font-mono-tnum text-cyan">₹{b.exposedEAD} cr</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function MathRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono-tnum shrink-0 ${highlight ? 'text-cyan' : 'text-slate-300'}`}>{value}</span>
    </div>
  )
}
