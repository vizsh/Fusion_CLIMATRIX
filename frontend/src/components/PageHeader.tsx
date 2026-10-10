import type { ReactNode } from 'react'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

interface PageHeaderProps {
  title: string
  subtitle?: string
  tag?: string
  actions?: ReactNode
  showScenarioSync?: boolean
}

export default function PageHeader({
  title,
  subtitle,
  tag,
  actions,
  showScenarioSync = true,
}: PageHeaderProps) {
  const region = useScenarioStore((s) => s.region)
  const hazard = useScenarioStore((s) => s.hazard)
  const severity = useScenarioStore((s) => s.severity)
  const durationMonths = useScenarioStore((s) => s.durationMonths)

  return (
    <header className="flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-bg-secondary/70 px-4 sm:px-6 py-2.5 backdrop-blur-sm z-10">
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2.5">
          <h1 className="font-mono text-[16px] sm:text-[18px] font-bold tracking-[0.1em] text-text-primary leading-tight">
            {title}
          </h1>
          {tag && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[9.5px] font-mono tracking-wider uppercase border border-border-subtle bg-bg-card text-text-muted">
              {tag}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="font-mono text-[10.5px] tracking-[0.12em] text-text-muted mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {showScenarioSync && (
          <div className="hidden sm:flex items-center gap-2 rounded border border-border-subtle bg-bg-card/80 px-2.5 py-1 font-mono text-[10px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
            <span className="text-text-muted">{REGION_LABEL[region]}</span>
            <span className="text-border-subtle">·</span>
            <span className="text-text-primary font-medium">{hazard} ({severity}%)</span>
            <span className="text-border-subtle">·</span>
            <span className="text-text-muted">{durationMonths}M</span>
          </div>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
