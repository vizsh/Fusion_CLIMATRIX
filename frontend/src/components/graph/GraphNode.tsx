import { Handle, Position, type NodeProps } from '@xyflow/react'
import { KIND_META, type GNode } from '../../lib/indiaGraphData'

export interface GraphNodeData {
  gnode: GNode
  dimmed?: boolean
  active?: boolean
  selected?: boolean
  /** Live stressed EL for this company under the CURRENT scenario, computed
   * by the page and passed in — shown directly on canvas so the graph
   * demonstrates the real calculation, not just highlighting. */
  stressedElCr?: number
  [key: string]: unknown
}

export default function GraphNode({ data }: NodeProps) {
  const { gnode, dimmed, active, selected, stressedElCr } = data as GraphNodeData
  const meta = KIND_META[gnode.kind]

  return (
    <div
      className="rounded-md border px-2.5 py-1.5 transition-all duration-200"
      style={{
        width: 192,
        borderColor: selected ? meta.color : active ? `${meta.color}99` : '#1c2430',
        background: selected ? `${meta.color}22` : active ? `${meta.color}0f` : '#0b0e14',
        opacity: dimmed ? 0.22 : 1,
        boxShadow: selected ? `0 0 16px ${meta.color}66` : 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle(meta.color)} />
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
        <span className="truncate font-mono text-[8px] tracking-wide text-slate-500">
          {meta.label.toUpperCase()}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] font-medium leading-tight text-slate-200">
        {gnode.label}
      </div>
      {(gnode.sector || gnode.eadCr) && (
        <div className="mt-0.5 flex items-center justify-between text-[9px] text-slate-500">
          <span className="truncate">{gnode.sector}</span>
          {gnode.eadCr != null && (
            <span className="font-mono-tnum shrink-0 text-slate-400">₹{gnode.eadCr}cr</span>
          )}
        </div>
      )}
      {stressedElCr != null && (
        <div className="mt-1 flex items-center justify-between rounded border border-risk-high/30 bg-risk-high/[0.08] px-1 py-0.5 text-[8.5px]">
          <span className="text-risk-high/80">STRESSED EL</span>
          <span className="font-mono-tnum text-risk-high">₹{stressedElCr.toFixed(1)}cr</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={handleStyle(meta.color)} />
    </div>
  )
}

function handleStyle(color: string) {
  return { background: color, width: 6, height: 6, border: 'none', opacity: 0.8 }
}
