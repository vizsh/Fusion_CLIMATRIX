import { Vector3 } from 'three';

const DEG2RAD = Math.PI / 180;

/**
 * Geographic coordinates to a point on a sphere of the given radius.
 *
 * Longitude 0 faces +Z after the standard three.js mapping, so the default camera at
 * +Z looks at the Gulf of Guinea. The scene rotates the globe group to bring a target
 * to front rather than moving the camera around it.
 */
export function latLonToVector3(lat: number, lon: number, radius = 1, out = new Vector3()): Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return out.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  );
}

/** Rotation (in radians) to apply to the globe group so a coordinate faces the camera. */
export function rotationToFace(lat: number, lon: number): { x: number; y: number } {
  return {
    x: lat * DEG2RAD,
    y: -(lon + 180) * DEG2RAD - Math.PI / 2,
  };
}
