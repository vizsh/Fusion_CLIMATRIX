const PHASES = [
  {
    tag: 'Now',
    h: 'Prototype Live',
    p: 'Command Centre, Portfolio Dashboard, Digital Twin, Scenario Lab and AI Copilot operational. Data from NASA POWER, Open-Meteo and NDMA hazard maps.',
    gate: 'Gate: End-to-end climate risk query in < 60 s.',
  },
  {
    tag: 'Q1 2026',
    h: 'Regulatory Connectors',
    p: 'SEBI BRSR Core auto-export, RBI climate questionnaire auto-fill, TCFD PDF generator and IFRS S2 mapper.',
    gate: 'Gate: Zero-touch compliance report for a listed firm.',
  },
  {
    tag: 'Q2–Q3 2026',
    h: 'Pilot with Financial Institutions',
    p: '3–5 banks, insurers or corporate groups as design partners. Integrate with CBS / treasury APIs; validate risk scores against internal loss data.',
    gate: 'Gate: Positive NPS, measurable hours saved on disclosure.',
  },
  {
    tag: '2027',
    h: 'Platform Scale',
    p: 'Open API for ecosystem integrators; GIS data partnerships with ISRO Bhuvan and state disaster authorities; enterprise SaaS pricing.',
    gate: 'Gate: 50 institutional subscribers.',
  },
]

const TRUST = [
  'Open-source data — no black-box scores',
  'On-premise deployment option',
  'SOC 2 roadmap',
  'DPDP 2023 compliant data handling',
  'Regulatory audit trails included',
]

export default function Roadmap() {
  return (
    <section id="pilot" className="lp-section lp-dark">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">Roadmap</span>
          <h2>Prototype today. Platform in 18 months.</h2>
          <p className="lp-sub">
            We are building in the open — with real institutions, on real data, against
            real Indian regulatory requirements.
          </p>
        </div>
        <div className="lp-grid lp-g4">
          {PHASES.map((p, i) => (
            <div key={p.h} className="lp-card-d reveal" style={{ transitionDelay: `${i * 0.06}s` }}>
              <span className="lp-tag">{p.tag}</span>
              <h3 style={{ margin: '10px 0 0' }}>{p.h}</h3>
              <p>{p.p}</p>
              <p className="lp-phase-g">{p.gate}</p>
            </div>
          ))}
        </div>
        <div className="lp-trust-chips reveal" style={{ transitionDelay: '.15s' }}>
          {TRUST.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
