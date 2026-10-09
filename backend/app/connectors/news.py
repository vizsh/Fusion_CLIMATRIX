"""General news — NewsAPI primary, GNews fallback.
https://newsapi.org/docs/endpoints/everything
https://gnews.io/docs/v4

Two independent providers behind one interface is the actual point here —
if NewsAPI's free-tier quota is exhausted or it errors, GNews is tried
before giving up, and the response says which provider actually answered.
Neither key is ever sent to the frontend; both calls happen server-side.
"""

import httpx

from app.config import settings
from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector


class NewsConnector(DataConnector):
    name = "News (NewsAPI / GNews)"
    evidence_class = "sourced"

    async def fetch(self, query: str, page_size: int = 8) -> ConnectorResult:
        result = await self._try_newsapi(query, page_size)
        if result.status == ConnectorStatus.OK:
            return result
        fallback = await self._try_gnews(query, page_size)
        if fallback.status == ConnectorStatus.OK:
            return fallback
        return ConnectorResult(ConnectorStatus.ERROR, None, f"NewsAPI: {result.message} | GNews: {fallback.message}")

    async def _try_newsapi(self, query: str, page_size: int) -> ConnectorResult:
        if not settings.newsapi_key:
            return ConnectorResult(ConnectorStatus.UNCONFIGURED, None, "NEWSAPI_KEY not set")
        params = {"q": query, "sortBy": "publishedAt", "pageSize": page_size, "language": "en", "apiKey": settings.newsapi_key}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{settings.newsapi_base_url}/everything", params=params)
                if resp.status_code == 429:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "rate limited")
                resp.raise_for_status()
                payload = resp.json()
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, str(e))

        articles = payload.get("articles", [])
        rows = [
            {
                "title": a.get("title"),
                "description": a.get("description"),
                "url": a.get("url"),
                "source_name": (a.get("source") or {}).get("name"),
                "published_at": a.get("publishedAt"),
                "provider": "NewsAPI",
            }
            for a in articles
        ]
        safe_url = f"{settings.newsapi_base_url}/everything?q={query}&sortBy=publishedAt"
        return ConnectorResult(ConnectorStatus.OK, rows, f"Fetched {len(rows)} article(s) from NewsAPI.", source_url=safe_url)

    async def _try_gnews(self, query: str, page_size: int) -> ConnectorResult:
        if not settings.gnews_api_key:
            return ConnectorResult(ConnectorStatus.UNCONFIGURED, None, "GNEWS_API_KEY not set")
        params = {"q": query, "max": page_size, "lang": "en", "apikey": settings.gnews_api_key}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{settings.gnews_base_url}/search", params=params)
                if resp.status_code == 429:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "rate limited")
                resp.raise_for_status()
                payload = resp.json()
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, str(e))

        articles = payload.get("articles", [])
        rows = [
            {
                "title": a.get("title"),
                "description": a.get("description"),
                "url": a.get("url"),
                "source_name": (a.get("source") or {}).get("name"),
                "published_at": a.get("publishedAt"),
                "provider": "GNews",
            }
            for a in articles
        ]
        safe_url = f"{settings.gnews_base_url}/search?q={query}"
        return ConnectorResult(ConnectorStatus.OK, rows, f"Fetched {len(rows)} article(s) from GNews.", source_url=safe_url)
