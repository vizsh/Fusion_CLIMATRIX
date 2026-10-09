import { AlertTriangle, ExternalLink, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { searchNews, type NewsArticle } from '../lib/api'
import {
  DIRECTION_META,
  rankBySensitivity,
  type RealMarketEntity,
  type SensitivityResult,
} from '../lib/realMarketSensitivity'
import { useScenarioStore } from '../store/useScenarioStore'

export default function RealMarketSensitivityPage() {
  const severity = useScenarioStore((s) => s.severity)
  const setSeverity = useScenarioStore((s) => s.setSeverity)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const ranked = useMemo(() => rankBySensitivity(severity), [severity])
  const selected = ranked.find((r) => r.entity.id === selectedId) ?? null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="REAL MARKET CLIMATE SENSITIVITY"
        subtitle="REAL LISTED COMPANIES · ILLUSTRATIVE SENSITIVITY FRAMEWORK"
        tag={`SEVERITY ${severity}/100`}
      />

      <div className="bg-grid p-6">
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-risk-med/30 bg-risk-med/[0.06] p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-risk-med" />
          <p className="text-[11px] leading-relaxed text-slate-400">
            Every name and sector below is a <span className="text-slate-200">real, publicly listed Indian company</span> —
            unlike the synthetic portfolio used everywhere else in this prototype. The sensitivity direction, multiplier,
            and worst-case/favorable narratives are this prototype's own <span className="text-risk-med">disclosed
            illustrative framework</span>, reusing the same sector-vulnerability mechanic as the synthetic portfolio — they
            are <span className="text-slate-200">not</span> a sourced ESG rating, a credit rating, or investment advice.
            No real financial-loss figure is computed for any of these companies (that would need real facility-level
            data this prototype doesn't have) — only a comparative 0-100 index.
          </p>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-wide text-slate-500">SCENARIO SEVERITY</span>
          <input
            type="range"
            min={0}
            max={100}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="h-1.5 w-48 accent-cyan"
          />
          <span className="font-mono-tnum text-[12px] text-cyan">{severity}/100</span>
          <span className="text-[10px] text-slate-600">— the same dial used everywhere else in this app</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div className="space-y-2">
            <div className="mb-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">
              RANKED BY SENSITIVITY INDEX — CLICK TO INSPECT
            </div>
            {ranked.map((r) => (
              <SensitivityRow key={r.entity.id} result={r} active={r.entity.id === selectedId} onClick={() => setSelectedId(r.entity.id)} />
            ))}
          </div>

          <div>
            {selected ? (
              <EntityDetail result={selected} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-line bg-panel-2 p-8 text-center">
                <p className="max-w-sm text-[11px] leading-relaxed text-slate-500">
                  <Sparkles size={16} className="mx-auto mb-2 text-cyan" />
                  Click any company on the left for its full sensitivity profile — worst-case and favorable scenarios,
                  and a live real-news search for current context.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SensitivityRow({ result, active, onClick }: { result: SensitivityResult; active: boolean; onClick: () => void }) {
  const meta = DIRECTION_META[result.entity.direction]
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-lg border p-2.5 text-left transition-colors ${
        active ? 'border-cyan/50 bg-cyan/10' : 'border-line bg-panel-2 hover:border-slate-600'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-slate-200">{result.entity.name}</span>
        <span
          className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] tracking-wide"
          style={{ borderColor: meta.color, color: meta.color }}
        >
          {meta.label.toUpperCase()}
        </span>
      </div>
      <div className="flex items-center justify-between text-[9.5px] text-slate-500">
        <span className="truncate">
          {result.entity.nseSymbol} · {result.entity.sector}
        </span>
        <span className="font-mono-tnum shrink-0 text-slate-300">{result.sensitivityIndex}</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line-soft">
        <div className="h-full rounded-full" style={{ width: `${result.sensitivityIndex}%`, background: meta.color }} />
      </div>
    </button>
  )
}

function EntityDetail({ result }: { result: SensitivityResult }) {
  const { entity, sensitivityIndex } = result
  const meta = DIRECTION_META[entity.direction]
  const [news, setNews] = useState<NewsArticle[] | null>(null)
  const [newsState, setNewsState] = useState<'idle' | 'loading' | 'error'>('idle')

  async function fetchNews() {
    setNewsState('loading')
    try {
      const res = await searchNews(entity.name)
      setNews(res.articles)
      setNewsState('idle')
    } catch {
      setNewsState('error')
      setNews(null)
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel-2 p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-white">{entity.name}</h2>
        <span className="shrink-0 rounded border px-2 py-0.5 font-mono text-[9.5px] tracking-wide" style={{ borderColor: meta.color, color: meta.color }}>
          {meta.label.toUpperCase()}
        </span>
      </div>
      <div className="mb-3 text-[11px] text-slate-500">
        NSE: {entity.nseSymbol} · {entity.sector}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <div className="rounded border border-line bg-panel p-2.5">
          <div className="font-mono text-[9px] tracking-wide text-slate-500">SENSITIVITY INDEX (CURRENT SCENARIO)</div>
          <div className="mt-1 font-mono-tnum text-xl font-semibold" style={{ color: meta.color }}>
            {sensitivityIndex}/100
          </div>
        </div>
        <div className="rounded border border-line bg-panel p-2.5">
          <div className="font-mono text-[9px] tracking-wide text-slate-500">VULNERABILITY MULTIPLIER</div>
          <div className="mt-1 font-mono-tnum text-xl font-semibold text-slate-300">×{entity.vulnerabilityMultiplier.toFixed(2)}</div>
        </div>
      </div>

      <p className="mb-1 font-mono text-[9.5px] tracking-wide text-risk-high">WORST-CASE SCENARIO</p>
      <p className="mb-3 text-[11.5px] leading-relaxed text-slate-400">{entity.worstCase}</p>

      <p className="mb-1 font-mono text-[9.5px] tracking-wide text-risk-low">HOW IT COULD FAVOR THEM</p>
      <p className="mb-4 text-[11.5px] leading-relaxed text-slate-400">{entity.favorable}</p>

      <div className="rounded border border-line bg-panel p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[9.5px] tracking-wide text-slate-500">
            <Search size={11} className="mr-1 inline text-cyan" /> REAL NEWS SEARCH
          </span>
          <button
            onClick={fetchNews}
            disabled={newsState === 'loading'}
            className="rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[9.5px] text-cyan hover:bg-cyan/20 disabled:opacity-50"
          >
            {newsState === 'loading' ? 'SEARCHING…' : 'SEARCH LIVE NEWS'}
          </button>
        </div>
        {newsState === 'error' && (
          <p className="text-[10.5px] text-risk-high">
            Backend not reachable — make sure the FastAPI server is running (see backend/README.md).
          </p>
        )}
        {news && (
          <div className="space-y-1.5">
            {news.length === 0 && <p className="text-[10.5px] text-slate-600">No recent articles found for this query.</p>}
            {news.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="block rounded border border-line bg-panel-2 px-2 py-1.5 hover:border-cyan/40">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] text-slate-300">{a.title}</span>
                  <ExternalLink size={10} className="mt-0.5 shrink-0 text-slate-600" />
                </div>
                <div className="mt-0.5 text-[9.5px] text-slate-500">{a.source_name}</div>
              </a>
            ))}
          </div>
        )}
        {!news && newsState === 'idle' && (
          <p className="text-[10.5px] text-slate-600">Pulls real, live articles via the backend's NewsAPI/GNews connector — not a synthetic result.</p>
        )}
      </div>
    </div>
  )
}
