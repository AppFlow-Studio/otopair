/**
 * useServiceCopyTier — resolves which tier of service-guide copy the
 * current user should see (simple / intermediate / technician).
 *
 * Reads `car_knowledge_level` from the Convex onboarding answers
 * (authoritative for signed-in users) and falls back to the local
 * `useOnboardingStore.data.carKnowledgeLevel` for users mid-onboarding
 * who haven't synced yet. Defaults to `"simple"` when neither source
 * has a value — same friendly baseline Oto AI uses (see
 * `convex/oto/envelope.ts:knowledgeLabel`).
 *
 * Pure read; never writes. Safe to call from any screen inside the
 * authed shell.
 */

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import type { ServiceCopyTier } from "@/constants/serviceCopy";
import { resolveServiceCopyTier } from "@/lib/serviceCopyTier";

export function useServiceCopyTier(): ServiceCopyTier {
  const { userId } = useUserFromConvex();
  // Authoritative: server-side onboarding answers row.
  const serverLevel = useQuery(
    api.onboarding_questions_answers.getCarKnowledgeLevelForUser,
    userId ? { user_id: userId } : "skip",
  );
  // Local fallback: the user just finished the ExperienceStep but the
  // sync round-trip hasn't landed yet, OR they're a returning user
  // whose store is hydrated faster than the network query.
  const localLevel = useOnboardingStore((s) => s.data.carKnowledgeLevel);

  // Prefer server when it's loaded AND has a value. `undefined` means
  // still loading; `null` means the row exists but never answered.
  // In both of those cases fall back to local so we don't flicker
  // from "technician" → "simple" → "technician" on first render.
  const effective =
    serverLevel !== undefined && serverLevel !== null
      ? serverLevel
      : localLevel;
  return resolveServiceCopyTier(effective);
}
