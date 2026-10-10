import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { CameraControls, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import type { Group } from 'three';

import { Atmosphere } from './Atmosphere';
import { CompanyMarkers } from './CompanyMarkers';
import { HazardFootprint } from './HazardFootprint';
import { HoverLabel } from './HoverLabel';
import { GlobeCore, Graticule, LandDots } from './LandDots';
import { PropagationArcs } from './PropagationArcs';
import { useUiStore } from '@/store/ui';

/** Seconds for one full propagation run to play out. */
const RUN_DURATION_S = 4.2;

/**
 * Advances the propagation playhead from the frame loop rather than a timer, so the
 * reveal stays in step with rendering instead of drifting against it.
 */
function PlayheadDriver() {
  const playing = useUiStore((s) => s.playing);
  const setPlayhead = useUiStore((s) => s.setPlayhead);
  const stop = useUiStore((s) => s.stop);

  useFrame((_, dt) => {
    if (!playing) return;
    const next = useUiStore.getState().playhead + dt / RUN_DURATION_S;
    if (next >= 1) {
      setPlayhead(1);
      stop();
    } else {
      setPlayhead(next);
    }
  });

  return null;
}

/** Rotation about Y that brings ~78E (central India) to face the camera. */
const INDIA_FACING_Y = -2.932;

function GlobeGroup() {
  const ref = useRef<Group>(null);
  const autoRotate = useUiStore((s) => s.autoRotate);
  const hoveredId = useUiStore((s) => s.hoveredId);

  useFrame((_, dt) => {
    // Pause the spin while a marker is under the cursor, or it slides out from under it.
    if (ref.current && autoRotate && !hoveredId) ref.current.rotation.y += dt * 0.045;
  });

  // Open on South Asia. The default orientation puts 90W at the camera, which would
  // open this product on the Pacific.
  return (
    <group ref={ref} rotation={[0, INDIA_FACING_Y, 0]}>
      <GlobeCore />
      <Graticule />
      <LandDots />
      <HazardFootprint />
      <PropagationArcs />
      <CompanyMarkers />
      <HoverLabel />
    </group>
  );
}

export function GlobeScene() {
  const stopAutoRotate = useUiStore((s) => s.stopAutoRotate);

  return (
    <Canvas
      camera={{ position: [0, 0.35, 3.1], fov: 42, near: 0.01, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onPointerDown={stopAutoRotate}
      onWheel={stopAutoRotate}
    >
      <color attach="background" args={['#07090D']} />

      <PlayheadDriver />

      <Suspense fallback={null}>
        <GlobeGroup />
        <Atmosphere />
        <Stars radius={60} depth={30} count={1400} factor={2.4} saturation={0} fade speed={0.3} />
      </Suspense>

      <CameraControls
        makeDefault
        minDistance={1.35}
        maxDistance={6}
        smoothTime={0.32}
        draggingSmoothTime={0.12}
        dollySpeed={0.5}
      />

      {/*
        multisampling={0} is load-bearing, not an oversight.

        On three 0.186.1 the composer's default half-float render target combined with
        MSAA renders a black frame - no error, no warning, just nothing. Either one alone
        is fine. Half-float is kept because the propagation arcs are additive and bright,
        and they need the HDR headroom for bloom to read properly; MSAA is the cheaper
        thing to give up since the dots and arcs are already soft-edged.

        If anti-aliasing becomes a problem, add postprocessing's SMAA pass rather than
        turning multisampling back on.
      */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.9} luminanceThreshold={0.1} luminanceSmoothing={0.35} mipmapBlur />
        <Vignette offset={0.26} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}
