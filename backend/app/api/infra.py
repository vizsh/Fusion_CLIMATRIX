import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.osm_overpass import OverpassConnector
from app.db.session import get_db
from app.models import OsmWay
from app.schemas.schemas import OsmInfraResult, OsmWayOut

router = APIRouter(prefix="/api/infra", tags=["infrastructure"])
_overpass = OverpassConnector()


def _bbox_key(lat_min: float, lng_min: float, lat_max: float, lng_max: float) -> str:
    return f"{lat_min:.2f},{lng_min:.2f},{lat_max:.2f},{lng_max:.2f}"


def _to_out(w: OsmWay) -> OsmWayOut:
    return OsmWayOut(id=w.id, highway=w.highway, bridge=w.bridge, name=w.name, geometry=json.loads(w.geometry_json))


@router.get("/osm", response_model=OsmInfraResult)
async def osm_infrastructure(lat_min: float, lng_min: float, lat_max: float, lng_max: float, db: Session = Depends(get_db)):
    """Real OSM road/bridge geometry for a bounding box, replacing hand-placed
    infra points. Cached per bbox after the first live fetch — Overpass is
    shared public infrastructure, not an SLA'd API (docs/DATA_STRATEGY.md)."""
    key = _bbox_key(lat_min, lng_min, lat_max, lng_max)
    cached = db.query(OsmWay).filter(OsmWay.bbox_key == key).all()
    if cached:
        return OsmInfraResult(ways=[_to_out(w) for w in cached], source="OSM Overpass (cached)", cached=True)

    result = await _overpass.fetch(lat_min=lat_min, lng_min=lng_min, lat_max=lat_max, lng_max=lng_max)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)

    rows = []
    for r in result.data:
        way = OsmWay(
            id=f"osm-way-{r['osm_id']}",
            osm_id=r["osm_id"],
            bbox_key=key,
            highway=r["highway"],
            bridge=r["bridge"],
            name=r["name"],
            geometry_json=json.dumps(r["geometry"]),
        )
        db.merge(way)
        rows.append(way)
    db.commit()

    return OsmInfraResult(ways=[_to_out(w) for w in rows], source="OSM Overpass (live)", cached=False)
