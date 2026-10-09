from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.open_meteo import OpenMeteoFloodConnector
from app.connectors.tomorrow_io import TomorrowIoConnector
from app.db.session import get_db
from app.schemas.schemas import (
    AnomalyPointOut,
    CurrentConditionsOut,
    FloodDayOut,
    FloodQueryResult,
    WeatherAnomalyResult,
    WeatherObservationOut,
    WeatherQueryIn,
    WeatherQueryResult,
)
from app.services.cache import ttl_cache
from app.services.scheduler import anomaly_sweep_status
from app.services.weather_data import WeatherFetchError, resolve_observations, run_anomaly_check

router = APIRouter(prefix="/api/weather", tags=["weather"])
_open_meteo_flood = OpenMeteoFloodConnector()
_tomorrow = TomorrowIoConnector()


async def _resolve_observations(db: Session, lat: float, lng: float, start: str, end: str):
    try:
        return await resolve_observations(db, lat, lng, start, end)
    except WeatherFetchError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/query", response_model=WeatherQueryResult)
async def query_weather(payload: WeatherQueryIn, db: Session = Depends(get_db)):
    """Historical daily precipitation/temperature. Tries NASA POWER first,
    falls back to Open-Meteo's archive on error — two independent
    reanalysis models behind one interface, same provider-adapter pattern
    as the news connector."""
    rows, source_name, source_url, cached = await _resolve_observations(
        db, payload.lat, payload.lng, payload.start, payload.end
    )
    retrieved_at = rows[0].retrieved_at if cached and rows else datetime.now(timezone.utc)
    return WeatherQueryResult(
        observations=rows,
        source=source_name,
        source_url=source_url if not cached else _nasa_url(payload),
        retrieved_at=retrieved_at,
        cached=cached,
    )


@router.get("/current", response_model=CurrentConditionsOut)
@ttl_cache(seconds=300)  # Tomorrow.io is "right now" data — 5 minutes is fresh enough and spares the free quota
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
@ttl_cache(seconds=600)  # GloFAS forecast moves slowly — 10 minutes avoids hammering the free endpoint
async def flood_discharge(lat: float, lng: float, past_days: int = 7, forecast_days: int = 5):
    """Real river discharge (m3/s) from Open-Meteo/GloFAS — a genuinely
    hydrological signal, not just rainfall, for the point nearest the given
    coordinates on a modeled river reach."""
    result = await _open_meteo_flood.fetch(lat=lat, lng=lng, past_days=past_days, forecast_days=forecast_days)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)
    days = [FloodDayOut(date=r["date"], river_discharge_m3s=r["river_discharge_m3s"]) for r in result.data]
    return FloodQueryResult(days=days, source_url=result.source_url or "", note=result.message)


@router.get("/anomalies", response_model=WeatherAnomalyResult)
async def weather_anomalies(lat: float, lng: float, days: int = 60, db: Session = Depends(get_db)):
    """ML anomaly detection over this location's own recent precipitation
    history (see app/services/ml_anomaly.py) — "is this location's weather
    behaving unlike its own baseline," not a fixed rainfall threshold. Same
    scoring+persistence path as the background sweep (see
    app/services/scheduler.py) — this is just an on-demand trigger of it."""
    try:
        points = await run_anomaly_check(db, lat, lng, days)
    except WeatherFetchError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    out_points = [AnomalyPointOut(**vars(p)) for p in points]
    return WeatherAnomalyResult(lat=lat, lng=lng, points=out_points, anomaly_count=sum(p.is_anomaly for p in points))


@router.get("/anomalies/sweep-status")
def anomaly_sweep_status_endpoint():
    """Visibility into the background anomaly sweep (app/services/
    scheduler.py): when it last ran, which regions it checked, and how
    many anomalies it found — so "is this actually running unattended" is
    answerable without digging through server logs."""
    return anomaly_sweep_status()


def _nasa_url(payload: WeatherQueryIn) -> str:
    from app.config import settings

    return f"{settings.nasa_power_base_url}?latitude={payload.lat}&longitude={payload.lng}&start={payload.start}&end={payload.end}"
