/* Console harness for the engine. Run with: npm run engine */
declare const process: { exit: (code?: number) => void };
import { DEFAULT_REQUEST, simulate } from './index';
import { companyById } from './graph';
import { infraDamageBreakdown } from './finance';
import { propagate } from './propagate';
import { hazardById } from './graph';
import type { SimulateRequest } from './types';

const name = (id: string) => companyById.get(id)?.name ?? id;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const cr = (x: number) => `${x.toFixed(1)} cr`;
const rule = (s: string) => `\n${s}\n${'-'.repeat(s.length)}`;

async function report(req: SimulateRequest, label: string) {
  const r = await simulate(req);

  console.log(rule(`${label}  ·  ${r.scenarioId}`));
  console.log(`hazard            ${r.hazard.name}`);
  console.log(`compute           ${r.computeMs.toFixed(1)} ms`);
  console.log(`directly hit      ${r.totals.directlyHitEntities}`);
  console.log(`affected total    ${r.totals.affectedEntities}`);
  console.log(`max hop depth     ${r.totals.maxHopDepth}`);
  console.log(`hidden exposures  ${r.totals.hiddenExposureCount}`);
  console.log(`\nTHREE SEPARATE BUCKETS (never summed)`);
  console.log(`  company contribution loss   ${cr(r.totals.contributionLoss_cr)}`);
  console.log(`  bank incremental ECL        ${cr(r.totals.deltaEl_cr)}   [SYNTHETIC]`);
  console.log(`  public reconstruction       ${cr(r.totals.publicReconstruction_cr)}`);
  console.log(
    `\nchannels  physical ${r.channels.physical}  supplier ${r.channels.supplier}  transport ${r.channels.transport}  agri/water ${r.channels.agriWater}`,
  );
  return r;
}

async function main() {
  const base = await report(DEFAULT_REQUEST, 'BASELINE');

  /* --- monthly curve, proves the timeline scrubber will have real state --- */
  console.log(rule('MONTHLY CURVE  (mean disruption across affected entities)'));
  for (const m of base.months) {
    const vals = Object.values(m.nodes)
      .map((n) => n.d)
      .filter((d) => d > 0.01);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const bar = '#'.repeat(Math.round(avg * 60));
    console.log(`  M${m.month}  ${pct(avg).padStart(6)}  ${vals.length.toString().padStart(3)} entities  ${bar}`);
  }

  /* --- the money shot: companies with no direct hazard exposure --- */
  console.log(rule('HIDDEN EXPOSURE  (negligible direct hazard, material indirect)'));
  const hidden = Object.values(base.companies)
    .filter((c) => c.hidden)
    .sort((a, b) => b.contributionLoss_cr - a.contributionLoss_cr)
    .slice(0, 10);
  for (const c of hidden) {
    const co = companyById.get(c.id)!;
    console.log(
      `  ${name(c.id).padEnd(34)} ${co.city.padEnd(18)} direct ${pct(c.peakDirect).padStart(6)}  indirect ${pct(c.peakIndirect).padStart(6)}  hop ${c.hop}  loss ${cr(c.contributionLoss_cr)}`,
    );
    const p = c.paths[0];
    if (p) console.log(`      via  ${p.chain.map(name).join('  ->  ')}`);
  }

  /* --- transcontinental reach --- */
  console.log(rule('TRANSCONTINENTAL REACH  (non-India entities touched)'));
  console.log(
    '  Note: percentages are small because these are very large diversified firms.\n' +
      '  The materiality is in the rupee figure, not the percentage.\n',
  );
  const abroad = Object.values(base.companies)
    .filter((c) => companyById.get(c.id)?.country !== 'India' && c.contributionLoss_cr > 0.1)
    .sort((a, b) => b.contributionLoss_cr - a.contributionLoss_cr);
  for (const c of abroad) {
    console.log(
      `  ${name(c.id).padEnd(24)} ${(companyById.get(c.id)?.city ?? '').padEnd(18)} peak ${(c.peakD * 100).toFixed(3)}%  hop ${c.hop}  loss ${cr(c.contributionLoss_cr)}`,
    );
    const p = c.paths[0];
    if (p) console.log(`      via  ${p.chain.map(name).join('  ->  ')}`);
  }

  /* --- credit --- */
  console.log(rule('BANK INCREMENTAL ECL  [ALL FIGURES SYNTHETIC]'));
  for (const b of base.banks) {
    console.log(
      `  ${name(b.lender).padEnd(26)} EAD ${cr(b.ead_cr).padStart(12)}  base ${cr(b.elBase_cr).padStart(9)}  stressed ${cr(b.elStressed_cr).padStart(9)}  delta ${cr(b.deltaEl_cr).padStart(9)}  (${b.exposureCount} loans)`,
    );
  }

  console.log(rule('TOP STRESSED EXPOSURES  [SYNTHETIC]'));
  for (const e of [...base.exposures].sort((a, b) => b.deltaEl_cr - a.deltaEl_cr).slice(0, 8)) {
    console.log(
      `  ${e.id}  ${name(e.borrower).padEnd(32)} PD ${pct(e.pdBase)} -> ${pct(e.pdStressed)}   LGD ${pct(e.lgdBase)} -> ${pct(e.lgdStressed)}   dEL ${cr(e.deltaEl_cr)}`,
    );
  }

  /* --- public --- */
  console.log(rule('PUBLIC RECONSTRUCTION REQUIREMENT  (not a bank loss)'));
  const hz = hazardById.get(DEFAULT_REQUEST.hazardId)!;
  for (const i of infraDamageBreakdown(propagate(hz, DEFAULT_REQUEST)).slice(0, 8)) {
    console.log(
      `  ${i.name.padEnd(42)} ${i.district.padEnd(10)} peak ${pct(i.peakDisruption).padStart(6)}  ${cr(i.reconstruction_cr)}`,
    );
  }

  /* --- portfolio --- */
  console.log(rule('PORTFOLIO  [SYNTHETIC]'));
  console.log(`  AUM ${cr(base.portfolio.aum_cr)}   value at risk ${cr(base.portfolio.valueAtRisk_cr)}`);
  for (const p of base.portfolio.positions.slice(0, 8)) {
    console.log(
      `  ${name(p.company).padEnd(32)} ${cr(p.value_cr).padStart(11)}  VaR ${cr(p.valueAtRisk_cr).padStart(9)}  hop ${p.hop ?? '-'}${p.hidden ? '  [HIDDEN]' : ''}`,
    );
  }

  /* --- sensitivity: inputs must actually move outputs --- */
  console.log(rule('SENSITIVITY  (changing inputs must change outputs)'));
  const variants: [string, Partial<SimulateRequest>][] = [
    ['severity 40', { severity: 40 }],
    ['severity 65', { severity: 65 }],
    ['severity 90 (base)', {}],
    ['severity 100', { severity: 100 }],
    ['duration 3m', { durationMonths: 3 }],
    ['duration 12m', { durationMonths: 12 }],
    ['sub: low', { substitutability: 'low' }],
    ['sub: high', { substitutability: 'high' }],
    ['hypothetical Solan-centred', { hazardId: 'IN-FLOOD-EXT-090' }],
  ];
  for (const [label, patch] of variants) {
    const r = await simulate({ ...DEFAULT_REQUEST, ...patch });
    console.log(
      `  ${label.padEnd(28)} dECL ${cr(r.totals.deltaEl_cr).padStart(9)}   contrib ${cr(r.totals.contributionLoss_cr).padStart(11)}   public ${cr(r.totals.publicReconstruction_cr).padStart(10)}   affected ${r.totals.affectedEntities}`,
    );
  }

  console.log(rule('INTERVENTIONS  (baseline vs mitigation, identical hazard)'));
  const interventions: [string, Partial<SimulateRequest['interventions']>][] = [
    ['alternative routes', { altRoutes: true }],
    ['supplier diversification', { supplierDiversification: true }],
    ['resilience capex', { resilienceCapex: true }],
    ['borrower liquidity', { borrowerLiquidity: true }],
    ['all four', { altRoutes: true, supplierDiversification: true, resilienceCapex: true, borrowerLiquidity: true }],
  ];
  for (const [label, patch] of interventions) {
    const r = await simulate({
      ...DEFAULT_REQUEST,
      interventions: { ...DEFAULT_REQUEST.interventions, ...patch },
    });
    const d = r.totals.deltaEl_cr - base.totals.deltaEl_cr;
    const pctChange = (d / base.totals.deltaEl_cr) * 100;
    console.log(
      `  ${label.padEnd(28)} dECL ${cr(r.totals.deltaEl_cr).padStart(9)}   change ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%   public ${cr(r.totals.publicReconstruction_cr).padStart(10)}`,
    );
  }

  console.log('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
