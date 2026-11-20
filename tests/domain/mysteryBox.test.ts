import { expect, test } from "vitest";
import { drawMysteryReward } from "../../src/domain/mysteryBox";
import type { PlayerProfile, VehicleDefinition } from "../../src/domain/types";

const car = (id: string, rarity: number, price: number): VehicleDefinition => ({
  id, name: id, rarity, price, class: "road", topSpeedKph: 180,
  acceleration: 20, braking: 30, steering: 1, offroadGrip: 0.5, modelKey: id,
});
const pool = [car("common", 1, 10_000), car("rare", 4, 40_000)];
const profile = (ownedVehicleIds: string[] = []): PlayerProfile => ({
  money: 0, ownedVehicleIds, activeVehicleId: ownedVehicleIds[0] ?? "common", bestTimes: {}, completedEvents: [],
});

test("uses inverse rarity weights with deterministic random input", () => {
  expect(drawMysteryReward(profile(), pool, () => 0).vehicle.id).toBe("common");
  expect(drawMysteryReward(profile(), pool, () => 0.99).vehicle.id).toBe("rare");
});

test("adds a newly drawn vehicle exactly once", () => {
  const result = drawMysteryReward(profile(), pool, () => 0);
  expect(result.kind).toBe("vehicle");
  expect(result.profile.ownedVehicleIds).toEqual(["common"]);
});

test("converts a duplicate to thirty-five percent cash", () => {
  const result = drawMysteryReward(profile(["common"]), pool, () => 0);
  expect(result.kind).toBe("cash");
  expect(result.cash).toBe(3_500);
  expect(result.profile.money).toBe(3_500);
  expect(result.profile.ownedVehicleIds).toEqual(["common"]);
});
