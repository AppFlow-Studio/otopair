import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/settings/edit-profile.tsx"), "utf8");

test("edit profile preflights changed phone numbers before routing to verification", () => {
  assert.match(source, /isIdentifierAlreadyTakenError/);
  assert.match(source, /prepareProfilePhoneVerification/);
  assert.match(source, /await prepareProfilePhoneVerification\(nextPhoneNumber\)/);
  assert.match(source, /pendingPhoneVerificationId/);
});

test("edit profile shows the onboarding-style error sheet for taken phone numbers", () => {
  assert.match(source, /showContactErrorSheet/);
  assert.match(source, /That phone number is already associated with another account\./);
  assert.match(source, /errorModalBackdrop/);
  assert.match(source, /errorModalHandle/);
  assert.match(source, /Incorrect code entered|Phone number already in use/);
});

test("edit profile preflights changed email addresses before routing to verification", () => {
  assert.match(source, /prepareProfileEmailVerification/);
  assert.match(source, /await prepareProfileEmailVerification\(nextEmail\)/);
  assert.match(source, /pendingEmailVerificationId/);
  assert.match(source, /Email already in use/);
});

test("edit profile only enables save for changed text fields with valid changed contact fields", () => {
  assert.match(source, /isTextFieldChanged/);
  assert.match(source, /isPhoneValidForSave/);
  assert.match(source, /isEmailValidForSave/);
  assert.match(source, /const canSave = !isSaving && isTextFieldChanged && isPhoneValidForSave && isEmailValidForSave/);
});

test("edit profile waits to render the editable fields until profile data has hydrated", () => {
  assert.match(source, /const \[hasHydratedProfile, setHasHydratedProfile\] = useState\(false\)/);
  assert.match(source, /allCountries\.length === 0 \|\| me === undefined/);
  assert.match(source, /setHasHydratedProfile\(true\)/);
  assert.match(source, /if \(!hasHydratedProfile\) \{/);
  assert.match(source, /<ActivityIndicator[\s\S]*color=\{BrandColors\.secondary\}/s);
  assert.match(source, /hasHydratedProfile[\s\S]*<TextInput[\s\S]*placeholder="Enter first name"/s);
});

test("edit profile resyncs contact fields from current profile data when returning from verification", () => {
  assert.match(source, /useFocusEffect/);
  assert.match(source, /const syncProfileFieldsFromCurrentData = useCallback/);
  assert.match(source, /syncProfileFieldsFromCurrentData\(\{ openPhotoOptions: true \}\)/);
  assert.match(source, /useFocusEffect\(\s*useCallback\(\(\) => \{/s);
  assert.match(source, /if \(hasHydratedProfileRef\.current\) \{\s*syncProfileFieldsRef\.current\(\);/s);
});

test("edit profile focus resync does not rerun while save dependencies change before verification navigation", () => {
  assert.match(source, /const syncProfileFieldsRef = useRef\(syncProfileFieldsFromCurrentData\)/);
  assert.match(source, /syncProfileFieldsRef\.current = syncProfileFieldsFromCurrentData/);
  assert.match(source, /const hasHydratedProfileRef = useRef\(hasHydratedProfile\)/);
  assert.match(source, /hasHydratedProfileRef\.current = hasHydratedProfile/);
  assert.match(source, /useFocusEffect\(\s*useCallback\(\(\) => \{[\s\S]*\}, \[\]\),\s*\);/s);
});

test("edit profile scrolls focused contact inputs above the keyboard", () => {
  assert.match(source, /const scrollViewRef = useRef<ScrollView \| null>\(null\)/);
  assert.match(source, /const focusedFieldRef = useRef<EditableProfileField \| null>\(null\)/);
  assert.match(source, /const fieldYOffsetsRef = useRef<Partial<Record<EditableProfileField, number>>>\(\{\}\)/);
  assert.match(source, /const scrollFocusedFieldIntoView = useCallback/);
  assert.match(source, /const handleFieldFocus = useCallback/);
  assert.match(source, /scrollViewRef\.current\?\.scrollTo\(\{/);
  assert.match(source, /ref=\{scrollViewRef\}/);
  assert.match(source, /onLayout=\{handleFieldLayout\("phone"\)\}/);
  assert.match(source, /onFocus=\{\(\) => handleFieldFocus\("phone"\)\}/);
  assert.match(source, /onLayout=\{handleFieldLayout\("email"\)\}/);
  assert.match(source, /onFocus=\{\(\) => handleFieldFocus\("email"\)\}/);
});

test("edit profile scrolls the last focused field whenever the keyboard reopens", () => {
  assert.match(source, /const focusedField = focusedFieldRef\.current/);
  assert.match(source, /if \(focusedField\) \{\s*scrollFocusedFieldIntoView\(focusedField\);/s);
  assert.match(source, /setIsKeyboardVisible\(true\);[\s\S]*scrollFocusedFieldIntoView\(focusedField\);/s);
});
