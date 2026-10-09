import { ExternalLink, Newspaper, RefreshCw, Search, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { ApiError, getInsiderSummary, searchMarketNews, searchNews, type InsiderSummary, type NewsArticle } from '../lib/api'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

type Source = 'news' | 'market'
type FetchState = 'idle' | 'loading' | 'error' | 'done'

export default function LiveNewsPanel() {
  const region = useScenarioStore((s) => s.region)
  const hazard = useScenarioStore((s) => s.hazard)
  const [source, setSource] = useState<Source>('news')
  const [state, setState] = useState<FetchState>('idle')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [provider, setProvider] = useState('')
  const [error, setError] = useState('')
  const [ticker, setTicker] = useState('')
  const [insider, setInsider] = useState<InsiderSummary | null>(null)
  const [insiderState, setInsiderState] = useState<FetchState>('idle')

  const query = `${REGION_LABEL[region]} ${hazard}`

  async function run(src: Source) {
    setSource(src)
    setState('loading')
    setError('')
    try {
      const res = src === 'news' ? await searchNews(query) : await searchMarketNews(query)
      setArticles(res.articles)
      setProvider(res.provider)
      setState('done')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unknown error')
      setState('error')
    }
  }

  async function lookupInsider() {
    if (!ticker.trim()) return
    setInsiderState('loading')
    try {
      const res = await getInsiderSummary(ticker.trim())
      setInsider(res)
      setInsiderState('done')
    } catch {
      setInsider(null)
      setInsiderState('error')
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel-2 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-cyan">
          {source === 'news' ? <Newspaper size={14} /> : <TrendingUp size={14} />}
          <span className="font-mono text-[11px] tracking-wide">
            {source === 'news' ? 'RECENT DEVELOPMENTS — NEWSAPI / GNEWS' : 'MARKET INTELLIGENCE — ALPHAAI'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => run('news')}
            className={`rounded border px-2 py-1 font-mono text-[9.5px] tracking-wide ${
              source === 'news' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-line text-slate-500 hover:text-slate-300'
            }`}
          >
            NEWS
          </button>
          <button
            onClick={() => run('market')}
            className={`rounded border px-2 py-1 font-mono text-[9.5px] tracking-wide ${
              source === 'market' ? 'border-cyan/40 bg-cyan/10 text-cyan' : 'border-line text-slate-500 hover:text-slate-300'
            }`}
          >
            MARKET INTEL
          </button>
          <button
            onClick={() => run(source)}
            disabled={state === 'loading'}
            className="flex items-center gap-1 rounded border border-line px-2 py-1 font-mono text-[9.5px] tracking-wide text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw size={10} className={state === 'loading' ? 'animate-spin' : ''} /> FETCH
          </button>
        </div>
      </div>

      <p className="mb-3 text-[10.5px] leading-relaxed text-slate-500">
        Query: <span className="text-slate-400">"{query}"</span> — real articles for the active
        scenario's region and hazard, not this prototype's fictional companies. Market Intel adds
        AlphaAI's per-article relevance score (1-10) and category.
      </p>

      {state === 'idle' && (
        <div className="rounded border border-line px-3 py-4 text-center text-[10.5px] text-slate-600">
          Not fetched yet. Requires the backend running locally.
        </div>
      )}
      {state === 'error' && (
        <div className="rounded border border-risk-high/40 bg-risk-high/[0.06] px-3 py-3 text-[11px] text-risk-high">{error}</div>
      )}
      {source === 'market' && (
        <div className="mb-3 rounded border border-line bg-panel px-2.5 py-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Search size={11} className="text-cyan" /> REFERENCE TICKER INSIDER SIGNAL (SEC FORM 4)
          </div>
          <div className="flex gap-1.5">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g. ROAD (Construction Partners)"
              className="flex-1 rounded border border-line bg-panel-2 px-2 py-1 text-[10.5px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
            />
            <button
              onClick={lookupInsider}
              className="rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[9.5px] text-cyan hover:bg-cyan/20"
            >
              LOOKUP
            </button>
          </div>
          <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-600">
            Real market data for a comparable listed company — not connected to any synthetic
            CLIMATRIX company, since none of our portfolio companies are real.
          </p>
          {insiderState === 'done' && insider && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10.5px]">
              <div>
                <div className="font-mono text-[9px] text-slate-500">TXNS (30D)</div>
                <div className="text-slate-300">{String(insider.raw.total_transactions ?? '—')}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-slate-500">BUYS</div>
                <div className="text-risk-low">{String(insider.raw.buy_count ?? '—')}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-slate-500">SELLS</div>
                <div className="text-risk-high">{String(insider.raw.sell_count ?? '—')}</div>
              </div>
            </div>
          )}
          {insiderState === 'error' && (
            <div className="mt-2 text-[10px] text-risk-high">No insider data found for that ticker.</div>
          )}
        </div>
      )}

      {state === 'done' && (
        <div className="space-y-2">
          <div className="text-[9.5px] text-slate-600">{articles.length} article(s) via {provider}</div>
          {articles.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded border border-line bg-panel px-2.5 py-2 hover:border-cyan/40"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11.5px] text-slate-200">{a.title}</span>
                <ExternalLink size={11} className="mt-0.5 shrink-0 text-slate-600" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[9.5px] text-slate-500">
                <span>{a.source_name}</span>
                <span>·</span>
                <span>{a.published_at ? new Date(a.published_at).toLocaleDateString() : ''}</span>
                {a.relevance != null && (
                  <span className="rounded border border-risk-med/40 px-1 text-risk-med">relevance {a.relevance}/10</span>
                )}
                {a.category && <span className="rounded border border-line px-1 text-slate-500">{a.category}</span>}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
