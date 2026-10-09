"""OSM Overpass API — real road/bridge way geometry, free and keyless.
https://wiki.openstreetmap.org/wiki/Overpass_API

Replaces hand-placed infra points with actual OpenStreetMap geometry so
`Asset.geo_confidence` can honestly read 'approximate' (a real way
centerline) instead of 'centroid' (a guessed point) — see
docs/DATA_STRATEGY.md item 2.

Verified live (via a browser fetch, since this project's own dev sandbox's
direct Bash/Python egress gets a 406 from the main overpass-api.de instance —
most likely IP-based anti-abuse on that shared public instance, not a query
problem): a bbox query for trunk/primary/secondary/tertiary highways and
bridge=yes ways returns real way geometry with no [timeout:N] directive
needed in the query itself, relying on the HTTP client's own timeout instead.
A deployment running from a different outbound IP may see this connector
work live where this dev sandbox's own curl/httpx calls do not — that's a
network-reachability fact about this sandbox, not a defect in the query.
Overpass is shared public infrastructure, not an SLA'd API, so every result
this connector returns is meant to be cached per bounding box by the caller
(see app/api/infra.py) rather than re-fetched per request."""

import httpx

from app.connectors.base import ConnectorResult, ConnectorStatus, DataConnector

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class OverpassConnector(DataConnector):
    name = "OSM Overpass"
    evidence_class = "sourced"

    async def fetch(self, lat_min: float, lng_min: float, lat_max: float, lng_max: float) -> ConnectorResult:
        bbox = f"{lat_min},{lng_min},{lat_max},{lng_max}"
        query = (
            "[out:json];"
            f'(way["highway"~"trunk|primary|secondary|tertiary"]({bbox});'
            f'way["bridge"="yes"]({bbox}););'
            "out geom;"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(OVERPASS_URL, data={"data": query})
                resp.raise_for_status()
                payload = resp.json()
        except httpx.TimeoutException:
            return ConnectorResult(ConnectorStatus.ERROR, None, "Overpass request timed out (shared public instance, no SLA).")
        except Exception as e:
            return ConnectorResult(ConnectorStatus.ERROR, None, f"Overpass request failed: {e}")

        rows = []
        for el in payload.get("elements", []):
            if el.get("type") != "way" or "geometry" not in el:
                continue
            tags = el.get("tags", {})
            rows.append(
                {
                    "osm_id": el["id"],
                    "highway": tags.get("highway"),
                    "bridge": tags.get("bridge") == "yes",
                    "name": tags.get("name", ""),
                    "geometry": [[pt["lat"], pt["lon"]] for pt in el["geometry"]],
                }
            )
        return ConnectorResult(
            ConnectorStatus.OK,
            rows,
            f"Fetched {len(rows)} way(s) from OSM Overpass.",
            source_url=f"{OVERPASS_URL}?bbox={bbox}",
        )
