type ClerkPhoneNumberResource = {
  id: string;
  phoneNumber?: string | null;
  verification?: { status?: string | null } | null;
  prepareVerification?: (...args: any[]) => Promise<unknown>;
  attemptVerification?: (params: { code: string }) => Promise<unknown>;
  destroy: () => Promise<unknown>;
};

type ClerkUserWithPhoneNumbers = {
  phoneNumbers: ClerkPhoneNumberResource[];
  reload?: () => Promise<unknown>;
  update?: (params: { primaryPhoneNumberId?: string }) => Promise<unknown>;
};

export const normalizePhoneForComparison = (phone: string | undefined | null) =>
  (phone ?? "").replace(/\D/g, "");

export const isPhoneNumberVerified = (phoneNumber: ClerkPhoneNumberResource | undefined | null) =>
  phoneNumber?.verification?.status === "verified";

export const findPhoneNumberByNormalizedValue = (
  user: ClerkUserWithPhoneNumbers,
  normalizedPhone: string,
) =>
  user.phoneNumbers.find(
    (phoneNumber) =>
      normalizePhoneForComparison(phoneNumber.phoneNumber) === normalizedPhone,
  );

export const isIdentifierAlreadyTakenError = (err: unknown) => {
  const code = (err as any)?.errors?.[0]?.code ?? (err as any)?.code;
  const message = err instanceof Error ? err.message : String((err as any)?.message ?? "");
  const lowerMessage = message.toLowerCase();
  return (
    code === "form_identifier_exists" ||
    lowerMessage.includes("phone number is taken") ||
    lowerMessage.includes("email address is taken") ||
    lowerMessage.includes("identifier already exists")
  );
};

export const cleanupStaleUnverifiedPhoneNumbers = async (
  user: ClerkUserWithPhoneNumbers,
  normalizedPhoneToKeep: string,
) => {
  const cleanupResults = await Promise.allSettled(
    user.phoneNumbers
      .filter(
        (phoneNumber) =>
          !isPhoneNumberVerified(phoneNumber) &&
          normalizePhoneForComparison(phoneNumber.phoneNumber) !== normalizedPhoneToKeep,
      )
      .map((phoneNumber) => phoneNumber.destroy()),
  );

  const failedCleanup = cleanupResults.filter((result) => result.status === "rejected");
  if (failedCleanup.length > 0) {
    console.warn("Failed to remove one or more stale unverified phone numbers:", failedCleanup);
  }
};

export const destroyOtherPhoneNumbers = async (
  user: ClerkUserWithPhoneNumbers,
  phoneNumberIdToKeep: string,
  options?: { makePrimary?: boolean },
) => {
  if (options?.makePrimary === true) {
    await user.update?.({ primaryPhoneNumberId: phoneNumberIdToKeep });
  }

  await user.reload?.();
  const cleanupResults = await Promise.allSettled(
    user.phoneNumbers
      .filter((phoneNumber) => phoneNumber.id !== phoneNumberIdToKeep)
      .map((phoneNumber) => phoneNumber.destroy()),
  );

  const failedCleanup = cleanupResults.filter((result) => result.status === "rejected");
  if (failedCleanup.length > 0) {
    console.warn("Failed to remove one or more secondary phone numbers:", failedCleanup);
  }
  await user.reload?.();
};

/**
 * Verify a signed-in (OAuth) user's phone number with the code they entered.
 * Resolves once the number is verified; throws only if it genuinely is not.
 *
 * Clerk's `attemptVerification` is the only step that decides whether the
 * number is verified. Making it primary and removing old numbers afterwards is
 * housekeeping — but it used to share one try/catch with the verification, so
 * a housekeeping failure showed "Verification failed" for a number Clerk had
 * already verified. Retrying could never succeed (Clerk rejects re-verifying a
 * verified number), and on the next launch the synced `phoneVerified`, plus the
 * name and email OAuth fills in, read as essential onboarding done, so the app
 * skipped the rest of onboarding (bug #235).
 *
 * So: don't re-attempt a number that is already verified; when an attempt
 * throws, believe Clerk's state over the error; and never let housekeeping turn
 * a verified number into a failure.
 */
export const verifyUserPhoneNumber = async (
  user: ClerkUserWithPhoneNumbers,
  phoneNumberId: string,
  code: string,
): Promise<void> => {
  const find = () => user.phoneNumbers.find((p) => p.id === phoneNumberId);
  const target = find();
  if (!target) throw new Error("No phone number found to verify.");

  if (!isPhoneNumberVerified(target)) {
    if (!target.attemptVerification) throw new Error("Phone number cannot be verified.");
    try {
      await target.attemptVerification({ code });
    } catch (err) {
      // An earlier attempt may already have verified it, in which case Clerk
      // rejects this one. Re-read Clerk's state before calling it a failure.
      await user.reload?.();
      if (!isPhoneNumberVerified(find())) throw err;
    }
  }

  try {
    await destroyOtherPhoneNumbers(user, phoneNumberId, { makePrimary: true });
  } catch (err) {
    console.warn("Phone verified, but making it primary or removing old numbers failed:", err);
  }
};
