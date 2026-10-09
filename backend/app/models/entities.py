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

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Index, Integer, String, Text
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


class Institution(Base):
    """Banks/NBFCs, government finance bodies, and insurers — previously
    only ever appeared as dangling string endpoints of a DependencyEdge
    (FINANCED_BY/INSURED_BY), with no backing row of their own, so nothing
    about an insurer's reinsurance cession or a subsidized scheme's
    government-subsidy share could be queried from the database. This
    table makes financial institutions first-class entities, same as
    Company — see docs/DATA_STRATEGY.md."""

    __tablename__ = "institutions"
    __table_args__ = (
        CheckConstraint("kind IN ('bank', 'govt', 'insurer')", name="ck_institution_kind"),
        Index("ix_institutions_kind_region", "kind", "region"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, index=True)  # bank | govt | insurer
    region: Mapped[str] = mapped_column(String, default="", index=True)
    sector: Mapped[str] = mapped_column(String, default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    # Insurer-only fields (null for bank/govt rows) — same disclosed
    # mechanics as frontend/src/lib/indiaGraphData.ts's GNode.
    ceded_reinsurance_share_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    reinsurer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    govt_subsidy_pct: Mapped[float | None] = mapped_column(Float, nullable=True)  # set only for a PMFBY-style scheme

    insured_companies: Mapped[list["Company"]] = relationship(back_populates="insurer")


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("baseline_pd >= 0 AND baseline_pd <= 1", name="ck_company_pd_range"),
        CheckConstraint("baseline_lgd >= 0 AND baseline_lgd <= 1", name="ck_company_lgd_range"),
        CheckConstraint("ead_cr >= 0", name="ck_company_ead_nonneg"),
        Index("ix_companies_region_sector", "region", "sector"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector: Mapped[str] = mapped_column(String, default="", index=True)
    region: Mapped[str] = mapped_column(String, default="", index=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    ead_cr: Mapped[float] = mapped_column(Float, default=0.0)
    baseline_pd: Mapped[float] = mapped_column(Float, default=0.0)
    baseline_lgd: Mapped[float] = mapped_column(Float, default=0.0)
    annual_revenue_cr: Mapped[float | None] = mapped_column(Float, nullable=True)
    note: Mapped[str] = mapped_column(Text, default="")
    is_synthetic: Mapped[bool] = mapped_column(default=True)
    # Insurance economics — null for an uninsured company (the protection
    # gap is a real finding, not every company has these set). Mirrors
    # frontend/src/lib/insurance.ts's claim-estimate inputs exactly.
    insurer_id: Mapped[str | None] = mapped_column(ForeignKey("institutions.id"), nullable=True, index=True)
    sum_insured_cr: Mapped[float | None] = mapped_column(Float, nullable=True)
    premium_rate_bps: Mapped[float | None] = mapped_column(Float, nullable=True)
    deductible_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    assets: Mapped[list["Asset"]] = relationship(back_populates="company")
    positions: Mapped[list["Position"]] = relationship(back_populates="company")
    insurer: Mapped[Institution | None] = relationship(back_populates="insured_companies")


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
    """`geo_confidence` is set honestly by the geocoding pipeline
    (`app/services/geocoding.py`), not defaulted and forgotten: a new asset
    is resolved through the free Nominatim geocoder, and whatever confidence
    tier it actually returns (or 'centroid' if geocoding failed/was
    ambiguous) is what's stored — see docs/DATA_STRATEGY.md's "Geocoding
    confidence pipeline" item."""

    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint(
            "geo_confidence IN ('exact', 'approximate', 'centroid')", name="ck_asset_geo_confidence"
        ),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, default="", index=True)  # infra | supplier | facility
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    geo_confidence: Mapped[str] = mapped_column(String, default="approximate")  # exact | approximate | centroid
    geocode_source: Mapped[str] = mapped_column(String, default="")  # e.g. "nominatim" | "manual"
    geocode_raw_importance: Mapped[float | None] = mapped_column(Float, nullable=True)  # Nominatim's own confidence signal

    company: Mapped[Company | None] = relationship(back_populates="assets")


class HazardEvent(Base):
    __tablename__ = "hazard_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    hazard_type: Mapped[str] = mapped_column(String, default="")
    region: Mapped[str] = mapped_column(String, default="", index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    evidence_class: Mapped[str] = mapped_column(String, default="assumption")
    note: Mapped[str] = mapped_column(Text, default="")


class DependencyEdge(Base):
    """Mirrors the frontend graph edges — one normalized relationship table
    covering AFFECTED_BY / DEPENDS_ON / SUPPLIES / TRANSPORTS_VIA /
    FINANCED_BY / INSURED_BY, each tagged with evidence class."""

    __tablename__ = "dependency_edges"
    __table_args__ = (
        CheckConstraint("weight >= 1 AND weight <= 3", name="ck_edge_weight_range"),
        Index("ix_dependency_edges_from_to", "from_id", "to_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    from_id: Mapped[str] = mapped_column(String, index=True)
    to_id: Mapped[str] = mapped_column(String, index=True)
    edge_type: Mapped[str] = mapped_column(String, index=True)
    evidence_class: Mapped[str] = mapped_column(String, default="assumption")
    weight: Mapped[int] = mapped_column(Integer, default=1)


class EvidenceRecord(Base):
    """`subject_type` + `subject_id` is a polymorphic reference (no single
    FK target table can cover company/hazard/portfolio/scenario at once),
    but it is no longer just a free-text convention: the composite index
    below makes "every evidence record about subject X" a real indexed
    lookup, `subject_type` is constrained to the same closed set every
    caller already assumes, and `app/services/evidence_links.py` is the one
    place that writes these rows, instead of each endpoint string-matching
    independently. See docs/DATA_STRATEGY.md's evidence-linkage item."""

    __tablename__ = "evidence_records"
    __table_args__ = (
        CheckConstraint(
            "subject_type IN ('company', 'hazard', 'portfolio', 'scenario', 'institution')",
            name="ck_evidence_subject_type",
        ),
        CheckConstraint(
            "evidence_class IN ('sourced', 'modelled', 'assumption', 'synthetic')",
            name="ck_evidence_class",
        ),
        Index("ix_evidence_subject", "subject_type", "subject_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    subject_type: Mapped[str] = mapped_column(String)  # company | hazard | portfolio | scenario | institution
    subject_id: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String)
    evidence_class: Mapped[str] = mapped_column(String)  # sourced | modelled | assumption | synthetic
    source: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class ScenarioRun(Base):
    """`*_weight_pct` columns are the data-quality rollup: what share of the
    edge weight in this run's actual propagation path (hazard -> ... ->
    exposed companies) was sourced vs. modelled vs. assumption vs.
    synthetic, computed once at run time by
    `app/services/data_quality.py`. This turns "how much of this result is
    evidence-backed" from a question you'd have to eyeball the graph to
    answer into a stored, queryable number per run."""

    __tablename__ = "scenario_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    region: Mapped[str] = mapped_column(String, index=True)
    hazard: Mapped[str] = mapped_column(String)
    severity: Mapped[int] = mapped_column(Integer)
    duration_months: Mapped[int] = mapped_column(Integer)
    substitutability: Mapped[str] = mapped_column(String)
    interventions: Mapped[str] = mapped_column(String, default="")  # comma-separated intervention ids
    baseline_el_cr: Mapped[float] = mapped_column(Float)
    stressed_el_cr: Mapped[float] = mapped_column(Float)
    mitigated_el_cr: Mapped[float] = mapped_column(Float)
    company_count: Mapped[int] = mapped_column(Integer, default=0)
    data_quality_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-1, sourced+modelled weight share
    sourced_weight_pct: Mapped[float] = mapped_column(Float, default=0.0)
    modelled_weight_pct: Mapped[float] = mapped_column(Float, default=0.0)
    assumption_weight_pct: Mapped[float] = mapped_column(Float, default=0.0)
    synthetic_weight_pct: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(default=_now, index=True)


class WeatherObservation(Base):
    """Real external data, populated by the NASA POWER / Open-Meteo
    connectors. Distinct from HazardEvent: this is an observed historical
    meteorological record, not a hazard/scenario entity. `source`
    distinguishes which provider answered (both are real, independent
    reanalysis models — kept separate rather than averaged together)."""

    __tablename__ = "weather_observations"
    __table_args__ = (Index("ix_weather_obs_location_date", "lat", "lng", "date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    date: Mapped[str] = mapped_column(String)  # YYYYMMDD
    precipitation_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    temp_c_avg: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String, default="NASA POWER")
    retrieved_at: Mapped[datetime] = mapped_column(default=_now)


class WeatherAnomaly(Base):
    """Output of the ML anomaly detector (app/services/ml_anomaly.py): for
    a location's own historical precipitation series, is a given day a
    genuine statistical outlier — not "is it raining," but "is THIS
    location's weather behaving unlike ITS OWN baseline." Two independent
    methods are stored side by side (rolling z-score, a simple transparent
    statistic; IsolationForest, a real unsupervised scikit-learn model)
    rather than silently picking one, so a flagged anomaly can be
    cross-checked against a second method before anyone treats it as
    signal. This is the same "deviate from your own calibrated baseline,
    not a flat threshold" principle the sector-vulnerability model already
    applies to credit risk, applied here to raw weather."""

    __tablename__ = "weather_anomalies"
    __table_args__ = (Index("ix_weather_anomaly_location_date", "lat", "lng", "date"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    date: Mapped[str] = mapped_column(String)  # YYYYMMDD
    precipitation_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    baseline_mean: Mapped[float] = mapped_column(Float)
    baseline_std: Mapped[float] = mapped_column(Float)
    z_score: Mapped[float] = mapped_column(Float)
    isolation_forest_score: Mapped[float] = mapped_column(Float)  # lower = more anomalous (sklearn convention)
    is_anomaly: Mapped[bool] = mapped_column(Boolean, default=False)  # true only if BOTH methods agree
    method_agreement: Mapped[bool] = mapped_column(Boolean, default=False)
    window_days: Mapped[int] = mapped_column(Integer, default=30)
    detected_at: Mapped[datetime] = mapped_column(default=_now)


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

    entity_links: Mapped[list["NewsEntityLink"]] = relationship(back_populates="article")


class NewsEntityLink(Base):
    """NLP entity-linking output (app/services/nlp.py): which graph entity
    (a company or region, matched against the SAME label gazetteer the
    frontend graph uses) a fetched news article's title+description
    actually mentions, with a match-strength score. Upgrades a news result
    from "matched this search query" to "is linked to this specific
    company/region" — real, if lightweight, NLP (gazetteer + fuzzy string
    matching), not a keyword-search restatement."""

    __tablename__ = "news_entity_links"
    __table_args__ = (
        CheckConstraint("entity_type IN ('company', 'region')", name="ck_entity_link_type"),
        Index("ix_news_entity_links_entity", "entity_type", "entity_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    article_id: Mapped[str] = mapped_column(ForeignKey("news_articles.id"), index=True)
    entity_type: Mapped[str] = mapped_column(String)  # company | region
    entity_id: Mapped[str] = mapped_column(String)  # graph ID, e.g. 'co-hp-tourism' or region code
    entity_label: Mapped[str] = mapped_column(String)
    match_score: Mapped[float] = mapped_column(Float)  # 0-1, fuzzy-match strength
    created_at: Mapped[datetime] = mapped_column(default=_now)

    article: Mapped[NewsArticle] = relationship(back_populates="entity_links")
