import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedMesh, Matrix4, Object3D, Vector3 } from 'three';

import { companies } from '@/engine/graph';
import { latLonToVector3 } from '@/lib/geo';
import { getPlacements } from '@/lib/layout';
import { materialityColor, materialityRadius, PALETTE } from '@/lib/palette';
import { useSimStore } from '@/store/sim';
import { useUiStore } from '@/store/ui';

const MARKER_ALTITUDE = 1.012;
const HALO_SCALE = 2.4;

export function CompanyMarkers() {
  const coreRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<InstancedMesh>(null);

  const result = useSimStore((s) => s.result);
  const hiddenOnly = useUiStore((s) => s.hiddenOnly);
  const hoveredId = useUiStore((s) => s.hoveredId);
  const selectedId = useUiStore((s) => s.selectedId);
  const setHovered = useUiStore((s) => s.setHovered);
  const select = useUiStore((s) => s.select);

  const placements = useMemo(() => getPlacements(), []);

  const basePositions = useMemo(
    () =>
      companies.map((c) => {
        const p = placements.get(c.id)!;
        return latLonToVector3(p.lat, p.lon, MARKER_ALTITUDE, new Vector3());
      }),
    [placements],
  );

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const inert = useMemo(() => new Color(PALETTE.inert), []);
  const assumed = useMemo(() => new Color(PALETTE.evAssumed), []);
  const accent = useMemo(() => new Color(PALETTE.accent), []);

  const maxHop = useMemo(() => {
    if (!result) return 1;
    return Math.max(1, ...Object.values(result.companies).map((c) => c.hop ?? 0));
  }, [result]);

  /* Colours change only when the run or the view mode does. */
  useLayoutEffect(() => {
    const core = coreRef.current;
    const halo = haloRef.current;
    if (!core || !halo) return;

    companies.forEach((c, i) => {
      const res = result?.companies[c.id];
      const loss = res?.contributionLoss_cr ?? 0;
      const dimmed = hiddenOnly && !(res?.hidden ?? false);

      if (c.id === selectedId) color.copy(accent);
      else if (dimmed) color.copy(inert).multiplyScalar(0.35);
      else materialityColor(loss, color);

      core.setColorAt(i, color);
      halo.setColorAt(i, assumed);
    });

    if (core.instanceColor) core.instanceColor.needsUpdate = true;
    if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
  }, [result, hiddenOnly, selectedId, color, inert, assumed, accent]);

  /*
    Transforms are rebuilt every frame instead of on state change.
    The playhead advances once per frame, so driving scale through React would
    re-render this component sixty times a second during a run. Reading the stores
    imperatively keeps the arrival pulses smooth and the render tree still.
  */
  useFrame(() => {
    const core = coreRef.current;
    const halo = haloRef.current;
    if (!core || !halo) return;

    const ui = useUiStore.getState();
    const { playhead, hoveredId: hovered, selectedId: selected, hiddenOnly: only } = ui;

    companies.forEach((c, i) => {
      const res = result?.companies[c.id];
      const loss = res?.contributionLoss_cr ?? 0;
      const isHidden = res?.hidden ?? false;
      const dimmed = only && !isHidden;

      // Each marker flares as its hop's wave reaches it, then settles.
      const hop = res?.hop ?? null;
      let pulse = 0;
      if (hop !== null && (res?.peakD ?? 0) > 0.001) {
        const arrival = (hop / maxHop) * 0.55 + 0.08;
        pulse = Math.exp(-Math.pow((playhead - arrival) * 8, 2));
      }

      const emphasis = c.id === hovered || c.id === selected ? 1.5 : 1;
      const r = materialityRadius(loss) * emphasis * (dimmed ? 0.45 : 1) * (1 + pulse * 1.1);

      dummy.position.copy(basePositions[i]);
      dummy.scale.setScalar(r);
      dummy.updateMatrix();
      core.setMatrixAt(i, dummy.matrix);

      // Halo marks hidden exposure: material indirect risk, negligible direct hazard.
      dummy.scale.setScalar(isHidden && !dimmed ? r * HALO_SCALE : 0);
      dummy.updateMatrix();
      halo.setMatrixAt(i, dummy.matrix);
    });

    core.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
  });

  /* Instanced meshes need an initial colour buffer before the first setColorAt. */
  useEffect(() => {
    const core = coreRef.current;
    if (core && !core.instanceColor) {
      const m = new Matrix4();
      for (let i = 0; i < companies.length; i++) core.getMatrixAt(i, m);
      core.setColorAt(0, new Color(PALETTE.inert));
    }
  }, []);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    const id = companies[i].id;
    if (id !== hoveredId) setHovered(id);
    document.body.style.cursor = 'pointer';
  };

  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = '';
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    select(companies[i].id);
  };

  return (
    <group>
      <instancedMesh
        ref={haloRef}
        args={[undefined, undefined, companies.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          transparent
          opacity={0.16}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={coreRef}
        args={[undefined, undefined, companies.length]}
        frustumCulled={false}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** Marker world position in globe-local space, for labels and arcs. */
export function markerPosition(id: string, out = new Vector3()): Vector3 {
  const p = getPlacements().get(id);
  if (!p) return out.set(0, 0, 0);
  return latLonToVector3(p.lat, p.lon, MARKER_ALTITUDE, out);
}

export { MARKER_ALTITUDE };
