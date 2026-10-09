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

import { AlertTriangle, Flame, Network, Search, ShieldAlert, SlidersHorizontal, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import EntityInspector from '../components/graph/EntityInspector'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import { layoutGraph } from '../lib/dagreLayout'
import { EVIDENCE_META } from '../lib/evidence'
import {
  computeBankConcentration,
  computeBottlenecks,
  getConnectedChain,
  getDescendants,
  REGION_HAZARD,
  totalPortfolioEAD,
} from '../lib/graphAnalytics'
import { computeProtectionGap } from '../lib/insurance'
import { EDGES, KIND_META, NODES, type GNode } from '../lib/indiaGraphData'
import GraphNode from '../components/graph/GraphNode'
import { computeImpact, REGION_LABEL, type Region, useScenarioStore } from '../store/useScenarioStore'

const NODE_TYPES = { ind: GraphNode }
const BASE_LAYOUT = layoutGraph(NODES, EDGES)
const BOTTLENECKS = computeBottlenecks(5)
const BANK_CONCENTRATION = computeBankConcentration()
const TOTAL_EAD = totalPortfolioEAD()
const HAZARDS = NODES.filter((n) => n.kind === 'hazard')

export default function DependencyExplorerPage() {
  const selectedId = useScenarioStore((s) => s.selectedEntityId)
  const setSelectedId = useScenarioStore((s) => s.setSelectedEntity)
  const setRegion = useScenarioStore((s) => s.setRegion)
  const scenario = useScenarioStore()
  const activeRegion = scenario.region
  const [query, setQuery] = useState('')
  const [showConsole, setShowConsole] = useState(true)

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

  const matchedIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(NODES.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [query])

  const nodes: Node[] = useMemo(() => {
    return BASE_LAYOUT.nodes.map((n) => {
      const inChain = chain ? chain.nodes.has(n.id) : scenarioReach.nodes.has(n.id)
      const inMatch = matchedIds ? matchedIds.has(n.id) : true
      return {
        ...n,
        data: { ...n.data, dimmed: !inChain || !inMatch, active: inChain, selected: n.id === selectedId },
      }
    })
  }, [chain, scenarioReach, matchedIds, selectedId])

  const edges: Edge[] = useMemo(() => {
    return EDGES.map((e) => {
      const meta = EVIDENCE_META[e.evidence]
      const inChain = chain ? chain.edges.has(e.id) : scenarioReach.edges.has(e.id)
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        animated: inChain,
        style: {
          stroke: inChain ? meta.color : '#1c2430',
          strokeWidth: inChain ? Math.max(1.4, e.weight * 0.9) : 1,
          strokeDasharray: meta.dash,
          opacity: inChain ? 0.9 : 0.08,
        },
      }
    })
  }, [chain, scenarioReach])

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
            <div className="mb-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">EDGE EVIDENCE</div>
            <div className="space-y-1">
              {Object.entries(EVIDENCE_META).map(([cls, meta]) => (
                <div key={cls} className="flex items-center gap-2 text-[10px] text-slate-400">
                  <svg width="18" height="6">
                    <line x1="0" y1="3" x2="18" y2="3" stroke={meta.color} strokeWidth="2" strokeDasharray={meta.dash} />
                  </svg>
                  {meta.label}
                </div>
              ))}
            </div>
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
            onPaneClick={() => setSelectedId(null)}
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
