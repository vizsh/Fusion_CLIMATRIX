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
