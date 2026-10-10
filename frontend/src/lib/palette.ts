import { Color } from 'three';

/**
 * JS-side mirror of the CSS tokens in index.css.
 *
 * WebGL materials cannot read CSS custom properties, so these values are duplicated.
 * If a token changes there, change it here too.
 */
export const PALETTE = {
  bg: '#07090D',
  surface: '#0E1117',
  border: '#1C2230',
  text: '#E6EAF2',
  muted: '#7D8699',
  accent: '#38BDF8',

  risk1: '#2DD4A7',
  risk2: '#FACC15',
  risk3: '#FB923C',
  risk4: '#F43F5E',

  evVerified: '#2DD4A7',
  evSourced: '#38BDF8',
  evInferred: '#FACC15',
  evAssumed: '#A78BFA',

  /** Entities the scenario does not touch. Visible, but clearly not in play. */
  inert: '#4A5C7A',
} as const;

const RISK_RAMP = [PALETTE.risk1, PALETTE.risk2, PALETTE.risk3, PALETTE.risk4].map(
  (h) => new Color(h),
);
const INERT = new Color(PALETTE.inert);

/**
 * Materiality scale, in INR crore of lost contribution margin.
 *
 * Deliberately NOT disruption percentage. A 0.07% disruption at Pfizer is twelve crore
 * of lost margin; colouring by percentage would render it as nothing. Log-scaled,
 * because exposure in this graph spans four orders of magnitude.
 */
const MATERIALITY_FLOOR_CR = 0.25;
const MATERIALITY_CEIL_CR = 400;

export function materialityT(loss_cr: number): number {
  if (loss_cr <= MATERIALITY_FLOOR_CR) return 0;
  const t =
    Math.log10(loss_cr / MATERIALITY_FLOOR_CR) /
    Math.log10(MATERIALITY_CEIL_CR / MATERIALITY_FLOOR_CR);
  return Math.max(0, Math.min(1, t));
}

export function materialityColor(loss_cr: number, out = new Color()): Color {
  const t = materialityT(loss_cr);
  if (t <= 0) return out.copy(INERT);

  const scaled = t * (RISK_RAMP.length - 1);
  const i = Math.min(RISK_RAMP.length - 2, Math.floor(scaled));
  return out.copy(RISK_RAMP[i]).lerp(RISK_RAMP[i + 1], scaled - i);
}

/**
 * Marker radius in world units on a unit sphere.
 *
 * The floor is deliberately not tiny: entities the scenario does not touch still need
 * to read as a baseline constellation, otherwise the globe looks empty and the viewer
 * cannot see how few of the holdings are affected.
 */
export function materialityRadius(loss_cr: number): number {
  return 0.0055 + 0.0105 * materialityT(loss_cr);
}

export function formatCr(x: number): string {
  if (x >= 1000) return `${(x / 1000).toFixed(2)} k cr`;
  if (x >= 10) return `${x.toFixed(0)} cr`;
  if (x >= 1) return `${x.toFixed(1)} cr`;
  return `${x.toFixed(2)} cr`;
}

export function formatPct(x: number, dp = 1): string {
  const v = x * 100;
  if (v > 0 && v < 0.1) return `${v.toFixed(3)}%`;
  return `${v.toFixed(dp)}%`;
}
