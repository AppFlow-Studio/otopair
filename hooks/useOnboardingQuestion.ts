import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";

/**
 * Hook to persist user answers to onboarding_questions_answers (Convex).
 * Question text and options are defined in each step component.
 */
export function useOnboardingQuestion(_stepName?: string) {
  const { isSignedIn } = useAuth();
  const saveQuestionAnswerMutation = useMutation(
    api.onboarding_questions_answers.saveQuestionAnswer
  );

  const saveQuestionAnswer = useCallback(
    async (questionText: string, answerText: string) => {
      if (!isSignedIn) {
        console.log("Not signed in, skipping answer save");
        return;
      }
      try {
        await saveQuestionAnswerMutation({
          question: questionText,
          answer: answerText,
        });
      } catch (error) {
        console.error("Failed to save onboarding Q&A:", error);
      }
    },
    [isSignedIn, saveQuestionAnswerMutation]
  );

  return { saveQuestionAnswer };
}
