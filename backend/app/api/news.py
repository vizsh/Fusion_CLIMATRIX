import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.connectors.alpha_ai import AlphaAiConnector
from app.connectors.article_extractor import ArticleExtractorConnector
from app.connectors.base import ConnectorStatus
from app.connectors.news import NewsConnector
from app.db.session import get_db
from app.models import Company, NewsArticle, NewsEntityLink
from app.schemas.schemas import ArticleExtractIn, ArticleExtractResult, InsiderSummaryResult, NewsQueryResult
from app.services.nlp import link_entities

router = APIRouter(prefix="/api", tags=["news"])
_news = NewsConnector()
_alphai = AlphaAiConnector()
_extractor = ArticleExtractorConnector()

# Region codes -> labels, mirroring the frontend's REGION_LABEL — used only
# as the gazetteer for entity-linking, not as a source of scenario state.
REGION_LABELS = {
    "HP": "Himachal Pradesh",
    "KL": "Kerala",
    "MH": "Marathwada",
    "UK": "Uttarakhand",
}


def _link_article_entities(db: Session, article: NewsArticle) -> None:
    """NLP entity-linking: does this article's title+description mention a
    company or region from our own graph? Writes NewsEntityLink rows so a
    news result becomes a linked reference instead of just a query-matched
    string. Best-effort — a linking failure never blocks the news fetch
    itself from succeeding."""
    companies = [(c.id, c.name) for c in db.query(Company.id, Company.name).all()]
    matches = link_entities(f"{article.title} {article.description}", companies, REGION_LABELS)
    for m in matches:
        db.add(
            NewsEntityLink(
                id=f"nel-{uuid.uuid4().hex[:10]}",
                article_id=article.id,
                entity_type=m["entity_type"],
                entity_id=m["entity_id"],
                entity_label=m["entity_label"],
                match_score=m["match_score"],
            )
        )


@router.get("/news/search", response_model=NewsQueryResult)
async def search_news(q: str, db: Session = Depends(get_db)):
    """General news — NewsAPI primary, GNews fallback. `q` is expected to be
    a region/hazard keyword string (e.g. 'Himachal Pradesh flood'), not a
    company name — see NewsArticle's docstring on why."""
    result = await _news.fetch(query=q)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)

    now = datetime.now(timezone.utc)
    rows = []
    for a in result.data:
        row = NewsArticle(
            id=f"news-{uuid.uuid4().hex[:10]}",
            query=q,
            title=a.get("title") or "(untitled)",
            description=a.get("description") or "",
            url=a.get("url") or "",
            source_name=a.get("source_name") or "",
            published_at=a.get("published_at") or "",
            provider=a["provider"],
            retrieved_at=now,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for r in rows:
        _link_article_entities(db, r)
    db.commit()
    for r in rows:
        db.refresh(r)

    return NewsQueryResult(articles=rows, provider=rows[0].provider if rows else "none", query=q, retrieved_at=now)


@router.get("/news/market", response_model=NewsQueryResult)
async def search_market_news(q: str, min_relevance: int = 1, db: Session = Depends(get_db)):
    """AlphaAI financial news search — per-article relevance score and
    category, distinct from the plain news search above."""
    result = await _alphai.search_news(query=q, min_relevance=min_relevance)
    if result.status == ConnectorStatus.UNCONFIGURED:
        raise HTTPException(status_code=503, detail="AlphaAI is not configured (ALPHAI_API_KEY unset).")
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)

    now = datetime.now(timezone.utc)
    rows = []
    for a in result.data:
        row = NewsArticle(
            id=f"mkt-{uuid.uuid4().hex[:10]}",
            query=q,
            title=a.get("title") or "(untitled)",
            description=a.get("summary") or "",
            url=a.get("url") or "",
            source_name=a.get("source_name") or "",
            published_at=a.get("published_at") or "",
            provider="AlphaAI",
            relevance=a.get("relevance"),
            category=a.get("category"),
            retrieved_at=now,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for r in rows:
        _link_article_entities(db, r)
    db.commit()
    for r in rows:
        db.refresh(r)

    return NewsQueryResult(articles=rows, provider="AlphaAI", query=q, retrieved_at=now)


@router.post("/news/extract", response_model=ArticleExtractResult)
async def extract_article(payload: ArticleExtractIn):
    """Server-side fetch + readable-text extraction for an arbitrary news
    URL the user pastes into the Copilot — the one step of "add a news
    source and ask how it affects my portfolio" that can't run in the
    browser (CORS blocks a page's own fetch() of most external news
    sites). Entity-linking against the portfolio graph and the financial
    impact computation both happen client-side afterwards, reusing the
    exact same engine every dashboard page already uses — this endpoint's
    only job is turning a URL into real article text."""
    result = await _extractor.fetch(url=payload.url)
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)
    row = result.data[0]
    return ArticleExtractResult(**row)


@router.get("/market/insider/{ticker}", response_model=InsiderSummaryResult)
async def insider_summary(ticker: str):
    """Reference-only: a real, US-listed comparable ticker's insider
    (SEC Form 4) summary via AlphaAI. Never attached to a synthetic
    CLIMATRIX company — the caller supplies the ticker explicitly."""
    result = await _alphai.ticker_insider_summary(ticker)
    if result.status == ConnectorStatus.UNCONFIGURED:
        raise HTTPException(status_code=503, detail="AlphaAI is not configured (ALPHAI_API_KEY unset).")
    if result.status != ConnectorStatus.OK:
        raise HTTPException(status_code=502, detail=result.message)
    return InsiderSummaryResult(ticker=ticker.upper(), raw=result.data[0])
