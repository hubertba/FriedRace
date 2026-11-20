import type { PlayerProfile, VehicleDefinition } from "./types";

export type PurchaseFailure = "insufficient-funds" | "already-owned";

export interface PurchaseResult {
  ok: boolean;
  reason?: PurchaseFailure;
  profile: PlayerProfile;
}

export const purchaseVehicle = (
  profile: PlayerProfile,
  vehicle: VehicleDefinition,
): PurchaseResult => {
  if (profile.ownedVehicleIds.includes(vehicle.id)) {
    return { ok: false, reason: "already-owned", profile };
  }
  if (profile.money < vehicle.price) {
    return { ok: false, reason: "insufficient-funds", profile };
  }
  return {
    ok: true,
    profile: {
      ...profile,
      money: profile.money - vehicle.price,
      ownedVehicleIds: [...profile.ownedVehicleIds, vehicle.id],
    },
  };
};
