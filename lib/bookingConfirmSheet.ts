const COMPACT_HEIGHT = 860;
const VERY_COMPACT_HEIGHT = 760;

const REGULAR_RATIO = 0.56;
const COMPACT_RATIO = 0.565;
const VERY_COMPACT_RATIO = 0.72;

/**
 * Where the pin glyph's bottom edge lands, as a fraction of screen height.
 *
 * The Lottie is a square 600x600 canvas drawn at the full window with
 * resizeMode="cover", so its rendered size — and therefore the pin — scales
 * with screen height. Measured off the simulator at 402x874: the glyph ends at
 * 271pt, i.e. 0.31 of height.
 */
const PIN_BOTTOM_FRACTION = 0.31;

/** Clearance between the pin's bottom and the first line of copy. */
const COPY_GAP = 38;

/** Two lines of copy plus its internal gap. */
const COPY_BLOCK_HEIGHT = 44;

/** Breathing room between the copy and the top of the sheet. */
const COPY_SHEET_MARGIN = 8;

const MIN_SHEET_HEIGHT = 468;
const MAX_SHEET_HEIGHT = 620;
const MAX_SCREEN_RATIO = 0.72;
const WIDE_COMPACT_WIDTH = 380;

interface BookingConfirmLayoutInput {
  width: number;
  height: number;
}

interface BookingConfirmLayout {
  sheetHeight: number;
  lottieTranslateY: number;
  /** Absolute top offset (px) for the copy block. */
  copyTop: number;
}

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

export function calculateBookingConfirmLayout({
  width,
  height,
}: BookingConfirmLayoutInput): BookingConfirmLayout {
  const isWideCompact = width >= WIDE_COMPACT_WIDTH;
  const isVeryCompactHeight = height < VERY_COMPACT_HEIGHT;
  const isCompactHeight = height < COMPACT_HEIGHT;

  let sheetHeight = calculateBookingConfirmSheetHeight(height);
  let lottieTranslateY = 0;

  if (isWideCompact && isVeryCompactHeight) {
    sheetHeight = Math.min(sheetHeight, Math.max(420, Math.round(height * 0.63)));
    lottieTranslateY = -28;
  } else if (isWideCompact && isCompactHeight) {
    sheetHeight = Math.min(sheetHeight, Math.max(440, Math.round(height * 0.535)));
    lottieTranslateY = -36;
  } else if (isWideCompact) {
    lottieTranslateY = -12;
  } else if (isVeryCompactHeight) {
    lottieTranslateY = -94;
  } else if (isCompactHeight) {
    lottieTranslateY = -66;
  }

  /*
   * The copy used to be a hand-tuned percentage per device bucket (19% / 22% /
   * 29% / 34% / 37%) while the pin was moved by an offset in POINTS. Mixing the
   * two units meant their separation changed per device, and on at least one
   * bucket it went negative — at 393x667 the copy started at 147 while the pin
   * ended near 179, so the text was drawn over the logo. That is bug #243.
   *
   * Deriving the copy from the pin keeps both in the same units, so the gap is
   * the same on every screen instead of being re-guessed five times.
   */
  const pinBottom = Math.round(height * PIN_BOTTOM_FRACTION) + lottieTranslateY;
  const desiredTop = pinBottom + COPY_GAP;

  // On a short screen the sheet claims most of the height; rather than let the
  // copy slide under it, cap it — a reduced gap is survivable, an occluded
  // line is not.
  const maxTop = height - sheetHeight - COPY_BLOCK_HEIGHT - COPY_SHEET_MARGIN;
  const copyTop = Math.max(pinBottom, Math.min(desiredTop, maxTop));

  return {
    copyTop,
    lottieTranslateY,
    sheetHeight,
  };
}
