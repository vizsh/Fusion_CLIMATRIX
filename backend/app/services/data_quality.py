"""Per-scenario and per-portfolio data-quality rollups — turning "how much
of this result is actually evidence-backed" from a question you'd have to
eyeball the graph to answer into a stored, queryable number.

Definition used throughout: an edge's weight (1-3, already a column on
DependencyEdge reflecting its financial/operational relevance) counts
toward whichever evidence-class bucket it belongs to. `sourced` and
`modelled` are both grounded in something real (a cited fact, or a real
computation) — `data_quality_score` is their combined weighted share.
`assumption` and `synthetic` are disclosed, not evidence-backed. This is a
disclosed scoring convention, not a regulatory or audit standard — see
docs/DATA_STRATEGY.md.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import DependencyEdge, EvidenceRecord
from app.services.graph import descendants, edges_within

EVIDENCE_CLASSES = ("sourced", "modelled", "assumption", "synthetic")


@dataclass
class DataQualityResult:
    sourced_weight_pct: float
    modelled_weight_pct: float
    assumption_weight_pct: float
    synthetic_weight_pct: float
    data_quality_score: float  # sourced + modelled, weighted
    edge_count: int


def _weighted_breakdown(edges: list[DependencyEdge]) -> DataQualityResult:
    if not edges:
        return DataQualityResult(0.0, 0.0, 0.0, 0.0, 0.0, 0)

    total_weight = sum(e.weight for e in edges)
    if total_weight == 0:
        return DataQualityResult(0.0, 0.0, 0.0, 0.0, 0.0, len(edges))

    buckets = dict.fromkeys(EVIDENCE_CLASSES, 0)
    for e in edges:
        cls = e.evidence_class if e.evidence_class in buckets else "assumption"
        buckets[cls] += e.weight

    pct = {k: v / total_weight for k, v in buckets.items()}
    return DataQualityResult(
        sourced_weight_pct=round(pct["sourced"], 4),
        modelled_weight_pct=round(pct["modelled"], 4),
        assumption_weight_pct=round(pct["assumption"], 4),
        synthetic_weight_pct=round(pct["synthetic"], 4),
        data_quality_score=round(pct["sourced"] + pct["modelled"], 4),
        edge_count=len(edges),
    )


def compute_scenario_data_quality(db: Session, hazard_id: str) -> DataQualityResult:
    """The propagation path a scenario run actually used: every edge
    reachable forward from the hazard, weighted by relevance. Computed
    once per run so `ScenarioRun` can store it as a real column rather
    than requiring a client to re-derive it from the raw edge list."""
    reached = descendants(db, hazard_id)
    edges = edges_within(db, reached)
    return _weighted_breakdown(edges)


@dataclass
class PortfolioDataQuality:
    position_count: int
    companies_with_sourced_evidence: int
    coverage_pct: float  # share of positions whose company has >=1 'sourced' evidence record


def compute_portfolio_data_quality(db: Session, company_ids: list[str]) -> PortfolioDataQuality:
    """What share of a portfolio's companies have at least one `sourced`
    evidence record backing a claim about them — the "data coverage
    indicator" DATA_STRATEGY.md's dashboard brief asks for, derivable
    once evidence records are reliably subject-linked (see
    EvidenceRecord's composite index)."""
    if not company_ids:
        return PortfolioDataQuality(0, 0, 0.0)

    sourced_subjects = {
        row.subject_id
        for row in db.query(EvidenceRecord.subject_id)
        .filter(
            EvidenceRecord.subject_type == "company",
            EvidenceRecord.subject_id.in_(company_ids),
            EvidenceRecord.evidence_class == "sourced",
        )
        .distinct()
        .all()
    }
    covered = len(sourced_subjects & set(company_ids))
    return PortfolioDataQuality(
        position_count=len(company_ids),
        companies_with_sourced_evidence=covered,
        coverage_pct=round(covered / len(company_ids), 4) if company_ids else 0.0,
    )
