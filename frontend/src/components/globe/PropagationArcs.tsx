import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  QuadraticBezierCurve3,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { buildArcs } from '@/lib/arcs';
import { materialityT, PALETTE } from '@/lib/palette';
import { useSimStore } from '@/store/sim';
import { useUiStore } from '@/store/ui';
import { markerPosition } from './CompanyMarkers';

const TUBE_SEGMENTS = 44;
const TUBE_RADIAL = 4;
const TUBE_RADIUS_MIN = 0.0013;
const TUBE_RADIUS_MAX = 0.0036;

/** Arc apex lift, scaled by how far around the planet the edge travels. */
function liftFor(angle: number): number {
  return 1.012 + 0.3 * angle;
}

const vertexShader = /* glsl */ `
  attribute float aHop;
  attribute float aWeight;

  varying float vProgress;
  varying float vHop;
  varying float vWeight;

  void main() {
    // TubeGeometry lays uv.x along the tube, so it is already arc progress.
    vProgress = uv.x;
    vHop = aHop;
    vWeight = aWeight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uPlayhead;
  uniform float uTime;
  uniform vec3 uNear;
  uniform vec3 uFar;
  uniform float uMaxHop;

  varying float vProgress;
  varying float vHop;
  varying float vWeight;

  void main() {
    // Each hop wave starts later, so the shock visibly travels outward rather than
    // every arc appearing at once.
    float hopStart = (vHop - 1.0) / max(uMaxHop, 1.0) * 0.55;
    float local = (uPlayhead - hopStart) / 0.42;

    float reveal = smoothstep(vProgress - 0.06, vProgress + 0.02, local);
    if (reveal <= 0.001) discard;

    // Comet running along the drawn section.
    float head = fract(uTime * 0.22 - vProgress * 0.85);
    float pulse = exp(-pow(head * 7.0, 2.0)) + exp(-pow((head - 1.0) * 7.0, 2.0));

    vec3 col = mix(uNear, uFar, vProgress);
    float body = 0.38 + 0.5 * vWeight;
    float alpha = reveal * (body + pulse * 0.9);

    gl_FragColor = vec4(col * (1.0 + pulse * 1.6), alpha);
  }
`;

export function PropagationArcs() {
  const result = useSimStore((s) => s.result);
  const playhead = useUiStore((s) => s.playhead);
  const materialRef = useRef<ShaderMaterial>(null);

  const arcs = useMemo(() => buildArcs(result), [result]);

  const geometry = useMemo(() => {
    if (!arcs.length) return null;

    const parts: TubeGeometry[] = [];
    const from = new Vector3();
    const to = new Vector3();

    for (const arc of arcs) {
      markerPosition(arc.from, from);
      markerPosition(arc.to, to);
      if (from.lengthSq() === 0 || to.lengthSq() === 0) continue;

      const angle = from.angleTo(to);
      const mid = from
        .clone()
        .add(to)
        .normalize()
        .multiplyScalar(liftFor(angle));

      // Same materiality scale the markers use, so an arc and the marker it feeds
      // always agree about how much is at stake.
      const w = materialityT(arc.targetLoss_cr);
      const radius = TUBE_RADIUS_MIN + (TUBE_RADIUS_MAX - TUBE_RADIUS_MIN) * w;

      const curve = new QuadraticBezierCurve3(from.clone(), mid, to.clone());
      const tube = new TubeGeometry(curve, TUBE_SEGMENTS, radius, TUBE_RADIAL, false);

      const count = tube.attributes.position.count;
      tube.setAttribute('aHop', new BufferAttribute(new Float32Array(count).fill(arc.hop), 1));
      tube.setAttribute('aWeight', new BufferAttribute(new Float32Array(count).fill(w), 1));
      parts.push(tube);
    }

    if (!parts.length) return null;
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  }, [arcs]);

  const maxHop = useMemo(() => Math.max(1, ...arcs.map((a) => a.hop)), [arcs]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uPlayhead: { value: 1 },
          uTime: { value: 0 },
          uNear: { value: new Color(PALETTE.risk4) },
          uFar: { value: new Color(PALETTE.risk2) },
          uMaxHop: { value: maxHop },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [maxHop],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uPlayhead.value = playhead;
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false} raycast={() => null}>
      <primitive object={material} ref={materialRef} attach="material" />
    </mesh>
  );
}
