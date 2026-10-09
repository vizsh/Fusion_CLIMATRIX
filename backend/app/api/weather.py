import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.nasa_power import NasaPowerConnector
from app.db.session import get_db
from app.models import WeatherObservation
from app.schemas.schemas import WeatherObservationOut, WeatherQueryIn, WeatherQueryResult

router = APIRouter(prefix="/api/weather", tags=["weather"])
_connector = NasaPowerConnector()


@router.post("/query", response_model=WeatherQueryResult)
async def query_weather(payload: WeatherQueryIn, db: Session = Depends(get_db)):
    """Live call to NASA POWER for real historical daily precipitation and
    temperature at the given coordinates. Results are cached in
    weather_observations (keyed on lat/lng/date) so repeat queries for the
    same point/range don't re-hit the external API."""
    cached = (
        db.query(WeatherObservation)
        .filter(
            WeatherObservation.lat == payload.lat,
            WeatherObservation.lng == payload.lng,
            WeatherObservation.date >= payload.start,
            WeatherObservation.date <= payload.end,
        )
        .order_by(WeatherObservation.date)
        .all()
    )
    expected_days = _day_count(payload.start, payload.end)
    if cached and len(cached) >= expected_days:
        return WeatherQueryResult(
            observations=cached,
            source="NASA POWER",
            source_url=_connector_url(payload),
            retrieved_at=cached[0].retrieved_at,
            cached=True,
        )

    result = await _connector.fetch(lat=payload.lat, lng=payload.lng, start=payload.start, end=payload.end)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=f"NASA POWER connector: {result.message}")

    now = datetime.now(timezone.utc)
    rows = []
    for r in result.data:
        obs = WeatherObservation(
            id=f"wx-{uuid.uuid4().hex[:10]}",
            lat=payload.lat,
            lng=payload.lng,
            date=r["date"],
            precipitation_mm=r["precipitation_mm"],
            temp_c_avg=r["temp_c_avg"],
            source="NASA POWER",
            retrieved_at=now,
        )
        db.add(obs)
        rows.append(obs)
    db.commit()
    for r in rows:
        db.refresh(r)

    return WeatherQueryResult(
        observations=rows,
        source="NASA POWER",
        source_url=result.source_url or _connector_url(payload),
        retrieved_at=now,
        cached=False,
    )


def _day_count(start: str, end: str) -> int:
    try:
        d0 = datetime.strptime(start, "%Y%m%d")
        d1 = datetime.strptime(end, "%Y%m%d")
        return (d1 - d0).days + 1
    except ValueError:
        return 0


def _connector_url(payload: WeatherQueryIn) -> str:
    from app.config import settings

    return f"{settings.nasa_power_base_url}?latitude={payload.lat}&longitude={payload.lng}&start={payload.start}&end={payload.end}"
