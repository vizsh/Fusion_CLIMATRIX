import type { ReactNode } from 'react'
import type { EvidenceClass } from '../../lib/evidence'
import EvidenceBadge from './EvidenceBadge'

interface KpiCardProps {
  label: string
  value: string | number
  unit?: string
  comparison?: string
  comparisonTone?: 'coral' | 'amber' | 'teal' | 'neutral'
  evidence?: EvidenceClass
  icon?: ReactNode
  subtitle?: string
  className?: string
}

export default function KpiCard({
  label,
  value,
  unit,
  comparison,
  comparisonTone = 'neutral',
  evidence,
  icon,
  subtitle,
  className = '',
}: KpiCardProps) {
  const compToneClasses = {
    coral: 'text-critical-coral bg-critical-coral/10 border-critical-coral/30',
    amber: 'text-warning-amber bg-warning-amber/10 border-warning-amber/30',
    teal: 'text-accent-teal bg-accent-teal/10 border-accent-teal/30',
    neutral: 'text-text-muted bg-surface/50 border-border-subtle',
  }[comparisonTone]

  return (
    <div
      className={`flex flex-col justify-between p-4 rounded-lg border border-border-subtle bg-bg-card hover:border-text-muted/40 transition-colors shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {evidence && <EvidenceBadge type={evidence} size="sm" />}
          {icon && <div className="text-text-muted/70">{icon}</div>}
        </div>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] sm:text-[28px] font-bold tracking-tight text-text-primary tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[12px] font-medium text-text-muted">
            {unit}
          </span>
        )}
      </div>

      {(comparison || subtitle) && (
        <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/50 text-[11px]">
          {comparison && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-medium border ${compToneClasses}`}
            >
              {comparison}
            </span>
          )}
          {subtitle && (
            <span className="text-text-muted text-[10.5px] truncate ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
