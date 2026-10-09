import { motion } from 'framer-motion'
import { ArrowRight, Building2, FileCheck2, Network, PieChart, Shield } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

const SECONDARY_LINKS = [
  { to: '/dependency', icon: Network, label: 'Dependency Explorer' },
  { to: '/company', icon: Building2, label: 'Company Investigation' },
  { to: '/portfolio', icon: PieChart, label: 'Portfolio Impact' },
  { to: '/mitigation', icon: Shield, label: 'Mitigation Studio' },
  { to: '/evidence', icon: FileCheck2, label: 'Evidence & Reports' },
]

const RBI_STATS = [
  { label: 'Flood scenario', value: '+66.1%' },
  { label: 'Cyclone scenario', value: '+65.8%' },
  { label: 'Tail-risk scenario', value: '+138%' },
]

export default function CommandCentrePage() {
  const navigate = useNavigate()
  const { region, hazard, severity, durationMonths, run } = useScenarioStore()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="COMMAND CENTRE"
        subtitle="CLIMATRIX INDIA — CLIMATE INTELLIGENCE FOR FINANCIAL RESILIENCE"
        tag="FIN-04 · BLACKROCK · INDIA-CENTRIC ADAPTATION"
      />

      <div className="bg-grid px-10 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl">
          <div className="mb-3 inline-block rounded border border-cyan/30 bg-cyan/10 px-2 py-1 font-mono text-[10px] tracking-[0.15em] text-cyan">
            RISK INTELLIGENCE
          </div>
          <h1 className="text-[32px] font-semibold leading-[1.15] text-white">
            When the landscape fails, <span className="text-cyan">what breaks next?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-slate-400">
            Explore the chain from a physical climate hazard to infrastructure disruption,
            supply-chain propagation, borrower stress and bank portfolio impact — then change a
            mitigation decision and watch the projected financial outcome change.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-10 max-w-xl rounded-xl border border-cyan/25 bg-panel-2 p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="font-mono text-[9.5px] tracking-[0.15em] text-slate-500">
              SCENARIO · <span className="text-slate-300">{REGION_LABEL[region]} · {hazard}</span>
            </div>
            <div className="font-mono text-[9.5px] tracking-[0.15em] text-slate-500">
              HORIZON · <span className="text-slate-300">{durationMonths} months</span>
            </div>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-cyan" style={{ width: `${severity}%` }} />
          </div>
          <button
            onClick={() => {
              run()
              navigate('/twin')
            }}
            className="flex w-full items-center justify-center gap-2 rounded border border-risk-high/50 bg-risk-high/10 py-3 font-mono text-[12px] font-semibold tracking-[0.1em] text-risk-high hover:bg-risk-high/20"
          >
            LAUNCH A CLIMATE STRESS SCENARIO <ArrowRight size={14} />
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-600">
            Watch the hazard propagate through a connected economic system.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 flex flex-wrap gap-2"
        >
          {SECONDARY_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-1.5 rounded border border-line bg-panel-2 px-3 py-2 text-[11px] text-slate-400 hover:border-cyan/40 hover:text-slate-200"
            >
              <l.icon size={13} className="text-cyan" />
              {l.label}
            </Link>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-10 max-w-2xl rounded-lg border border-line bg-panel-2 p-5"
        >
          <div className="mb-3 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            RBI PILOT CLIMATE VAST EXERCISE, 2022 · 15 BANKS · REPORTED JAN 2024 BULLETIN
          </div>
          <div className="flex flex-wrap gap-8">
            {RBI_STATS.map((s) => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-bold text-risk-high">{s.value}</div>
                <div className="text-[11px] text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-[10.5px] leading-relaxed text-slate-600">
            Reported projected increases in modeled credit-loss potential versus baseline —
            scenario-model outputs from RBI's exploratory pilot, not realized losses from a
            specific historical disaster. The evidence base this prototype is designed around.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
