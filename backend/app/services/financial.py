"""The expected-credit-loss formula — a direct port of
frontend/src/store/useScenarioStore.ts's stressPdLgd/computeImpact, kept
numerically identical so a scenario run through this API produces the same
figures a user would see in the app. See the frontend file for the
disclosure that this is a transparent, disclosed formula, not a calibrated
hazard-to-credit model.
"""

from dataclasses import dataclass

SUB_MULTIPLIER = {"Limited": 1.25, "Moderate": 1.0, "Strong": 0.75}

SECTOR_VULNERABILITY = {
    "Tourism": 1.45,
    "Agriculture": 1.35,
    "Agro processing": 1.3,
    "Dairy": 1.25,
    "Seafood export": 1.2,
    "Rubber processing": 1.15,
    "Textiles": 1.1,
    "Manufacturing": 1.0,
    "Logistics": 1.0,
    "FMCG": 0.9,
    "Pharmaceuticals": 0.7,
    "IT / BPO": 0.5,
    "Construction": 1.2,
}


def sector_vulnerability(sector: str | None) -> float:
    if not sector:
        return 1.0
    return SECTOR_VULNERABILITY.get(sector, 1.0)


def stress_pd_lgd(
    baseline_pd: float,
    baseline_lgd: float,
    severity: int,
    duration_months: int,
    substitutability: str,
    vulnerability: float = 1.0,
) -> tuple[float, float]:
    sub_multiplier = SUB_MULTIPLIER.get(substitutability, 1.0)
    duration_factor = min(duration_months / 12, 1.0)
    severity_factor = (severity / 100) * vulnerability
    stressed_pd = min(baseline_pd * (1 + severity_factor * 4 * sub_multiplier * (0.5 + duration_factor)), 0.95)
    stressed_lgd = min(baseline_lgd + severity_factor * 0.15 * sub_multiplier, 0.95)
    return stressed_pd, stressed_lgd


INTERVENTION_REDUCTION = {
    "alt-route": 0.22,
    "supplier-diversification": 0.15,
    "resilience-infra": 0.34,
    "early-engagement": 0.12,
}


def combined_reduction_share(intervention_ids: list[str]) -> float:
    remaining = 1.0
    for iid in intervention_ids:
        share = INTERVENTION_REDUCTION.get(iid)
        if share:
            remaining *= 1 - share
    return 1 - remaining


@dataclass
class CompanyInput:
    id: str
    sector: str
    ead_cr: float
    baseline_pd: float
    baseline_lgd: float


@dataclass
class ScenarioResult:
    baseline_el_cr: float
    stressed_el_cr: float
    mitigated_el_cr: float
    company_count: int
    ead_cr: float


def compute_scenario(
    companies: list[CompanyInput],
    severity: int,
    duration_months: int,
    substitutability: str,
    intervention_ids: list[str],
) -> ScenarioResult:
    baseline_el = 0.0
    stressed_el = 0.0
    total_ead = 0.0
    for c in companies:
        stressed_pd, stressed_lgd = stress_pd_lgd(
            c.baseline_pd, c.baseline_lgd, severity, duration_months, substitutability, sector_vulnerability(c.sector)
        )
        baseline_el += c.ead_cr * c.baseline_pd * c.baseline_lgd
        stressed_el += c.ead_cr * stressed_pd * stressed_lgd
        total_ead += c.ead_cr

    reduction = combined_reduction_share(intervention_ids)
    mitigated_el = baseline_el + (stressed_el - baseline_el) * (1 - reduction)

    return ScenarioResult(
        baseline_el_cr=round(baseline_el, 4),
        stressed_el_cr=round(stressed_el, 4),
        mitigated_el_cr=round(mitigated_el, 4),
        company_count=len(companies),
        ead_cr=round(total_ead, 2),
    )
