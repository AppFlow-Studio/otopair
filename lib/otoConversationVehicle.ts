/**
 * Which garage car an Oto conversation is about (#430).
 *
 * Each conversation is anchored server-side to the car it was started for
 * (`ai_conversations.vehicle_id`), and Oto answers about that car. Returns the
 * anchored car's VIN when the driver still owns it; null when the
 * conversation has no anchor, isn't loaded yet, or its car is no longer in
 * the garage — the caller then keeps its current car, which is what the
 * server falls back to as well (convex/oto/envelope.ts pickActiveVehicleRow).
 */
export function anchoredConversationVin(
  conversations: readonly { _id: string; vehicle_id?: string }[] | undefined,
  conversationId: string | null,
  garage: readonly { vin: string; vehicle?: { _id?: string } | null }[] | undefined,
): string | null {
  if (!conversationId) return null;
  const anchor = conversations?.find((row) => row._id === conversationId)?.vehicle_id;
  if (!anchor) return null;
  return garage?.find((row) => row.vehicle?._id === anchor)?.vin ?? null;
}
