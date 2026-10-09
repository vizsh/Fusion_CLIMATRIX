"""Open-Meteo — free, no-API-key historical weather and flood data.
https://open-meteo.com/en/docs/historical-weather-api
https://open-meteo.com/en/docs/flood-api

Two distinct real datasets:
- Archive API: ERA5/ERA5-Land reanalysis daily precipitation/temperature —
  a second historical source alongside NASA POWER, useful for cross-
  validating one reanalysis model against another rather than trusting a
  single source blindly.
- Flood API: GloFAS river discharge (m3/s), forecast + a short recent
  window — the first genuinely hydrological (not just meteorological)
  signal in this product, directly relevant to the HP flood scenario's
  Beas river corridor. Note: GloFAS discharge is forecast/near-term only in
  the free tier, not a multi-year historical archive — see the 'note' field
  returned to the frontend.
"""

import httpx

from app.config import settings
from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector


class OpenMeteoArchiveConnector(DataConnector):
    name = "Open-Meteo Historical Weather"
    evidence_class = "sourced"

    async def fetch(self, lat: float, lng: float, start: str, end: str) -> ConnectorResult:
        # Open-Meteo wants YYYY-MM-DD; the rest of this app uses YYYYMMDD
        # (NASA POWER's format) — normalize here so callers share one shape.
        start_d, end_d = f"{start[:4]}-{start[4:6]}-{start[6:]}", f"{end[:4]}-{end[4:6]}-{end[6:]}"
        params = {
            "latitude": lat,
            "longitude": lng,
            "start_date": start_d,
            "end_date": end_d,
            "daily": "precipitation_sum,temperature_2m_mean",
            "timezone": "UTC",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(settings.open_meteo_archive_url, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "Open-Meteo archive request timed out.")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Open-Meteo archive request failed: {e}")

        try:
            daily = payload["daily"]
            dates = daily["time"]
            precip = daily["precipitation_sum"]
            temp = daily["temperature_2m_mean"]
        except (KeyError, TypeError):
            return ConnectorResult(ConnectorStatus.ERROR, None, "Open-Meteo archive response shape was unexpected.")

        rows = [
            {"date": d.replace("-", ""), "precipitation_mm": precip[i], "temp_c_avg": temp[i]}
            for i, d in enumerate(dates)
        ]
        return ConnectorResult(ConnectorStatus.OK, rows, f"Fetched {len(rows)} day(s) from Open-Meteo archive.", source_url=str(resp.url))


class OpenMeteoFloodConnector(DataConnector):
    name = "Open-Meteo Flood (GloFAS)"
    evidence_class = "sourced"

    async def fetch(self, lat: float, lng: float, past_days: int = 7, forecast_days: int = 5) -> ConnectorResult:
        params = {
            "latitude": lat,
            "longitude": lng,
            "daily": "river_discharge",
            "past_days": past_days,
            "forecast_days": forecast_days,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(settings.open_meteo_flood_url, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "Open-Meteo flood request timed out.")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Open-Meteo flood request failed: {e}")

        try:
            daily = payload["daily"]
            dates = daily["time"]
            discharge = daily["river_discharge"]
        except (KeyError, TypeError):
            return ConnectorResult(ConnectorStatus.ERROR, None, "Open-Meteo flood response shape was unexpected (this point may not be on a modeled river reach).")

        rows = [{"date": d.replace("-", ""), "river_discharge_m3s": discharge[i]} for i, d in enumerate(dates)]
        return ConnectorResult(
            ConnectorStatus.OK,
            rows,
            f"Fetched {len(rows)} day(s) of river discharge from Open-Meteo/GloFAS (near-term window, not deep historical).",
            source_url=str(resp.url),
        )
