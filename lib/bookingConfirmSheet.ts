const COMPACT_HEIGHT = 860;
const VERY_COMPACT_HEIGHT = 760;

const REGULAR_RATIO = 0.56;
const COMPACT_RATIO = 0.565;
const VERY_COMPACT_RATIO = 0.72;

const MIN_SHEET_HEIGHT = 468;
const MAX_SHEET_HEIGHT = 620;
const MAX_SCREEN_RATIO = 0.72;

export function calculateBookingConfirmSheetHeight(windowHeight: number): number {
  if (!Number.isFinite(windowHeight) || windowHeight <= 0) {
    return MIN_SHEET_HEIGHT;
  }

  const ratio =
    windowHeight < VERY_COMPACT_HEIGHT
      ? VERY_COMPACT_RATIO
      : windowHeight < COMPACT_HEIGHT
        ? COMPACT_RATIO
        : REGULAR_RATIO;

  const desiredHeight = Math.max(MIN_SHEET_HEIGHT, Math.round(windowHeight * ratio));
  const screenCap = Math.round(windowHeight * MAX_SCREEN_RATIO);
  const maxHeight = Math.min(MAX_SHEET_HEIGHT, screenCap);

  return Math.min(desiredHeight, maxHeight);
}
