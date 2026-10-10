import {
  BarChart2,
  CheckCircle2,
  Database,
  Layers,
  MapPin,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useEffect, useRef } from 'react'

const WAVE = [40, 70, 40, 100, 60, 90, 40, 60, 30, 80, 50, 40, 70, 90, 50]

function ramp(p: number, xs: number[], ys: number[]) {
  if (p <= xs[0]) return ys[0]
  for (let i = 0; i < xs.length - 1; i++) {
    if (p >= xs[i] && p <= xs[i + 1]) {
      const t = (p - xs[i]) / (xs[i + 1] - xs[i])
      return ys[i] + t * (ys[i + 1] - ys[i])
    }
  }
  return ys[ys.length - 1]
}

const PHASES = [
  { xs: [0, 0.25, 0.35], ys: [1, 1, 0] },
  { xs: [0.25, 0.35, 0.6, 0.7], ys: [0, 1, 1, 0] },
  { xs: [0.6, 0.7, 1], ys: [0, 1, 1] },
]

export default function Journey() {
  const gridRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<HTMLDivElement>(null)
  const phaseRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ]

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')

    const onScroll = () => {
      const grid = gridRef.current
      if (!grid) return
      const r = grid.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (window.innerHeight / 2 - r.top) / r.height))

      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`
      if (markerRef.current) markerRef.current.style.top = `calc(${(p * 100).toFixed(2)}% - 20px)`

      if (!desktop.matches) return
      PHASES.forEach(({ xs, ys }, i) => {
        const el = phaseRefs[i].current
        if (!el) return
        const v = ramp(p, xs, ys)
        el.style.opacity = String(v)
        el.style.visibility = v <= 0.01 ? 'hidden' : 'visible'
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section id="how" className="lp-journey-sec">
      <div className="lp-jov1" />
      <div className="lp-jov2" />

      <div className="lp-j-head">
        <div className="lp-sec-head reveal" style={{ padding: '0 24px' }}>
          <span className="lp-eyebrow">How it works</span>
          <h2>From raw satellite data to board-ready risk disclosure.</h2>
          <p className="lp-sub">
            A query becomes a geocoded risk score, a portfolio stress-test and a
            regulator-ready report — in under 60 seconds. Keep scrolling to see the
            pipeline.
          </p>
        </div>
      </div>

      <div className="lp-journey">
        <div className="lp-journey-grid" ref={gridRef}>
          <div className="lp-left-col">
            <div className="lp-timeline">
              <div className="lp-track">
                <div className="lp-fill" ref={fillRef} />
              </div>
              <div className="lp-truck" ref={markerRef}>
                <Zap size={18} />
              </div>
            </div>

            {/* Step 1 */}
            <div className="lp-step-wrap">
              <div className="lp-step-card frosted reveal-x">
                <div className="lp-step-head">
                  <div className="lp-icon-box">
                    <MapPin size={24} color="var(--lp-emerald-700)" />
                  </div>
                  <div>
                    <div className="lp-kicker" style={{ color: 'var(--lp-emerald-700)' }}>
                      Step 1 — Ingest & Geocode
                    </div>
                    <h2>Pin any Indian asset in seconds.</h2>
                  </div>
                </div>
                <p className="lp-body">
                  Drop a lat/long, upload a portfolio CSV or connect your core banking API.
                  CLIMATRIX geocodes every asset, corridor and counterparty to India's
                  district-level hazard grid in real time.
                </p>
                <div className="lp-stat-strip glass-in">
                  <Database size={20} color="var(--lp-emerald-600)" />
                  <span>6 hazard layers · 640+ districts · Updated daily.</span>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="lp-step-wrap">
              <div className="lp-step-card frosted reveal-x">
                <div className="lp-step-head">
                  <div className="lp-icon-box">
                    <BarChart2 size={24} color="var(--lp-blue-700)" />
                  </div>
                  <div>
                    <div className="lp-kicker" style={{ color: 'var(--lp-blue-700)' }}>
                      Step 2 — Score & Scenario
                    </div>
                    <h2>Run the climate stress-test.</h2>
                  </div>
                </div>
                <p className="lp-body">
                  The AI Copilot runs NGFS scenarios (SSP1 / SSP3 / SSP5) against your
                  portfolio, surfacing revenue-at-risk, stranded-asset probability and
                  expected credit loss deltas — across time horizons you choose.
                </p>
                <div className="lp-stat-strip glass-in">
                  <ShieldCheck size={20} color="var(--lp-blue-600)" />
                  <span>SSP1 · SSP3 · SSP5 · Custom pathways supported.</span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="lp-step-wrap">
              <div className="lp-step-card frosted reveal-x">
                <div className="lp-step-head">
                  <div className="lp-icon-box">
                    <Layers size={24} color="var(--lp-purple-700)" />
                  </div>
                  <div>
                    <div className="lp-kicker" style={{ color: 'var(--lp-purple-700)' }}>
                      Step 3 — Disclose & Govern
                    </div>
                    <h2>Publish with one click.</h2>
                  </div>
                </div>
                <p className="lp-body">
                  Export SEBI BRSR Core reports, TCFD disclosures and RBI climate
                  questionnaire responses directly from the platform. Board-ready PDFs or
                  machine-readable JSON — your choice.
                </p>
                <div className="lp-stat-strip glass-in">
                  <CheckCircle2 size={20} color="var(--lp-purple-600)" />
                  <span>BRSR Core · TCFD · GRI · IFRS S2 · RBI aligned.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky right panel */}
          <div className="lp-right-col">
            <div className="lp-sticky-wrap">
              <div className="lp-canvas frosted">
                <div className="lp-dots" />

                {/* Phase 1 */}
                <div className="lp-phase" ref={phaseRefs[0]} style={{ zIndex: 10 }}>
                  <div className="lp-phase-inner">
                    <div className="lp-audio-bubble glass-in">
                      <div className="lp-audio-row">
                        <div className="lp-mic-circle">
                          <MapPin size={20} />
                        </div>
                        <div className="lp-wave">
                          {WAVE.map((h, i) => (
                            <i
                              key={i}
                              style={
                                { '--h': `${h}%`, '--d': `${i * 0.08}s` } as React.CSSProperties
                              }
                            />
                          ))}
                        </div>
                        <span className="lp-dur">Live</span>
                      </div>
                      <p className="lp-quote">
                        "Show me flood exposure for our entire Maharashtra portfolio."
                      </p>
                    </div>
                    <div className="lp-geo-card glass-in" style={{ marginTop: 12 }}>
                      <div className="lp-accent-bar" />
                      <div className="lp-geo-row">
                        <span className="lp-t">Portfolio · 247 assets geocoded</span>
                        <span className="lp-chip lp-chip-blue">LIVE SCAN</span>
                      </div>
                      <div className="lp-status">
                        <div className="lp-dot" />
                        6 hazard layers applied · 0.8 s
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phase 2 */}
                <div
                  className="lp-phase"
                  ref={phaseRefs[1]}
                  style={{ zIndex: 11, opacity: 0, visibility: 'hidden' }}
                >
                  <div className="lp-phase-inner">
                    <div className="lp-radar-zone">
                      <div className="lp-radar">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="lp-ring"
                            style={{ '--d': `${i}s` } as React.CSSProperties}
                          />
                        ))}
                        <div className="lp-pin">
                          <BarChart2 size={28} />
                          <div className="lp-tag">SSP3 · 2035</div>
                        </div>
                      </div>
                    </div>
                    <div className="lp-cand glass-in">
                      <div>
                        <div className="lp-name">Vidarbha · Agri Loans</div>
                        <div className="lp-meta">Heat stress · ECL +18% · ₹340 cr at risk</div>
                      </div>
                      <span className="lp-chip lp-chip-blue">HIGH RISK</span>
                    </div>
                    <div className="lp-cand glass-in">
                      <div>
                        <div className="lp-name">Konkan · Infrastructure</div>
                        <div className="lp-meta">Cyclone track · Flood depth +0.6 m</div>
                      </div>
                      <span className="lp-chip lp-chip-blue">ELEVATED</span>
                    </div>
                  </div>
                </div>

                {/* Phase 3 */}
                <div
                  className="lp-phase"
                  ref={phaseRefs[2]}
                  style={{ zIndex: 12, opacity: 0, visibility: 'hidden' }}
                >
                  <div className="lp-phase-inner">
                    <div className="lp-p3-head">
                      <div className="lp-who">
                        <div className="lp-icon-box">
                          <Layers size={22} color="var(--lp-purple-700)" />
                        </div>
                        <div>
                          <div className="lp-name">SEBI BRSR Core Report</div>
                          <div className="lp-stream">Auto-generated · FY 2025-26</div>
                        </div>
                      </div>
                      <span className="lp-chip-api">READY</span>
                    </div>
                    <div className="lp-score-box glass-in">
                      <div className="lp-score-circle">
                        <div>
                          <div className="lp-n">A+</div>
                          <div className="lp-l">
                            Disclosure
                            <br />
                            Grade
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                          Climate Disclosure Score
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
                          All 9 mandatory BRSR Core indicators populated.
                        </div>
                      </div>
                    </div>
                    <div className="lp-money-grid">
                      <div className="lp-money-card lp-mc-green glass-in">
                        <div className="lp-lbl">
                          <CheckCircle2 size={16} /> TCFD Sections
                        </div>
                        <div className="lp-val">4 / 4</div>
                      </div>
                      <div className="lp-money-card lp-mc-green glass-in">
                        <div className="lp-lbl">
                          <CheckCircle2 size={16} /> IFRS S2
                        </div>
                        <div className="lp-val">Mapped</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
