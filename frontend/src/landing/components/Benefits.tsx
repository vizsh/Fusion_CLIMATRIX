const CARDS = [
  {
    h: 'Banks & NBFCs',
    p: 'Identify climate-exposed loan portfolios, run RBI climate stress-tests, and produce board-ready disclosures in minutes.',
    stat: 'RBI Climate Risk Framework · BRSR Core · TCFD',
  },
  {
    h: 'Insurers & Reinsurers',
    p: 'Update actuarial models with forward-looking hazard data; price agri, property and infra risk accurately.',
    stat: 'IRDAI Climate Guidelines · Catastrophe Modelling',
    modelled: false,
  },
  {
    h: 'Corporates & Listed Firms',
    p: 'Meet SEBI BRSR Core mandatory disclosure with auto-populated templates and audit trails.',
    stat: 'SEBI BRSR Core · GRI 201 · IFRS S2',
  },
  {
    h: 'Infrastructure Developers',
    p: 'Assess climate risk across project corridors before financial close; satisfy DFI environmental covenants.',
    stat: 'ADB · World Bank · NDB Safeguards',
  },
  {
    h: 'Regulators & DFIs',
    p: 'Aggregate sector-wide climate exposure from regulated entities; run macro stress scenarios on the fly.',
    stat: 'SEBI · RBI · MoEFCC · NABARD',
    modelled: false,
  },
  {
    h: 'Asset Managers & FPIs',
    p: 'Screen and tilt portfolios on physical and transition risk; generate ESG climate sub-scores for every holding.',
    stat: '220–480 t CO₂ / corridor avoided (modelled)',
    modelled: true,
  },
]

export default function Benefits() {
  return (
    <section id="benefits" className="lp-section lp-dark">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">Who uses CLIMATRIX</span>
          <h2>Built for every player in India's climate-finance stack</h2>
        </div>
        <div className="lp-grid lp-g3">
          {CARDS.map((c, i) => (
            <div key={c.h} className="lp-card-d reveal" style={{ transitionDelay: `${i * 0.05}s` }}>
              <h3>{c.h}</h3>
              <p>{c.p}</p>
              <p className="lp-stat">
                {c.stat}
                {c.modelled && <span className="lp-chip-modelled">Modelled</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
