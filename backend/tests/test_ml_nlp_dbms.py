"""Coverage for the backend v2 additions: ML anomaly detection, NLP
semantic search/entity-linking, and the DBMS data-quality rollups — plus
the API endpoints that expose them."""

from app.models import Company, DependencyEdge, EvidenceRecord, HazardEvent, Institution, NewsArticle, Organization, Portfolio, Position
from app.services.data_quality import compute_portfolio_data_quality, compute_scenario_data_quality
from app.services.insurance import compute_institution_book, compute_protection_gap, estimate_claim
from app.services.ml_anomaly import detect_anomalies
from app.services.nlp import link_entities, semantic_search


# ---------------------------------------------------------------- ML -----


def test_detect_anomalies_flags_a_genuine_outlier():
    dates = [f"2024010{i}" if i < 10 else f"202401{i}" for i in range(1, 31)]
    values = [5.0 + (i % 3) for i in range(30)]  # a calm, low-variance baseline
    values[15] = 500.0  # an unmistakable outlier

    points = detect_anomalies(dates, values)
    assert len(points) == 30
    assert points[15].is_anomaly is True
    assert points[15].z_score > 2.0
    # a normal day from the baseline should not be flagged
    assert points[0].is_anomaly is False


def test_detect_anomalies_returns_empty_for_too_short_series():
    assert detect_anomalies(["20240101", "20240102"], [1.0, 2.0]) == []


def test_detect_anomalies_handles_a_perfectly_flat_series():
    dates = [f"202401{i:02d}" for i in range(1, 11)]
    values = [10.0] * 10
    points = detect_anomalies(dates, values)
    assert len(points) == 10
    assert all(p.is_anomaly is False for p in points)


# --------------------------------------------------------------- NLP -----


def test_semantic_search_ranks_topical_match_above_unrelated_text():
    docs = [
        ("a", "severe flood warning for Himachal Pradesh after heavy monsoon rain"),
        ("b", "quarterly earnings beat expectations for a technology company"),
        ("c", "drought conditions worsen across the Marathwada agricultural belt"),
    ]
    results = semantic_search("monsoon flood rainfall disaster", docs)
    assert results
    assert results[0][0] == "a"
    assert results[0][1] > 0


def test_semantic_search_handles_empty_query_and_empty_corpus():
    assert semantic_search("", [("a", "text")]) == []
    assert semantic_search("flood", []) == []


def test_link_entities_finds_exact_company_mention():
    companies = [("co-hp-tourism", "Manali Hill Tourism Cooperative"), ("co-kl-agri", "Wayanad Plantation Exports Ltd.")]
    regions = {"HP": "Himachal Pradesh", "KL": "Kerala"}
    text = "Manali Hill Tourism Cooperative reported disruption after flooding in Himachal Pradesh."

    matches = link_entities(text, companies, regions)
    ids = {m["entity_id"] for m in matches}
    assert "co-hp-tourism" in ids
    assert "HP" in ids
    assert "co-kl-agri" not in ids  # unrelated company should not be pulled in
    exact = next(m for m in matches if m["entity_id"] == "co-hp-tourism")
    assert exact["match_score"] == 1.0


def test_link_entities_handles_empty_text():
    assert link_entities("", [("co-1", "Some Co")], {}) == []


# -------------------------------------------------------------- DBMS -----


def test_scenario_data_quality_weights_by_evidence_class_and_edge_weight(db_session):
    db_session.add(HazardEvent(id="hz-q", name="Q Hazard", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.add(Company(id="co-q1", name="Q1", sector="Tourism", region="HP", lat=31.1, lng=77.1, ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    db_session.add(Company(id="co-q2", name="Q2", sector="Tourism", region="HP", lat=31.2, lng=77.2, ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    # weight 3 sourced, weight 1 synthetic -> sourced should dominate the weighted share
    db_session.add(DependencyEdge(id="e-q1", from_id="hz-q", to_id="co-q1", edge_type="AFFECTED_BY", evidence_class="sourced", weight=3))
    db_session.add(DependencyEdge(id="e-q2", from_id="hz-q", to_id="co-q2", edge_type="AFFECTED_BY", evidence_class="synthetic", weight=1))
    db_session.commit()

    result = compute_scenario_data_quality(db_session, "hz-q")
    assert result.edge_count == 2
    assert result.sourced_weight_pct == 0.75
    assert result.synthetic_weight_pct == 0.25
    assert result.data_quality_score == 0.75  # sourced + modelled


def test_scenario_data_quality_handles_a_hazard_with_no_edges(db_session):
    db_session.add(HazardEvent(id="hz-lonely", name="Lonely", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.commit()
    result = compute_scenario_data_quality(db_session, "hz-lonely")
    assert result.edge_count == 0
    assert result.data_quality_score == 0.0


def test_portfolio_data_quality_counts_sourced_evidence_coverage(db_session):
    db_session.add(Organization(id="org-q", name="Org", org_type="bank"))
    db_session.add(Company(id="co-cov-1", name="Covered Co", sector="Tourism", region="HP", ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    db_session.add(Company(id="co-cov-2", name="Uncovered Co", sector="Tourism", region="HP", ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    db_session.add(EvidenceRecord(id="ev-cov", subject_type="company", subject_id="co-cov-1", label="x", evidence_class="sourced"))
    db_session.commit()

    result = compute_portfolio_data_quality(db_session, ["co-cov-1", "co-cov-2"])
    assert result.companies_with_sourced_evidence == 1
    assert result.coverage_pct == 0.5


def test_portfolio_data_quality_handles_empty_portfolio(db_session):
    result = compute_portfolio_data_quality(db_session, [])
    assert result.coverage_pct == 0.0


# ---------------------------------------------------------- insurance ---


def _seed_insurance_fixture(db_session):
    # The db_session fixture shares one SQLite file across the whole test
    # session (see conftest.py) — guard against re-inserting the same rows
    # when multiple tests in this file reuse this fixture.
    if db_session.query(Institution).filter(Institution.id == "insurer-test").first():
        return
    # hz-hp (the real HP hazard REGION_HAZARD maps to) may already exist
    # from another test in this session-shared DB — reuse it so this
    # fixture's companies are reachable via region="HP" in API-level tests.
    if not db_session.query(HazardEvent).filter(HazardEvent.id == "hz-hp").first():
        db_session.add(HazardEvent(id="hz-hp", name="HP Hazard", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.add(
        Institution(
            id="insurer-test", name="Test Insurer", kind="insurer", region="National",
            ceded_reinsurance_share_pct=40, reinsurer_name="Test Re Treaty",
        )
    )
    db_session.add(
        Institution(
            id="pmfby-test", name="Test PMFBY", kind="insurer", region="National", govt_subsidy_pct=75,
        )
    )
    db_session.add(
        Company(
            id="co-ins-covered", name="Covered Co", sector="Tourism", region="HP", ead_cr=50,
            baseline_pd=0.02, baseline_lgd=0.3, insurer_id="insurer-test",
            sum_insured_cr=70, premium_rate_bps=180, deductible_pct=0.1,
        )
    )
    db_session.add(
        Company(
            id="co-ins-pmfby", name="PMFBY Co", sector="Agriculture", region="HP", ead_cr=30,
            baseline_pd=0.03, baseline_lgd=0.4, insurer_id="pmfby-test",
            sum_insured_cr=40, premium_rate_bps=300, deductible_pct=0,
        )
    )
    db_session.add(
        Company(id="co-ins-uncovered", name="Uncovered Co", sector="Manufacturing", region="HP", ead_cr=20, baseline_pd=0.02, baseline_lgd=0.3)
    )
    for cid in ("co-ins-covered", "co-ins-pmfby", "co-ins-uncovered"):
        db_session.add(DependencyEdge(id=f"e-ins-{cid}", from_id="hz-hp", to_id=cid, edge_type="AFFECTED_BY", evidence_class="sourced", weight=2))
    db_session.commit()


def test_estimate_claim_returns_none_for_uninsured_company(db_session):
    _seed_insurance_fixture(db_session)
    company = db_session.query(Company).filter(Company.id == "co-ins-uncovered").first()
    assert estimate_claim(company, 80, 6) is None


def test_estimate_claim_scales_with_severity(db_session):
    _seed_insurance_fixture(db_session)
    company = db_session.query(Company).filter(Company.id == "co-ins-covered").first()
    low = estimate_claim(company, 20, 6)
    high = estimate_claim(company, 90, 6)
    assert low.net_claim_cr < high.net_claim_cr
    assert high.net_claim_cr <= company.sum_insured_cr  # never pays out more than the policy


def test_compute_protection_gap_splits_insured_vs_uninsured(db_session):
    # hz-hp is a shared fixture hazard other tests in this session-wide DB
    # may also attach companies to — assert membership, not exact totals.
    _seed_insurance_fixture(db_session)
    result = compute_protection_gap(db_session, "hz-hp", 80, 6)
    assert "co-ins-uncovered" in result.uninsured_company_ids
    assert "co-ins-covered" not in result.uninsured_company_ids
    assert "co-ins-pmfby" not in result.uninsured_company_ids
    assert result.insured_ead_cr >= 80  # at least 50 + 30 from this fixture
    assert result.uninsured_ead_cr >= 20


def test_compute_institution_book_private_insurer_has_no_subsidy(db_session):
    _seed_insurance_fixture(db_session)
    book = compute_institution_book(db_session, "insurer-test", "hz-hp", 80, 6)
    assert book.policy_count == 1
    assert book.govt_subsidy_cr == 0.0
    assert book.ceded_claims_cr > 0  # 40% reinsurance cession should apply
    assert round(book.ceded_claims_cr + book.retained_claims_cr, 4) == round(book.expected_net_claims_cr, 4)


def test_compute_institution_book_pmfby_splits_farmer_and_subsidy(db_session):
    _seed_insurance_fixture(db_session)
    book = compute_institution_book(db_session, "pmfby-test", "hz-hp", 80, 6)
    assert book.policy_count == 1
    assert book.govt_subsidy_cr > 0
    assert round(book.farmer_paid_premium_cr + book.govt_subsidy_cr, 4) == round(book.total_premium_cr, 4)
    assert book.ceded_claims_cr == 0.0  # no reinsurance treaty configured for this scheme


def test_compute_institution_book_returns_none_for_non_insurer(db_session):
    _seed_insurance_fixture(db_session)
    if not db_session.query(Institution).filter(Institution.id == "bank-test").first():
        db_session.add(Institution(id="bank-test", name="Test Bank", kind="bank", region="National"))
        db_session.commit()
    assert compute_institution_book(db_session, "bank-test", "hz-hp", 80, 6) is None


# --------------------------------------------------------- API surface ---


def test_weather_anomalies_endpoint_returns_scored_points(client, monkeypatch):
    async def fake_resolve(db, lat, lng, start, end):
        from app.models import WeatherObservation

        dates = [f"202401{i:02d}" for i in range(1, 29)]
        values = [5.0] * 27 + [400.0]
        rows = [
            WeatherObservation(id=f"wx-{i}", lat=lat, lng=lng, date=d, precipitation_mm=v, temp_c_avg=20.0)
            for i, (d, v) in enumerate(zip(dates, values))
        ]
        return rows, "NASA POWER", "https://example.test", False

    monkeypatch.setattr("app.api.weather._resolve_observations", fake_resolve)
    resp = client.get("/api/weather/anomalies", params={"lat": 31.98, "lng": 77.15, "days": 28})
    assert resp.status_code == 200
    body = resp.json()
    assert body["anomaly_count"] >= 1
    assert any(p["is_anomaly"] for p in body["points"])


def test_semantic_search_endpoint_ranks_seeded_articles(client, db_session):
    db_session.add(
        NewsArticle(
            id="news-flood", query="HP flood", title="Flood warning issued", description="heavy monsoon rain in Himachal",
            url="https://x.test/1", provider="NewsAPI",
        )
    )
    db_session.add(
        NewsArticle(
            id="news-earnings", query="HP flood", title="Company posts earnings", description="quarterly profit beat",
            url="https://x.test/2", provider="NewsAPI",
        )
    )
    db_session.commit()

    resp = client.get("/api/search/semantic", params={"q": "monsoon flood rain", "kind": "news"})
    assert resp.status_code == 200
    hits = resp.json()["hits"]
    assert hits
    assert hits[0]["id"] == "news-flood"


def test_portfolio_data_quality_endpoint(client, db_session):
    db_session.add(Organization(id="org-api", name="Org", org_type="bank"))
    db_session.add(Portfolio(id="pf-api", organization_id="org-api", name="Test Portfolio"))
    db_session.add(Company(id="co-api-1", name="C1", sector="Tourism", region="HP", ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    db_session.add(Position(id="pos-api-1", portfolio_id="pf-api", company_id="co-api-1", cost_basis_cr=10, market_value_cr=10))
    db_session.add(EvidenceRecord(id="ev-api", subject_type="company", subject_id="co-api-1", label="x", evidence_class="sourced"))
    db_session.commit()

    resp = client.get("/api/portfolios/pf-api/data-quality")
    assert resp.status_code == 200
    body = resp.json()
    assert body["position_count"] == 1
    assert body["coverage_pct"] == 1.0


def test_create_asset_uses_geocoding_pipeline(client, monkeypatch):
    async def fake_geocode(name, region_hint=""):
        from app.services.geocoding import GeocodeResult

        return GeocodeResult(lat=31.5, lng=77.2, geo_confidence="approximate", geocode_source="nominatim", importance=0.3, error=None)

    monkeypatch.setattr("app.api.companies.geocode_asset", fake_geocode)
    resp = client.post("/api/assets", json={"name": "Test Bridge", "kind": "infra", "region_hint": "Himachal Pradesh"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["asset"]["geo_confidence"] == "approximate"
    assert body["geocode_source"] == "nominatim"


def test_scenario_run_includes_data_quality_breakdown(client, db_session):
    db_session.add(HazardEvent(id="hz-dq", name="DQ Hazard", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.add(Company(id="co-dq", name="DQ Co", sector="Tourism", region="HP", ead_cr=50, baseline_pd=0.02, baseline_lgd=0.4))
    db_session.add(DependencyEdge(id="e-dq", from_id="hz-dq", to_id="co-dq", edge_type="AFFECTED_BY", evidence_class="sourced", weight=3))
    db_session.commit()

    resp = client.post(
        "/api/scenarios/run",
        json={"region": "HP", "hazard": "Flood", "severity": 80, "duration_months": 6, "substitutability": "Moderate", "interventions": []},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sourced_weight_pct"] == 1.0
    assert body["data_quality_score"] == 1.0


def test_news_search_links_entities_to_matching_company(client, db_session, monkeypatch):
    from app.connectors.base import ConnectorResult, ConnectorStatus

    db_session.add(Company(id="co-news-1", name="Manali Hill Tourism Cooperative", sector="Tourism", region="HP", ead_cr=10, baseline_pd=0.02, baseline_lgd=0.3))
    db_session.commit()

    async def fake_fetch(self, query):
        return ConnectorResult(
            ConnectorStatus.OK,
            [
                {
                    "title": "Manali Hill Tourism Cooperative hit by flooding",
                    "description": "Disruption reported in Himachal Pradesh",
                    "url": "https://x.test/news1",
                    "source_name": "Test Wire",
                    "published_at": "2024-01-01",
                    "provider": "NewsAPI",
                }
            ],
            "ok",
        )

    monkeypatch.setattr("app.connectors.news.NewsConnector.fetch", fake_fetch)
    resp = client.get("/api/news/search", params={"q": "Himachal Pradesh flood"})
    assert resp.status_code == 200
    article = resp.json()["articles"][0]
    linked_ids = {link["entity_id"] for link in article["entity_links"]}
    assert "co-news-1" in linked_ids
    assert "HP" in linked_ids


def test_institution_endpoints(client, db_session):
    _seed_insurance_fixture(db_session)

    resp = client.get("/api/institutions", params={"kind": "insurer"})
    assert resp.status_code == 200
    ids = {i["id"] for i in resp.json()}
    assert {"insurer-test", "pmfby-test"} <= ids

    resp_404 = client.get("/api/institutions/does-not-exist")
    assert resp_404.status_code == 404

    book_resp = client.get("/api/institutions/pmfby-test/book", params={"region": "HP", "severity": 80, "duration_months": 6})
    assert book_resp.status_code == 200
    body = book_resp.json()
    assert body["govt_subsidy_cr"] > 0

    bank_404 = client.get("/api/institutions/does-not-exist/book", params={"region": "HP"})
    assert bank_404.status_code == 404


def test_create_asset_rejects_unresolvable_location(client, monkeypatch):
    async def fake_geocode_fail(name, region_hint=""):
        from app.services.geocoding import GeocodeResult

        return GeocodeResult(lat=None, lng=None, geo_confidence="centroid", geocode_source="nominatim", importance=None, error="No match found")

    monkeypatch.setattr("app.api.companies.geocode_asset", fake_geocode_fail)
    resp = client.post("/api/assets", json={"name": "Nonexistent Place XYZ123", "kind": "infra"})
    assert resp.status_code == 422
