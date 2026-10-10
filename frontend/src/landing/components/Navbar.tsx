const LINKS = [
  ['Problem', '#problem'],
  ['Solution', '#solution'],
  ['How it works', '#how'],
  ['Platform', '#platform'],
  ['Impact', '#impact'],
  ['Roadmap', '#pilot'],
] as const

export default function Navbar() {
  return (
    <div className="lp-nav-wrap">
      <nav className="lp-nav frosted">
        <span className="lp-wordmark">
          <span className="lp-wordmark-main">CLIMATRIX</span>
          <span className="lp-wordmark-sub">India</span>
        </span>
        <div className="lp-nav-links">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </div>
        <a href="#/app" className="lp-nav-cta">
          Open Dashboard →
        </a>
      </nav>
    </div>
  )
}
