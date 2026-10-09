import pytest

from app.connectors.alpha_ai import AlphaAiConnector
from app.connectors.base import ConnectorStatus
from app.connectors.news import NewsConnector
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
