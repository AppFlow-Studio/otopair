import { create } from 'zustand';
import { Id } from '@/convex/_generated/dataModel';

interface Question {
  _id: Id<"onboarding_questions">;
  question_text: string;
  rank: number;
  step_name: string;
  question_type: string;
  display_order: number;
  is_active: boolean;
}

interface Answer {
  _id: Id<"onboarding_question_answers">;
  question_id: Id<"onboarding_questions">;
  answer_text: string;
  answer_value: string;
  display_order: number;
  emoji?: string;
}

interface OnboardingQuestionsState {
  questions: Record<string, Question>;
  answers: Record<string, Answer[]>;
  isLoaded: boolean;

  setQuestions: (questions: Record<string, Question>, answers: Record<string, Answer[]>) => void;
  getQuestion: (stepName: string) => Question | null;
  getAnswers: (stepName: string) => Answer[];
}

export const useOnboardingQuestionsStore = create<OnboardingQuestionsState>()((set, get) => ({
  questions: {},
  answers: {},
  isLoaded: false,

  setQuestions: (questions, answers) => set({ questions, answers, isLoaded: true }),

  getQuestion: (stepName) => get().questions[stepName] ?? null,

  getAnswers: (stepName) => get().answers[stepName] ?? [],
}));
