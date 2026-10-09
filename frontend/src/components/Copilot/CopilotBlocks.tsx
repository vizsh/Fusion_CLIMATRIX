// Renders CopilotBlock[] as rich, typed UI — not a markdown dump. Every
// number-bearing block carries an evidence-class dot using the exact same
// vocabulary/colors as the rest of the app (lib/evidence.ts), so the
// chatbot's output looks and reads like it belongs to CLIMATRIX, not a
// generic chat widget pasted on top.

import { EVIDENCE_META, type EvidenceClass } from '../../lib/evidence'
import type { CopilotAction, CopilotBlock } from '../../lib/copilot/types'

function EvidenceDot({ cls }: { cls?: EvidenceClass }) {
  if (!cls) return null
  const meta = EVIDENCE_META[cls]
  return (
    <span
      title={`${meta.label}: ${meta.desc}`}
      className="ml-1.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-[1px] font-mono text-[8.5px] tracking-wide"
      style={{ borderColor: `${meta.color}55`, color: meta.color }}
    >
      <span className="h-1 w-1 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export function CopilotBlockView({
  block,
  onAction,
  onSuggest,
}: {
  block: CopilotBlock
  onAction: (a: CopilotAction) => void
  onSuggest?: (text: string) => void
}) {
  switch (block.kind) {
    case 'text':
      return <p className="text-[12.5px] leading-relaxed text-slate-300">{block.text}</p>

    case 'heading':
      return <h4 className="font-mono text-[11px] font-semibold tracking-wide text-cyan">{block.text}</h4>

    case 'bullets':
      return (
        <ul className="space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-slate-300">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-cyan/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )

    case 'stat':
      return (
        <div className="rounded border border-line bg-panel-2/60 px-2.5 py-2">
          <div className="flex items-center font-mono text-[9px] uppercase tracking-wide text-slate-500">
            {block.label}
            <EvidenceDot cls={block.evidence} />
          </div>
          <div className="font-mono text-[15px] font-semibold text-white">{block.value}</div>
          {block.sub && <div className="text-[10px] text-slate-500">{block.sub}</div>}
        </div>
      )

    case 'statRow':
      return (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {block.stats.map((s, i) => (
            <div key={i} className="rounded border border-line bg-panel-2/60 px-2 py-1.5">
              <div className="flex items-center font-mono text-[8.5px] uppercase tracking-wide text-slate-500">
                {s.label}
                <EvidenceDot cls={s.evidence} />
              </div>
              <div className="font-mono text-[13px] font-semibold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      )

    case 'rankedList':
      return (
        <div className="overflow-hidden rounded border border-line">
          <div className="border-b border-line bg-panel-2/80 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-wide text-slate-400">
            {block.title}
          </div>
          <div className="divide-y divide-line">
            {block.rows.map((row) => (
              <div key={row.rank} className="flex items-start gap-2 px-2.5 py-1.5">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan/10 font-mono text-[9px] text-cyan">
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-slate-200">{row.label}</span>
                    <span className="flex items-center font-mono text-[12px] font-semibold text-white">
                      {row.value}
                      <EvidenceDot cls={row.evidence} />
                    </span>
                  </div>
                  <div className="text-[10px] leading-snug text-slate-500">{row.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-line bg-panel-2/80">
                {block.headers.map((h) => (
                  <th key={h} className="px-2.5 py-1.5 text-left font-mono text-[9px] uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={`px-2.5 py-1.5 ${j === 0 ? 'text-slate-300' : 'font-mono text-slate-200'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'actions':
      return (
        <div className="flex flex-wrap gap-1.5">
          {block.actions.map((a) => (
            <button
              key={a.id}
              onClick={() => onAction(a)}
              className="rounded border border-cyan/35 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-cyan transition-colors hover:bg-cyan/20"
            >
              {a.label}
            </button>
          ))}
        </div>
      )

    case 'suggestions':
      return (
        <div className="flex flex-wrap gap-1.5 border-t border-line/60 pt-2">
          {block.prompts.map((p, i) => (
            <button
              key={i}
              onClick={() => onSuggest?.(p)}
              className="rounded-full border border-line bg-panel/60 px-2.5 py-1 font-mono text-[9.5px] leading-tight text-slate-400 transition-colors hover:border-cyan/30 hover:text-cyan"
            >
              {p}
            </button>
          ))}
        </div>
      )

    default:
      return null
  }
}
