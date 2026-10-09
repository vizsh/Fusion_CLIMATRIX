"""Server-side port of frontend/src/lib/insurance.ts's protection-gap and
insurer-book calculations, now that Institution/Company.insurer_id are real
columns instead of dangling edge endpoints. Kept numerically identical to
the frontend on purpose — same pattern as services/financial.py's
stress_pd_lgd port, verified in tests/test_financial.py."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Company, Institution
from app.services.financial import sector_vulnerability
from app.services.graph import hazard_reach_companies


@dataclass
class ClaimEstimate:
    disruption_fraction: float
    gross_claim_cr: float
    deductible_cr: float
    net_claim_cr: float
    premium_cr: float


def estimate_claim(company: Company, severity: int, duration_months: int) -> ClaimEstimate | None:
    if not company.sum_insured_cr:
        return None
    vulnerability = sector_vulnerability(company.sector)
    months_fraction = min(duration_months / 12, 1.0)
    disruption_fraction = min((severity / 100) * vulnerability * months_fraction, 1.0)
    gross_claim = company.sum_insured_cr * disruption_fraction
    deductible = gross_claim * (company.deductible_pct or 0.0)
    net_claim = max(0.0, gross_claim - deductible)
    premium = company.sum_insured_cr * ((company.premium_rate_bps or 0.0) / 10000)
    return ClaimEstimate(disruption_fraction, gross_claim, deductible, net_claim, premium)


@dataclass
class ProtectionGapResult:
    exposed_company_count: int
    exposed_ead_cr: float
    insured_ead_cr: float
    uninsured_ead_cr: float
    protection_gap_share: float
    uninsured_company_ids: list[str]


def compute_protection_gap(db: Session, hazard_id: str, severity: int, duration_months: int) -> ProtectionGapResult:
    companies = hazard_reach_companies(db, hazard_id)
    exposed_ead = sum(c.ead_cr for c in companies)
    insured_ead = 0.0
    uninsured_ids = []
    for c in companies:
        if c.insurer_id and estimate_claim(c, severity, duration_months):
            insured_ead += c.ead_cr
        else:
            uninsured_ids.append(c.id)
    uninsured_ead = exposed_ead - insured_ead
    return ProtectionGapResult(
        exposed_company_count=len(companies),
        exposed_ead_cr=round(exposed_ead, 2),
        insured_ead_cr=round(insured_ead, 2),
        uninsured_ead_cr=round(uninsured_ead, 2),
        protection_gap_share=round(uninsured_ead / exposed_ead, 4) if exposed_ead else 0.0,
        uninsured_company_ids=uninsured_ids,
    )


@dataclass
class InstitutionBookResult:
    institution: Institution
    policy_count: int
    total_sum_insured_cr: float
    total_premium_cr: float
    expected_net_claims_cr: float
    gross_loss_ratio: float
    ceded_claims_cr: float
    retained_claims_cr: float
    farmer_paid_premium_cr: float
    govt_subsidy_cr: float


def compute_institution_book(
    db: Session, institution_id: str, hazard_id: str, severity: int, duration_months: int
) -> InstitutionBookResult | None:
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution or institution.kind != "insurer":
        return None

    companies = hazard_reach_companies(db, hazard_id)
    book = [c for c in companies if c.insurer_id == institution_id]

    total_sum_insured = 0.0
    total_premium = 0.0
    total_net_claims = 0.0
    for c in book:
        claim = estimate_claim(c, severity, duration_months)
        if not claim:
            continue
        total_sum_insured += c.sum_insured_cr or 0.0
        total_premium += claim.premium_cr
        total_net_claims += claim.net_claim_cr

    ceded_pct = institution.ceded_reinsurance_share_pct or 0.0
    ceded_claims = total_net_claims * (ceded_pct / 100)
    govt_subsidy_pct = institution.govt_subsidy_pct or 0.0
    govt_subsidy_cr = total_premium * (govt_subsidy_pct / 100)

    return InstitutionBookResult(
        institution=institution,
        policy_count=len(book),
        total_sum_insured_cr=round(total_sum_insured, 2),
        total_premium_cr=round(total_premium, 4),
        expected_net_claims_cr=round(total_net_claims, 4),
        gross_loss_ratio=round(total_net_claims / total_premium, 4) if total_premium else 0.0,
        ceded_claims_cr=round(ceded_claims, 4),
        retained_claims_cr=round(total_net_claims - ceded_claims, 4),
        farmer_paid_premium_cr=round(total_premium - govt_subsidy_cr, 4),
        govt_subsidy_cr=round(govt_subsidy_cr, 4),
    )
