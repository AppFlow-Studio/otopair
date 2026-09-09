export interface CustomSheetBounds {
  minimum: number;
  initial: number;
  maximum: number;
}

interface OverlayClearanceInput {
  safeAreaBottom: number;
  overlayHeight: number;
  extraSpacing: number;
}

interface CappedSheetHeightInput {
  viewportHeight: number;
  desiredHeight: number;
  minimumHeight: number;
  maximumRatio: number;
  absoluteMaximum: number;
}

export const BOOKING_FLOW_CTA_HEIGHT = 64;

export function getCustomSheetBounds(
  viewportHeight: number,
): CustomSheetBounds {
  return {
    minimum: viewportHeight * 0.23,
    initial: viewportHeight * 0.92,
    maximum: viewportHeight,
  };
}

export function clampSheetHeight(
  currentHeight: number,
  bounds: CustomSheetBounds,
): number {
  return Math.max(bounds.minimum, Math.min(bounds.maximum, currentHeight));
}

export function getOverlayClearance({
  safeAreaBottom,
  overlayHeight,
  extraSpacing,
}: OverlayClearanceInput): number {
  return Math.max(0, safeAreaBottom) + overlayHeight + extraSpacing;
}

export function getCappedSheetHeight({
  viewportHeight,
  desiredHeight,
  minimumHeight,
  maximumRatio,
  absoluteMaximum,
}: CappedSheetHeightInput): number {
  const maximumHeight = Math.min(
    viewportHeight * maximumRatio,
    absoluteMaximum,
  );
  return Math.max(
    Math.min(minimumHeight, maximumHeight),
    Math.min(maximumHeight, desiredHeight),
  );
}
