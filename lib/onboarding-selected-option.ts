/**
 * Pure re-entry rule for the single-select onboarding questions. NO React /
 * native imports — imported directly by Vitest.
 *
 * These steps keep the option *id* in the onboarding store, but the answer they
 * save to Convex is the option *label*, and app/(onboarding)/index.tsx
 * rehydrates the same store field from that saved answer as soon as it lands.
 * So by the time the user steps back, the store holds a label: truthy, which
 * kept Continue enabled, but equal to no option id, so nothing was highlighted.
 * Accept either shape and always answer with the id.
 */
export function resolveSelectedOptionId(
  options: readonly { id: string; label: string }[],
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  return options.find((option) => option.id === stored || option.label === stored)?.id ?? null;
}
