"""AlphaAI — financial news with per-article relevance scoring, and SEC
Form 4 insider-filing signals. https://alphai.io/developers

Two capabilities used here:
- News search: scoped to climate/region keywords (e.g. "India monsoon
  flood"), returns real articles with AlphaAI's own relevance score and
  category — distinct from the plain NewsConnector by that scoring.
- Insider summary: AlphaAI's ticker coverage is overwhelmingly US-listed,
  and this product's companies are synthetic — so this is exposed as an
  explicit "reference ticker" lookup (the caller supplies a real ticker of
  a comparable real company), never silently attached to a synthetic
  company record. See the 'reference' framing in app/api/market.py.
"""

import httpx

from app.config import settings
from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector


class AlphaAiConnector(DataConnector):
    name = "AlphaAI"
    evidence_class = "sourced"

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {settings.alphai_api_key}"}

    def _configured(self) -> bool:
        return bool(settings.alphai_api_key)

    async def fetch(self, **kwargs) -> ConnectorResult:
        """Satisfies the DataConnector interface by delegating to
        search_news — the two more specific methods below are what callers
        actually use."""
        return await self.search_news(**kwargs)

    async def search_news(self, query: str, min_relevance: int = 1, limit: int = 8) -> ConnectorResult:
        if not self._configured():
            return ConnectorResult(ConnectorStatus.UNCONFIGURED, None, "ALPHAI_API_KEY not set")
        params = {"q": query, "min_relevance": min_relevance}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{settings.alphai_base_url}/news/search/", params=params, headers=self._headers())
                if resp.status_code == 429:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "AlphaAI rate limit reached (100/day free tier) — try again later.")
                if resp.status_code == 401:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "AlphaAI rejected the API key (401).")
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "AlphaAI request timed out.")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"AlphaAI request failed: {e}")

        results = payload.get("results", [])[:limit]
        rows = []
        for r in results:
            original = r.get("original", {})
            enrichment = r.get("enrichment", {})
            rows.append(
                {
                    "title": original.get("title"),
                    "summary": original.get("summary"),
                    "url": original.get("url"),
                    "source_name": original.get("source_domain"),
                    "published_at": original.get("time_published"),
                    "relevance": enrichment.get("relevance_score"),
                    "category": enrichment.get("category"),
                    "provider": "AlphaAI",
                }
            )
        return ConnectorResult(ConnectorStatus.OK, rows, f"Fetched {len(rows)} article(s) from AlphaAI.", source_url=str(resp.url))

    async def ticker_insider_summary(self, ticker: str) -> ConnectorResult:
        if not self._configured():
            return ConnectorResult(ConnectorStatus.UNCONFIGURED, None, "ALPHAI_API_KEY not set")
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{settings.alphai_base_url}/symbols/{ticker.upper()}/insider-summary/", headers=self._headers())
                if resp.status_code == 404:
                    return ConnectorResult(ConnectorStatus.ERROR, None, f"AlphaAI has no insider data for ticker '{ticker}'.")
                if resp.status_code == 429:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "AlphaAI rate limit reached — try again later.")
                resp.raise_for_status()
                payload = resp.json()
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"AlphaAI request failed: {e}")

        return ConnectorResult(ConnectorStatus.OK, [payload], f"Fetched insider summary for {ticker.upper()} from AlphaAI.", source_url=str(resp.url))
