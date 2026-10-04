/**
 * Reopening a saved design in the same physical place, without cloud anchors: the user marks the same two floor points
 * (point A, e.g. a room corner, then point B along a wall). Everything is stored relative to that A->B frame, so it
 * survives the AR session's world origin changing between launches. Accuracy is limited by how precisely the two
 * points are re-tapped (a few cm).
 */
import type { V3 } from './wall';

/** Yaw (degrees) of the A->B direction in Viro's rotationY convention: local +x maps to (cos a, 0, -sin a). */
export const frameYaw = (a: V3, b: V3) => (Math.atan2(-(b[2] - a[2]), b[0] - a[0]) * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

export interface Placed { position: V3; rotationY: number }

/** World placement -> coordinates in the frame at `origin` turned by `yaw` degrees: [along, up, across]. */
export function toFrameYaw(origin: V3, yaw: number, p: Placed): { offset: V3; rotationY: number } {
  const al = rad(yaw), dx = p.position[0] - origin[0], dz = p.position[2] - origin[2];
  return {
    offset: [dx * Math.cos(al) - dz * Math.sin(al), p.position[1] - origin[1], dx * Math.sin(al) + dz * Math.cos(al)],
    rotationY: p.rotationY - yaw,
  };
}
/** Inverse of toFrameYaw, with the (possibly different) origin and yaw found in a new session. */
export function fromFrameYaw(origin: V3, yaw: number, f: { offset: V3; rotationY: number }): Placed {
  const al = rad(yaw), [u, y, v] = f.offset;
  return { position: [origin[0] + u * Math.cos(al) + v * Math.sin(al), origin[1] + y, origin[2] - u * Math.sin(al) + v * Math.cos(al)], rotationY: f.rotationY + yaw };
}
/** Two-point version: the frame runs from A towards B. */
export const toFrame = (a: V3, b: V3, p: Placed) => toFrameYaw(a, frameYaw(a, b), p);
export const fromFrame = (a: V3, b: V3, f: { offset: V3; rotationY: number }) => fromFrameYaw(a, frameYaw(a, b), f);
