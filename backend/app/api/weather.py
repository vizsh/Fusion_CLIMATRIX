import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.nasa_power import NasaPowerConnector
from app.connectors.open_meteo import OpenMeteoArchiveConnector, OpenMeteoFloodConnector
from app.connectors.tomorrow_io import TomorrowIoConnector
from app.db.session import get_db
from app.models import WeatherObservation
from app.schemas.schemas import (
    CurrentConditionsOut,
    FloodDayOut,
    FloodQueryResult,
    WeatherObservationOut,
    WeatherQueryIn,
    WeatherQueryResult,
)

router = APIRouter(prefix="/api/weather", tags=["weather"])
_nasa = NasaPowerConnector()
_open_meteo_archive = OpenMeteoArchiveConnector()
_open_meteo_flood = OpenMeteoFloodConnector()
_tomorrow = TomorrowIoConnector()


@router.post("/query", response_model=WeatherQueryResult)
async def query_weather(payload: WeatherQueryIn, db: Session = Depends(get_db)):
    """Historical daily precipitation/temperature. Tries NASA POWER first,
    falls back to Open-Meteo's archive on error — two independent
    reanalysis models behind one interface, same provider-adapter pattern
    as the news connector."""
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
            observations=cached, source=cached[0].source, source_url=_nasa_url(payload), retrieved_at=cached[0].retrieved_at, cached=True,
        )

    result = await _nasa.fetch(lat=payload.lat, lng=payload.lng, start=payload.start, end=payload.end)
    source_name = "NASA POWER"
    if result.status != ConnectorStatus.OK:
        result = await _open_meteo_archive.fetch(lat=payload.lat, lng=payload.lng, start=payload.start, end=payload.end)
        source_name = "Open-Meteo"
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=f"Both weather providers failed. Last error: {result.message}")

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
            source=source_name,
            retrieved_at=now,
        )
        db.add(obs)
        rows.append(obs)
    db.commit()
    for r in rows:
        db.refresh(r)

    return WeatherQueryResult(observations=rows, source=source_name, source_url=result.source_url or "", retrieved_at=now, cached=False)


@router.get("/current", response_model=CurrentConditionsOut)
async def current_conditions(lat: float, lng: float):
    """Live current conditions via Tomorrow.io — distinct from /query's
    historical reanalysis: this is what's happening right now."""
    result = await _tomorrow.fetch(lat=lat, lng=lng)
    if result.status == ConnectorStatus.UNCONFIGURED:
        raise HTTPException(status_code=503, detail="Tomorrow.io is not configured (TOMORROW_IO_API_KEY unset).")
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)
    row = result.data[0]
    return CurrentConditionsOut(**row, source_url=result.source_url or "")


@router.get("/flood", response_model=FloodQueryResult)
async def flood_discharge(lat: float, lng: float, past_days: int = 7, forecast_days: int = 5):
    """Real river discharge (m3/s) from Open-Meteo/GloFAS — a genuinely
    hydrological signal, not just rainfall, for the point nearest the given
    coordinates on a modeled river reach."""
    result = await _open_meteo_flood.fetch(lat=lat, lng=lng, past_days=past_days, forecast_days=forecast_days)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)
    days = [FloodDayOut(date=r["date"], river_discharge_m3s=r["river_discharge_m3s"]) for r in result.data]
    return FloodQueryResult(days=days, source_url=result.source_url or "", note=result.message)


def _day_count(start: str, end: str) -> int:
    try:
        d0 = datetime.strptime(start, "%Y%m%d")
        d1 = datetime.strptime(end, "%Y%m%d")
        return (d1 - d0).days + 1
    except ValueError:
        return 0


def _nasa_url(payload: WeatherQueryIn) -> str:
    from app.config import settings

    return f"{settings.nasa_power_base_url}?latitude={payload.lat}&longitude={payload.lng}&start={payload.start}&end={payload.end}"
