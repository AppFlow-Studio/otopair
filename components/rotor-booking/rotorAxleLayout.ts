export const ROTOR_AXLE_ICON_SIZE = 64;

export const ROTOR_AXLE_CENTER_PCTS = {
  left: 12,
  right: 88,
} as const;

export function getRotorAxleCenters(surfaceWidth: number): { left: number; right: number } {
  return {
    left: (surfaceWidth * ROTOR_AXLE_CENTER_PCTS.left) / 100,
    right: (surfaceWidth * ROTOR_AXLE_CENTER_PCTS.right) / 100,
  };
}
