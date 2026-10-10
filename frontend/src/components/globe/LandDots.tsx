import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';

import dotsData from '@/data/globe-dots.json';
import { latLonToVector3 } from '@/lib/geo';

const GLOBE_RADIUS = 1;

const vertexShader = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vFade;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Dots near the limb read as noise, so ease them out. The normal of a point on a
    // unit sphere is its own position.
    vec3 worldNormal = normalize(mat3(modelMatrix) * position);
    vec3 toCamera = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
    vFade = smoothstep(0.0, 0.35, dot(worldNormal, toCamera));

    gl_PointSize = uSize * uPixelRatio * (1.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float edge = 1.0 - smoothstep(0.32, 0.5, d);
    gl_FragColor = vec4(uColor, edge * uOpacity * vFade);
  }
`;

export function LandDots() {
  const ref = useRef<Points>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const flat = dotsData.dots as number[];
    const count = flat.length / 2;
    const positions = new Float32Array(count * 3);
    const v = { x: 0, y: 0, z: 0 } as { x: number; y: number; z: number };
    const tmp = latLonToVector3(0, 0, GLOBE_RADIUS);
    for (let i = 0; i < count; i++) {
      latLonToVector3(flat[i * 2], flat[i * 2 + 1], GLOBE_RADIUS, tmp);
      v.x = tmp.x;
      v.y = tmp.y;
      v.z = tmp.z;
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uSize: { value: 3.4 },
          uPixelRatio: { value: dpr },
          uColor: { value: [0.45, 0.6, 0.78] },
          uOpacity: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [dpr],
  );

  useFrame(() => {
    material.uniforms.uPixelRatio.value = dpr;
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}

/** Opaque core that hides dots on the far side so the sphere reads as solid. */
export function GlobeCore() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 0.992, 64, 64]} />
      <meshBasicMaterial color="#080B12" />
    </mesh>
  );
}

/** Faint latitude/longitude cage, just enough to give the sphere structure. */
export function Graticule() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 0.996, 36, 18]} />
      <meshBasicMaterial color="#141B28" wireframe transparent opacity={0.5} />
    </mesh>
  );
}
