import httpx
import pytest

from app.connectors.alpha_ai import AlphaAiConnector
from app.connectors.base import ConnectorStatus
from app.connectors.news import NewsConnector
from app.connectors.osm_overpass import OverpassConnector
from app.connectors.tomorrow_io import TomorrowIoConnector


@pytest.mark.asyncio
async def test_tomorrow_io_reports_unconfigured_not_fake_success(monkeypatch):
    monkeypatch.setattr("app.connectors.tomorrow_io.settings.tomorrow_io_api_key", "")
    result = await TomorrowIoConnector().fetch(lat=0, lng=0)
    assert result.status == ConnectorStatus.UNCONFIGURED
    assert result.data is None


@pytest.mark.asyncio
async def test_alphai_reports_unconfigured_not_fake_success(monkeypatch):
    monkeypatch.setattr("app.connectors.alpha_ai.settings.alphai_api_key", "")
    result = await AlphaAiConnector().search_news(query="test")
    assert result.status == ConnectorStatus.UNCONFIGURED
    assert result.data is None


@pytest.mark.asyncio
async def test_news_connector_reports_error_when_both_providers_unconfigured(monkeypatch):
    monkeypatch.setattr("app.connectors.news.settings.newsapi_key", "")
    monkeypatch.setattr("app.connectors.news.settings.gnews_api_key", "")
    result = await NewsConnector().fetch(query="test")
    # Neither provider configured -> both legs report UNCONFIGURED -> the
    # combined fetch() surfaces that as an ERROR with both messages, never
    # a silent empty "success".
    assert result.status == ConnectorStatus.ERROR
    assert result.data is None
    assert "NEWSAPI_KEY" in result.message
    assert "GNEWS_API_KEY" in result.message


@pytest.mark.asyncio
async def test_overpass_reports_error_not_fake_success_on_timeout(monkeypatch):
    # Overpass is a shared public instance with no SLA — some environments
    # (including this project's own dev sandbox) get blocked/rate-limited at
    # the network level. The connector must report that honestly as ERROR,
    # never as an empty OK.
    class _RaisingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **kw):
            raise httpx.TimeoutException("simulated timeout")

    monkeypatch.setattr("app.connectors.osm_overpass.httpx.AsyncClient", lambda **kw: _RaisingClient())
    result = await OverpassConnector().fetch(lat_min=31.9, lng_min=77.05, lat_max=32.0, lng_max=77.15)
    assert result.status == ConnectorStatus.ERROR
    assert result.data is None


@pytest.mark.asyncio
async def test_overpass_parses_real_response_shape():
    # Shape captured from a verified-live Overpass response (way with
    # geometry + tags) — guards against silently breaking the parser.
    sample = {
        "elements": [
            {
                "type": "way",
                "id": 123,
                "tags": {"highway": "trunk", "name": "NH-5"},
                "geometry": [{"lat": 31.98, "lon": 77.15}, {"lat": 31.99, "lon": 77.16}],
            },
            {"type": "node", "id": 456},  # non-way elements must be skipped, not crash the parser
        ]
    }

    class _FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return sample

    class _FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **kw):
            return _FakeResponse()

    import app.connectors.osm_overpass as osm_mod

    original_client = osm_mod.httpx.AsyncClient
    osm_mod.httpx.AsyncClient = lambda **kw: _FakeClient()
    try:
        result = await OverpassConnector().fetch(lat_min=31.9, lng_min=77.05, lat_max=32.0, lng_max=77.15)
    finally:
        osm_mod.httpx.AsyncClient = original_client

    assert result.status == ConnectorStatus.OK
    assert len(result.data) == 1
    assert result.data[0]["highway"] == "trunk"
    assert result.data[0]["geometry"] == [[31.98, 77.15], [31.99, 77.16]]
