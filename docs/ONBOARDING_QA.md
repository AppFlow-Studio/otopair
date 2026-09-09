# Onboarding Q&A (Unified Table)

**Purpose:** Document the unified onboarding Q&A storage used for the data intelligence track.  
**See also:** [REFERENCE.md](./REFERENCE.md) (schema overview), [diagrams.md](./diagrams.md) (Part 6).

---

## Overview

User answers from onboarding and “Tell us about you” flows are stored in a **single table** per user: **`onboarding_questions_answers`**. Each row holds a JSON-shaped array of question–answer pairs and a **last updated** timestamp.

- **One row per user** (indexed by `user_id`).
- **`questions_and_answers`:** array of `{ question: string, answer: string }`.
- **`user_intentions`:** optional `{ question: string, intentions: string[] }` (question + intent ids).
- **`car_knowledge_level`:** optional self-reported auto knowledge (1–3 from experience step).
- **`last_updated`:** Unix timestamp; set on every save (create or upsert).

There is **only one table** for onboarding Q&A: **`onboarding_questions_answers`**. Question text and answer options are defined in the app (step components); the database only stores the user’s answers.

---

## Table

| Table | Purpose |
| ----- | ------- |
| **onboarding_questions_answers** | One row per user: `user_id`, `questions_and_answers`, optional `user_intentions`, optional `car_knowledge_level`, `last_updated`. |

---

## Convex API

**Module:** `convex/onboarding_questions_answers.ts`

| Function | Type | Description |
| -------- | ---- | ----------- |
| **saveQuestionAnswer** | mutation | Args: `question: string`, `answer: string`. Upserts one row per user: appends or replaces the entry for that question in `questions_and_answers`, and sets `last_updated`. |
| **saveUserIntentions** | mutation | Args: `question: string`, `intentions: string[]`. Sets `user_intentions: { question, intentions }` and `last_updated`. |
| **saveCarKnowledgeLevel** | mutation | Args: `level: number`. Sets `car_knowledge_level` and `last_updated`. |
| **getMyQuestionsAndAnswers** | query | Returns the current user’s row (or null). |

---

## Frontend usage

- **Hook:** `hooks/useOnboardingQuestion.ts` — returns `saveQuestionAnswer(questionText, answerText)`.
- **Steps:** Tell Us About steps call `saveQuestionAnswer(questionText, answerLabelOrLabels)`. UserIntentStep (onboarding) calls `saveUserIntentions(question, intentions)` to set **`user_intentions`** (question + intent ids).

Question text and options live in the app (step components); **persistence** uses `saveQuestionAnswer` and `saveUserIntentions`.

When the user completes the Tell Us About flow, the app also sets **`users.tellUsAboutCompleted = true`** via `users.updateProfile({ tellUsAboutCompleted: true })`. That flag is used by the home **Finish setup card** to grey out the “About You” step (and persists across reloads). See [REFERENCE.md](./REFERENCE.md) § Finish setup card (home).

---

## Example JSON (questions_and_answers)

```json
[
  { "question": "How would you explain your experience with cars in general?", "answer": "I prefer things explained to me" },
  { "question": "What do you want to use Otopair for?", "answer": "Find a shop, Understand car maintenance" }
]
```

---

## Seed and reassign

- **Seed:** `convex/seed.ts` inserts into `onboarding_questions_answers` (e.g. demo user with one Q&A pair) and uses `last_updated`.
- **Reassign:** `claimSeedDataForCurrentUser` reassigns `onboarding_questions_answers` rows from seed user to current user (by `user_id`).
- **Clear:** `TABLES_TO_CLEAR` includes `onboarding_questions_answers` for reset flows.

---

**Last updated:** February 2026.
