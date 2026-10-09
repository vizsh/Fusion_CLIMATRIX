"""Dependency graph traversal — a Python port of the same BFS logic used in
frontend/src/lib/graphAnalytics.ts, operating over DependencyEdge rows
instead of the hardcoded TS array, so a scenario run computed by the API
and a scenario viewed in the app are the same calculation over the same
graph shape (companies/edges are seeded 1:1 from indiaGraphData.ts)."""

from collections import defaultdict, deque

from sqlalchemy.orm import Session

from app.models import Company, DependencyEdge

REGION_HAZARD = {"HP": "hz-hp", "KL": "hz-kl", "MH": "hz-mh", "UK": "hz-uk"}


def _adjacency(db: Session) -> dict[str, list[str]]:
    forward: dict[str, list[str]] = defaultdict(list)
    for edge in db.query(DependencyEdge).all():
        forward[edge.from_id].append(edge.to_id)
    return forward


def _reverse_adjacency(db: Session) -> dict[str, list[str]]:
    reverse: dict[str, list[str]] = defaultdict(list)
    for edge in db.query(DependencyEdge).all():
        reverse[edge.to_id].append(edge.from_id)
    return reverse


def _bfs(adjacency: dict[str, list[str]], start_id: str) -> set[str]:
    visited = {start_id}
    queue = deque([start_id])
    while queue:
        cur = queue.popleft()
        for nxt in adjacency.get(cur, []):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
    return visited


def descendants(db: Session, start_id: str) -> set[str]:
    return _bfs(_adjacency(db), start_id)


def ancestors(db: Session, start_id: str) -> set[str]:
    return _bfs(_reverse_adjacency(db), start_id)


def edges_within(db: Session, node_ids: set[str]) -> list[DependencyEdge]:
    return [e for e in db.query(DependencyEdge).all() if e.from_id in node_ids and e.to_id in node_ids]


def hazard_reach_companies(db: Session, hazard_id: str) -> list[Company]:
    reached = descendants(db, hazard_id)
    return db.query(Company).filter(Company.id.in_(reached)).all()
