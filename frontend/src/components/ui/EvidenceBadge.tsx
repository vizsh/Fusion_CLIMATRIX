import { Database, Cpu, HelpCircle, FlaskConical } from 'lucide-react'
import type { EvidenceClass } from '../../lib/evidence'
import { EVIDENCE_META } from '../../lib/evidence'

interface EvidenceBadgeProps {
  type: EvidenceClass
  size?: 'sm' | 'md'
  showTooltip?: boolean
  className?: string
}

const ICON_MAP = {
  sourced: Database,
  modelled: Cpu,
  assumption: HelpCircle,
  synthetic: FlaskConical,
}

export default function EvidenceBadge({
  type,
  size = 'sm',
  showTooltip = true,
  className = '',
}: EvidenceBadgeProps) {
  const meta = EVIDENCE_META[type] || EVIDENCE_META.synthetic
  const Icon = ICON_MAP[type] || FlaskConical

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[9.5px] gap-1'
      : 'px-2.5 py-1 text-[11px] gap-1.5'

  return (
    <span
      title={showTooltip ? `${meta.label}: ${meta.desc}` : undefined}
      className={`inline-flex items-center font-mono font-medium uppercase tracking-[0.08em] rounded border transition-colors select-none ${sizeClasses} ${className}`}
      style={{
        color: meta.color,
        borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} className="shrink-0" />
      <span>{meta.label}</span>
    </span>
  )
}
