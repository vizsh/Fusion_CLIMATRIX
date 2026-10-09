"""The governed assumption queue (app/api/proposals.py) — propose, list,
approve/reject, and the guard against reviewing an already-reviewed
proposal twice."""


def test_create_and_list_proposal(client):
    resp = client.post(
        "/api/proposals",
        json={
            "kind": "sector_vulnerability",
            "target": "Tourism",
            "current_value": "1.45",
            "proposed_value": "1.6",
            "rationale": "Recent monsoon claims ran higher than the current multiplier implies.",
            "proposed_by": "Risk Analyst",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "pending"
    assert body["target"] == "Tourism"

    listed = client.get("/api/proposals")
    assert listed.status_code == 200
    assert any(p["id"] == body["id"] for p in listed.json())

    pending_only = client.get("/api/proposals", params={"status": "pending"})
    assert all(p["status"] == "pending" for p in pending_only.json())


def test_approve_proposal(client):
    created = client.post(
        "/api/proposals",
        json={"kind": "other", "target": "test-target", "proposed_value": "x", "rationale": "because"},
    ).json()

    approved = client.post(f"/api/proposals/{created['id']}/approve", json={"reviewer": "CRO", "review_note": "Agreed."})
    assert approved.status_code == 200
    body = approved.json()
    assert body["status"] == "approved"
    assert body["reviewer"] == "CRO"
    assert body["reviewed_at"] is not None


def test_cannot_review_twice(client):
    created = client.post(
        "/api/proposals",
        json={"kind": "other", "target": "t", "proposed_value": "x", "rationale": "r"},
    ).json()
    client.post(f"/api/proposals/{created['id']}/reject", json={"reviewer": "CRO"})

    second = client.post(f"/api/proposals/{created['id']}/approve", json={"reviewer": "CRO"})
    assert second.status_code == 409


def test_review_unknown_proposal_404s(client):
    resp = client.post("/api/proposals/does-not-exist/approve", json={})
    assert resp.status_code == 404
