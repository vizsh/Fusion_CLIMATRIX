const ROWS = [
  ['Assets geocoded to hazard grid', 'measured by platform ingestion logs', '10,000+'],
  ['Hazard layers active', 'Flood, Heat, Cyclone, Water Scarcity, Drought, Sea-Level Rise', '6'],
  ['Districts covered', 'All states and UTs of India', '640+'],
  ['Scenario pathways available', 'NGFS SSP1 / SSP3 / SSP5 + custom', '3+'],
  ['Regulatory frameworks mapped', 'SEBI BRSR Core, TCFD, GRI, IFRS S2, RBI', '5'],
  ['Data refresh cadence', 'Open-Meteo, NASA POWER, NDMA feeds', 'Daily'],
] as const

export default function Impact() {
  return (
    <section id="impact" className="lp-section lp-light">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">Platform coverage</span>
          <h2>Built for India's scale — from day one</h2>
          <p className="lp-sub">
            CLIMATRIX is designed around India's geography, regulatory landscape and
            financial system — not retrofitted from a Western product.
          </p>
        </div>
        <div className="lp-impact-list reveal" style={{ transitionDelay: '.05s' }}>
          {ROWS.map(([m, h, t]) => (
            <div className="lp-impact-row" key={m}>
              <div>
                <div className="lp-m">{m}</div>
                <div className="lp-h">{h}</div>
              </div>
              <div className="lp-t">{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
