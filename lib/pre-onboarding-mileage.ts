/**
 * The vehicle setup questionnaire (app/car-pre-onboarding.tsx) asks for the
 * mileage at purchase and the current odometer on two separate steps, so
 * nothing compared them: a used car that read 10,000 mi on the day it was
 * bought cannot read 5,000 mi today. Kareem hit exactly that and the form
 * advanced without a word.
 */

/** Same two values as the questionnaire's ownership question. */
export type PreOnboardingOwnershipType = "leased" | "owned";

export type CurrentMileageCheck =
  | { status: "ok" }
  | { status: "below_purchase"; mileageAtPurchase: number };

/**
 * Parse a mileage field the way the questionnaire's number-pad inputs are
 * filled: bare digits, but paste and autofill can land thousands separators
 * or padding. Anything else reads as "no answer yet".
 */
export function parseMileageInput(raw: string): number | undefined {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Is the current odometer answer consistent with the mileage-at-purchase
 * answer? Only a used purchase collects one — leased and bought-new skip that
 * step, and "Not sure" leaves no number to compare against. An unreadable
 * value on either side is left to the step's own answer-required gate, which
 * keeps Continue disabled anyway.
 */
export function checkCurrentMileage({
  ownershipType,
  ownedSinceNew,
  mileageAtPurchaseNotSure,
  mileageAtPurchaseInput,
  currentMileageInput,
}: {
  ownershipType: PreOnboardingOwnershipType | undefined;
  ownedSinceNew: boolean | undefined;
  mileageAtPurchaseNotSure: boolean;
  mileageAtPurchaseInput: string;
  currentMileageInput: string;
}): CurrentMileageCheck {
  if (ownershipType !== "owned" || ownedSinceNew !== false) return { status: "ok" };
  if (mileageAtPurchaseNotSure) return { status: "ok" };

  const mileageAtPurchase = parseMileageInput(mileageAtPurchaseInput);
  const currentMileage = parseMileageInput(currentMileageInput);
  if (mileageAtPurchase === undefined || currentMileage === undefined) return { status: "ok" };

  // Equal is fine — they may have just picked the car up.
  if (currentMileage >= mileageAtPurchase) return { status: "ok" };
  return { status: "below_purchase", mileageAtPurchase };
}

/** Inline copy for the odometer field when it reads below the purchase mileage. */
export function currentMileageBelowPurchaseMessage(mileageAtPurchase: number): string {
  const formatted = Math.round(mileageAtPurchase).toLocaleString("en-US");
  return `That's lower than the mileage when you got it (${formatted} mi). Double-check both numbers.`;
}
