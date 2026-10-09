from fastapi import APIRouter, Depends

from app.db.session import get_db
from app.models import EvidenceRecord, NewsArticle
from app.schemas.schemas import SemanticSearchHit, SemanticSearchResult
from app.services.nlp import semantic_search
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/semantic", response_model=SemanticSearchResult)
def semantic(q: str, kind: str = "all", top_k: int = 10, db: Session = Depends(get_db)):
    """TF-IDF semantic search (app/services/nlp.py) over whatever's already
    in the database — fetched news articles and evidence records — ranked
    by topical similarity rather than exact keyword match. `kind` narrows
    to 'news', 'evidence', or 'all' (default)."""
    documents: list[tuple[str, str]] = []
    doc_kind: dict[str, str] = {}
    doc_title: dict[str, str] = {}

    if kind in ("news", "all"):
        for a in db.query(NewsArticle).all():
            text = f"{a.title} {a.description}"
            documents.append((a.id, text))
            doc_kind[a.id] = "news"
            doc_title[a.id] = a.title

    if kind in ("evidence", "all"):
        for e in db.query(EvidenceRecord).all():
            text = f"{e.label} {e.detail}"
            documents.append((e.id, text))
            doc_kind[e.id] = "evidence"
            doc_title[e.id] = e.label

    ranked = semantic_search(q, documents, top_k=top_k)
    hits = [SemanticSearchHit(id=doc_id, kind=doc_kind[doc_id], title=doc_title[doc_id], score=round(score, 4)) for doc_id, score in ranked]
    return SemanticSearchResult(query=q, hits=hits)
