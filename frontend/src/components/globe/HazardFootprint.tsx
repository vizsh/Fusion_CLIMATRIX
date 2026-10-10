import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, Vector3 } from 'three';

import { latLonToVector3 } from '@/lib/geo';
import { PALETTE } from '@/lib/palette';
import { useSimStore } from '@/store/sim';

const EARTH_R_KM = 6371;
const SURFACE = 1.002;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Soft disc with a brighter ring, matching the engine's footprint model: full
 * intensity inside the inner 60% of the radius, falling to zero at the edge.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;

    float core = 1.0 - smoothstep(0.6, 1.0, d);
    float ring = exp(-pow((d - 0.86) * 13.0, 2.0));
    float breathe = 0.82 + 0.18 * sin(uTime * 1.6);

    float a = (core * 0.2 + ring * 0.55) * uIntensity * breathe;
    gl_FragColor = vec4(uColor, a);
  }
`;

export function HazardFootprint() {
  const result = useSimStore((s) => s.result);
  const materials = useRef<ShaderMaterial[]>([]);

  const discs = useMemo(() => {
    materials.current = [];
    if (!result) return [];

    const severity = result.request.severity / 100;

    return result.hazard.centroids.map((c) => {
      const position = latLonToVector3(c.lat, c.lon, SURFACE, new Vector3());
      const material = new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(PALETTE.risk4) },
          uIntensity: { value: c.intensity * severity },
          uTime: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      });
      materials.current.push(material);

      return {
        key: `${result.hazard.id}-${c.district}`,
        position,
        // Lay the disc flat on the surface rather than billboarding it: a hazard
        // footprint belongs to the ground, not to the camera.
        up: position.clone().normalize(),
        radius: (c.radius_km / EARTH_R_KM) * 1.35,
        material,
      };
    });
  }, [result]);

  useFrame((state) => {
    for (const m of materials.current) m.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group>
      {discs.map((d) => (
        <mesh
          key={d.key}
          position={d.position}
          onUpdate={(self) => self.lookAt(d.up.clone().multiplyScalar(10))}
          raycast={() => null}
        >
          <circleGeometry args={[d.radius, 48]} />
          <primitive object={d.material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
