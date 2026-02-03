import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useOnboardingQuestionsStore } from "@/stores/useOnboardingQuestionsStore";

/**
 * Hook for Tell-Us-About steps to read question data from the Zustand cache
 * and persist user answers to Convex.
 */
export function useOnboardingQuestion(stepName: string) {
  const { isSignedIn } = useAuth();
  const question = useOnboardingQuestionsStore((s) => s.questions[stepName]) ?? null;
  const answers = useOnboardingQuestionsStore((s) => s.answers[stepName]) ?? [];
  const isLoaded = useOnboardingQuestionsStore((s) => s.isLoaded);

  const saveAnswerMutation = useMutation(api.user_question_answers.saveAnswer);

  const saveAnswer = useCallback(
    async (params: {
      answerId?: Id<"onboarding_question_answers">;
      answerIds?: Id<"onboarding_question_answers">[];
      freeTextAnswer?: string;
    }) => {
      if (!isSignedIn || !question) {
        console.log("Not signed in or no question, skipping answer save");
        return;
      }
      try {
        await saveAnswerMutation({
          questionId: question._id,
          answerId: params.answerId,
          answerIds: params.answerIds,
          freeTextAnswer: params.freeTextAnswer,
        });
      } catch (error) {
        console.error("Failed to save answer:", error);
      }
    },
    [isSignedIn, question, saveAnswerMutation]
  );

  return {
    question,
    answers,
    isLoading: !isLoaded,
    saveAnswer,
  };
}
