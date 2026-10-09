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

import { AlertTriangle, Flame, Network, Search, ShieldAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import EntityInspector from '../components/graph/EntityInspector'
import PageHeader from '../components/PageHeader'
import { layoutGraph } from '../lib/dagreLayout'
import { EVIDENCE_META } from '../lib/evidence'
import {
  computeBankConcentration,
  computeBottlenecks,
  getConnectedChain,
  totalPortfolioEAD,
} from '../lib/graphAnalytics'
import { EDGES, KIND_META, NODES, type GNode } from '../lib/indiaGraphData'
import GraphNode from '../components/graph/GraphNode'
import { useScenarioStore } from '../store/useScenarioStore'

const NODE_TYPES = { ind: GraphNode }
const BASE_LAYOUT = layoutGraph(NODES, EDGES)
const BOTTLENECKS = computeBottlenecks(5)
const BANK_CONCENTRATION = computeBankConcentration()
const TOTAL_EAD = totalPortfolioEAD()
const HAZARDS = NODES.filter((n) => n.kind === 'hazard')

export default function DependencyExplorerPage() {
  const selectedId = useScenarioStore((s) => s.selectedEntityId)
  const setSelectedId = useScenarioStore((s) => s.setSelectedEntity)
  const [query, setQuery] = useState('')

  const chain = useMemo(() => (selectedId ? getConnectedChain(selectedId) : null), [selectedId])

  const matchedIds = useMemo(() => {
    if (!query.trim()) return null
    const q = query.trim().toLowerCase()
    return new Set(NODES.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id))
  }, [query])

  const nodes: Node[] = useMemo(() => {
    return BASE_LAYOUT.nodes.map((n) => {
      const inChain = chain ? chain.nodes.has(n.id) : true
      const inMatch = matchedIds ? matchedIds.has(n.id) : true
      return {
        ...n,
        data: { ...n.data, dimmed: !inChain || !inMatch, active: chain ? inChain : false, selected: n.id === selectedId },
      }
    })
  }, [chain, matchedIds, selectedId])

  const edges: Edge[] = useMemo(() => {
    return EDGES.map((e) => {
      const meta = EVIDENCE_META[e.evidence]
      const inChain = chain ? chain.edges.has(e.id) : true
      const highlighted = chain ? inChain : false
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        animated: highlighted,
        style: {
          stroke: highlighted ? meta.color : '#1c2430',
          strokeWidth: highlighted ? Math.max(1.4, e.weight * 0.9) : 1,
          strokeDasharray: meta.dash,
          opacity: chain ? (inChain ? 0.9 : 0.08) : 0.35,
        },
      }
    })
  }, [chain])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="DEPENDENCY EXPLORER"
        subtitle="HAZARD → INFRASTRUCTURE → SUPPLIER → COMPANY → FINANCIAL EXPOSURE"
        tag={`${NODES.length} NODES · ${EDGES.length} EDGES · ₹${TOTAL_EAD} CR PORTFOLIO`}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-line bg-panel/60 p-3">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              <Search size={11} className="text-cyan" /> SEARCH GRAPH
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Company, bank, supplier…"
              className="w-full rounded border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              <Flame size={11} className="text-risk-high" /> SEED A HAZARD
            </div>
            <div className="space-y-1.5">
              {HAZARDS.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(selectedId === h.id ? null : h.id)}
                  className={`w-full rounded border px-2 py-1.5 text-left text-[10.5px] transition-colors ${
                    selectedId === h.id ? 'border-risk-high/50 bg-risk-high/10 text-risk-high' : 'border-line text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {h.label}
                </button>
              ))}
            </div>
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
            <div className="border-b border-line p-4 text-[11px] leading-relaxed text-slate-500">
              <Network size={14} className="mb-2 text-cyan" />
              Click any node to trace its full upstream and downstream chain, or seed a hazard on
              the left to see everything it can financially reach.
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
