"""Seeds the database from backend/seed_graph.json — a 1:1 JSON export of
frontend/src/lib/indiaGraphData.ts (produced via esbuild, see
backend/README.md "Regenerating the seed data"), plus one demo portfolio
built from a subset of the seeded companies so /api/portfolios has
something real to return.

Run: python -m app.db.seed
"""

import json
from pathlib import Path

from app.db.session import Base, SessionLocal, engine
from app.models import Company, DependencyEdge, EvidenceRecord, HazardEvent, Organization, Portfolio, Position

SEED_FILE = Path(__file__).resolve().parent.parent.parent / "seed_graph.json"

# Node kinds that aren't modeled as their own table yet (infra/supplier/
# bank/govt/insurer) are intentionally NOT inserted as Company rows — only
# true companies become Company records. Financial institutions, infra and
# suppliers remain in dependency_edges as endpoints (by id/kind) for graph
# traversal; a dedicated Institution table is a natural next step, noted in
# docs/DATA_STRATEGY.md, kept out of scope here to avoid a schema nobody
# queries yet.
COMPANY_KIND = "company"
HAZARD_KIND = "hazard"


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Company).count() > 0:
            print("Already seeded — skipping. Delete climatrix.db to reseed from scratch.")
            return

        data = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        nodes = data["NODES"]
        edges = data["EDGES"]

        for n in nodes:
            if n["kind"] == COMPANY_KIND:
                db.add(
                    Company(
                        id=n["id"],
                        name=n["label"],
                        sector=n.get("sector", ""),
                        region=n.get("region", ""),
                        lat=n["coords"][1] if n.get("coords") else None,
                        lng=n["coords"][0] if n.get("coords") else None,
                        ead_cr=n.get("eadCr") or 0.0,
                        baseline_pd=n.get("baselinePd") or 0.0,
                        baseline_lgd=n.get("baselineLgd") or 0.0,
                        annual_revenue_cr=n.get("annualRevenueCr"),
                        note=n.get("note", ""),
                        is_synthetic=True,
                    )
                )
            elif n["kind"] == HAZARD_KIND:
                db.add(
                    HazardEvent(
                        id=n["id"],
                        name=n["label"],
                        hazard_type=n.get("sector", ""),
                        region=n.get("region", ""),
                        lat=n["coords"][1] if n.get("coords") else 0.0,
                        lng=n["coords"][0] if n.get("coords") else 0.0,
                        evidence_class="assumption",
                        note=n.get("note", ""),
                    )
                )
        db.commit()

        for e in edges:
            db.add(
                DependencyEdge(
                    id=e["id"],
                    from_id=e["from"],
                    to_id=e["to"],
                    edge_type=e["type"],
                    evidence_class=e["evidence"],
                    weight=e.get("weight", 1),
                )
            )
        db.commit()

        # One demo organization + portfolio, positions covering the HP/UK
        # flagship companies at a plausible mark relative to their EAD.
        org = Organization(id="org-demo", name="Demo Investment Firm", org_type="demo")
        db.add(org)
        portfolio = Portfolio(id="pf-demo", organization_id=org.id, name="India Climate-Exposed Portfolio", mandate="Multi-sector, India-focused")
        db.add(portfolio)
        db.commit()

        demo_positions = [
            ("co-hp-auto", "credit_facility", 210, 210, "illiquid"),
            ("co-hp-pharma", "equity", 180, 205, "liquid"),
            ("co-hp-tourism", "credit_facility", 95, 95, "illiquid"),
            ("co-kl-seafood", "equity", 140, 162, "liquid"),
            ("co-mh-textile", "credit_facility", 230, 230, "illiquid"),
            ("co-uk-construction", "credit_facility", 100, 100, "illiquid"),
        ]
        for i, (company_id, instrument, cost, market, liquidity) in enumerate(demo_positions):
            db.add(
                Position(
                    id=f"pos-{i+1}",
                    portfolio_id=portfolio.id,
                    company_id=company_id,
                    instrument_type=instrument,
                    quantity_or_share=1.0,
                    cost_basis_cr=cost,
                    market_value_cr=market,
                    valuation_date="2026-10-01",
                    liquidity=liquidity,
                )
            )
        db.commit()

        # A handful of real evidence records tying the RBI/HP figures already
        # cited in the frontend to actual backend rows, same evidence
        # taxonomy as the UI (sourced/modelled/assumption/synthetic).
        db.add_all(
            [
                EvidenceRecord(
                    id="ev-rbi-vast",
                    subject_type="portfolio",
                    subject_id="pf-demo",
                    label="RBI pilot VAST results (+66.1% flood, +65.8% cyclone, +138% tail-risk)",
                    evidence_class="sourced",
                    source="RBI Bulletin, 18 Jan 2024",
                    detail="2022 exploratory pilot across 15 banks — scenario-model outputs, not realized losses.",
                ),
                EvidenceRecord(
                    id="ev-hp-recovery",
                    subject_type="hazard",
                    subject_id="hz-hp",
                    label="Himachal Pradesh 2023 recovery allocation — Rs 2,006.40 cr",
                    evidence_class="sourced",
                    source="Government of India central-share approval, June 2025",
                    detail="Public-finance figure, not a bank credit loss.",
                ),
            ]
        )
        db.commit()

        print(f"Seeded {db.query(Company).count()} companies, {db.query(HazardEvent).count()} hazards, "
              f"{db.query(DependencyEdge).count()} edges, {len(demo_positions)} positions.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
