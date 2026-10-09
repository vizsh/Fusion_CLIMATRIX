import { ArrowUpRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  companyExposureDetail,
  computeBottlenecks,
  computeHazardReach,
  directFinanciers,
  getAncestors,
  institutionExposureToHazard,
  REGION_HAZARD,
} from '../../lib/graphAnalytics'
import { KIND_META, NODES, type GNode } from '../../lib/indiaGraphData'
import { computeInsuranceAdjustedCredit, computeInsurerBook } from '../../lib/insurance'
import { sectorVulnerability } from '../../lib/sectorVulnerability'
import { computeEquityImpact, REGION_LABEL, stressPdLgd, useScenarioStore } from '../../store/useScenarioStore'

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-2 text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono-tnum" style={{ color: color ?? '#e2e8f0' }}>
        {value}
      </span>
    </div>
  )
}

function ScenarioBanner({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`mb-3 rounded border p-2.5 text-[11px] leading-relaxed ${
        active ? 'border-risk-high/30 bg-risk-high/[0.06] text-risk-high' : 'border-line bg-panel-2 text-slate-500'
      }`}
    >
      {children}
    </div>
  )
}

export default function EntityInspector({
  nodeId,
  onClose,
  onSelect,
}: {
  nodeId: string
  onClose?: () => void
  onSelect?: (id: string) => void
}) {
  const navigate = useNavigate()
  const node = NODES.find((n) => n.id === nodeId)
  if (!node) return null
  const meta = KIND_META[node.kind]

  return (
    <div>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-[9.5px] tracking-wide" style={{ color: meta.color }}>
            {meta.label.toUpperCase()}
            {node.region && node.region !== 'National' ? ` · ${node.region}` : ''}
          </span>
          <div className="mt-0.5 text-[14px] font-semibold text-white">{node.label}</div>
          {node.sector && <div className="text-[11px] text-slate-500">{node.sector}</div>}
        </div>
        {onClose && (
          <button onClick={onClose} className="rounded border border-line p-1 text-slate-500 hover:text-slate-300">
            <X size={13} />
          </button>
        )}
      </div>

      {node.note && <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{node.note}</p>}

      {node.kind === 'hazard' && <HazardStats node={node} onSelect={onSelect} />}
      {(node.kind === 'infra' || node.kind === 'supplier') && <BottleneckStats node={node} onSelect={onSelect} />}
      {node.kind === 'company' && <CompanyStats node={node} onSelect={onSelect} />}
      {(node.kind === 'bank' || node.kind === 'govt' || node.kind === 'insurer') && (
        <InstitutionStats node={node} onSelect={onSelect} />
      )}

      {node.kind === 'company' && (
        <button
          onClick={() => navigate(`/company?id=${node.id}`)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 py-2 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
        >
          OPEN FULL INVESTIGATION <ArrowUpRight size={12} />
        </button>
      )}
    </div>
  )
}

function LinkChip({
  node,
  onSelect,
  dim,
}: {
  node: GNode
  onSelect?: (id: string) => void
  dim?: boolean
}) {
  const meta = KIND_META[node.kind]
  return (
    <button
      onClick={() => onSelect?.(node.id)}
      className="rounded border px-2 py-1 text-left text-[10.5px] transition-colors hover:brightness-125"
      style={
        dim
          ? { borderColor: '#1c2430', color: '#64748b', background: 'transparent' }
          : { borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}0f` }
      }
    >
      {node.label}
    </button>
  )
}

function HazardStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const reach = computeHazardReach(node.id)
  return (
    <div>
      <StatRow label="Companies financially reachable" value={`${reach.companies.length}`} />
      <StatRow label="Portfolio EAD reachable" value={`₹${reach.companyEAD.toFixed(0)} cr`} />
      <StatRow label="Share of modeled portfolio" value={`${(reach.portfolioShare * 100).toFixed(1)}%`} />
      <StatRow label="Institutions exposed" value={`${reach.institutions.length}`} />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {reach.institutions.map((i) => (
          <LinkChip key={i.id} node={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function BottleneckStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const b = computeBottlenecks(50).find((x) => x.node.id === node.id)
  const { nodes: ancestorIds } = getAncestors(node.id)
  const hazardSources = NODES.filter((n) => n.kind === 'hazard' && ancestorIds.has(n.id))
  const companies = b?.reachedCompanies ?? []
  const ead = b?.reachedEAD ?? 0
  return (
    <div>
      <StatRow label="Exposed to hazard" value={hazardSources.map((h) => h.region).join(', ') || '—'} />
      <StatRow label="Downstream companies" value={`${companies.length}`} />
      <StatRow label="Downstream EAD at risk" value={`₹${ead.toFixed(0)} cr`} />
      {companies.length > 1 && (
        <div className="mt-2.5 rounded border border-risk-med/30 bg-risk-med/[0.06] p-2.5 text-[10.5px] leading-relaxed text-slate-400">
          Shared dependency: a single disruption here reaches {companies.length} otherwise
          unrelated borrowers — the hidden concentration risk this graph is built to surface.
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {companies.slice(0, 6).map((c) => (
          <LinkChip key={c.id} node={c} onSelect={onSelect} />
        ))}
      </div>
    </div>
  )
}

function CompanyStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const scenario = useScenarioStore()
  const navigate = useNavigate()
  const financiers = directFinanciers(node.id)
  const { hazards, directInfra, indirectInfra, suppliers, directInfraParent } = companyExposureDetail(node.id)

  const activeHazardId = REGION_HAZARD[scenario.region]
  const { nodes: ancestorIds } = getAncestors(node.id)
  const inScenario = ancestorIds.has(activeHazardId)

  const vulnerability = sectorVulnerability(node.sector)
  const { stressedPd, stressedLgd } = stressPdLgd(
    node.baselinePd ?? 0,
    node.baselineLgd ?? 0,
    scenario.severity,
    scenario.durationMonths,
    scenario.substitutability,
    vulnerability,
  )
  const baselineEl = (node.eadCr ?? 0) * (node.baselinePd ?? 0) * (node.baselineLgd ?? 0)
  const stressedEl = (node.eadCr ?? 0) * stressedPd * stressedLgd
  const equity = computeEquityImpact(node, scenario.severity, scenario.durationMonths)
  const insuranceAdjusted = inScenario
    ? computeInsuranceAdjustedCredit(node, stressedPd, stressedLgd, scenario.severity, scenario.durationMonths)
    : null

  const pathSentence = directInfraParent
    ? `Directly dependent on ${directInfra.map((i) => i.label).join(' and ')}.${
        indirectInfra.length
          ? ` Also indirectly linked to ${indirectInfra.map((n) => n.label).join(', ')} through a shared supplier.`
          : ''
      }`
    : hazards.length
      ? `Indirectly exposed — the path runs through ${[...indirectInfra, ...suppliers].map((n) => n.label).join(' → ') || 'a supplier'}.`
      : 'No hazard dependency is traced to this company in the current graph.'

  return (
    <div>
      <ScenarioBanner active={inScenario}>
        {inScenario ? (
          <>
            <strong>Exposed to the active scenario</strong> ({REGION_LABEL[scenario.region]} ·{' '}
            {scenario.hazard}, severity {scenario.severity}/100). {pathSentence}
          </>
        ) : (
          <>
            Not reachable from the active scenario ({REGION_LABEL[scenario.region]} ·{' '}
            {scenario.hazard}). {hazards.length > 0 ? `This company is exposed to: ${hazards.map((h) => REGION_LABEL[h.region as 'HP' | 'KL' | 'MH' | 'UK' | 'MB']).join(', ')} — switch the region in the Scenario console above to see it stressed.` : pathSentence}
          </>
        )}
      </ScenarioBanner>

      {scenario.userMode === 'bank' ? (
        <>
          <StatRow label="Exposure at default (EAD)" value={`₹${node.eadCr} cr`} />
          <StatRow label="Baseline PD → Stressed PD" value={`${((node.baselinePd ?? 0) * 100).toFixed(1)}% → ${inScenario ? (stressedPd * 100).toFixed(1) : ((node.baselinePd ?? 0) * 100).toFixed(1)}%`} />
          <StatRow
            label="Expected loss — current scenario"
            value={inScenario ? `₹${stressedEl.toFixed(2)} cr` : `₹${baselineEl.toFixed(2)} cr (baseline)`}
            color={inScenario ? '#fb3a4a' : undefined}
          />
          {inScenario && insuranceAdjusted && (
            <div className="mt-2.5 rounded border border-cyan/30 bg-cyan/[0.06] p-2.5 text-[10.5px] leading-relaxed text-slate-400">
              <span className="text-cyan">Insured by {insuranceAdjusted.insurer.label}.</span> Modeled claim
              payout offsets ₹{insuranceAdjusted.insuranceOffsetCr.toFixed(2)} cr of loss-given-default — effective
              stressed LGD drops to {(insuranceAdjusted.effectiveLgd * 100).toFixed(1)}%, insurance-adjusted EL ₹
              {insuranceAdjusted.effectiveEl.toFixed(2)} cr.
            </div>
          )}
          {inScenario && !insuranceAdjusted && (
            <div className="mt-2.5 rounded border border-risk-high/30 bg-risk-high/[0.06] p-2.5 text-[10.5px] leading-relaxed text-risk-high">
              No insurance coverage traced for this borrower — the full stressed loss above is uninsured. See
              Insurance &amp; Protection Gap.
            </div>
          )}
        </>
      ) : (
        <>
          <StatRow label="Est. annual revenue" value={`₹${equity.annualRevenueCr.toFixed(0)} cr`} />
          <StatRow
            label="Revenue at risk — current scenario"
            value={inScenario ? `₹${equity.revenueAtRiskCr.toFixed(2)} cr` : '₹0.00 cr (not exposed)'}
            color={inScenario ? '#fb3a4a' : undefined}
          />
          <StatRow label="Est. margin impact" value={inScenario ? `₹${equity.marginImpactCr.toFixed(2)} cr` : '—'} />
        </>
      )}

      <div className="mt-2.5 text-[9.5px] tracking-wide text-slate-500">
        LINKED {scenario.userMode === 'bank' ? 'LENDER(S)' : 'FINANCIER(S)'}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {financiers.length ? financiers.map((f) => <LinkChip key={f.id} node={f} onSelect={onSelect} />) : (
          <span className="text-[10.5px] text-slate-600">None traced</span>
        )}
      </div>

      <button
        onClick={() => navigate(`/company?id=${node.id}`)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-line py-1.5 font-mono text-[10px] tracking-wide text-slate-400 hover:border-cyan/40 hover:text-cyan"
      >
        FULL DUE-DILIGENCE VIEW <ArrowUpRight size={11} />
      </button>
    </div>
  )
}

function InstitutionStats({ node, onSelect }: { node: GNode; onSelect?: (id: string) => void }) {
  const scenario = useScenarioStore()
  const activeHazardId = REGION_HAZARD[scenario.region]
  const exposure = institutionExposureToHazard(node.id, activeHazardId)

  let baselineEl = 0
  let stressedEl = 0
  for (const c of exposure.exposedBorrowers) {
    const { stressedPd, stressedLgd } = stressPdLgd(
      c.baselinePd ?? 0,
      c.baselineLgd ?? 0,
      scenario.severity,
      scenario.durationMonths,
      scenario.substitutability,
      sectorVulnerability(c.sector),
    )
    baselineEl += (c.eadCr ?? 0) * (c.baselinePd ?? 0) * (c.baselineLgd ?? 0)
    stressedEl += (c.eadCr ?? 0) * stressedPd * stressedLgd
  }

  const hasExposure = exposure.exposedBorrowers.length > 0
  const book = node.kind === 'insurer' ? computeInsurerBook(node.id, activeHazardId, scenario.severity, scenario.durationMonths) : null

  return (
    <div>
      <ScenarioBanner active={hasExposure}>
        {node.label} finances {exposure.totalBorrowers.length} borrower(s) totaling ₹
        {exposure.totalEAD.toFixed(0)} cr.{' '}
        {hasExposure ? (
          <>
            Under the active scenario ({REGION_LABEL[scenario.region]} · {scenario.hazard}, severity{' '}
            {scenario.severity}/100), <strong>{exposure.exposedBorrowers.length} of {exposure.totalBorrowers.length}</strong>{' '}
            are exposed — ₹{exposure.exposedEAD.toFixed(0)} cr of its book.
          </>
        ) : (
          <>None of its borrowers are reachable from the active scenario ({REGION_LABEL[scenario.region]} · {scenario.hazard}) — try a different region above.</>
        )}
      </ScenarioBanner>

      <StatRow label="Total book (all regions)" value={`₹${exposure.totalEAD.toFixed(0)} cr`} />
      <StatRow label="Scenario-exposed EAD" value={`₹${exposure.exposedEAD.toFixed(0)} cr`} color={hasExposure ? '#f5a524' : undefined} />
      {book && book.policyCount > 0 && (
        <>
          <StatRow label="Underwriting — sum insured in scope" value={`₹${book.totalSumInsuredCr.toFixed(0)} cr`} />
          <StatRow label="Expected net claims — scenario" value={`₹${book.expectedNetClaimsCr.toFixed(2)} cr`} color="#fb3a4a" />
          <StatRow label="Gross loss ratio" value={`${(book.grossLossRatio * 100).toFixed(0)}%`} color="#f5a524" />
          {book.govtSubsidyPct > 0 ? (
            <StatRow
              label={`Govt subsidy (${book.govtSubsidyPct}% of premium)`}
              value={`₹${book.govtSubsidyCr.toFixed(2)} cr`}
              color="#2dd4a7"
            />
          ) : (
            <StatRow
              label={`Ceded to ${book.insurer.reinsurerName ?? 'reinsurer'}`}
              value={`${book.cededSharePct}% · ₹${book.cededClaimsCr.toFixed(2)} cr`}
            />
          )}
        </>
      )}
      {hasExposure && (
        <>
          <StatRow label="Baseline EL (exposed borrowers)" value={`₹${baselineEl.toFixed(2)} cr`} />
          <StatRow label="Stressed EL (exposed borrowers)" value={`₹${stressedEl.toFixed(2)} cr`} color="#fb3a4a" />
        </>
      )}

      {hasExposure && (
        <>
          <div className="mt-3 text-[9.5px] tracking-wide text-risk-high">EXPOSED BORROWERS</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {exposure.exposedBorrowers.map((c) => (
              <LinkChip key={c.id} node={c} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
      {exposure.unexposedBorrowers.length > 0 && (
        <>
          <div className="mt-3 text-[9.5px] tracking-wide text-slate-600">OTHER BORROWERS (NOT IN THIS SCENARIO)</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {exposure.unexposedBorrowers.map((c) => (
              <LinkChip key={c.id} node={c} onSelect={onSelect} dim />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
