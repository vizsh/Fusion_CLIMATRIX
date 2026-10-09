import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.nasa_power import NasaPowerConnector
from app.connectors.open_meteo import OpenMeteoArchiveConnector, OpenMeteoFloodConnector
from app.connectors.tomorrow_io import TomorrowIoConnector
from app.db.session import get_db
from app.models import WeatherAnomaly, WeatherObservation
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
from app.services.ml_anomaly import detect_anomalies

router = APIRouter(prefix="/api/weather", tags=["weather"])
_nasa = NasaPowerConnector()
_open_meteo_archive = OpenMeteoArchiveConnector()
_open_meteo_flood = OpenMeteoFloodConnector()
_tomorrow = TomorrowIoConnector()


async def _resolve_observations(
    db: Session, lat: float, lng: float, start: str, end: str
) -> tuple[list[WeatherObservation], str, str, bool]:
    """Shared cache-first fetch used by both /query and /anomalies — one
    place decides "do we already have this location/date-range cached,
    or do we need a live connector call," instead of two endpoints
    re-implementing the same NASA POWER -> Open-Meteo fallback chain."""
    cached = (
        db.query(WeatherObservation)
        .filter(
            WeatherObservation.lat == lat,
            WeatherObservation.lng == lng,
            WeatherObservation.date >= start,
            WeatherObservation.date <= end,
        )
        .order_by(WeatherObservation.date)
        .all()
    )
    expected_days = _day_count(start, end)
    if cached and len(cached) >= expected_days:
        return cached, cached[0].source, cached[0].source, True

    result = await _nasa.fetch(lat=lat, lng=lng, start=start, end=end)
    source_name = "NASA POWER"
    if result.status != ConnectorStatus.OK:
        result = await _open_meteo_archive.fetch(lat=lat, lng=lng, start=start, end=end)
        source_name = "Open-Meteo"
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=f"Both weather providers failed. Last error: {result.message}")

    now = datetime.now(timezone.utc)
    rows = []
    for r in result.data:
        obs = WeatherObservation(
            id=f"wx-{uuid.uuid4().hex[:10]}",
            lat=lat,
            lng=lng,
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
    return rows, source_name, result.source_url or "", False


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
    behaving unlike its own baseline," not a fixed rainfall threshold.
    Persists every scored day to WeatherAnomaly so a run is auditable
    later, not just returned and discarded."""
    end_dt = datetime.now(timezone.utc) - timedelta(days=2)  # reanalysis products lag by a day or two
    start_dt = end_dt - timedelta(days=days)
    start, end = start_dt.strftime("%Y%m%d"), end_dt.strftime("%Y%m%d")

    rows, _, _, _ = await _resolve_observations(db, lat, lng, start, end)
    series = [r for r in rows if r.precipitation_mm is not None]
    points = detect_anomalies([r.date for r in series], [r.precipitation_mm for r in series])

    now = datetime.now(timezone.utc)
    # Replace any prior run for this exact (lat, lng, window) rather than
    # accumulating duplicate rows on every re-check of the same location.
    db.query(WeatherAnomaly).filter(
        WeatherAnomaly.lat == lat, WeatherAnomaly.lng == lng, WeatherAnomaly.window_days == days
    ).delete()
    for p in points:
        db.add(
            WeatherAnomaly(
                id=f"anom-{uuid.uuid4().hex[:10]}",
                lat=lat,
                lng=lng,
                date=p.date,
                precipitation_mm=p.value,
                baseline_mean=p.baseline_mean,
                baseline_std=p.baseline_std,
                z_score=p.z_score,
                isolation_forest_score=p.isolation_forest_score,
                is_anomaly=p.is_anomaly,
                method_agreement=p.method_agreement,
                window_days=days,
                detected_at=now,
            )
        )
    db.commit()

    out_points = [AnomalyPointOut(**vars(p)) for p in points]
    return WeatherAnomalyResult(lat=lat, lng=lng, points=out_points, anomaly_count=sum(p.is_anomaly for p in points))


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
