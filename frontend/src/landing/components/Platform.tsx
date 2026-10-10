const MODULES = [
  {
    name: 'Command Centre',
    desc: 'Real-time climate event monitoring, anomaly alerts and portfolio heat-maps in a single pane.',
    href: '#/app',
    pill: 'Live',
  },
  {
    name: 'Portfolio Dashboard',
    desc: 'Aggregate physical and transition risk scores across every asset and sector in your book.',
    href: '#/dashboard',
    pill: 'Core',
  },
  {
    name: 'Digital Twin',
    desc: 'Asset-level 3D visualisation with live weather overlays, flood inundation and heat-stress layers.',
    href: '#/twin',
    pill: 'Core',
  },
  {
    name: 'Scenario Lab',
    desc: 'Run NGFS SSP1/3/5 and custom pathways; compare ECL and revenue-at-risk trajectories.',
    href: '#/scenario',
    pill: 'Analysis',
  },
  {
    name: 'What-if Analysis',
    desc: 'Drag sliders on temperature, rainfall, sea-level and carbon price — see P&L impact instantly.',
    href: '#/what-if',
    pill: 'Analysis',
  },
  {
    name: 'Dependency Explorer',
    desc: 'Map supply-chain and infrastructure climate dependencies across corridors and counterparties.',
    href: '#/dependency',
    pill: 'Analysis',
  },
  {
    name: 'Evidence & Reports',
    desc: 'Auto-generate SEBI BRSR Core, TCFD, GRI and RBI climate questionnaire exports.',
    href: '#/evidence',
    pill: 'Governance',
  },
  {
    name: 'AI Copilot',
    desc: 'Natural-language queries: "Which of our Rajasthan assets face water scarcity by 2030?"',
    href: '#/app',
    pill: 'AI',
  },
]

export default function Platform() {
  return (
    <section id="platform" className="lp-section lp-light">
      <div className="lp-inner">
        <div className="lp-sec-head reveal">
          <span className="lp-eyebrow">The platform</span>
          <h2>Eight modules. One climate intelligence layer.</h2>
          <p className="lp-sub">
            Every tool in CLIMATRIX is built around a single, shared risk graph — so your
            scenario results, your disclosures and your real-time alerts all speak the
            same language.
          </p>
        </div>

        <div className="lp-platform-grid">
          {MODULES.map((m, i) => (
            <a
              key={m.name}
              href={m.href}
              className="lp-platform-card reveal"
              style={{ transitionDelay: `${i * 0.04}s` }}
            >
              <div className="lp-platform-top">
                <h3>{m.name}</h3>
                <span className="lp-platform-pill">{m.pill}</span>
              </div>
              <p>{m.desc}</p>
              <span className="lp-platform-cta">Open →</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
