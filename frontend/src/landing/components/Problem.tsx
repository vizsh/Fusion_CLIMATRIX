const STATS = [
  ['₹14.9 lakh cr', 'in bank loans exposed to climate-sensitive sectors', 'RBI Financial Stability Report, 2024'],
  ['68%', 'of Indian districts face high or very high climate vulnerability', 'CEEW Climate Vulnerability Index, 2021'],
  ['₹4.2 lakh cr', 'in estimated annual GDP loss from extreme heat alone by 2030', 'McKinsey Global Institute, 2020'],
  ['<2%', 'of Indian listed firms disclose credible physical risk data', 'SEBI BRSR Survey, 2023'],
] as const

export default function Problem() {
  return (
    <section id="problem" className="lp-section lp-dark">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">The problem</span>
          <h2>India's climate risk is enormous — and almost entirely unmapped</h2>
          <p className="lp-sub">
            Floods, heat stress, cyclones and water scarcity are already eroding asset
            values across India. Yet the financial system is flying blind: no shared data
            layer, no standardised disclosure, no forward-looking risk pricing.
          </p>
        </div>

        <div className="lp-grid lp-g2">
          <div className="lp-card-d story reveal" style={{ transitionDelay: '.05s' }}>
            <span className="lp-tag">A bank's dilemma · Mumbai HQ</span>
            <h3>₹2,400 cr in flood-zone loans — no idea which ones</h3>
            <p>
              A mid-sized PSU bank holds a massive agricultural and infrastructure loan
              book. When a cyclone hits the Konkan coast, the credit team scrambles to
              identify exposure manually. It takes three weeks and misses the regulatory
              deadline.
            </p>
          </div>
          <div className="lp-card-d story reveal" style={{ transitionDelay: '.15s' }}>
            <span className="lp-tag">An insurer's blind spot · Bengaluru</span>
            <h3>Heat-stress crop claims surge 40% — the model never saw it coming</h3>
            <p>
              An agri-insurer's actuarial models are trained on 1990–2010 weather data.
              A three-sigma heat event in Vidarbha triggers a claims wave that blows
              through the loss ratio by 22 percentage points. The reserves weren't there.
            </p>
          </div>
        </div>

        <p className="lp-punchline reveal" style={{ transitionDelay: '.1s' }}>
          Both institutions had the assets. Neither had the climate intelligence to price
          them. <em>CLIMATRIX bridges that gap.</em>
        </p>

        <div className="lp-stats">
          {STATS.map(([n, l, s], i) => (
            <div key={n} className="lp-stat-cell reveal" style={{ transitionDelay: `${i * 0.05}s` }}>
              <div className="lp-n">{n}</div>
              <div className="lp-l">{l}</div>
              <div className="lp-s">{s}</div>
            </div>
          ))}
        </div>

        <p className="lp-src-note reveal">
          All figures from RBI, SEBI, CEEW, McKinsey and Government of India publications.
          Modelled projections on this page are labelled as such.
        </p>
      </div>
    </section>
  )
}
