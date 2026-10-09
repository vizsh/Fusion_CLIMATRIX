import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ScenarioRun
from app.schemas.schemas import ScenarioRunIn, ScenarioRunOut
from app.services.financial import CompanyInput, compute_scenario
from app.services.graph import REGION_HAZARD, hazard_reach_companies

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.post("/run", response_model=ScenarioRunOut)
def run_scenario(payload: ScenarioRunIn, db: Session = Depends(get_db)):
    hazard_id = REGION_HAZARD.get(payload.region)
    if not hazard_id:
        raise HTTPException(status_code=400, detail=f"Unknown region '{payload.region}'. Expected one of {list(REGION_HAZARD)}.")

    companies = hazard_reach_companies(db, hazard_id)
    result = compute_scenario(
        [CompanyInput(c.id, c.sector, c.ead_cr, c.baseline_pd, c.baseline_lgd) for c in companies],
        payload.severity,
        payload.duration_months,
        payload.substitutability,
        payload.interventions,
    )

    run = ScenarioRun(
        id=f"run-{uuid.uuid4().hex[:10]}",
        region=payload.region,
        hazard=payload.hazard,
        severity=payload.severity,
        duration_months=payload.duration_months,
        substitutability=payload.substitutability,
        interventions=",".join(payload.interventions),
        baseline_el_cr=result.baseline_el_cr,
        stressed_el_cr=result.stressed_el_cr,
        mitigated_el_cr=result.mitigated_el_cr,
        company_count=result.company_count,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


@router.get("", response_model=list[ScenarioRunOut])
def list_scenario_runs(db: Session = Depends(get_db), limit: int = 20):
    return db.query(ScenarioRun).order_by(ScenarioRun.created_at.desc()).limit(limit).all()


@router.get("/{run_id}", response_model=ScenarioRunOut)
def get_scenario_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(ScenarioRun).filter(ScenarioRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"No scenario run with id '{run_id}'")
    return run
