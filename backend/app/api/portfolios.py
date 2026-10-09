from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Portfolio, Position
from app.schemas.schemas import PortfolioOut, PortfolioSummary

router = APIRouter(prefix="/api/portfolios", tags=["portfolios"])


@router.get("", response_model=list[PortfolioSummary])
def list_portfolios(db: Session = Depends(get_db)):
    portfolios = db.query(Portfolio).options(joinedload(Portfolio.positions)).all()
    return [
        PortfolioSummary(
            id=p.id,
            name=p.name,
            mandate=p.mandate,
            position_count=len(p.positions),
            total_cost_basis_cr=round(sum(pos.cost_basis_cr for pos in p.positions), 2),
            total_market_value_cr=round(sum(pos.market_value_cr for pos in p.positions), 2),
        )
        for p in portfolios
    ]


@router.get("/{portfolio_id}", response_model=PortfolioOut)
def get_portfolio(portfolio_id: str, db: Session = Depends(get_db)):
    portfolio = (
        db.query(Portfolio)
        .options(joinedload(Portfolio.positions).joinedload(Position.company))
        .filter(Portfolio.id == portfolio_id)
        .first()
    )
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"No portfolio with id '{portfolio_id}'")
    return portfolio
