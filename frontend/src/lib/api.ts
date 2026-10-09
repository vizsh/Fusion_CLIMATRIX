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

export function checkHealth() {
  return request<{ status: string; service: string }>('/api/health', undefined, 4000)
}
