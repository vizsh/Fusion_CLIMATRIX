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
  return request<{ configured: boolean }>('/api/copilot/status', undefined, 4000)
}

// Deliberately untyped pass-through — this mirrors Anthropic's Messages
// API request/response shape exactly (see backend/app/api/copilot.py),
// and copilot/llmClient.ts owns interpreting the content blocks.
export function postCopilotChat(body: { system: string; messages: unknown[]; tools?: unknown[]; max_tokens?: number }) {
  return request<any>('/api/copilot/chat', { method: 'POST', body: JSON.stringify(body) }, 45000)
}
