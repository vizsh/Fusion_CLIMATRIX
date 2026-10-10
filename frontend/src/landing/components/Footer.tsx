const LINKS = [
  ['Problem', '#problem'],
  ['Solution', '#solution'],
  ['How it works', '#how'],
  ['Platform', '#platform'],
  ['Impact', '#impact'],
  ['Roadmap', '#pilot'],
] as const

export default function Footer() {
  return (
    <footer id="contact" className="lp-section lp-dark" style={{ padding: '120px 24px 40px' }}>
      <div className="lp-inner">
        <div className="lp-cta-block reveal">
          <h2>Ready to map your climate exposure?</h2>
          <p>
            We're looking for pilot partners — banks, insurers, corporates and regulators
            ready to put real portfolios through India's first AI-native climate risk
            platform.
          </p>
          <div className="lp-cta-btns">
            <a href="mailto:hello@climatrix.in" className="lp-btn lp-btn-white">
              Partner with us
            </a>
            <a href="#/app" className="lp-btn lp-btn-ghost-dark">
              Open the platform →
            </a>
          </div>
        </div>

        <div className="lp-footer-bar">
          <div>
            <span className="lp-footer-wordmark">
              <span className="lp-footer-wm-main">CLIMATRIX</span>
              <span className="lp-footer-wm-sub"> India</span>
            </span>
            <p className="lp-brand-sub">
              AI-native climate risk intelligence for India's financial system.
            </p>
          </div>
          <div className="lp-footer-links">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </div>
        </div>

        <p className="lp-disclaimer">
          CLIMATRIX is a prototype built for SANKALP 2026. All risk scores and projections shown are
          illustrative and based on open government, RBI and NITI Aayog datasets. Modelled
          projections are labelled as such. Not investment or regulatory advice.
        </p>
      </div>
    </footer>
  )
}
