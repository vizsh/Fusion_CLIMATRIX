"""Core schema.

IDs for Company/Asset/HazardEvent/DependencyEdge intentionally reuse the same
string IDs as the frontend's indiaGraphData.ts (e.g. 'co-hp-auto', 'hz-hp').
This is the data-linkage decision that matters most for this prototype: it
means the backend and the frontend describe the *same* entities with no
mapping table, so a future migration (frontend fetches from this API instead
of its bundled TS file) requires no ID reconciliation — only swapping the
data source. See docs/DATA_STRATEGY.md.
"""

from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    org_type: Mapped[str] = mapped_column(String, default="demo")  # bank | investor | demo

    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="organization")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    mandate: Mapped[str] = mapped_column(String, default="")

    organization: Mapped[Organization] = relationship(back_populates="portfolios")
    positions: Mapped[list["Position"]] = relationship(back_populates="portfolio")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, default="")
    region: Mapped[str] = mapped_column(String, default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    ead_cr: Mapped[float] = mapped_column(Float, default=0.0)
    baseline_pd: Mapped[float] = mapped_column(Float, default=0.0)
    baseline_lgd: Mapped[float] = mapped_column(Float, default=0.0)
    annual_revenue_cr: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    is_synthetic: Mapped[bool] = mapped_column(default=True)

    assets: Mapped[list["Asset"]] = relationship(back_populates="company")
    positions: Mapped[list["Position"]] = relationship(back_populates="company")


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    portfolio_id: Mapped[str] = mapped_column(ForeignKey("portfolios.id"))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"))
    instrument_type: Mapped[str] = mapped_column(String, default="equity")  # equity | credit_facility | private_equity
    quantity_or_share: Mapped[float] = mapped_column(Float, default=0.0)
    cost_basis_cr: Mapped[float] = mapped_column(Float, default=0.0)
    market_value_cr: Mapped[float] = mapped_column(Float, default=0.0)
    valuation_date: Mapped[str] = mapped_column(String, default="")
    liquidity: Mapped[str] = mapped_column(String, default="illiquid")  # liquid | semi_liquid | illiquid

    portfolio: Mapped[Portfolio] = relationship(back_populates="positions")
    company: Mapped[Company] = relationship(back_populates="positions")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, default="")  # infra | supplier | facility
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    geo_confidence: Mapped[str] = mapped_column(String, default="approximate")  # exact | approximate | centroid

    company: Mapped[Company | None] = relationship(back_populates="assets")


class HazardEvent(Base):
    __tablename__ = "hazard_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    hazard_type: Mapped[str] = mapped_column(String, default="")
    region: Mapped[str] = mapped_column(String, default="")
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    evidence_class: Mapped[str] = mapped_column(String, default="assumption")
    note: Mapped[str] = mapped_column(Text, default="")


class DependencyEdge(Base):
    """Mirrors the frontend graph edges — one normalized relationship table
    covering AFFECTED_BY / DEPENDS_ON / SUPPLIES / TRANSPORTS_VIA /
    FINANCED_BY / INSURED_BY, each tagged with evidence class."""

    __tablename__ = "dependency_edges"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    from_id: Mapped[str] = mapped_column(String, index=True)
    to_id: Mapped[str] = mapped_column(String, index=True)
    edge_type: Mapped[str] = mapped_column(String)
    evidence_class: Mapped[str] = mapped_column(String, default="assumption")
    weight: Mapped[int] = mapped_column(Integer, default=1)


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    subject_type: Mapped[str] = mapped_column(String)  # company | hazard | portfolio | scenario
    subject_id: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String)
    evidence_class: Mapped[str] = mapped_column(String)  # sourced | modelled | assumption | synthetic
    source: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    region: Mapped[str] = mapped_column(String)
    hazard: Mapped[str] = mapped_column(String)
    severity: Mapped[int] = mapped_column(Integer)
    duration_months: Mapped[int] = mapped_column(Integer)
    substitutability: Mapped[str] = mapped_column(String)
    interventions: Mapped[str] = mapped_column(String, default="")  # comma-separated intervention ids
    baseline_el_cr: Mapped[float] = mapped_column(Float)
    stressed_el_cr: Mapped[float] = mapped_column(Float)
    mitigated_el_cr: Mapped[float] = mapped_column(Float)
    company_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class WeatherObservation(Base):
    """Real external data, populated by the NASA POWER / Open-Meteo
    connectors. Distinct from HazardEvent: this is an observed historical
    meteorological record, not a hazard/scenario entity. `source`
    distinguishes which provider answered (both are real, independent
    reanalysis models — kept separate rather than averaged together)."""

    __tablename__ = "weather_observations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    date: Mapped[str] = mapped_column(String)  # YYYYMMDD
    precipitation_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp_c_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String, default="NASA POWER")
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class OsmWay(Base):
    """Real road/bridge geometry from OSM Overpass, cached per bounding box —
    Overpass is shared public infrastructure, not an SLA'd API, so every
    bbox is fetched live once and served from here after that. Replaces
    hand-placed infra points with actual way geometry; geo_confidence for
    anything drawn from this table is honestly 'approximate' (way centerline,
    not a surveyed asset footprint), not 'exact'."""

    __tablename__ = "osm_ways"

    id: Mapped[str] = mapped_column(String, primary_key=True)  # f"osm-way-{osm_id}"
    osm_id: Mapped[int] = mapped_column(Integer)
    bbox_key: Mapped[str] = mapped_column(String, index=True)
    highway: Mapped[str | None] = mapped_column(String, nullable=True)
    bridge: Mapped[bool] = mapped_column(default=False)
    name: Mapped[str] = mapped_column(String, default="")
    geometry_json: Mapped[str] = mapped_column(Text)  # JSON list of [lat, lng]
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class NewsArticle(Base):
    """Real articles fetched live from NewsAPI/GNews/AlphaAI. `query` records
    what search produced this row (region/hazard keywords, not a company —
    see docs/DATA_STRATEGY.md on not blending synthetic companies with real
    news as if it were company-specific coverage)."""

    __tablename__ = "news_articles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    query: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(Text)
    source_name: Mapped[str] = mapped_column(String, default="")
    published_at: Mapped[str] = mapped_column(String, default="")
    provider: Mapped[str] = mapped_column(String)  # NewsAPI | GNews | AlphaAI
    relevance: Mapped[float | None] = mapped_column(Float, nullable=True)  # AlphaAI only
    category: Mapped[str | None] = mapped_column(String, nullable=True)  # AlphaAI only
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)
