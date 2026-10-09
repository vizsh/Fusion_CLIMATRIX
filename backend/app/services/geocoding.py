"""Real geocoding pipeline via the free Nominatim API (OpenStreetMap) —
when a new Asset is created, resolve it through an actual geocoder and
store whatever confidence tier it actually returns, instead of defaulting
every new row to 'approximate' by assertion. See docs/DATA_STRATEGY.md's
"Geocoding confidence pipeline" item.

Nominatim's usage policy requires a descriptive User-Agent and caps
requests at roughly 1/second — fine for this prototype's asset-creation
volume (one geocode per new asset, a rare admin action), not a bulk
geocoding solution."""

from dataclasses import dataclass

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "CLIMATRIX-India-prototype/0.1 (hackathon demo; non-commercial)"

# Nominatim's `importance` is roughly 0-1 (well-known places score higher).
# This is a disclosed, approximate mapping onto this project's existing
# 3-tier vocabulary (exact/approximate/centroid) — not an official
# Nominatim confidence scale.
IMPORTANCE_EXACT = 0.5
IMPORTANCE_APPROXIMATE = 0.2


@dataclass
class GeocodeResult:
    lat: float | None
    lng: float | None
    geo_confidence: str  # exact | approximate | centroid
    geocode_source: str
    importance: float | None
    error: str | None


async def geocode_asset(name: str, region_hint: str = "") -> GeocodeResult:
    query = f"{name}, {region_hint}, India" if region_hint else f"{name}, India"
    params = {"q": query, "format": "json", "limit": 1, "countrycodes": "in"}
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(NOMINATIM_URL, params=params, headers=headers)
            resp.raise_for_status()
            results = resp.json()
    except Exception as e:
        return GeocodeResult(None, None, "centroid", "", None, f"Nominatim request failed: {e}")

    if not results:
        return GeocodeResult(None, None, "centroid", "nominatim", None, "No match found")

    match = results[0]
    importance = float(match.get("importance", 0))
    if importance >= IMPORTANCE_EXACT:
        confidence = "exact"
    elif importance >= IMPORTANCE_APPROXIMATE:
        confidence = "approximate"
    else:
        confidence = "centroid"

    return GeocodeResult(
        lat=float(match["lat"]),
        lng=float(match["lon"]),
        geo_confidence=confidence,
        geocode_source="nominatim",
        importance=importance,
        error=None,
    )
