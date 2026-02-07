/**
 * No-op: Question text and options live in the app (step components).
 * Only onboarding_questions_answers table is used for persistence.
 */
export function usePrefetchOnboardingQuestions() {
  return { isLoaded: true };
}
