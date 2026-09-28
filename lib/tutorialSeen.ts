/**
 * tutorialSeen — the local mirror of `users.tutorialSeenAt`.
 *
 * The server stamp is the durable, cross-device record. This mirror exists so
 * a failed or slow write cannot show a driver the phone-mock tour twice.
 *
 * NAMESPACED PER USER. v1 was one device-wide key, so the mirror outlived the
 * account it belonged to: once ANY account finished the tour on a device,
 * every later account on that device was treated as having seen it. That is
 * #306. The stamp it mirrors is per-account, so the mirror has to be too.
 *
 * Lives here rather than in the Home screen because CoachMarkHost needs the
 * same answer — see the `first_run` trigger. Two readers, one definition.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const tutorialSeenKey = (userId: string) =>
  `otopair.tutorialSeen.v2.${userId}`;

/**
 * True when this account has finished or skipped the tour on this device,
 * according to the local mirror alone. Callers should OR this with the server
 * stamp, never replace it — the mirror is device-local and says nothing about
 * what happened on the driver's other phone.
 */
export async function readTutorialSeenLocal(
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await AsyncStorage.getItem(tutorialSeenKey(userId))) != null;
  } catch {
    return false;
  }
}
