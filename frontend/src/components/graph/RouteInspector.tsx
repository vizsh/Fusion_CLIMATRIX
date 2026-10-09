// Route-level inspector for the Digital Twin's supply-chain movement
// layer — "select a route → see its hazard exposure → trace the
// dependency to affected holdings → understand the potential investment
// impact" per the supply-chain audit's required interaction. Every
// number here comes from the exact same stressPdLgd/computeEquityImpact
// functions the rest of the app uses on this company; nothing is
// recomputed or invented for this panel.

import { ArrowUpRight, Ship, Truck, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EVIDENCE_META } from '../../lib/evidence'
import { NODES } from '../../lib/indiaGraphData'
import { sectorVulnerability } from '../../lib/sectorVulnerability'
import type { SupplyRoute } from '../../lib/supplyChainRoutes'
import { computeEquityImpact, REGION_LABEL, stressPdLgd, useScenarioStore } from '../../store/useScenarioStore'

export default function RouteInspector({ route, onClose, onInspectNode }: { route: SupplyRoute; onClose: () => void; onInspectNode: (id: string) => void }) {
  const navigate = useNavigate()
  const { severity, durationMonths, substitutability, hazard, userMode, region } = useScenarioStore()
  const hazardNode = NODES.find((n) => n.id === route.hazardId)
  const infraNode = NODES.find((n) => n.id === route.infraId)
  const company = NODES.find((n) => n.id === route.companyId)
  if (!hazardNode || !infraNode || !company) return null

  const vulnerability = sectorVulnerability(company.sector)
  const { stressedPd, stressedLgd } = stressPdLgd(company.baselinePd ?? 0, company.baselineLgd ?? 0, severity, durationMonths, substitutability, vulnerability)
  const eadCr = company.eadCr ?? 0
  const baselineElCr = eadCr * (company.baselinePd ?? 0) * (company.baselineLgd ?? 0)
  const stressedElCr = eadCr * stressedPd * stressedLgd
  const equity = computeEquityImpact(company, severity, durationMonths)
  const ModeIcon = route.mode === 'port' ? Ship : Truck

  return (
    <div>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10">
            <ModeIcon size={15} className="text-amber-400" />
          </div>
          <div>
            <span className="font-mono text-[9px] tracking-wide text-amber-400">SUPPLY-CHAIN MOVEMENT</span>
            <div className="text-[13px] font-semibold text-white">{route.label}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded border border-line p-1 text-slate-500 hover:text-slate-300">
          <X size={13} />
        </button>
      </div>

      <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/[0.06] p-2 text-[10px] leading-relaxed text-amber-300">
        <strong>DEMO SIMULATION — NOT LIVE TRACKING.</strong> This marker illustrates a plausible route built from this
        graph’s own real node coordinates — it is not a GPS track, a real shipment, or a live logistics feed. No
        provider data backs this specific movement.
      </div>

      <div className="mb-3 space-y-1.5 rounded border border-line bg-panel-2 p-2.5 text-[11px]">
        <div className="flex justify-between text-slate-400">
          <span>Origin (hazard)</span>
          <span className="text-slate-200">{hazardNode.label}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Exposed infrastructure</span>
          <span className="text-slate-200">{infraNode.label}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Dependent holding</span>
          <span className="text-cyan">{company.label}</span>
        </div>
      </div>

      <div className="mb-3 rounded border border-line bg-panel-2 p-2.5">
        <div className="mb-1.5 font-mono text-[9px] tracking-[0.12em] text-slate-500">ROUTE HAZARD EXPOSURE</div>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Active scenario: {REGION_LABEL[region]} · {hazard} · severity {severity}/100 · {durationMonths}mo ·
          substitutability {substitutability}. {infraNode.label} sits in {hazardNode.label}’s descendant chain — a
          disruption here is modelled to reach {company.label} before any alternate routing.
        </p>
      </div>

      <div className="mb-3 rounded border border-line bg-panel-2 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-[0.12em] text-slate-500">FINANCIAL SENSITIVITY — {company.label}</span>
          <span className="rounded-full border px-1.5 py-0.5 font-mono text-[8px]" style={{ borderColor: `${EVIDENCE_META.modelled.color}55`, color: EVIDENCE_META.modelled.color }}>
            MODELLED
          </span>
        </div>
        {userMode === 'bank' ? (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-slate-600">Baseline EL</div>
              <div className="font-mono text-slate-200">₹{baselineElCr.toFixed(2)} cr</div>
            </div>
            <div>
              <div className="text-slate-600">Stressed EL</div>
              <div className="font-mono text-risk-high">₹{stressedElCr.toFixed(2)} cr</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-slate-600">Revenue at risk</div>
              <div className="font-mono text-risk-high">₹{equity.revenueAtRiskCr.toFixed(2)} cr</div>
            </div>
            <div>
              <div className="text-slate-600">Margin impact</div>
              <div className="font-mono text-slate-200">₹{equity.marginImpactCr.toFixed(2)} cr</div>
            </div>
          </div>
        )}
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-slate-600">
          Same ECL = EAD × PD × LGD / revenue-at-risk formula every other page uses on this company — the scenario
          dial drives it, not this route’s illustrative geometry.
        </p>
      </div>

      <div className="space-y-1.5">
        <button
          onClick={() => onInspectNode(infraNode.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-line py-1.5 font-mono text-[10px] tracking-wide text-slate-300 hover:border-cyan/40 hover:text-cyan"
        >
          INSPECT {infraNode.label.toUpperCase()}
        </button>
        <button
          onClick={() => navigate(`/company?id=${company.id}`)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 py-2 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
        >
          OPEN FULL COMPANY INVESTIGATION <ArrowUpRight size={12} />
        </button>
      </div>
    </div>
  )
}
