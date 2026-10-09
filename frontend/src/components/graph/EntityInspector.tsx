import { ArrowUpRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  computeBottlenecks,
  computeHazardReach,
  directFinanciers,
  getAncestors,
} from '../../lib/graphAnalytics'
import { KIND_META, NODES, type GNode } from '../../lib/indiaGraphData'

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2 text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono-tnum text-slate-200">{value}</span>
    </div>
  )
}

export default function EntityInspector({
  nodeId,
  onClose,
  onSelect,
}: {
  nodeId: string
  onClose?: () => void
  onSelect?: (id: string) => void
}) {
  const navigate = useNavigate()
  const node = NODES.find((n) => n.id === nodeId)
  if (!node) return null
  const meta = KIND_META[node.kind]

  return (
    <div>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-[9.5px] tracking-wide" style={{ color: meta.color }}>
            {meta.label.toUpperCase()}
            {node.region && node.region !== 'National' ? ` · ${node.region}` : ''}
          </span>
          <div className="mt-0.5 text-[14px] font-semibold text-white">{node.label}</div>
          {node.sector && <div className="text-[11px] text-slate-500">{node.sector}</div>}
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded border border-line p-1 text-slate-500 hover:text-slate-300">
            <X size={13} />
          </button>
        )}
      </div>

      {node.note && <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{node.note}</p>}

      {node.kind === 'hazard' && <HazardStats node={node} onSelect={onSelect} />}
      {(node.kind === 'infra' || node.kind === 'supplier') && <BottleneckStats node={node} onSelect={onSelect} />}
      {node.kind === 'company' && <CompanyStats node={node} onSelect={onSelect} />}
      {(node.kind === 'bank' || node.kind === 'govt' || node.kind === 'insurer') && (
        <InstitutionStats node={node} onSelect={onSelect} />
      )}

      {node.kind === 'company' && (
        <button
          onClick={() => navigate(`/company?id=${node.id}`)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 py-2 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
        >
          OPEN FULL INVESTIGATION <ArrowUpRight size={12} />
        </button>
      )}
    </div>
  )
}

function LinkChip({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const meta = KIND_META[node.kind]
  return (
    <button
      onClick={() => onSelect?.(node.id)}
      className="rounded border px-2 py-1 text-left text-[10.5px] transition-colors hover:brightness-125"
      style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}0f` }}
    >
      {node.label}
    </button>
  )
}

function HazardStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const reach = computeHazardReach(node.id)
  return (
    <div>
      <StatRow label="Companies financially reachable" value={`${reach.companies.length}`} />
      <StatRow label="Portfolio EAD reachable" value={`₹${reach.companyEAD.toFixed(0)} cr`} />
      <StatRow label="Share of modeled portfolio" value={`${(reach.portfolioShare * 100).toFixed(1)}%`} />
      <StatRow label="Institutions exposed" value={`${reach.institutions.length}`} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {reach.institutions.map((i) => (
          <LinkChip key={i.id} node={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function BottleneckStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const b = computeBottlenecks(50).find((x) => x.node.id === node.id)
  const { nodes: ancestorIds } = getAncestors(node.id)
  const hazardSources = NODES.filter((n) => n.kind === 'hazard' && ancestorIds.has(n.id))
  const companies = b?.reachedCompanies ?? []
  const ead = b?.reachedEAD ?? 0
  return (
    <div>
      <StatRow label="Exposed to hazard" value={hazardSources.map((h) => h.region).join(', ') || '—'} />
      <StatRow label="Downstream companies" value={`${companies.length}`} />
      <StatRow label="Downstream EAD at risk" value={`₹${ead.toFixed(0)} cr`} />
      {companies.length > 1 && (
        <div className="mt-2.5 rounded border border-risk-med/30 bg-risk-med/[0.06] p-2.5 text-[10.5px] leading-relaxed text-slate-400">
          Shared dependency: a single disruption here reaches {companies.length} otherwise
          unrelated borrowers — the hidden concentration risk this graph is built to surface.
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {companies.slice(0, 6).map((c) => (
          <LinkChip key={c.id} node={c} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function CompanyStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const financiers = directFinanciers(node.id)
  const { nodes: ancestorIds } = getAncestors(node.id)
  const hazards = NODES.filter((n) => n.kind === 'hazard' && ancestorIds.has(n.id))
  return (
    <div>
      <StatRow label="Exposure at default (EAD)" value={`₹${node.eadCr} cr`} />
      <StatRow label="Baseline PD" value={`${((node.baselinePd ?? 0) * 100).toFixed(1)}%`} />
      <StatRow label="Baseline LGD" value={`${((node.baselineLgd ?? 0) * 100).toFixed(0)}%`} />
      <StatRow label="Hazard exposure path" value={hazards.length ? 'Traced' : 'None in graph'} />
      <div className="mt-2.5 text-[9.5px] tracking-wide text-slate-500">LINKED FINANCIER(S)</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {financiers.map((f) => (
          <LinkChip key={f.id} node={f} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function InstitutionStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const { nodes } = getAncestors(node.id)
  const companies = NODES.filter((n) => n.kind === 'company' && nodes.has(n.id))
  const exposedEAD = companies.reduce((s, c) => s + (c.eadCr ?? 0), 0)
  return (
    <div>
      <StatRow label="Borrowers linked" value={`${companies.length}`} />
      <StatRow label="Total linked EAD" value={`₹${exposedEAD.toFixed(0)} cr`} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {companies.map((c) => (
          <LinkChip key={c.id} node={c} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}
