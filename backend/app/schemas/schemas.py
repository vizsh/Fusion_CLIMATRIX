from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    sector: str
    region: str
    lat: float | None
    lng: float | None
    ead_cr: float
    baseline_pd: float
    baseline_lgd: float
    annual_revenue_cr: float | None
    note: str
    is_synthetic: bool
    insurer_id: str | None = None
    sum_insured_cr: float | None = None
    premium_rate_bps: float | None = None
    deductible_pct: float | None = None


class InstitutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    kind: str
    region: str
    sector: str
    note: str
    ceded_reinsurance_share_pct: float | None
    reinsurer_name: str | None
    govt_subsidy_pct: float | None


class InstitutionBookOut(BaseModel):
    """Mirrors frontend/src/lib/insurance.ts's computeInsurerBook() shape —
    the same claim-estimate mechanic, computed server-side."""

    institution: InstitutionOut
    policy_count: int
    total_sum_insured_cr: float
    total_premium_cr: float
    expected_net_claims_cr: float
    gross_loss_ratio: float
    ceded_claims_cr: float
    retained_claims_cr: float
    farmer_paid_premium_cr: float
    govt_subsidy_cr: float
    evidence_class: str = "assumption"


class PositionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str
    instrument_type: str
    quantity_or_share: float
    cost_basis_cr: float
    market_value_cr: float
    valuation_date: str
    liquidity: str
    company: CompanyOut


class PortfolioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    mandate: str
    positions: list[PositionOut]


class PortfolioSummary(BaseModel):
    id: str
    name: str
    mandate: str
    position_count: int
    total_cost_basis_cr: float
    total_market_value_cr: float


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    company_id: str | None
    name: str
    kind: str
    lat: float
    lng: float
    geo_confidence: str


class DependencyEdgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    from_id: str
    to_id: str
    edge_type: str
    evidence_class: str
    weight: int


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    subject_type: str
    subject_id: str
    label: str
    evidence_class: str
    source: str
    detail: str
    retrieved_at: datetime


class ScenarioRunIn(BaseModel):
    region: str
    hazard: str
    severity: int
    duration_months: int
    substitutability: str
    interventions: list[str] = []


class ScenarioRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    region: str
    hazard: str
    severity: int
    duration_months: int
    substitutability: str
    interventions: str
    baseline_el_cr: float
    stressed_el_cr: float
    mitigated_el_cr: float
    company_count: int
    data_quality_score: float
    sourced_weight_pct: float
    modelled_weight_pct: float
    assumption_weight_pct: float
    synthetic_weight_pct: float
    created_at: datetime


class WeatherQueryIn(BaseModel):
    lat: float
    lng: float
    start: str  # YYYYMMDD
    end: str  # YYYYMMDD


class WeatherObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lat: float
    lng: float
    date: str
    precipitation_mm: float | None
    temp_c_avg: float | None
    source: str
    retrieved_at: datetime


class WeatherQueryResult(BaseModel):
    observations: list[WeatherObservationOut]
    source: str
    source_url: str
    retrieved_at: datetime
    cached: bool
    evidence_class: str = "sourced"


class CurrentConditionsOut(BaseModel):
    observed_at: str
    temperature_c: float | None
    temperature_apparent_c: float | None
    humidity_pct: float | None
    precipitation_probability_pct: float | None
    rain_intensity_mm_hr: float | None
    wind_speed_m_s: float | None
    wind_gust_m_s: float | None
    visibility_km: float | None
    weather_code: int | None
    source: str = "Tomorrow.io"
    source_url: str
    evidence_class: str = "sourced"


class FloodDayOut(BaseModel):
    date: str
    river_discharge_m3s: float | None


class FloodQueryResult(BaseModel):
    days: list[FloodDayOut]
    source: str = "Open-Meteo / GloFAS"
    source_url: str
    note: str
    evidence_class: str = "sourced"


class NewsEntityLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    entity_type: str
    entity_id: str
    entity_label: str
    match_score: float


class NewsArticleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    description: str
    url: str
    source_name: str
    published_at: str
    provider: str
    relevance: float | None = None
    category: str | None = None
    entity_links: list[NewsEntityLinkOut] = []


class NewsQueryResult(BaseModel):
    articles: list[NewsArticleOut]
    provider: str
    query: str
    retrieved_at: datetime
    evidence_class: str = "sourced"


class OsmWayOut(BaseModel):
    id: str
    highway: str | None
    bridge: bool
    name: str
    geometry: list[list[float]]  # [[lat, lng], ...] way centerline


class OsmInfraResult(BaseModel):
    ways: list[OsmWayOut]
    source: str
    cached: bool
    evidence_class: str = "sourced"


class PortfolioDataQualityOut(BaseModel):
    portfolio_id: str
    position_count: int
    companies_with_sourced_evidence: int
    coverage_pct: float
    evidence_class: str = "modelled"  # the rollup itself is a real computation over real evidence rows


class AnomalyPointOut(BaseModel):
    date: str
    value: float
    baseline_mean: float
    baseline_std: float
    z_score: float
    isolation_forest_score: float
    is_anomaly: bool
    method_agreement: bool


class WeatherAnomalyResult(BaseModel):
    lat: float
    lng: float
    points: list[AnomalyPointOut]
    anomaly_count: int
    source: str = "NASA POWER + scikit-learn (z-score + IsolationForest)"
    method_note: str = (
        "A day is flagged anomalous only when a rolling z-score (|z|>2 vs. this location's own "
        "baseline) AND an independent IsolationForest model agree — reduces false positives, not a "
        "claim of calibrated probability."
    )
    evidence_class: str = "modelled"


class SemanticSearchHit(BaseModel):
    id: str
    kind: str  # news | evidence
    title: str
    score: float


class SemanticSearchResult(BaseModel):
    query: str
    hits: list[SemanticSearchHit]
    method: str = "TF-IDF + cosine similarity (scikit-learn)"
    evidence_class: str = "modelled"


class AssetCreateIn(BaseModel):
    name: str
    kind: str  # infra | supplier | facility
    region_hint: str = ""
    company_id: str | None = None


class AssetCreateResult(BaseModel):
    asset: AssetOut
    geocode_source: str
    geocode_importance: float | None
    geocode_error: str | None


class InsiderSummaryResult(BaseModel):
    ticker: str
    raw: dict
    source: str = "AlphaAI"
    note: str = "Reference real-market data for a comparable listed company — not connected to any synthetic CLIMATRIX company record."


class ProposedUpdateCreateIn(BaseModel):
    kind: str  # sector_vulnerability | transition_sensitivity | scenario_archetype | other
    target: str
    current_value: str = ""
    proposed_value: str
    rationale: str
    proposed_by: str = ""


class ProposedUpdateReviewIn(BaseModel):
    reviewer: str = ""
    review_note: str = ""


class ProposedUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    kind: str
    target: str
    current_value: str
    proposed_value: str
    rationale: str
    proposed_by: str
    status: str
    reviewer: str
    review_note: str
    created_at: datetime
    reviewed_at: datetime | None
