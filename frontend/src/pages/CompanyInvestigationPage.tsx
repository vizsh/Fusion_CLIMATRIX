import { motion } from 'framer-motion'
import { Building2, GitBranch, Landmark, MapPin, ShieldQuestion, TrendingDown } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { directFinanciers, getAncestors } from '../lib/graphAnalytics'
import { EDGES, NODES } from '../lib/indiaGraphData'
import { stressPdLgd, useScenarioStore } from '../store/useScenarioStore'

const COMPANIES = NODES.filter((n) => n.kind === 'company')

export default function CompanyInvestigationPage() {
  const [params] = useSearchParams()
  const selectedId = useScenarioStore((s) => s.selectedEntityId)
  const setSelectedId = useScenarioStore((s) => s.setSelectedEntity)
  const scenario = useScenarioStore()

  useEffect(() => {
    const paramId = params.get('id')
    if (paramId && COMPANIES.some((c) => c.id === paramId)) setSelectedId(paramId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const company = COMPANIES.find((c) => c.id === selectedId) ?? COMPANIES[0]

  const { nodes: ancestorIds } = getAncestors(company.id)
  const hazards = NODES.filter((n) => n.kind === 'hazard' && ancestorIds.has(n.id))
  const infra = NODES.filter((n) => n.kind === 'infra' && ancestorIds.has(n.id))
  const suppliers = NODES.filter((n) => n.kind === 'supplier' && ancestorIds.has(n.id))
  const directInfraParent = EDGES.some(
    (e) => e.to === company.id && NODES.find((n) => n.id === e.from)?.kind === 'infra',
  )
  const financiers = directFinanciers(company.id)

  const { stressedPd, stressedLgd } = stressPdLgd(
    company.baselinePd ?? 0,
    company.baselineLgd ?? 0,
    scenario.severity,
    scenario.durationMonths,
    scenario.substitutability,
  )
  const baselineEl = (company.eadCr ?? 0) * (company.baselinePd ?? 0) * (company.baselineLgd ?? 0)
  const stressedEl = (company.eadCr ?? 0) * stressedPd * stressedLgd
  const relevantScenario = hazards.some((h) => h.region === scenario.region)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="COMPANY INVESTIGATION"
        subtitle="FACILITY · SUPPLY CHAIN · FINANCIAL TRANSMISSION · EVIDENCE"
        tag="FICTIONAL COMPANIES — ILLUSTRATIVE RISK INVESTIGATION"
      />
      <div className="flex min-h-0 flex-1">
        <aside className="w-[270px] shrink-0 overflow-y-auto border-r border-line bg-panel/60 p-3">
          <div className="mb-2 px-1 font-mono text-[9px] tracking-[0.15em] text-slate-500">PORTFOLIO COMPANIES</div>
          <div className="space-y-1.5">
            {COMPANIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full rounded border p-2.5 text-left transition-colors ${
                  company.id === c.id ? 'border-cyan/50 bg-cyan/10' : 'border-line bg-panel-2 hover:border-slate-600'
                }`}
              >
                <div className={`font-mono text-[11px] ${company.id === c.id ? 'text-cyan' : 'text-slate-300'}`}>
                  {c.label}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {c.sector} · {c.region}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-grid p-6">
          <motion.div key={company.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-3xl">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Building2 size={13} />
              <span className="font-mono text-[9px] tracking-[0.15em]">COMPANY INTELLIGENCE / INDUSTRIAL EXPOSURE</span>
            </div>
            <h1 className="text-xl font-semibold text-white">{company.label}</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Fictional company · {company.sector} · {company.region}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatCard label="Direct hazard exposure" value={directInfraParent && hazards.length ? 'Direct' : hazards.length ? 'Indirect' : 'None traced'} color={hazards.length ? (directInfraParent ? '#fb3a4a' : '#f5a524') : '#2dd4a7'} />
              <StatCard label="Hazard ancestors" value={`${hazards.length}`} color="#f5a524" />
              <StatCard label="Scenario relevance" value={relevantScenario ? 'In current scenario' : 'Outside current scenario'} color={relevantScenario ? '#22d3ee' : '#64748b'} />
            </div>

            <div className="mt-6 space-y-4">
              <Block icon={MapPin} title="Facility and geographic exposure">
                {company.label} operates in {company.region === 'National' ? 'a diversified national footprint' : company.region}.{' '}
                {infra.length
                  ? `Its dependency chain traces back through ${infra.map((i) => i.label).join(', ')}.`
                  : 'No infrastructure dependency is currently traced to this company in the graph.'}
              </Block>

              <Block icon={GitBranch} title="Supply-chain exposure and substitutability">
                {suppliers.length
                  ? `Depends on ${suppliers.map((s) => s.label).join(', ')}. Under the active scenario, supplier substitutability is set to "${scenario.substitutability}" — ${
                      scenario.substitutability === 'Limited'
                        ? 'few viable alternatives, so disruption here passes through largely unabsorbed.'
                        : scenario.substitutability === 'Strong'
                          ? 'multiple viable alternatives exist, cushioning the impact.'
                          : 'alternatives exist but with switching delay and cost.'
                    }`
                  : 'No supplier dependency is currently traced to this company in the graph.'}
              </Block>

              <Block icon={TrendingDown} title="Company-level stressed credit view">
                <div className="mb-2">
                  Applying the same scenario formula used portfolio-wide (EAD × PD × LGD) to this
                  company alone:
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded border border-line bg-panel-2 p-2">
                    <div className="font-mono text-[9px] text-slate-500">BASELINE EL</div>
                    <div className="font-mono-tnum text-slate-200">₹{baselineEl.toFixed(2)} cr</div>
                  </div>
                  <div className="rounded border border-risk-high/30 bg-risk-high/[0.06] p-2">
                    <div className="font-mono text-[9px] text-slate-500">STRESSED EL</div>
                    <div className="font-mono-tnum text-risk-high">₹{stressedEl.toFixed(2)} cr</div>
                  </div>
                </div>
              </Block>

              <Block icon={Landmark} title="Linked lender / financier exposure">
                {financiers.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {financiers.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        className="rounded border border-cyan/40 bg-cyan/10 px-2 py-1 text-[10.5px] text-cyan hover:bg-cyan/20"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  'No financier is linked to this company in the graph.'
                )}
              </Block>

              <Block icon={ShieldQuestion} title="Evidence and assumptions">
                Company identity, EAD, PD/LGD and supplier/financier relationships are{' '}
                <span className="text-risk-high">synthetic</span> — fabricated for this
                demonstration. Hazard-to-infrastructure links are{' '}
                <span className="text-cyan">sourced</span> from documented district-level disaster
                impact. Infrastructure-to-company dependency links are{' '}
                <span className="text-risk-low">modelled</span> by this application's graph logic,
                not independently verified. A production build requires authorized borrower data
                before any of this can be treated as decision-grade.
              </Block>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border border-line bg-panel-2 p-3">
      <div className="font-mono text-[9px] tracking-wide text-slate-500">{label.toUpperCase()}</div>
      <div className="mt-1 font-mono-tnum text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function Block({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-4">
      <div className="mb-2 flex items-center gap-2 text-cyan">
        <Icon size={14} />
        <span className="font-mono text-[11px] tracking-wide">{title}</span>
      </div>
      <div className="text-[12px] leading-relaxed text-slate-400">{children}</div>
    </div>
  )
}
