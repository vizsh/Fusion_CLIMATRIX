"""Shared weather-fetch and anomaly-persistence logic, used by both the
on-demand `/api/weather/*` endpoints and the background anomaly sweep
(app/services/scheduler.py) — one place owns "how do we get observations
for a location" and "how do we score+store an anomaly run" so the two
callers can't drift apart.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.connectors.base import ConnectorStatus
from app.connectors.nasa_power import NasaPowerConnector
from app.connectors.open_meteo import OpenMeteoArchiveConnector
from app.models import WeatherAnomaly, WeatherObservation
from app.services.ml_anomaly import AnomalyPoint, detect_anomalies

_nasa = NasaPowerConnector()
_open_meteo_archive = OpenMeteoArchiveConnector()


class WeatherFetchError(Exception):
    pass


def day_count(start: str, end: str) -> int:
    try:
        d0 = datetime.strptime(start, "%Y%m%d")
        d1 = datetime.strptime(end, "%Y%m%d")
        return (d1 - d0).days + 1
    except ValueError:
        return 0


async def resolve_observations(
    db: Session, lat: float, lng: float, start: str, end: str
) -> tuple[list[WeatherObservation], str, str, bool]:
    """Cache-first fetch: serve from WeatherObservation if this
    location/date-range is already fully cached, else NASA POWER with an
    Open-Meteo fallback. Raises WeatherFetchError (not HTTPException —
    this module has no FastAPI dependency) if both providers fail."""
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
    expected_days = day_count(start, end)
    if cached and len(cached) >= expected_days:
        return cached, cached[0].source, cached[0].source, True

    result = await _nasa.fetch(lat=lat, lng=lng, start=start, end=end)
    source_name = "NASA POWER"
    if result.status != ConnectorStatus.OK:
        result = await _open_meteo_archive.fetch(lat=lat, lng=lng, start=start, end=end)
        source_name = "Open-Meteo"
    if result.status != ConnectorStatus.OK:
        raise WeatherFetchError(f"Both weather providers failed. Last error: {result.message}")

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


async def run_anomaly_check(db: Session, lat: float, lng: float, days: int = 60) -> list[AnomalyPoint]:
    """Fetch this location's recent history, score it, and persist the
    scored points to WeatherAnomaly (replacing any prior run for the same
    (lat, lng, window) rather than accumulating duplicates). Shared by the
    on-demand endpoint and the scheduled sweep — identical behavior either
    way, just a different caller."""
    end_dt = datetime.now(timezone.utc) - timedelta(days=2)  # reanalysis products lag a day or two
    start_dt = end_dt - timedelta(days=days)
    start, end = start_dt.strftime("%Y%m%d"), end_dt.strftime("%Y%m%d")

    rows, _, _, _ = await resolve_observations(db, lat, lng, start, end)
    series = [r for r in rows if r.precipitation_mm is not None]
    points = detect_anomalies([r.date for r in series], [r.precipitation_mm for r in series])

    now = datetime.now(timezone.utc)
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
    return points
