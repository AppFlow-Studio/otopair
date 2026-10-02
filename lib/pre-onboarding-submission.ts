export const PRE_ONBOARDING_SAVE_ERROR =
  "Couldn’t finish saving your vehicle details. Try again.";

export async function completePreOnboarding(
  save: () => Promise<unknown>,
  advance: () => void,
): Promise<string | null> {
  try {
    await save();
    advance();
    return null;
  } catch {
    return PRE_ONBOARDING_SAVE_ERROR;
  }
}
