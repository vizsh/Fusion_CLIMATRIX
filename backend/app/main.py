from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import companies, copilot, evidence, infra, institutions, news, portfolios, scenarios, search, weather
from app.api.companies import assets_router
from app.config import settings
from app.logging_config import RequestLoggingMiddleware, configure_logging
from app.services import scheduler

# Schema is now migration-managed (see backend/alembic/) — no
# Base.metadata.create_all() here. A fresh checkout runs
# `alembic upgrade head` once (see backend/README.md); the app assumes the
# schema already matches its models rather than silently patching around a
# missing migration, which is exactly the kind of drift real migrations
# exist to prevent.
configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()  # background ML anomaly sweep — see app/services/scheduler.py
    yield
    await scheduler.stop()


app = FastAPI(
    title="CLIMATRIX India API",
    description="Backend for the CLIMATRIX India climate-risk intelligence prototype. "
    "See docs/IMPLEMENTATION_AUDIT.md and docs/DATA_STRATEGY.md in the repo root.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(portfolios.router)
app.include_router(companies.router)
app.include_router(scenarios.router)
app.include_router(weather.router)
app.include_router(evidence.router)
app.include_router(news.router)
app.include_router(infra.router)
app.include_router(copilot.router)
app.include_router(search.router)
app.include_router(assets_router)
app.include_router(institutions.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "climatrix-api"}
