from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Asset, Company
from app.schemas.schemas import AssetOut, CompanyOut, DependencyEdgeOut
from app.services.graph import ancestors, descendants, edges_within

router = APIRouter(prefix="/api/companies", tags=["companies"])


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
