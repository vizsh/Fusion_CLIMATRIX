import { useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial } from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Rim light. Rendered on the inside of a slightly larger sphere so the glow sits
 * behind the planet's silhouette rather than washing over its face.
 */
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  varying vec3 vNormal;

  void main() {
    float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), uPower);
    gl_FragColor = vec4(uColor, 1.0) * rim * uIntensity;
  }
`;

export function Atmosphere({
  radius = 1.14,
  color = '#2a7fb8',
  intensity = 0.9,
  power = 2.6,
}: {
  radius?: number;
  color?: string;
  intensity?: number;
  power?: number;
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: intensity },
          uPower: { value: power },
        },
        vertexShader,
        fragmentShader,
        blending: AdditiveBlending,
        side: BackSide,
        transparent: true,
        depthWrite: false,
      }),
    [color, intensity, power],
  );

  return (
    <mesh material={material}>
      <sphereGeometry args={[radius, 64, 64]} />
    </mesh>
  );
}
