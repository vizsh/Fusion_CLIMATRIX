from app.models import Company, DependencyEdge, HazardEvent


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_company_crud_flow(client, db_session):
    db_session.add(HazardEvent(id="hz-test", name="Test Hazard", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.add(
        Company(
            id="co-test",
            name="Test Co",
            sector="Manufacturing",
            region="HP",
            lat=31.1,
            lng=77.1,
            ead_cr=50,
            baseline_pd=0.02,
            baseline_lgd=0.4,
        )
    )
    db_session.add(DependencyEdge(id="e-test", from_id="hz-test", to_id="co-test", edge_type="AFFECTED_BY", evidence_class="assumption", weight=2))
    db_session.commit()

    resp = client.get("/api/companies/co-test")
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Test Co"
    assert body["ead_cr"] == 50

    resp_404 = client.get("/api/companies/does-not-exist")
    assert resp_404.status_code == 404

    deps = client.get("/api/companies/co-test/dependencies")
    assert deps.status_code == 200
    assert any(e["from_id"] == "hz-test" for e in deps.json())


def test_scenario_run_rejects_unknown_region(client):
    resp = client.post(
        "/api/scenarios/run",
        json={"region": "XX", "hazard": "Flood", "severity": 80, "duration_months": 6, "substitutability": "Moderate", "interventions": []},
    )
    assert resp.status_code == 400


def test_scenario_run_persists_and_is_retrievable(client, db_session):
    db_session.add(HazardEvent(id="hz-hp", name="HP Hazard", hazard_type="Flood", region="HP", lat=31.0, lng=77.0))
    db_session.add(Company(id="co-hp-x", name="HP Co", sector="Tourism", region="HP", lat=31.1, lng=77.1, ead_cr=100, baseline_pd=0.02, baseline_lgd=0.4))
    db_session.add(DependencyEdge(id="e-hp-x", from_id="hz-hp", to_id="co-hp-x", edge_type="AFFECTED_BY", evidence_class="sourced", weight=3))
    db_session.commit()

    resp = client.post(
        "/api/scenarios/run",
        json={"region": "HP", "hazard": "Flood", "severity": 90, "duration_months": 6, "substitutability": "Moderate", "interventions": []},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["stressed_el_cr"] > body["baseline_el_cr"]
    assert body["company_count"] >= 1

    fetched = client.get(f"/api/scenarios/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == body["id"]
