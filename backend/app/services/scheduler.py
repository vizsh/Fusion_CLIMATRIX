"""Background anomaly sweep — runs the ML weather anomaly detector
(app/services/ml_anomaly.py via weather_data.run_anomaly_check) for every
region's hazard coordinates on a fixed interval, instead of only when a
client happens to call GET /api/weather/anomalies. A plain asyncio task
loop, not a new dependency (Celery/APScheduler) — one process, one
in-memory schedule, which is all a single-instance prototype needs; see
docs/DATA_STRATEGY.md for the production caveat.

Status is kept in-memory (not persisted) and read by
GET /api/weather/anomalies/sweep-status — restarting the app resets it,
which is fine for a liveness/"is this running" check, not an audit log
(the actual scored points ARE persisted, to WeatherAnomaly)."""

import asyncio
from datetime import datetime, timezone

from app.config import settings
from app.db.session import SessionLocal
from app.logging_config import logger
from app.models import HazardEvent
from app.services.graph import REGION_HAZARD
from app.services.weather_data import WeatherFetchError, run_anomaly_check

_status: dict = {
    "enabled": False,
    "last_run_at": None,
    "last_run_ok": None,
    "regions_checked": 0,
    "total_anomalies": 0,
    "last_error": None,
}
_task: asyncio.Task | None = None


def anomaly_sweep_status() -> dict:
    return dict(_status)


async def _sweep_once() -> None:
    """One pass over every region's hazard coordinates."""
    db = SessionLocal()
    regions_checked = 0
    total_anomalies = 0
    try:
        for hazard_id in REGION_HAZARD.values():
            hazard = db.query(HazardEvent).filter(HazardEvent.id == hazard_id).first()
            if not hazard:
                continue  # not every region's hazard is necessarily seeded yet
            try:
                points = await run_anomaly_check(db, hazard.lat, hazard.lng, days=60)
            except WeatherFetchError as e:
                logger.warning("Anomaly sweep: %s unreachable (%s)", hazard_id, e)
                continue
            regions_checked += 1
            total_anomalies += sum(p.is_anomaly for p in points)
        _status.update(
            last_run_at=datetime.now(timezone.utc).isoformat(),
            last_run_ok=True,
            regions_checked=regions_checked,
            total_anomalies=total_anomalies,
            last_error=None,
        )
        logger.info("Anomaly sweep complete: %d region(s) checked, %d anomaly day(s) found", regions_checked, total_anomalies)
    except Exception as e:  # a sweep failure must never crash the app
        _status.update(last_run_at=datetime.now(timezone.utc).isoformat(), last_run_ok=False, last_error=str(e))
        logger.error("Anomaly sweep failed: %s", e)
    finally:
        db.close()


async def _sweep_loop() -> None:
    interval_seconds = max(settings.anomaly_sweep_interval_hours, 0.1) * 3600
    while True:
        await _sweep_once()
        await asyncio.sleep(interval_seconds)


def start() -> None:
    """Call once at app startup. A no-op if already running or disabled
    via settings.anomaly_sweep_enabled (conftest.py sets this false so the
    test suite never makes live network calls on startup)."""
    global _task
    if not settings.anomaly_sweep_enabled or _task is not None:
        return
    _status["enabled"] = True
    _task = asyncio.create_task(_sweep_loop())
    logger.info(
        "Anomaly sweep scheduled every %.1fh for regions: %s",
        settings.anomaly_sweep_interval_hours,
        ", ".join(REGION_HAZARD),
    )


async def stop() -> None:
    """Call at app shutdown so the loop doesn't log a dangling-task
    warning when the process exits."""
    global _task
    if _task is None:
        return
    _task.cancel()
    try:
        await _task
    except asyncio.CancelledError:
        pass
    _task = None
    _status["enabled"] = False
