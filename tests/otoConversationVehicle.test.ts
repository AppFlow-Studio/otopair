/**
 * #430 (Oyelade, Sep 27): the Oto header showed the same yellow Mercedes above
 * the Jeep brakes chat and the Mercedes chat alike. Opening a conversation from
 * Recents never looked at the car it is anchored to.
 */
import { describe, expect, it } from "vitest";
import { anchoredConversationVin } from "../lib/otoConversationVehicle";

const garage = [
  { vin: "1C4PJMDX5KD000001", vehicle: { _id: "veh_jeep" } },
  { vin: "WDBSK74F85F000002", vehicle: { _id: "veh_sl55" } },
];
const conversations = [
  { _id: "conv_jeep", vehicle_id: "veh_jeep" },
  { _id: "conv_sl55", vehicle_id: "veh_sl55" },
  { _id: "conv_old" },
  { _id: "conv_sold", vehicle_id: "veh_gone" },
];

describe("the header follows the open conversation's car", () => {
  it("returns each conversation's own car", () => {
    expect(anchoredConversationVin(conversations, "conv_jeep", garage)).toBe("1C4PJMDX5KD000001");
    expect(anchoredConversationVin(conversations, "conv_sl55", garage)).toBe("WDBSK74F85F000002");
  });

  it("keeps the current car for a conversation with no anchor", () => {
    expect(anchoredConversationVin(conversations, "conv_old", garage)).toBeNull();
  });

  it("keeps the current car when the anchored car is no longer in the garage", () => {
    expect(anchoredConversationVin(conversations, "conv_sold", garage)).toBeNull();
  });

  it("waits while the conversation list or garage is still loading", () => {
    expect(anchoredConversationVin(undefined, "conv_jeep", garage)).toBeNull();
    expect(anchoredConversationVin(conversations, "conv_jeep", undefined)).toBeNull();
  });

  it("does nothing before the first message creates a conversation", () => {
    expect(anchoredConversationVin(conversations, null, garage)).toBeNull();
  });
});
