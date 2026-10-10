import { ShieldCheck } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ScenarioConsole from '../components/ScenarioConsole'
import KpiCard from '../components/ui/KpiCard'
import EvidenceBadge from '../components/ui/EvidenceBadge'
import { REGION_HAZARD } from '../lib/graphAnalytics'
import { allInsurers, computeInsurerBook, computeProtectionGap, formatLossRatio } from '../lib/insurance'
import { REGION_LABEL, useScenarioStore } from '../store/useScenarioStore'

export default function InsurancePage() {
  const { region, hazard, severity, durationMonths } = useScenarioStore()
  const hazardId = REGION_HAZARD[region]
  const gap = computeProtectionGap(hazardId, severity, durationMonths)
  const insurers = allInsurers()
  const books = insurers.map((i) => computeInsurerBook(i.id, hazardId, severity, durationMonths)).filter((b) => !!b)

  const gapPct = (gap.protectionGapShare * 100).toFixed(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg-main">
      <PageHeader
        title="INSURANCE & PROTECTION GAP"
        subtitle="UNDERWRITTEN CAPITAL, UNHEDGED RESIDUAL RISK & TAIL-LIABILITY"
        tag={`${REGION_LABEL[region]} · ${hazard} (${severity}%)`}
      />

      <div className="border-b border-border-subtle bg-bg-secondary/70 backdrop-blur-sm">
        <ScenarioConsole compact />
      </div>

      <div className="p-4 sm:p-6 lg:p-7 space-y-6">
        {/* KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Exposed Portfolio EAD"
            value={`₹${gap.exposedEADCr.toFixed(0)}`}
            unit="Cr"
            comparison="Reachable by Active Hazard"
            comparisonTone="neutral"
            evidence="sourced"
            subtitle={`${gap.exposedCompanies.length} borrowers underwritten`}
          />

          <KpiCard
            label="Protection Gap"
            value={`${gapPct}%`}
            unit="Uninsured"
            comparison={`₹${gap.uninsuredEADCr.toFixed(0)} Cr Uncovered`}
            comparisonTone={gap.protectionGapShare > 0.5 ? 'coral' : 'amber'}
            evidence="modelled"
            subtitle="Zero physical climate policy"
          />

          <KpiCard
            label="Total Sum Insured"
            value={`₹${gap.totalSumInsuredCr.toFixed(0)}`}
            unit="Cr"
            comparison="Insured Asset Subset"
            comparisonTone="teal"
            evidence="sourced"
            subtitle={`₹${gap.totalPremiumCr.toFixed(2)} Cr Annual Premium`}
          />

          <KpiCard
            label="Expected Net Claims"
            value={`₹${gap.totalNetClaimsCr.toFixed(2)}`}
            unit="Cr"
            comparison={`Loss Ratio ${formatLossRatio(gap.portfolioLossRatio)}`}
            comparisonTone="coral"
            evidence="modelled"
            subtitle="Modeled physical event payout"
          />
        </div>

        {/* Insurer Underwriting Books */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              <ShieldCheck size={14} className="text-accent-teal" />
              <span>UNDERWRITING EXPOSURE BY INSURER BOOK</span>
            </div>
            <EvidenceBadge type="modelled" size="sm" />
          </div>

          <div className="space-y-3">
            {books.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-subtle p-6 text-center font-mono text-[11px] text-text-muted">
                No insurer in this network currently carries a policy reaching the active hazard zone.
              </div>
            ) : (
              books.map((b) => (
                <div key={b!.insurer.id} className="rounded-lg border border-border-subtle bg-bg-elevated p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="flex items-center gap-2 font-mono text-[13px] font-bold text-text-primary">
                      <span>{b!.insurer.label}</span>
                      {b!.govtSubsidyPct > 0 && (
                        <span className="rounded border border-accent-teal/40 bg-accent-teal/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-accent-teal uppercase tracking-wider">
                          PMFBY / STATE SUBSIDY SCHEME
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[10.5px] text-text-muted">
                      {b!.policyCount} polic{b!.policyCount === 1 ? 'y' : 'ies'} in active scope
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px] pt-2 border-t border-border-subtle/50">
                    <div>
                      <div className="text-[9.5px] text-text-muted uppercase tracking-wider">Total Sum Insured</div>
                      <div className="text-[14px] font-bold text-text-primary mt-0.5">
                        ₹{b!.totalSumInsuredCr.toFixed(0)} Cr
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] text-text-muted uppercase tracking-wider">Expected Net Claims</div>
                      <div className="text-[14px] font-bold text-critical-coral mt-0.5">
                        ₹{b!.expectedNetClaimsCr.toFixed(2)} Cr
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] text-text-muted uppercase tracking-wider">Gross Loss Ratio</div>
                      <div className="text-[14px] font-bold text-warning-amber mt-0.5">
                        {formatLossRatio(b!.grossLossRatio)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] text-text-muted uppercase tracking-wider">Farmer vs Govt Share</div>
                      <div className="text-[12px] font-medium text-text-secondary mt-0.5">
                        {b!.govtSubsidyPct > 0
                          ? `₹${b!.farmerPaidPremiumCr.toFixed(1)}Cr / ₹${b!.govtSubsidyCr.toFixed(1)}Cr (${b!.govtSubsidyPct}%)`
                          : 'Commercial 100%'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Protection Gap Entities Table */}
        <div className="rounded-xl border border-border-subtle bg-bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-muted">
              EXPOSED ASSET COVERAGE BREAKDOWN
            </div>
            <span className="font-mono text-[10.5px] text-text-muted">
              {gap.exposedCompanies.length} ASSESSED ENTITIES
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-bg-elevated border-b border-border-subtle text-text-muted text-[9.5px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Borrower / Asset</th>
                  <th className="p-3">Sector</th>
                  <th className="p-3 text-right">EAD (₹ Cr)</th>
                  <th className="p-3 text-right">Sum Insured</th>
                  <th className="p-3 text-right">Uninsured Gap</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 bg-bg-card">
                {gap.exposedCompanies.map((c) => {
                  const isUninsured = gap.uninsuredExposed.some((u) => u.id === c.id)
                  return (
                    <tr key={c.id} className="hover:bg-bg-elevated/50 transition-colors">
                      <td className="p-3 font-semibold text-text-primary">{c.label}</td>
                      <td className="p-3 text-text-muted">{c.sector}</td>
                      <td className="p-3 text-right tabular-nums text-text-primary">₹{(c.eadCr ?? 0).toFixed(0)}</td>
                      <td className="p-3 text-right tabular-nums text-accent-teal">
                        {isUninsured ? '₹0' : `₹${((c.eadCr ?? 0) * 0.85).toFixed(0)}`}
                      </td>
                      <td className="p-3 text-right tabular-nums text-critical-coral">
                        {isUninsured ? `₹${(c.eadCr ?? 0).toFixed(0)}` : `₹${((c.eadCr ?? 0) * 0.15).toFixed(0)}`}
                      </td>
                      <td className="p-3 text-center">
                        {isUninsured ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-critical-coral/40 bg-critical-coral/10 text-critical-coral">
                            UNINSURED
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-accent-teal/40 bg-accent-teal/10 text-accent-teal">
                            COVERED
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
