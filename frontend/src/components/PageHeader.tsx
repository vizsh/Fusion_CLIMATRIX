interface PageHeaderProps {
  title: string
  subtitle: string
  tag?: string
}

export default function PageHeader({ title, subtitle, tag }: PageHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel/80 px-5 backdrop-blur">
      <div className="leading-tight">
        <div className="font-mono text-[13px] font-semibold tracking-[0.12em] text-white">
          {title}
        </div>
        <div className="font-mono text-[9px] tracking-[0.18em] text-slate-500">{subtitle}</div>
      </div>
      {tag && (
        <div className="hidden font-mono text-[11px] tracking-wide text-slate-400 md:block">{tag}</div>
      )}
    </header>
  )
}
