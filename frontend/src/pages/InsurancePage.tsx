import { AlertTriangle, ShieldCheck, Umbrella } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import { REGION_HAZARD } from '../lib/graphAnalytics'
import { KIND_META } from '../lib/indiaGraphData'
import { allInsurers, computeInsurerBook, computeProtectionGap } from '../lib/insurance'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

function Card({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3.5">
      <div className="font-mono text-[9px] tracking-[0.15em] text-slate-500">{label}</div>
      <div className="mt-1 text-[20px] font-semibold" style={{ color: color ?? '#e2e8f0' }}>
        {value}
      </div>
      {note && <div className="mt-1 text-[10px] leading-relaxed text-slate-600">{note}</div>}
    </div>
  )
}

export default function InsurancePage() {
  const { region, hazard, severity, durationMonths } = useScenarioStore()
  const hazardId = REGION_HAZARD[region]
  const gap = computeProtectionGap(hazardId, severity, durationMonths)
  const insurers = allInsurers()
  const books = insurers.map((i) => computeInsurerBook(i.id, hazardId, severity, durationMonths)).filter((b) => !!b)

  const gapPct = (gap.protectionGapShare * 100).toFixed(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="INSURANCE & PROTECTION GAP"
        subtitle="WHAT'S INSURED, WHAT ISN'T, WHO CARRIES THE TAIL"
        tag={`${REGION_LABEL[region]} · ${hazard} · SEVERITY ${severity}/100`}
      />

      <div className="bg-grid p-6">
        <div className="mb-5">
          <ScenarioConsole compact />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="EXPOSED PORTFOLIO (CURRENT SCENARIO)" value={`₹${gap.exposedEADCr.toFixed(0)} cr`} />
          <Card
            label="PROTECTION GAP"
            value={`${gapPct}%`}
            color={gap.protectionGapShare > 0.5 ? '#fb3a4a' : '#f5a524'}
            note={`₹${gap.uninsuredEADCr.toFixed(0)} cr of exposed EAD carries zero climate-event insurance coverage.`}
          />
          <Card label="TOTAL SUM INSURED (INSURED SUBSET)" value={`₹${gap.totalSumInsuredCr.toFixed(0)} cr`} />
          <Card
            label="EXPECTED NET CLAIMS — SCENARIO"
            value={`₹${gap.totalNetClaimsCr.toFixed(2)} cr`}
            color="#fb3a4a"
            note={`Modeled loss ratio ${(gap.portfolioLossRatio * 100).toFixed(0)}% against ₹${gap.totalPremiumCr.toFixed(2)} cr premium — a disclosed estimate, not a filed-claims figure.`}
          />
        </div>

        <div className="mb-6 rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            <ShieldCheck size={12} className="text-cyan" /> INSURER BOOKS — CURRENT SCENARIO
          </div>
          <div className="space-y-2.5">
            {books.length === 0 && (
              <div className="rounded border border-line px-3 py-4 text-center text-[10.5px] text-slate-600">
                No insurer in this graph has a policy reaching the active scenario.
              </div>
            )}
            {books.map((b) => (
              <div key={b!.insurer.id} className="rounded border border-line bg-panel p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-200">{b!.insurer.label}</span>
                  <span className="font-mono text-[9.5px] text-slate-500">{b!.policyCount} polic{b!.policyCount === 1 ? 'y' : 'ies'} in scope</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10.5px] sm:grid-cols-4">
                  <div>
                    <div className="text-slate-600">Sum insured</div>
                    <div className="font-mono-tnum text-slate-300">₹{b!.totalSumInsuredCr.toFixed(0)} cr</div>
                  </div>
                  <div>
                    <div className="text-slate-600">Expected net claims</div>
                    <div className="font-mono-tnum text-risk-high">₹{b!.expectedNetClaimsCr.toFixed(2)} cr</div>
                  </div>
                  <div>
                    <div className="text-slate-600">Gross loss ratio</div>
                    <div className="font-mono-tnum text-risk-med">{(b!.grossLossRatio * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-slate-600">Ceded to {b!.insurer.reinsurerName ?? 'reinsurer'}</div>
                    <div className="font-mono-tnum text-slate-300">
                      {b!.cededSharePct}% · ₹{b!.cededClaimsCr.toFixed(2)} cr
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full bg-risk-high"
                    style={{ width: `${Math.min(b!.grossLossRatio * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[9.5px] leading-relaxed text-slate-600">
                  Net retained after cession: ₹{b!.retainedClaimsCr.toFixed(2)} cr — the catastrophe-concentration
                  check every reinsurer runs before renewing a treaty.
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-risk-high/30 bg-risk-high/[0.04] p-4">
          <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-risk-high">
            <AlertTriangle size={12} /> UNINSURED EXPOSED BORROWERS ({gap.uninsuredExposed.length})
          </div>
          {gap.uninsuredExposed.length === 0 ? (
            <p className="text-[10.5px] text-slate-500">Every company this scenario reaches carries coverage.</p>
          ) : (
            <div className="space-y-1.5">
              {[...gap.uninsuredExposed]
                .sort((a, b) => (b.eadCr ?? 0) - (a.eadCr ?? 0))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded border border-line bg-panel-2 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Umbrella size={12} className="text-slate-600" />
                      <span className="text-[11.5px] text-slate-300">{c.label}</span>
                      <span className="text-[9.5px] text-slate-600">{c.sector}</span>
                    </div>
                    <span className="font-mono-tnum text-[10.5px] text-risk-high">₹{(c.eadCr ?? 0).toFixed(0)} cr uncovered</span>
                  </div>
                ))}
            </div>
          )}
          <p className="mt-3 text-[9.5px] leading-relaxed text-slate-600">
            For a lender, this is a lending-condition candidate — requiring coverage in exposed sectors before
            renewal. For an investor, this is asymmetric tail risk no credit metric currently prices in. See{' '}
            {KIND_META.insurer.label.toLowerCase()} policies above for which borrowers already carry it.
          </p>
        </div>
      </div>
    </div>
  )
}
