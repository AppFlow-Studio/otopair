import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyUserPhoneNumber } from "../lib/clerk-phone-numbers";

/**
 * Bug #235: a first-time OAuth user's phone verification "failed", and after a
 * restart the app skipped onboarding entirely. The code had in fact verified
 * the number at Clerk; the housekeeping that followed (making it primary) threw
 * inside the same try, so the screen reported a failure, every retry was
 * rejected as already-verified, and the synced phoneVerified later read as
 * essential onboarding done.
 */

type Status = "unverified" | "verified";

function phone(id: string, status: Status, attempt?: (code: string) => Promise<void>) {
  const p = {
    id,
    phoneNumber: "+15555550100",
    verification: { status } as { status: Status },
    destroy: vi.fn(async () => {}),
    attemptVerification: vi.fn(async ({ code }: { code: string }) => {
      if (attempt) await attempt(code);
      p.verification.status = "verified"; // Clerk updates the resource in place
    }),
  };
  return p;
}

function user(phones: ReturnType<typeof phone>[], opts: { updateThrows?: boolean } = {}) {
  return {
    phoneNumbers: phones,
    reload: vi.fn(async () => {}),
    update: vi.fn(async () => {
      if (opts.updateThrows) throw new Error("reverification required");
    }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("verifyUserPhoneNumber", () => {
  it("verifies the number and makes it primary on the normal path", async () => {
    const p = phone("ph_1", "unverified");
    const u = user([p]);
    await expect(verifyUserPhoneNumber(u, "ph_1", "123456")).resolves.toBeUndefined();
    expect(p.attemptVerification).toHaveBeenCalledWith({ code: "123456" });
    expect(u.update).toHaveBeenCalledWith({ primaryPhoneNumberId: "ph_1" });
    expect(p.verification.status).toBe("verified");
  });

  it("THE BUG: still succeeds when making the number primary fails afterwards", async () => {
    // Before the fix this threw, and the screen said "Verification failed" for
    // a number Clerk had just verified.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = phone("ph_1", "unverified");
    const u = user([p], { updateThrows: true });
    await expect(verifyUserPhoneNumber(u, "ph_1", "123456")).resolves.toBeUndefined();
    expect(p.verification.status).toBe("verified");
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not re-attempt a number that is already verified, so a retry can succeed", async () => {
    // The retry after the false failure: Clerk would reject a second attempt.
    const p = phone("ph_1", "verified", async () => {
      throw new Error("This verification has already been verified.");
    });
    const u = user([p]);
    await expect(verifyUserPhoneNumber(u, "ph_1", "123456")).resolves.toBeUndefined();
    expect(p.attemptVerification).not.toHaveBeenCalled();
  });

  it("believes Clerk's state over a thrown error when the number did verify", async () => {
    const p = phone("ph_1", "unverified");
    p.attemptVerification.mockImplementationOnce(async () => {
      p.verification.status = "verified";
      throw new Error("network blip after the server accepted the code");
    });
    const u = user([p]);
    await expect(verifyUserPhoneNumber(u, "ph_1", "123456")).resolves.toBeUndefined();
    expect(u.reload).toHaveBeenCalled();
  });

  it("still fails on a genuinely wrong code", async () => {
    const wrong = new Error("Incorrect code");
    const p = phone("ph_1", "unverified");
    p.attemptVerification.mockImplementationOnce(async () => {
      throw wrong;
    });
    const u = user([p]);
    await expect(verifyUserPhoneNumber(u, "ph_1", "000000")).rejects.toBe(wrong);
    expect(u.update).not.toHaveBeenCalled(); // no housekeeping for an unverified number
  });

  it("fails when the number to verify is missing", async () => {
    const u = user([phone("ph_other", "unverified")]);
    await expect(verifyUserPhoneNumber(u, "ph_missing", "123456")).rejects.toThrow(
      "No phone number found to verify.",
    );
  });
});
