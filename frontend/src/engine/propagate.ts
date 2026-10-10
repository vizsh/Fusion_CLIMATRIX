import {
  ALT_ROUTE_BASELINE_USE,
  DIVERSIFICATION_RELIEF_BONUS,
  INFRA_TRANSFER,
  MAX_HOPS,
  MAX_RELIEF,
  MONTH_ZERO_RAMP,
  RECOVERY_LAMBDA,
  RESILIENCE_CAPEX_PROTECTION,
  SUB_RELIEF,
  SUB_STANCE_SHIFT,
} from './constants';
import {
  companies,
  companyById,
  hazardIntensityAt,
  inEdges,
  infraServing,
  infrastructure,
  outEdges,
  protectionOf,
  vulnerabilityOf,
} from './graph';
import type {
  ExposurePath,
  Hazard,
  MonthSnapshot,
  Relation,
  SimulateRequest,
  Substitutability,
} from './types';

const CLASSES: Substitutability[] = ['low', 'moderate', 'high'];

/** Shift an edge's substitutability class by the scenario's global stance. */
function shiftedClass(edge: Substitutability, stance: Substitutability): Substitutability {
  const i = CLASSES.indexOf(edge) + SUB_STANCE_SHIFT[stance];
  return CLASSES[Math.max(0, Math.min(CLASSES.length - 1, i))];
}

/**
 * How much of an edge's disruption has been relieved by switching to an alternative,
 * at month t. Relief ramps linearly over the edge's switching time and is capped -
 * substitution is never instant and never complete.
 */
function reliefAt(r: Relation, t: number, req: SimulateRequest): number {
  const cls = shiftedClass(r.substitutability, req.substitutability);
  const ceiling =
    SUB_RELIEF[cls] + (req.interventions.supplierDiversification ? DIVERSIFICATION_RELIEF_BONUS : 0);
  const ramp = r.switching_months <= 0 ? 1 : Math.min(1, t / r.switching_months);
  return Math.min(MAX_RELIEF, ceiling * ramp);
}

/** Onset and recovery shape. Peaks at month 1, then decays. */
function timeProfile(t: number): number {
  if (t <= 0) return MONTH_ZERO_RAMP;
  return Math.exp(-RECOVERY_LAMBDA * (t - 1));
}

/** Combine independent disruption sources without letting them exceed total shutdown. */
function noisyOr(values: number[]): number {
  let survive = 1;
  for (const v of values) survive *= 1 - Math.max(0, Math.min(1, v));
  return 1 - survive;
}

export interface PropagationResult {
  months: MonthSnapshot[];
  /** Peak total disruption per company across the horizon. */
  peakD: Map<string, number>;
  peakDirect: Map<string, number>;
  peakIndirect: Map<string, number>;
  meanD: Map<string, number>;
  /** Hop distance from the nearest directly hit entity. 0 = directly hit. */
  hop: Map<string, number>;
  /** Peak disruption per infrastructure asset. */
  peakInfra: Map<string, number>;
  paths: Map<string, ExposurePath[]>;
  directlyHit: string[];
  peakMonth: number;
}

export function propagate(hazard: Hazard, req: SimulateRequest): PropagationResult {
  const sev = Math.max(0, Math.min(100, req.severity)) / 100;
  const horizon = Math.max(1, Math.round(req.durationMonths));

  /* ---- stage 1 & 2: static hazard intensity and undamped direct disruption ---- */

  const infraBase = new Map<string, number>();
  for (const i of infrastructure) {
    const intensity = hazardIntensityAt(hazard, i.lat, i.lon) * sev;
    const protection = Math.min(
      0.95,
      i.protection + (req.interventions.resilienceCapex ? RESILIENCE_CAPEX_PROTECTION : 0),
    );
    let d = intensity * i.vulnerability * (1 - protection);

    // An available alternative absorbs part of the loss; the intervention uses it fully.
    if (i.alt_route_available) {
      const use = req.interventions.altRoutes ? 1 : ALT_ROUTE_BASELINE_USE;
      d *= 1 - i.alt_capacity * use;
    }
    infraBase.set(i.id, Math.max(0, Math.min(1, d)));
  }

  const ownBase = new Map<string, number>();
  for (const c of companies) {
    const intensity = hazardIntensityAt(hazard, c.lat, c.lon) * sev;
    const protection = Math.min(
      0.95,
      protectionOf(c) + (req.interventions.resilienceCapex && !c.listed ? RESILIENCE_CAPEX_PROTECTION : 0),
    );
    ownBase.set(c.id, Math.max(0, Math.min(1, intensity * vulnerabilityOf(c) * (1 - protection))));
  }

  /* ---- stage 3 & 4: month-by-month, with infrastructure cascade then dependency hops ---- */

  const months: MonthSnapshot[] = [];
  const history: Map<string, number>[] = [];
  const peakD = new Map<string, number>();
  const peakDirect = new Map<string, number>();
  const peakIndirect = new Map<string, number>();
  const sumD = new Map<string, number>();
  const peakInfra = new Map<string, number>();
  const hop = new Map<string, number>();

  for (const c of companies) {
    peakD.set(c.id, 0);
    peakDirect.set(c.id, 0);
    peakIndirect.set(c.id, 0);
    sumD.set(c.id, 0);
  }

  for (let t = 0; t <= horizon; t++) {
    const prof = timeProfile(t);

    const infraNow = new Map<string, number>();
    for (const [id, base] of infraBase) {
      const d = base * prof;
      infraNow.set(id, d);
      peakInfra.set(id, Math.max(peakInfra.get(id) ?? 0, d));
    }

    // Direct = the hazard hitting this entity, OR the infrastructure it depends on failing.
    // A dry factory whose only access road is gone is still a directly hit entity.
    const direct = new Map<string, number>();
    for (const c of companies) {
      const own = (ownBase.get(c.id) ?? 0) * prof;
      let viaInfra = 0;
      for (const { infra, criticality } of infraServing.get(c.id) ?? []) {
        viaInfra = Math.max(viaInfra, INFRA_TRANSFER * (infraNow.get(infra.id) ?? 0) * criticality);
      }
      direct.set(c.id, Math.max(own, viaInfra));
    }

    // Dependency relaxation, capped at MAX_HOPS.
    let work = new Map(direct);
    const indirect = new Map<string, number>(companies.map((c) => [c.id, 0]));

    for (let pass = 1; pass <= MAX_HOPS; pass++) {
      const snapshot = new Map(work);
      for (const c of companies) {
        const contribs: number[] = [];
        for (const r of inEdges.get(c.id) ?? []) {
          // Inventory buffers delay arrival: read the supplier's state as of t - inventory.
          let supplierD: number;
          if (r.inventory_months > 0) {
            const lagged = t - r.inventory_months;
            if (lagged < 0) continue;
            const lo = Math.floor(lagged);
            const hi = Math.min(history.length - 1, Math.ceil(lagged));
            if (lo > history.length - 1) continue;
            const a = history[lo]?.get(r.supplier) ?? 0;
            const b = history[hi]?.get(r.supplier) ?? a;
            supplierD = a + (b - a) * (lagged - lo);
          } else {
            supplierD = snapshot.get(r.supplier) ?? 0;
          }
          if (supplierD <= 0) continue;
          contribs.push(supplierD * r.criticality * (1 - reliefAt(r, t, req)));
        }
        if (!contribs.length) continue;
        const combined = noisyOr(contribs);
        if (combined > (indirect.get(c.id) ?? 0)) indirect.set(c.id, combined);
      }
      work = new Map(
        companies.map((c) => [
          c.id,
          noisyOr([direct.get(c.id) ?? 0, indirect.get(c.id) ?? 0]),
        ]),
      );
    }

    const nodes: MonthSnapshot['nodes'] = {};
    const snap = new Map<string, number>();
    for (const c of companies) {
      const d = work.get(c.id) ?? 0;
      const di = direct.get(c.id) ?? 0;
      const ind = indirect.get(c.id) ?? 0;
      snap.set(c.id, d);
      nodes[c.id] = { d, direct: di, indirect: ind };
      if (d > (peakD.get(c.id) ?? 0)) peakD.set(c.id, d);
      if (di > (peakDirect.get(c.id) ?? 0)) peakDirect.set(c.id, di);
      if (ind > (peakIndirect.get(c.id) ?? 0)) peakIndirect.set(c.id, ind);
      sumD.set(c.id, (sumD.get(c.id) ?? 0) + d);
    }
    history.push(snap);
    months.push({ month: t, nodes, infra: Object.fromEntries(infraNow) });
  }

  const meanD = new Map<string, number>();
  for (const c of companies) meanD.set(c.id, (sumD.get(c.id) ?? 0) / (horizon + 1));

  /* ---- hop distance from the directly hit set ---- */

  const DIRECT_SEED = 0.02;
  const directlyHit = companies
    .filter((c) => (peakDirect.get(c.id) ?? 0) > DIRECT_SEED)
    .map((c) => c.id);

  let frontier = new Set(directlyHit);
  for (const id of frontier) hop.set(id, 0);
  for (let h = 1; h <= MAX_HOPS; h++) {
    const next = new Set<string>();
    for (const n of frontier) {
      for (const r of outEdges.get(n) ?? []) {
        if (hop.has(r.customer)) continue;
        if ((peakIndirect.get(r.customer) ?? 0) <= 0) continue;
        hop.set(r.customer, h);
        next.add(r.customer);
      }
    }
    frontier = next;
  }

  /* ---- explanatory paths, traced at the peak month ---- */

  let peakMonth = 0;
  let peakSum = -1;
  months.forEach((m) => {
    const s = Object.values(m.nodes).reduce((a, n) => a + n.d, 0);
    if (s > peakSum) {
      peakSum = s;
      peakMonth = m.month;
    }
  });

  const paths = tracePaths(directlyHit, peakMonth, req, months[peakMonth]);

  return {
    months,
    peakD,
    peakDirect,
    peakIndirect,
    meanD,
    hop,
    peakInfra,
    paths,
    directlyHit,
    peakMonth,
  };
}

/**
 * Walk outward from every directly hit entity and record the chains that explain
 * downstream exposure. These are what the dossier renders - a number nobody can trace
 * back to a chain of real dependencies is not worth showing.
 */
function tracePaths(
  origins: string[],
  t: number,
  req: SimulateRequest,
  snapshot: MonthSnapshot,
): Map<string, ExposurePath[]> {
  const out = new Map<string, ExposurePath[]>();
  const PRUNE = 0.001;

  const push = (target: string, p: ExposurePath) => {
    if (!out.has(target)) out.set(target, []);
    out.get(target)!.push(p);
  };

  for (const origin of origins) {
    const seed = snapshot.nodes[origin]?.direct ?? 0;
    if (seed <= PRUNE) continue;

    const walk = (node: string, chain: string[], carried: number) => {
      if (chain.length - 1 >= 3) return;
      for (const r of outEdges.get(node) ?? []) {
        if (chain.includes(r.customer)) continue; // the graph contains real cycles
        const delivered = carried * r.criticality * (1 - reliefAt(r, t, req));
        if (delivered <= PRUNE) continue;
        const nextChain = [...chain, r.customer];
        push(r.customer, {
          chain: nextChain,
          hops: nextChain.length - 1,
          contribution: delivered,
        });
        walk(r.customer, nextChain, delivered);
      }
    };

    walk(origin, [origin], seed);
  }

  for (const [k, v] of out) {
    v.sort((a, b) => b.contribution - a.contribution);
    out.set(k, v.slice(0, 4));
  }
  return out;
}

/** Which infrastructure asset, if any, is the reason this entity is directly hit. */
export function dominantInfraFor(
  companyId: string,
  snapshot: MonthSnapshot,
): string | undefined {
  const c = companyById.get(companyId);
  if (!c) return undefined;
  let bestId: string | undefined;
  let best = 0;
  for (const { infra, criticality } of infraServing.get(companyId) ?? []) {
    const v = INFRA_TRANSFER * (snapshot.infra[infra.id] ?? 0) * criticality;
    if (v > best) {
      best = v;
      bestId = infra.id;
    }
  }
  return best > 0 ? bestId : undefined;
}
