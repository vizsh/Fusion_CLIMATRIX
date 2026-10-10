// Thin typed client for the CLIMATRIX backend (backend/, FastAPI). The rest
// of the app still runs on the bundled indiaGraphData.ts for the
// interactive demo — this client is the one proven integration point
// showing the backend is real and callable, not a parallel data source the
// UI silently depends on. See docs/IMPLEMENTATION_AUDIT.md.

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(body?.detail ?? `Request failed (${res.status})`, res.status)
    }
    return (await res.json()) as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('Backend did not respond in time — is it running? (see backend/README.md)')
    }
    throw new ApiError('Could not reach the CLIMATRIX backend — is it running on ' + API_BASE + '?')
  } finally {
    clearTimeout(timer)
  }
}

export interface WeatherObservation {
  id: string
  lat: number
  lng: number
  date: string
  precipitation_mm: number | null
  temp_c_avg: number | null
  source: string
  retrieved_at: string
}

export interface WeatherQueryResult {
  observations: WeatherObservation[]
  source: string
  source_url: string
  retrieved_at: string
  cached: boolean
  evidence_class: string
}

export function queryWeather(lat: number, lng: number, start: string, end: string) {
  return request<WeatherQueryResult>('/api/weather/query', {
    method: 'POST',
    body: JSON.stringify({ lat, lng, start, end }),
  })
}

export interface CurrentConditions {
  observed_at: string
  temperature_c: number | null
  temperature_apparent_c: number | null
  humidity_pct: number | null
  precipitation_probability_pct: number | null
  rain_intensity_mm_hr: number | null
  wind_speed_m_s: number | null
  wind_gust_m_s: number | null
  visibility_km: number | null
  weather_code: number | null
  source: string
  source_url: string
  evidence_class: string
}

export function getCurrentConditions(lat: number, lng: number) {
  return request<CurrentConditions>(`/api/weather/current?lat=${lat}&lng=${lng}`)
}

export interface FloodDay {
  date: string
  river_discharge_m3s: number | null
}

export interface FloodResult {
  days: FloodDay[]
  source: string
  source_url: string
  note: string
  evidence_class: string
}

export function getFloodDischarge(lat: number, lng: number, pastDays = 7, forecastDays = 5) {
  return request<FloodResult>(`/api/weather/flood?lat=${lat}&lng=${lng}&past_days=${pastDays}&forecast_days=${forecastDays}`)
}

export interface NewsArticle {
  id: string
  title: string
  description: string
  url: string
  source_name: string
  published_at: string
  provider: string
  relevance: number | null
  category: string | null
}

export interface NewsResult {
  articles: NewsArticle[]
  provider: string
  query: string
  retrieved_at: string
  evidence_class: string
}

export function searchNews(q: string) {
  return request<NewsResult>(`/api/news/search?q=${encodeURIComponent(q)}`)
}

export interface ExtractedArticle {
  title: string
  text: string
  excerpt: string
  url: string
  char_count: number
  evidence_class: string
}

/** Server-side fetch + readable-text extraction for a news URL the user
 * pastes into the Copilot — a browser fetch() of an arbitrary external
 * news site is blocked by CORS almost everywhere, so this has to go
 * through the backend (`app/connectors/article_extractor.py`). */
export function extractArticle(url: string) {
  return request<ExtractedArticle>('/api/news/extract', { method: 'POST', body: JSON.stringify({ url }) })
}

export function searchMarketNews(q: string, minRelevance = 1) {
  return request<NewsResult>(`/api/news/market?q=${encodeURIComponent(q)}&min_relevance=${minRelevance}`)
}

export interface InsiderSummary {
  ticker: string
  raw: Record<string, unknown>
  source: string
  note: string
}

export function getInsiderSummary(ticker: string) {
  return request<InsiderSummary>(`/api/market/insider/${encodeURIComponent(ticker)}`)
}

export interface PortfolioSummary {
  id: string
  name: string
  mandate: string
  position_count: number
  total_cost_basis_cr: number
  total_market_value_cr: number
}

export function listPortfolios() {
  return request<PortfolioSummary[]>('/api/portfolios')
}

export interface OsmWay {
  id: string
  highway: string | null
  bridge: boolean
  name: string
  geometry: [number, number][] // [lat, lng] pairs, way centerline
}

export interface OsmInfraResult {
  ways: OsmWay[]
  source: string
  cached: boolean
  evidence_class: string
}

export function getOsmInfrastructure(latMin: number, lngMin: number, latMax: number, lngMax: number) {
  return request<OsmInfraResult>(
    `/api/infra/osm?lat_min=${latMin}&lng_min=${lngMin}&lat_max=${latMax}&lng_max=${lngMax}`,
    undefined,
    25000, // Overpass can be slow on a cold cache — longer timeout than other endpoints
  )
}

export function checkHealth() {
  return request<{ status: string; service: string }>('/api/health', undefined, 4000)
}

export function getCopilotStatus() {
  return request<{ available: boolean; model: string | null; models: string[] }>('/api/copilot/status', undefined, 5000)
}

// Deliberately untyped pass-through — this mirrors Ollama's /api/chat
// request/response shape (see backend/app/api/copilot.py), and
// copilot/ollamaClient.ts owns interpreting the message content. 90s
// timeout to tolerate a cold local model load on a CPU-only machine.
export function postCopilotClassify(body: { model: string; prompt: string; schema: unknown; max_tokens?: number }) {
  return request<any>('/api/copilot/classify', { method: 'POST', body: JSON.stringify(body) }, 90000)
}

// --- Backend bridge for the Copilot — these two make the Copilot actually
// use the backend's ML/NLP layer instead of staying 100% frontend-only. ---

export interface SemanticSearchHit {
  id: string
  kind: string
  title: string
  score: number
}

export interface SemanticSearchResult {
  query: string
  hits: SemanticSearchHit[]
  method: string
  evidence_class: string
}

export function semanticSearch(q: string, kind: 'news' | 'evidence' | 'all' = 'all', topK = 5) {
  return request<SemanticSearchResult>(
    `/api/search/semantic?q=${encodeURIComponent(q)}&kind=${kind}&top_k=${topK}`,
    undefined,
    10000,
  )
}

export interface AnomalyPoint {
  date: string
  value: number
  baseline_mean: number
  baseline_std: number
  z_score: number
  isolation_forest_score: number
  is_anomaly: boolean
  method_agreement: boolean
}

export interface WeatherAnomalyResult {
  lat: number
  lng: number
  points: AnomalyPoint[]
  anomaly_count: number
  method_note: string
}

export function getWeatherAnomalies(lat: number, lng: number, days = 60) {
  return request<WeatherAnomalyResult>(
    `/api/weather/anomalies?lat=${lat}&lng=${lng}&days=${days}`,
    undefined,
    25000, // cold-cache NASA POWER fetch + ML scoring can take a few seconds
  )
}

// --- Governed assumption queue (Griid-pattern proposed updates) ---------
export interface ProposedUpdate {
  id: string
  kind: 'sector_vulnerability' | 'transition_sensitivity' | 'scenario_archetype' | 'other'
  target: string
  current_value: string
  proposed_value: string
  rationale: string
  proposed_by: string
  status: 'pending' | 'approved' | 'rejected'
  reviewer: string
  review_note: string
  created_at: string
  reviewed_at: string | null
}

export function listProposals(status?: string) {
  return request<ProposedUpdate[]>(`/api/proposals${status ? `?status=${status}` : ''}`)
}

export function createProposal(body: {
  kind: ProposedUpdate['kind']
  target: string
  current_value?: string
  proposed_value: string
  rationale: string
  proposed_by?: string
}) {
  return request<ProposedUpdate>('/api/proposals', { method: 'POST', body: JSON.stringify(body) })
}

export function reviewProposal(id: string, action: 'approve' | 'reject', reviewer: string, reviewNote?: string) {
  return request<ProposedUpdate>(`/api/proposals/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ reviewer, review_note: reviewNote ?? '' }),
  })
}
