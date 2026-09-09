export const ACTION_CARD_HEIGHT_ANIMATION_DURATION_MS = 280;

type DirectHeightTransition = {
  mode: "direct";
  height: number;
};

type AnimatedHeightTransition = {
  mode: "animated";
  height: number;
  duration: typeof ACTION_CARD_HEIGHT_ANIMATION_DURATION_MS;
};

export type ActionCardHeightTransition =
  | DirectHeightTransition
  | AnimatedHeightTransition;

export function getCarouselHeightTransition(
  containerHeight: number | undefined,
  hasAppliedInitialHeight: boolean,
): ActionCardHeightTransition | null {
  if (containerHeight == null) return null;

  if (!hasAppliedInitialHeight) {
    return {
      mode: "direct",
      height: containerHeight,
    };
  }

  return {
    mode: "animated",
    height: containerHeight,
    duration: ACTION_CARD_HEIGHT_ANIMATION_DURATION_MS,
  };
}
