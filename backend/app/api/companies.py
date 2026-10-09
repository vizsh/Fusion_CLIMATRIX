import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Asset, Company
from app.schemas.schemas import AssetCreateIn, AssetCreateResult, AssetOut, CompanyOut, DependencyEdgeOut
from app.services.geocoding import geocode_asset
from app.services.graph import ancestors, descendants, edges_within

router = APIRouter(prefix="/api/companies", tags=["companies"])
assets_router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return db.query(Company).all()


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail=f"No company with id '{company_id}'")
    return company


@router.get("/{company_id}/assets", response_model=list[AssetOut])
def get_company_assets(company_id: str, db: Session = Depends(get_db)):
    return db.query(Asset).filter(Asset.company_id == company_id).all()


@router.get("/{company_id}/dependencies", response_model=list[DependencyEdgeOut])
def get_company_dependencies(company_id: str, db: Session = Depends(get_db)):
    """Every edge in this company's upstream chain — what its exposure
    traces back to — the same question the frontend's Dependency Explorer
    answers, computed here over the DB-backed graph instead of the bundled
    TS array."""
    upstream = ancestors(db, company_id)
    return edges_within(db, upstream)


@router.get("/{company_id}/reach", response_model=list[str])
def get_company_downstream_reach(company_id: str, db: Session = Depends(get_db)):
    """What this node (company, infra, supplier, hazard) can reach downstream."""
    return sorted(descendants(db, company_id))


@assets_router.post("", response_model=AssetCreateResult)
async def create_asset(payload: AssetCreateIn, db: Session = Depends(get_db)):
    """The real geocoding pipeline (docs/DATA_STRATEGY.md): resolves the
    asset through the free Nominatim geocoder instead of defaulting
    geo_confidence to 'approximate' by assertion, and stores whatever
    confidence tier Nominatim's own match quality actually supports."""
    if payload.company_id and not db.query(Company).filter(Company.id == payload.company_id).first():
        raise HTTPException(status_code=404, detail=f"No company with id '{payload.company_id}'")

    geocoded = await geocode_asset(payload.name, payload.region_hint)
    if geocoded.lat is None:
        raise HTTPException(status_code=422, detail=f"Could not geocode '{payload.name}': {geocoded.error}")

    asset = Asset(
        id=f"asset-{uuid.uuid4().hex[:10]}",
        company_id=payload.company_id,
        name=payload.name,
        kind=payload.kind,
        lat=geocoded.lat,
        lng=geocoded.lng,
        geo_confidence=geocoded.geo_confidence,
        geocode_source=geocoded.geocode_source,
        geocode_raw_importance=geocoded.importance,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return AssetCreateResult(
        asset=asset,
        geocode_source=geocoded.geocode_source,
        geocode_importance=geocoded.importance,
        geocode_error=geocoded.error,
    )
