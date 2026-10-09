from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Institution
from app.schemas.schemas import InstitutionBookOut, InstitutionOut
from app.services.graph import REGION_HAZARD
from app.services.insurance import compute_institution_book

router = APIRouter(prefix="/api/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionOut])
def list_institutions(kind: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Institution)
    if kind:
        query = query.filter(Institution.kind == kind)
    return query.all()


@router.get("/{institution_id}", response_model=InstitutionOut)
def get_institution(institution_id: str, db: Session = Depends(get_db)):
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution:
        raise HTTPException(status_code=404, detail=f"No institution with id '{institution_id}'")
    return institution


@router.get("/{institution_id}/book", response_model=InstitutionBookOut)
def get_institution_book(
    institution_id: str, region: str, severity: int = 50, duration_months: int = 6, db: Session = Depends(get_db)
):
    """An insurer's book under a scenario — sum insured, expected net
    claims, loss ratio, reinsurance cession, and (for a subsidized scheme
    like PMFBY) the farmer-paid vs. government-subsidy premium split. Only
    meaningful for an `insurer`-kind institution — 404s for a bank/govt id,
    same honesty-over-convenience pattern as the connector statuses."""
    hazard_id = REGION_HAZARD.get(region)
    if not hazard_id:
        raise HTTPException(status_code=400, detail=f"Unknown region '{region}'. Expected one of {list(REGION_HAZARD)}.")

    result = compute_institution_book(db, institution_id, hazard_id, severity, duration_months)
    if not result:
        raise HTTPException(status_code=404, detail=f"No insurer institution with id '{institution_id}'")

    return InstitutionBookOut(
        institution=result.institution,
        policy_count=result.policy_count,
        total_sum_insured_cr=result.total_sum_insured_cr,
        total_premium_cr=result.total_premium_cr,
        expected_net_claims_cr=result.expected_net_claims_cr,
        gross_loss_ratio=result.gross_loss_ratio,
        ceded_claims_cr=result.ceded_claims_cr,
        retained_claims_cr=result.retained_claims_cr,
        farmer_paid_premium_cr=result.farmer_paid_premium_cr,
        govt_subsidy_cr=result.govt_subsidy_cr,
    )
