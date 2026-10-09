"""Tomorrow.io — current conditions and short-term forecast.
https://docs.tomorrow.io/reference/weather-forecast
https://docs.tomorrow.io/reference/realtime-weather

Distinct role from NASA POWER/Open-Meteo (both historical): this is "what's
happening right now / in the next few days" at a hazard's coordinates — the
'observation vs forecast' distinction the product's evidence model asks for.
Free-tier rate limits apply; a 429/401 is reported honestly, not retried
silently into a fabricated response.
"""

import httpx

from app.config import settings
from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector


class TomorrowIoConnector(DataConnector):
    name = "Tomorrow.io"
    evidence_class = "sourced"

    def _configured(self) -> bool:
        return bool(settings.tomorrow_io_api_key)

    async def fetch(self, lat: float, lng: float) -> ConnectorResult:
        if not self._configured():
            return ConnectorResult(ConnectorStatus.UNCONFIGURED, None, "TOMORROW_IO_API_KEY is not set.")

        url = f"{settings.tomorrow_io_base_url}/weather/realtime"
        params = {"location": f"{lat},{lng}", "apikey": settings.tomorrow_io_api_key}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 429:
                    return ConnectorResult(ConnectorStatus.ERROR, None, "Tomorrow.io rate limit reached — try again shortly.")
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "Tomorrow.io request timed out.")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Tomorrow.io request failed: {e}")

        try:
            values = payload["data"]["values"]
            observed_time = payload["data"]["time"]
        except (KeyError, TypeError):
            return ConnectorResult(ConnectorStatus.ERROR, None, "Tomorrow.io response shape was unexpected.")

        row = {
            "observed_at": observed_time,
            "temperature_c": values.get("temperature"),
            "temperature_apparent_c": values.get("temperatureApparent"),
            "humidity_pct": values.get("humidity"),
            "precipitation_probability_pct": values.get("precipitationProbability"),
            "rain_intensity_mm_hr": values.get("rainIntensity"),
            "wind_speed_m_s": values.get("windSpeed"),
            "wind_gust_m_s": values.get("windGust"),
            "visibility_km": values.get("visibility"),
            "weather_code": values.get("weatherCode"),
        }
        # Never echo the API key back to the client — report the endpoint
        # path only, not the signed request URL.
        safe_url = f"{url}?location={lat},{lng}"
        return ConnectorResult(ConnectorStatus.OK, [row], "Fetched current conditions from Tomorrow.io.", source_url=safe_url)
