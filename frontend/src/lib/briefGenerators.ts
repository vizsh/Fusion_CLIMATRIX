// Domain-specific PDF briefs built on the generic BriefBuilder
// (pdfBrief.ts) — one function per decision a user actually needs to walk
// away with a document for: a free-text What-If scenario, and a single
// company's long-term climate due-diligence read.

import { BriefBuilder } from './pdfBrief'
import type { ParsedScenario } from './copilot/freeTextScenario'
import type { ImpactResult, Region } from '../store/useScenarioStore'
import { REGION_LABEL } from '../store/useScenarioStore'
import type { RealMarketEntity, SensitivityResult } from './realMarketSensitivity'
import type { CompanyTrajectoryVerdict, IntensificationPathway, PortfolioTrajectoryResult, SensitivityTrajectoryPoint, TrajectoryRecommendation } from './climateTrajectory'
import { INTENSIFICATION_PATHWAYS } from './climateTrajectory'

// jsPDF's standard fonts (Helvetica/Times/Courier) don't include the ₹
// glyph — it silently renders as a garbled superscript character instead
// of failing loudly, so "Rs." is used in every PDF brief specifically
// (the on-screen app keeps ₹ throughout; only this jsPDF text path needs
// the substitution).
function fmtCr(n: number) {
  return `Rs. ${n.toFixed(1)} cr`
}

export function generateScenarioBriefPdf(scenario: ParsedScenario, impact: ImpactResult, notes: string[], originalText?: string) {
  const b = new BriefBuilder('Climate Scenario Brief', `${REGION_LABEL[scenario.region]} · ${scenario.hazard} · what-if decision document`)

  if (originalText) {
    b.subheading('As described')
    b.paragraph(`"${originalText}"`, { italic: true, color: [91, 102, 112] })
    b.spacer(4)
  }

  b.subheading('Scenario this brief is built from')
  b.paragraph(
    `Region: ${REGION_LABEL[scenario.region]}  ·  Hazard: ${scenario.hazard}  ·  Severity: ${scenario.severity}/100  ·  Duration: ${scenario.durationMonths} month${scenario.durationMonths === 1 ? '' : 's'}  ·  Supply-chain substitutability: ${scenario.substitutability}`,
  )
  if (notes.length) {
    b.paragraph(`Inference notes: ${notes.join(' ')}`, { color: [184, 116, 43], size: 8.5 })
  }
  b.spacer(4)

  b.heading('Executive summary')
  b.statRow([
    { label: 'Baseline expected loss', value: fmtCr(impact.baselineEl) },
    { label: 'Stressed expected loss', value: fmtCr(impact.stressedEl), tone: 'red' },
    { label: 'Borrowers reached', value: String(impact.companyCount) },
  ])
  b.paragraph(
    `Expected credit loss (ECL = EAD × PD × LGD), computed per borrower and summed — never a blended portfolio average. The ±15% severity sensitivity band around the headline figure is ${fmtCr(impact.stressedElLow)} to ${fmtCr(impact.stressedElHigh)}.`,
  )

  b.heading('Sector attribution')
  b.table(
    ['Sector', 'EAD', 'Stressed EL'],
    impact.bySector.slice(0, 8).map((s) => [s.sector, fmtCr(s.eadCr), fmtCr(s.stressedEl)]),
    [240, 150, 157],
  )

  b.heading('Decision notes')
  b.bullet('Review repayment capacity / investment thesis for the sectors above before this scenario’s window.')
  b.bullet('Request current insurance documentation for holdings exposed under this hazard — see the Insurance & Protection Gap module for the modelled claim and coverage gap.')
  b.bullet('Re-run this scenario if official warnings, forecasts or news materially change the evidence basis for severity or duration.')

  b.calloutBox(
    'Evidence basis',
    'Severity and duration are disclosed stress-test dials, not a measured flood depth, wind speed or a forecast probability. Expected credit loss is a modelled output from this app’s disclosed formula, not a verified real-world loss. Company identities and loan exposures in the underlying graph are synthetic demonstration data unless the module states otherwise. This brief is a decision-support document, not investment advice.',
    'amber',
  )

  b.finish(`climatrix-scenario-brief-${scenario.region}-${Date.now()}.pdf`)
}

export function generateCompanyBriefPdf(
  entity: RealMarketEntity,
  result: SensitivityResult,
  trajectory: SensitivityTrajectoryPoint[],
  verdict: CompanyTrajectoryVerdict,
  ctx: { region: Region; hazard: string; severity: number; durationMonths: number },
  pathway: IntensificationPathway,
  plainSummary: string,
) {
  const b = new BriefBuilder('Company Climate Brief', `${entity.name} (${entity.nseSymbol}) · ${entity.sector}`)

  b.subheading('Snapshot')
  b.statRow([
    { label: 'Direction', value: entity.direction.charAt(0).toUpperCase() + entity.direction.slice(1) },
    { label: 'Sensitivity index (today)', value: `${result.sensitivityIndex}/100`, tone: result.sensitivityIndex >= 60 ? 'red' : result.sensitivityIndex >= 35 ? 'amber' : 'teal' },
    { label: 'Vulnerability multiplier', value: `×${entity.vulnerabilityMultiplier.toFixed(2)}` },
  ])
  b.paragraph(`Active scenario context: ${REGION_LABEL[ctx.region]} · ${ctx.hazard} · severity ${ctx.severity}/100 · ${ctx.durationMonths} months.`)
  b.paragraph(plainSummary)

  b.heading('Long-term climate trajectory')
  b.paragraph(
    `${INTENSIFICATION_PATHWAYS[pathway].label} pathway (${INTENSIFICATION_PATHWAYS[pathway].desc}) — a disclosed illustrative assumption, not a calibrated climate forecast.`,
    { size: 8.5, color: [91, 102, 112] },
  )
  b.table(
    ['Year', 'Drifted severity', 'Sensitivity index'],
    trajectory.map((p) => [String(p.calendarYear), `${p.severity}/100`, `${p.sensitivityIndex}/100`]),
    [198, 198, 151],
  )

  b.heading('Verdict — factor for new-position due diligence')
  b.calloutBox(
    verdict.verdict.toUpperCase(),
    verdict.reasoning.join(' '),
    verdict.verdict.startsWith('High') ? 'red' : verdict.verdict.startsWith('Elevated') ? 'amber' : 'teal',
  )

  b.heading('Worst-case and favorable framing')
  b.subheading('Worst case')
  b.paragraph(entity.worstCase)
  b.subheading('How it could favor them')
  b.paragraph(entity.favorable)

  b.calloutBox(
    'Evidence basis',
    'This company’s identity, sector and NSE ticker are real. The sensitivity index, direction, trajectory and verdict above are this prototype’s own disclosed illustrative framework — not a sourced ESG rating, a credit rating, or investment advice. No real financial-loss figure is computed for this company; that would require real facility-level data this prototype doesn’t have.',
    'amber',
  )

  b.finish(`climatrix-company-brief-${entity.nseSymbol}-${Date.now()}.pdf`)
}

export function generatePortfolioTrajectoryBriefPdf(
  portfolioName: string,
  result: PortfolioTrajectoryResult,
  recommendations: TrajectoryRecommendation[],
  pathway: IntensificationPathway,
) {
  const b = new BriefBuilder('Long-Term Climate Trajectory Brief', `${portfolioName} · ${INTENSIFICATION_PATHWAYS[pathway].label} pathway`)

  const final = result.points[result.points.length - 1]
  b.subheading('Snapshot')
  b.statRow([
    { label: 'Total portfolio EAD', value: fmtCr(result.totalEADCr) },
    { label: `Combined loss by ${final.calendarYear}`, value: fmtCr(final.combinedCr), tone: 'red' },
    { label: 'Share of EAD', value: `${(final.shareOfEAD * 100).toFixed(1)}%`, tone: 'amber' },
  ])
  b.paragraph(INTENSIFICATION_PATHWAYS[pathway].desc, { size: 8.5, color: [91, 102, 112] })

  b.heading('Trajectory')
  b.table(
    ['Year', 'Drifted severity', 'Physical loss', 'Transition at risk', 'Combined'],
    result.points.map((p) => [String(p.calendarYear), `${p.severity}/100`, fmtCr(p.stressedElCr), fmtCr(p.transitionAtRiskCr), fmtCr(p.combinedCr)]),
    [80, 110, 110, 125, 122],
  )

  b.heading(`Sector breakdown by ${final.calendarYear}`)
  b.table(
    ['Sector', 'Combined loss', 'Physical share', 'Transition share'],
    result.finalSectorBreakdown.slice(0, 8).map((s) => [s.sector, fmtCr(s.combinedCr), `${(s.physicalShare * 100).toFixed(0)}%`, `${(s.transitionShare * 100).toFixed(0)}%`]),
    [220, 140, 100, 87],
  )

  b.heading('Recommendations')
  for (const r of recommendations) {
    b.calloutBox(r.title, r.detail, r.level === 'act' ? 'red' : r.level === 'watch' ? 'amber' : 'teal')
  }

  b.calloutBox(
    'Evidence basis',
    'The intensification pathway is a disclosed yearly severity-drift assumption, not a calibrated RCP/SSP climate model or a forecast. Physical loss and transition-at-risk figures are modelled from this app’s disclosed formulas over the synthetic demonstration portfolio. Treat this as a structured discussion starter for a climate-risk committee, not a standalone capital-allocation decision.',
    'amber',
  )

  b.finish(`climatrix-trajectory-brief-${Date.now()}.pdf`)
}
