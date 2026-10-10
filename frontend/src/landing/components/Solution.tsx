export default function Solution() {
  return (
    <section id="solution" className="lp-section lp-light">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">The solution</span>
          <h2>One platform. Every climate risk dimension.</h2>
          <p className="lp-sub">
            CLIMATRIX ingests satellite imagery, open-meteo streams, government hazard
            maps and financial disclosures to build a living, asset-level climate risk
            graph for India — updated daily, queryable in seconds.
          </p>
        </div>

        <div className="lp-grid lp-g2">
          <div className="lp-card-l reveal" style={{ transitionDelay: '.05s' }}>
            <span className="lp-dir-pill">Physical Risk</span>
            <h3>Asset-level hazard scoring</h3>
            <p className="lp-body">
              Flood depth, heat stress, cyclone track probability, water scarcity and
              drought indices — all geocoded to the asset, district and corridor level.
              Data fused from NASA POWER, Open-Meteo, NDMA and ISRO Bhuvan.
            </p>
            <p className="lp-fix">
              Move from "our Gujarat portfolio might be exposed" to "Asset ID 4821 has a
              1-in-15-year flood risk of ₹3.4 cr."
            </p>
          </div>
          <div className="lp-card-l reveal" style={{ transitionDelay: '.15s' }}>
            <span className="lp-dir-pill">Transition Risk</span>
            <h3>Scenario-adjusted financial impact</h3>
            <p className="lp-body">
              Run NGFS SSP1, SSP3 and SSP5 scenarios against your portfolio. See
              revenue-at-risk, stranded-asset probability and loan default probability
              shift with every degree of warming.
            </p>
            <p className="lp-fix">
              Stress-test your book against India's 2070 net-zero pathway before the
              regulator asks you to.
            </p>
          </div>
        </div>

        <div className="lp-wins reveal" style={{ transitionDelay: '.15s' }}>
          <span>SEBI BRSR Core ready</span>
          <span>RBI climate disclosure aligned</span>
          <span>TCFD & GRI mapped</span>
          <span>IFRS S2 compatible</span>
        </div>
      </div>
    </section>
  )
}
