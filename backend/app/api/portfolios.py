from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models import Portfolio, Position
from app.schemas.schemas import PortfolioDataQualityOut, PortfolioOut, PortfolioSummary
from app.services.data_quality import compute_portfolio_data_quality

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


@router.get("/{portfolio_id}/data-quality", response_model=PortfolioDataQualityOut)
def get_portfolio_data_quality(portfolio_id: str, db: Session = Depends(get_db)):
    """What share of this portfolio's companies have at least one `sourced`
    evidence record backing a claim about them — the data-coverage
    indicator from docs/DATA_STRATEGY.md's linkage backlog."""
    portfolio = db.query(Portfolio).options(joinedload(Portfolio.positions)).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail=f"No portfolio with id '{portfolio_id}'")
    company_ids = [pos.company_id for pos in portfolio.positions]
    result = compute_portfolio_data_quality(db, company_ids)
    return PortfolioDataQualityOut(
        portfolio_id=portfolio_id,
        position_count=result.position_count,
        companies_with_sourced_evidence=result.companies_with_sourced_evidence,
        coverage_pct=result.coverage_pct,
    )
