"""Real, lightweight NLP: TF-IDF semantic search and gazetteer-based entity
linking. Deliberately CPU-only, dependency-light (scikit-learn + stdlib
difflib, no downloaded language model, no embedding server) — the same
"prefer free/lightweight over heavy infra" choice this project already
made for SQLite over Postgres. Both pieces are classic, explainable NLP
techniques, not an LLM call wearing an NLP label.
"""

import difflib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ENTITY_MATCH_THRESHOLD = 0.3


def semantic_search(query: str, documents: list[tuple[str, str]], top_k: int = 10) -> list[tuple[str, float]]:
    """`documents` is a list of (id, text). Returns the top_k (id, score)
    pairs ranked by TF-IDF cosine similarity to `query` — finds documents
    about the same topic even without exact keyword overlap (e.g. "crop
    failure" surfacing a "drought" article), unlike a substring search."""
    if not documents or not query.strip():
        return []

    ids = [d[0] for d in documents]
    texts = [d[1] or "" for d in documents]

    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000, ngram_range=(1, 2))
    try:
        matrix = vectorizer.fit_transform([*texts, query])
    except ValueError:
        # Every document (and the query) was empty/stopwords-only after
        # cleaning — nothing meaningful to rank.
        return []

    query_vec = matrix[-1]
    doc_matrix = matrix[:-1]
    sims = cosine_similarity(query_vec, doc_matrix).flatten()

    ranked = sorted(zip(ids, sims), key=lambda x: x[1], reverse=True)
    return [(doc_id, float(score)) for doc_id, score in ranked[:top_k] if score > 0]


def link_entities(
    text: str, companies: list[tuple[str, str]], regions: dict[str, str]
) -> list[dict]:
    """Gazetteer-based entity linking: does this free text mention a known
    company or region from our own graph? `companies` is a list of
    (id, name); `regions` maps region code -> label (e.g. 'HP' ->
    'Himachal Pradesh'). An exact substring match scores 1.0; otherwise a
    difflib.SequenceMatcher ratio is used as a fuzzy-match confidence,
    kept only above ENTITY_MATCH_THRESHOLD. No ML model — deterministic
    and trivially explainable per match, which matters more than recall
    for a feature whose job is to make a data *link*, not just a guess."""
    if not text.strip():
        return []
    text_lower = text.lower()

    matches: list[dict] = []
    for entity_id, name in companies:
        name_lower = name.lower()
        if not name_lower:
            continue
        if name_lower in text_lower:
            matches.append({"entity_type": "company", "entity_id": entity_id, "entity_label": name, "match_score": 1.0})
            continue
        ratio = difflib.SequenceMatcher(None, name_lower, text_lower).ratio()
        if ratio > ENTITY_MATCH_THRESHOLD:
            matches.append(
                {"entity_type": "company", "entity_id": entity_id, "entity_label": name, "match_score": round(ratio, 3)}
            )

    for code, label in regions.items():
        label_lower = label.lower()
        if label_lower in text_lower or f" {code.lower()} " in f" {text_lower} ":
            matches.append({"entity_type": "region", "entity_id": code, "entity_label": label, "match_score": 1.0})

    matches.sort(key=lambda m: m["match_score"], reverse=True)
    return matches[:10]
