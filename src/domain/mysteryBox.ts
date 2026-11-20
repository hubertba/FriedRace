import type { PlayerProfile, VehicleDefinition } from "./types";

export interface MysteryRewardResult {
  kind: "vehicle" | "cash";
  vehicle: VehicleDefinition;
  cash: number;
  profile: PlayerProfile;
}

export const drawMysteryReward = (
  profile: PlayerProfile,
  pool: VehicleDefinition[],
  random: () => number = Math.random,
): MysteryRewardResult => {
  if (pool.length === 0) throw new Error("Mystery pool is empty");
  const weights = pool.map((vehicle) => 1 / Math.max(1, vehicle.rarity));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.min(0.999999, Math.max(0, random())) * total;
  let vehicle = pool.at(-1)!;
  for (let index = 0; index < pool.length; index += 1) {
    cursor -= weights[index]!;
    if (cursor < 0) { vehicle = pool[index]!; break; }
  }
  if (profile.ownedVehicleIds.includes(vehicle.id)) {
    const cash = Math.floor(vehicle.price * 0.35);
    return { kind: "cash", vehicle, cash, profile: { ...profile, money: profile.money + cash } };
  }
  return {
    kind: "vehicle",
    vehicle,
    cash: 0,
    profile: { ...profile, ownedVehicleIds: [...profile.ownedVehicleIds, vehicle.id] },
  };
};
