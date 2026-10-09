"""Governed assumption queue — see ProposedUpdate's docstring in
app/models/entities.py for the full rationale (CLIMATRIX's own
implementation of the griid.ai propose-then-review pattern). No auth
system exists yet (see README's Honest limitations), so `proposed_by`
and `reviewer` are free-text fields, not authenticated identities — this
is a review-workflow prototype, not an access-controlled governance
system. Approving/rejecting does not change any live constant in the
app; that remains a manual follow-up edit, by design (see the model
docstring)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import ProposedUpdate
from app.schemas.schemas import ProposedUpdateCreateIn, ProposedUpdateOut, ProposedUpdateReviewIn

router = APIRouter(prefix="/api/proposals", tags=["proposals"])


@router.get("", response_model=list[ProposedUpdateOut])
def list_proposals(status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(ProposedUpdate)
    if status:
        query = query.filter(ProposedUpdate.status == status)
    return query.order_by(ProposedUpdate.created_at.desc()).all()


@router.post("", response_model=ProposedUpdateOut, status_code=201)
def create_proposal(body: ProposedUpdateCreateIn, db: Session = Depends(get_db)):
    row = ProposedUpdate(
        id=f"prop-{uuid.uuid4().hex[:10]}",
        kind=body.kind,
        target=body.target,
        current_value=body.current_value,
        proposed_value=body.proposed_value,
        rationale=body.rationale,
        proposed_by=body.proposed_by,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _review(proposal_id: str, status: str, body: ProposedUpdateReviewIn, db: Session) -> ProposedUpdate:
    row = db.query(ProposedUpdate).filter(ProposedUpdate.id == proposal_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"No proposal with id '{proposal_id}'")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already '{row.status}' — cannot review again.")
    row.status = status
    row.reviewer = body.reviewer
    row.review_note = body.review_note
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{proposal_id}/approve", response_model=ProposedUpdateOut)
def approve_proposal(proposal_id: str, body: ProposedUpdateReviewIn, db: Session = Depends(get_db)):
    return _review(proposal_id, "approved", body, db)


@router.post("/{proposal_id}/reject", response_model=ProposedUpdateOut)
def reject_proposal(proposal_id: str, body: ProposedUpdateReviewIn, db: Session = Depends(get_db)):
    return _review(proposal_id, "rejected", body, db)
