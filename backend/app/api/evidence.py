from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import EvidenceRecord
from app.schemas.schemas import EvidenceOut

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("", response_model=list[EvidenceOut])
def list_evidence(db: Session = Depends(get_db), subject_id: str | None = None):
    q = db.query(EvidenceRecord)
    if subject_id:
        q = q.filter(EvidenceRecord.subject_id == subject_id)
    return q.order_by(EvidenceRecord.retrieved_at.desc()).all()
