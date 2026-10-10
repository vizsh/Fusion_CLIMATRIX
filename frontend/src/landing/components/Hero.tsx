const TRUSTED = ['SEBI', 'RBI', 'MoEFCC', 'IRDA', 'NITI Aayog', 'GIZ India']

export default function Hero() {
  return (
    <header className="lp-hero">
      {/* Served from public/hero.mp4 - moving clouds video from Sankalp_Base */}
      <video
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="lp-hero-video"
      />
      <div className="lp-ov1" />
      <div className="lp-ov2" />
      <div className="lp-ov3" />

      <div className="lp-hero-content">
        <span className="lp-hero-eyebrow">
          🌏 India's First AI-Native Climate Risk Intelligence Platform
        </span>
        <h1 className="lp-hero-title">
          CLIMATRIX
        </h1>
        <div className="lp-hero-tagline">
          Know your climate exposure. Act before it costs you.
        </div>
        <p className="lp-hero-sub">
          Continuous physical risk modeling across Indian assets, infrastructure corridors,
          and portfolios — so banks, insurers, corporates, and regulators can price, hedge, and disclose with confidence.
        </p>
        <div className="lp-hero-ctas">
          <a href="#/app" className="lp-btn lp-btn-primary">
            Open Platform →
          </a>
          <a href="#solution" className="lp-btn lp-btn-ghost">
            See How It Works
          </a>
        </div>
      </div>

      <div className="lp-sponsors">
        <p className="lp-label">Aligned with frameworks used by</p>
        <div className="lp-sponsor-row">
          {TRUSTED.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
    </header>
  )
}
