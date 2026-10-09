from app.services.financial import CompanyInput, compute_scenario, stress_pd_lgd


def test_stress_pd_lgd_baseline_severity_zero_equals_baseline():
    """At severity 0, the stress formula should return exactly the baseline inputs."""
    pd, lgd = stress_pd_lgd(0.02, 0.4, severity=0, duration_months=6, substitutability="Moderate")
    assert pd == 0.02
    assert lgd == 0.4


def test_stress_pd_lgd_worked_example_matches_readme_illustration():
    """EAD 100cr, baseline PD 2%, LGD 40% -> baseline EL 0.8cr (the exact
    worked example used throughout the product docs and UI copy)."""
    ead, pd, lgd = 100, 0.02, 0.4
    baseline_el = ead * pd * lgd
    assert round(baseline_el, 2) == 0.8


def test_stress_increases_monotonically_with_severity():
    low_pd, low_lgd = stress_pd_lgd(0.02, 0.4, severity=20, duration_months=6, substitutability="Moderate")
    high_pd, high_lgd = stress_pd_lgd(0.02, 0.4, severity=90, duration_months=6, substitutability="Moderate")
    assert high_pd > low_pd
    assert high_lgd > low_lgd


def test_stress_pd_lgd_never_exceeds_95_percent():
    pd, lgd = stress_pd_lgd(0.5, 0.8, severity=100, duration_months=12, substitutability="Limited", vulnerability=1.45)
    assert pd <= 0.95
    assert lgd <= 0.95


def test_compute_scenario_sums_per_company_not_blended_average():
    companies = [
        CompanyInput("a", "Tourism", ead_cr=100, baseline_pd=0.02, baseline_lgd=0.4),
        CompanyInput("b", "IT / BPO", ead_cr=100, baseline_pd=0.02, baseline_lgd=0.4),
    ]
    result = compute_scenario(companies, severity=90, duration_months=6, substitutability="Moderate", intervention_ids=[])
    # Tourism (vulnerability 1.45) must stress harder than IT/BPO (0.5) under
    # the identical scenario — this is the whole point of per-company,
    # sector-weighted aggregation instead of one blended portfolio PD/LGD.
    tourism_only = compute_scenario([companies[0]], 90, 6, "Moderate", [])
    it_only = compute_scenario([companies[1]], 90, 6, "Moderate", [])
    assert tourism_only.stressed_el_cr > it_only.stressed_el_cr
    assert round(result.stressed_el_cr, 4) == round(tourism_only.stressed_el_cr + it_only.stressed_el_cr, 4)


def test_mitigation_reduces_incremental_loss_only():
    companies = [CompanyInput("a", "Tourism", ead_cr=100, baseline_pd=0.02, baseline_lgd=0.4)]
    unmitigated = compute_scenario(companies, 90, 6, "Moderate", [])
    mitigated = compute_scenario(companies, 90, 6, "Moderate", ["resilience-infra"])
    assert mitigated.stressed_el_cr == unmitigated.stressed_el_cr  # stressed figure is the same gross number
    assert mitigated.mitigated_el_cr < unmitigated.stressed_el_cr  # mitigation lowers the applied figure
    assert mitigated.baseline_el_cr == unmitigated.baseline_el_cr  # baseline is untouched by interventions
