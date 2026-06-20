import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/settings/verify-contact-update.tsx"), "utf8");

test("verify contact update auto-submits once a six digit code is entered", () => {
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /const fullCode = code\.join\(""\)/);
  assert.match(source, /fullCode\.length === 6/);
  assert.match(source, /handleSubmitCode\(fullCode\)/);
});

test("verify contact update uses the onboarding-style error sheet for failed codes", () => {
  assert.match(source, /showErrorModal/);
  assert.match(source, /Animated\.spring\(slideAnim/);
  assert.match(source, /Incorrect code entered/);
  assert.match(source, /errorModalBackdrop/);
  assert.match(source, /errorModalHandle/);
});

test("verify contact update accepts a prepared phone verification resource from edit profile", () => {
  assert.match(source, /pendingPhoneVerificationId/);
  assert.match(source, /find\(.*phoneNumber\.id === pendingPhoneVerificationId/s);
});

test("verify contact update accepts a prepared email verification resource from edit profile", () => {
  assert.match(source, /pendingEmailVerificationId/);
  assert.match(source, /find\(.*emailAddress\.id === pendingEmailVerificationId/s);
});

test("verify contact update clears the first code before moving to the next contact method", () => {
  assert.match(
    source,
    /if \(stepIndex < steps\.length - 1\) \{\s*setIsStepReady\(false\);\s*setCode\(\["", "", "", "", "", ""\]\);\s*setFocusedIndex\(0\);\s*setStepIndex\(\(prev\) => prev \+ 1\);/s,
  );
});

test("verify contact update refocuses the first code input after changing verification steps", () => {
  assert.match(
    source,
    /await prepareVerificationForCurrentStep\(\);[\s\S]*setVisibleStepIndex\(stepIndex\);[\s\S]*setIsStepReady\(true\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*inputRefs\.current\[0\]\?\.focus\(\);/s,
  );
});

test("verify contact update shows a loading indicator instead of code inputs during step transitions", () => {
  assert.match(source, /ActivityIndicator/);
  assert.match(source, /const isCodeLoading = isSubmitting \|\| !isStepReady \|\| stepIndex !== visibleStepIndex/);
  assert.match(source, /isCodeLoading \? \(/);
  assert.match(source, /<ActivityIndicator[\s\S]*color=\{BrandColors\.secondary\}/s);
  assert.match(source, /: \(\s*code\.map/s);
});

test("verify contact update keeps prior visible step text until the next step is prepared", () => {
  assert.match(source, /const \[visibleStepIndex, setVisibleStepIndex\] = useState\(0\)/);
  assert.match(source, /const visibleStep = steps\[visibleStepIndex\] \?\? currentStep/);
  assert.match(source, /Step \{visibleStepIndex \+ 1\} of \{steps\.length\}/);
  assert.match(source, /visibleStep === "phone" \? pendingPhone : pendingEmail/);
});

test("verify contact update commits each verified contact method before advancing", () => {
  assert.match(source, /const commitVerifiedContactStep = useCallback/);
  assert.match(
    source,
    /await commitVerifiedContactStep\(currentStep\);[\s\S]*if \(stepIndex < steps\.length - 1\)/s,
  );
});

test("verify contact update persists phone changes to Clerk and Convex immediately after phone code verification", () => {
  assert.match(
    source,
    /target === "phone"[\s\S]*await user\.update\(\{ primaryPhoneNumberId: phoneVerificationRef\.current\.id \}\);[\s\S]*await destroyOtherPhoneNumbers\(user, phoneVerificationRef\.current\.id\);[\s\S]*updateData\(\{ phoneNumber: pendingPhone, phoneVerified: true \}\);[\s\S]*await persistProfileField\(\{ phone: pendingPhone, phoneVerified: true \}\);[\s\S]*phoneVerificationRef\.current = null;/s,
  );
});

test("verify contact update persists email changes to Clerk and Convex immediately after email code verification", () => {
  assert.match(
    source,
    /target === "email"[\s\S]*await user\.update\(\{ primaryEmailAddressId: emailVerificationRef\.current\.id \}\);[\s\S]*updateData\(\{ email: pendingEmail \}\);[\s\S]*await persistProfileField\(\{ email: pendingEmail \}\);[\s\S]*emailVerificationRef\.current = null;/s,
  );
});

test("verify contact update routes to the conditional settings success screen after all verification steps", () => {
  assert.match(source, /contact_both/);
  assert.match(source, /contact_phone/);
  assert.match(source, /contact_email/);
  assert.match(source, /pathname:\s*"\/settings\/success"/);
  assert.match(source, /params:\s*\{\s*type:\s*successType\s*\}/s);
});
