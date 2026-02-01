import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect } from 'react';
import { useOnboardingQuestionsStore } from '@/stores/useOnboardingQuestionsStore';

export function usePrefetchOnboardingQuestions() {
  const data = useQuery(api.onboarding_questions.listAllWithAnswers);
  const isLoaded = useOnboardingQuestionsStore((s) => s.isLoaded);
  const setQuestions = useOnboardingQuestionsStore((s) => s.setQuestions);

  useEffect(() => {
    if (!data || isLoaded) return;

    const questions: Record<string, (typeof data)[number]> = {};
    const answers: Record<string, (typeof data)[number]['answers']> = {};

    for (const item of data) {
      questions[item.step_name] = item;
      answers[item.step_name] = item.answers;
    }

    setQuestions(questions, answers);
  }, [data, isLoaded, setQuestions]);

  return { isLoaded: isLoaded || !!data };
}
