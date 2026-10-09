from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import companies, evidence, news, portfolios, scenarios, weather
from app.config import settings
from app.db.session import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CLIMATRIX India API",
    description="Backend for the CLIMATRIX India climate-risk intelligence prototype. "
    "See docs/IMPLEMENTATION_AUDIT.md and docs/DATA_STRATEGY.md in the repo root.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolios.router)
app.include_router(companies.router)
app.include_router(scenarios.router)
app.include_router(weather.router)
app.include_router(evidence.router)
app.include_router(news.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "climatrix-api"}
