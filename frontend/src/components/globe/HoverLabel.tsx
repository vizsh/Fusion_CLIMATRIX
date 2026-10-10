import { useMemo } from 'react';
import { Html } from '@react-three/drei';

import { companyById } from '@/engine/graph';
import { formatCr, formatPct } from '@/lib/palette';
import { useSimStore } from '@/store/sim';
import { useUiStore } from '@/store/ui';
import { markerPosition } from './CompanyMarkers';

/**
 * One label, for the hovered marker only.
 *
 * 140 persistent HTML labels would wreck both the framerate and the composition, so
 * the label is created on demand and lives inside the rotating globe group where it
 * tracks its marker automatically.
 */
export function HoverLabel() {
  const hoveredId = useUiStore((s) => s.hoveredId);
  const result = useSimStore((s) => s.result);

  const position = useMemo(
    () => (hoveredId ? markerPosition(hoveredId).multiplyScalar(1.03) : null),
    [hoveredId],
  );

  if (!hoveredId || !position) return null;
  const company = companyById.get(hoveredId);
  if (!company) return null;

  const res = result?.companies[hoveredId];
  const loss = res?.contributionLoss_cr ?? 0;

  // No distanceFactor on the Html: a data readout should stay a constant size on
  // screen rather than ballooning as the camera dollies in.
  return (
    <Html position={position} zIndexRange={[20, 0]} occlude={false}>
      <div className="pointer-events-none translate-x-3 -translate-y-1/2 select-none whitespace-nowrap">
        <div className="border-border/90 bg-surface/95 border px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-text">{company.name}</span>
            {company.ticker && (
              <span className="num text-muted text-[10px]">{company.ticker}</span>
            )}
          </div>
          <div className="text-muted text-[10px]">{company.city}</div>

          {res && (
            <div className="border-border/70 mt-1.5 flex gap-3 border-t pt-1.5 text-[10px]">
              <Field label="Direct" value={formatPct(res.peakDirect)} />
              <Field label="Indirect" value={formatPct(res.peakIndirect)} />
              <Field label="Margin loss" value={formatCr(loss)} />
            </div>
          )}

          {res?.hidden && (
            <div
              className="mt-1 text-[9px] uppercase tracking-wider"
              style={{ color: 'var(--color-ev-assumed)' }}
            >
              Hidden exposure · hop {res.hop}
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted text-[9px] uppercase tracking-wider">{label}</div>
      <div className="num text-text">{value}</div>
    </div>
  );
}
