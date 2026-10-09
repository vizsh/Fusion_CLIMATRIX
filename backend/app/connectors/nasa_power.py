"""NASA POWER — free, no-API-key historical meteorological data.
https://power.larc.nasa.gov/docs/services/api/temporal/daily/

This is a genuinely live external call (not a mock): given a lat/lng and a
date range, it fetches real observed/reanalysis daily precipitation and
temperature. It is historical reanalysis data, not a live flood feed and
not a forecast — labeled 'sourced' evidence class, with the limitation
stated explicitly in the response the API returns to the frontend.
"""

import httpx

from app.config import settings
from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector

PARAMETERS = "PRECTOTCORR,T2M"  # precipitation (mm/day), mean air temp (C)


class NasaPowerConnector(DataConnector):
    name = "NASA POWER"
    evidence_class = "sourced"

    async def fetch(self, lat: float, lng: float, start: str, end: str) -> ConnectorResult:
        url = settings.nasa_power_base_url
        params = {
            "parameters": PARAMETERS,
            "community": "AG",
            "longitude": lng,
            "latitude": lat,
            "start": start,
            "end": end,
            "format": "JSON",
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "NASA POWER request timed out.")
        except httpx.HTTPStatusError as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"NASA POWER returned HTTP {e.response.status_code}.")
        except Exception as e:  # network error, DNS failure, etc. — report, don't fabricate
            return ConnectorResult(ConnectorStatus.ERROR, None, f"NASA POWER request failed: {e}")

        try:
            params_block = payload["properties"]["parameter"]
            precip = params_block.get("PRECTOTCORR", {})
            temp = params_block.get("T2M", {})
        except (KeyError, TypeError):
            return ConnectorResult(ConnectorStatus.ERROR, None, "NASA POWER response shape was unexpected.")

        dates = sorted(set(precip.keys()) | set(temp.keys()))
        rows = [
            {
                "date": d,
                "precipitation_mm": _clean(precip.get(d)),
                "temp_c_avg": _clean(temp.get(d)),
            }
            for d in dates
        ]
        return ConnectorResult(ConnectorStatus.OK, rows, f"Fetched {len(rows)} day(s) from NASA POWER.", source_url=resp.url.__str__())


def _clean(value: float | None) -> float | None:
    # NASA POWER uses -999 as a fill value for missing observations.
    if value is None or value <= -900:
        return None
    return value
