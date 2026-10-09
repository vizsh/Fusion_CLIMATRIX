import { motion } from 'framer-motion'
import {
  Building2,
  Download,
  GitBranch,
  Landmark,
  LineChart,
  ListChecks,
  MapPin,
  ShieldQuestion,
  TrendingDown,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { companyExposureDetail, directFinanciers } from '../lib/graphAnalytics'
import { NODES, type GNode } from '../lib/indiaGraphData'
import { INTERVENTIONS } from '../lib/interventions'
import { sectorVulnerability } from '../lib/sectorVulnerability'
import { computeEquityImpact, REGION_LABEL, stressPdLgd, useScenarioStore } from '../store/useScenarioStore'

const COMPANIES = NODES.filter((n) => n.kind === 'company')

function dueDiligenceQuestions(
  hazards: GNode[],
  directInfra: GNode[],
  suppliers: GNode[],
  directInfraParent: boolean,
  financiers: GNode[],
) {
  const qs: string[] = []
  if (directInfraParent && hazards.length) {
    qs.push(`Request an independent hazard/engineering assessment for ${directInfra.map((i) => i.label).join(' and ')}, the direct physical dependency for this site.`)
  }
  if (hazards.length && !directInfraParent) {
    qs.push('Verify the indirect exposure path: confirm which infrastructure or supplier failure would actually interrupt operations, rather than assuming proximity alone is a risk.')
  }
  if (suppliers.length === 1) {
    qs.push(`${suppliers[0].label} appears to be a single-sourced dependency — confirm whether a qualified alternate supplier exists.`)
  }
  if (directInfra.length === 1) {
    qs.push(`${directInfra[0].label} appears to be the sole direct access/utility dependency traced in the graph — verify whether an alternate route or backup exists.`)
  }
  if (!financiers.length) {
    qs.push('No financing relationship is captured for this company — confirm lender of record before relying on any credit-side conclusion.')
  }
  qs.push('All relationships and financial figures shown here are synthetic placeholders — verify every fact against authorized company and lender records before this informs an actual decision.')
  return qs
}

export default function CompanyInvestigationPage() {
  const [params] = useSearchParams()
  const selectedId = useScenarioStore((s) => s.selectedEntityId)
  const setSelectedId = useScenarioStore((s) => s.setSelectedEntity)
  const userMode = useScenarioStore((s) => s.userMode)
  const scenario = useScenarioStore()

  useEffect(() => {
    const paramId = params.get('id')
    if (paramId && COMPANIES.some((c) => c.id === paramId)) setSelectedId(paramId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const company = COMPANIES.find((c) => c.id === selectedId) ?? COMPANIES[0]

  const { hazards, directInfra, indirectInfra, suppliers, directInfraParent } = companyExposureDetail(company.id)
  const financiers = directFinanciers(company.id)
  const relevantScenario = hazards.some((h) => h.region === scenario.region)
  const questions = useMemo(
    () => dueDiligenceQuestions(hazards, directInfra, suppliers, directInfraParent, financiers),
    [hazards, directInfra, suppliers, directInfraParent, financiers],
  )
  const candidateMitigations = INTERVENTIONS.filter((i) =>
    suppliers.length ? true : i.id !== 'supplier-diversification',
  )

  const { stressedPd, stressedLgd } = stressPdLgd(
    company.baselinePd ?? 0,
    company.baselineLgd ?? 0,
    scenario.severity,
    scenario.durationMonths,
    scenario.substitutability,
    sectorVulnerability(company.sector),
  )
  const baselineEl = (company.eadCr ?? 0) * (company.baselinePd ?? 0) * (company.baselineLgd ?? 0)
  const stressedEl = (company.eadCr ?? 0) * stressedPd * stressedLgd
  const equity = computeEquityImpact(company, scenario.severity, scenario.durationMonths)

  function exportBrief() {
    const title = userMode === 'bank' ? 'LENDING-RISK BRIEF' : 'INVESTMENT-RISK BRIEF'
    const lines = [
      `CLIMATRIX INDIA — ${title}`,
      `Generated: ${new Date().toISOString()}`,
      `Company: ${company.label} (fictional/synthetic) — ${company.sector}, ${REGION_LABEL[scenario.region] ?? company.region}`,
      '',
      '— SCENARIO —',
      `${scenario.hazard} · severity ${scenario.severity}/100 · ${scenario.durationMonths}mo horizon · substitutability ${scenario.substitutability}`,
      '',
      '— EXPOSURE —',
      `Hazard ancestors: ${hazards.length} (${directInfraParent ? 'direct infrastructure dependency' : 'indirect'})`,
      `Direct infrastructure dependency: ${directInfra.map((i) => i.label).join(', ') || 'none traced'}`,
      `Indirect infrastructure (via supplier): ${indirectInfra.map((i) => i.label).join(', ') || 'none traced'}`,
      `Supplier dependencies: ${suppliers.map((s) => s.label).join(', ') || 'none traced'}`,
      '',
      userMode === 'bank'
        ? `— CREDIT VIEW — EAD ₹${company.eadCr} cr · Baseline EL ₹${baselineEl.toFixed(2)} cr · Stressed EL ₹${stressedEl.toFixed(2)} cr`
        : `— INVESTMENT VIEW — Est. annual revenue ₹${equity.annualRevenueCr.toFixed(0)} cr · Revenue at risk ₹${equity.revenueAtRiskCr.toFixed(2)} cr · Est. margin impact ₹${equity.marginImpactCr.toFixed(2)} cr`,
      `Linked ${userMode === 'bank' ? 'lender' : 'financier'}: ${financiers.map((f) => f.label).join(', ') || 'none traced'}`,
      '',
      '— DUE-DILIGENCE QUESTIONS —',
      ...questions.map((q, i) => `${i + 1}. ${q}`),
      '',
      '— CANDIDATE MITIGATIONS —',
      ...candidateMitigations.map((m) => `- ${m.label}: ${m.description} (illustrative cost ₹${m.costCr} cr)`),
      '',
      'All company identities, financial figures and relationships are synthetic demonstration data.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `climatrix-${userMode}-brief-${company.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="COMPANY INVESTIGATION"
        subtitle={`FACILITY · SUPPLY CHAIN · ${userMode === 'bank' ? 'CREDIT' : 'INVESTMENT'} TRANSMISSION · EVIDENCE`}
        tag={`${userMode.toUpperCase()} LENS — FICTIONAL COMPANIES, ILLUSTRATIVE INVESTIGATION`}
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
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <Building2 size={13} />
                <span className="font-mono text-[9px] tracking-[0.15em]">COMPANY INTELLIGENCE / INDUSTRIAL EXPOSURE</span>
              </div>
              <button
                onClick={exportBrief}
                className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-cyan hover:bg-cyan/20"
              >
                <Download size={12} /> EXPORT {userMode === 'bank' ? 'LENDING' : 'INVESTMENT'} BRIEF
              </button>
            </div>
            <h1 className="text-xl font-semibold text-white">{company.label}</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Fictional company · {company.sector} · {company.region}
              {company.note && <span className="block mt-1 text-slate-600">{company.note}</span>}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatCard label="Direct hazard exposure" value={directInfraParent && hazards.length ? 'Direct' : hazards.length ? 'Indirect' : 'None traced'} color={hazards.length ? (directInfraParent ? '#fb3a4a' : '#f5a524') : '#2dd4a7'} />
              <StatCard label="Hazard ancestors" value={`${hazards.length}`} color="#f5a524" />
              <StatCard label="Scenario relevance" value={relevantScenario ? 'In current scenario' : 'Outside current scenario'} color={relevantScenario ? '#22d3ee' : '#64748b'} />
            </div>

            <div className="mt-6 space-y-4">
              <Block icon={MapPin} title="Facility and geographic exposure">
                {company.label} operates in {company.region === 'National' ? 'a diversified national footprint' : company.region}.{' '}
                {directInfra.length
                  ? `Directly dependent on ${directInfra.map((i) => i.label).join(', ')}.`
                  : 'No direct infrastructure dependency is traced to this company in the graph.'}
                {indirectInfra.length
                  ? ` Also indirectly linked, via a shared supplier, to ${indirectInfra.map((i) => i.label).join(', ')} — a real but more distant dependency, not a direct site risk.`
                  : ''}
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

              {userMode === 'bank' ? (
                <Block icon={TrendingDown} title="Company-level stressed credit view">
                  <div className="mb-2">
                    Applying the same scenario formula used portfolio-wide (EAD × PD × LGD) to this
                    company alone, with a {company.sector ?? 'default'} sector vulnerability
                    multiplier of ×{sectorVulnerability(company.sector).toFixed(2)} on the severity
                    factor:
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
              ) : (
                <Block icon={LineChart} title="Operating and revenue sensitivity (investor lens)">
                  <div className="mb-2">
                    Screening estimate — revenue at risk = annual revenue × exposed revenue share
                    (×{equity.exposedRevenueShare.toFixed(2)}, assumed) × disruption fraction
                    (×{equity.disruptionFraction.toFixed(2)}) × horizon fraction. Not a calibrated
                    earnings forecast or valuation input.
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border border-line bg-panel-2 p-2">
                      <div className="font-mono text-[9px] text-slate-500">EST. ANNUAL REVENUE</div>
                      <div className="font-mono-tnum text-slate-200">₹{equity.annualRevenueCr.toFixed(0)} cr</div>
                    </div>
                    <div className="rounded border border-risk-high/30 bg-risk-high/[0.06] p-2">
                      <div className="font-mono text-[9px] text-slate-500">REVENUE AT RISK</div>
                      <div className="font-mono-tnum text-risk-high">₹{equity.revenueAtRiskCr.toFixed(2)} cr</div>
                    </div>
                    <div className="rounded border border-line bg-panel-2 p-2">
                      <div className="font-mono text-[9px] text-slate-500">EST. MARGIN IMPACT</div>
                      <div className="font-mono-tnum text-slate-200">₹{equity.marginImpactCr.toFixed(2)} cr</div>
                    </div>
                    <div className="rounded border border-line bg-panel-2 p-2">
                      <div className="font-mono text-[9px] text-slate-500">EST. CASH-FLOW IMPACT</div>
                      <div className="font-mono-tnum text-slate-200">₹{equity.cashflowImpactCr.toFixed(2)} cr</div>
                    </div>
                  </div>
                </Block>
              )}

              <Block icon={Landmark} title={userMode === 'bank' ? 'Linked lender exposure' : 'Linked financing relationship'}>
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

              <Block icon={ListChecks} title={`Recommended due-diligence questions${userMode === 'investor' ? ' and resilience checks' : ''}`}>
                <ul className="list-disc space-y-1.5 pl-4">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </Block>

              <Block icon={ShieldQuestion} title="Evidence and assumptions">
                Company identity, EAD, revenue and supplier/financier relationships are{' '}
                <span className="text-risk-high">synthetic</span> — fabricated for this
                demonstration. Hazard-to-infrastructure links are{' '}
                <span className="text-cyan">sourced</span> or disclosed assumptions where no
                documented event exists. Infrastructure-to-company dependency links are{' '}
                <span className="text-risk-low">modelled</span> by this application's graph logic,
                not independently verified. A production build requires authorized{' '}
                {userMode === 'bank' ? 'borrower' : 'company'} data before any of this can be
                treated as decision-grade.
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
