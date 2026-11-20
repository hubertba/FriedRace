import { describe, expect, test } from "vitest";
import { createInitialProfile } from "../../src/app/createInitialProfile";
import { VEHICLES } from "../../src/content/vehicles";
import { purchaseVehicle } from "../../src/domain/economy";
import type { PlayerProfile, VehicleDefinition } from "../../src/domain/types";

const vehicle = (id: string, price = 25_000): VehicleDefinition => ({
  id,
  name: id,
  price,
  class: "road",
  topSpeedKph: 180,
  acceleration: 20,
  braking: 30,
  steering: 1,
  offroadGrip: 0.5,
  rarity: 1,
  modelKey: "placeholder",
});

const profile = (money: number, ownedVehicleIds: string[] = ["mitsubishi-eclipse-1995"]): PlayerProfile => ({
  money,
  ownedVehicleIds,
  activeVehicleId: ownedVehicleIds[0]!,
  bestTimes: {},
  completedEvents: [],
});

describe("player economy", () => {
  test("creates the agreed starter profile", () => {
    expect(createInitialProfile()).toMatchObject({
      money: 30_000,
      ownedVehicleIds: ["mitsubishi-eclipse-1995"],
      activeVehicleId: "mitsubishi-eclipse-1995",
    });
  });

  test("blocks purchases without enough money", () => {
    const result = purchaseVehicle(profile(20_000), vehicle("car-a"));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient-funds");
    expect(result.profile.money).toBe(20_000);
  });

  test("deducts the price and grants a purchased vehicle immutably", () => {
    const original = profile(30_000);
    const result = purchaseVehicle(original, vehicle("car-a"));
    expect(result.ok).toBe(true);
    expect(result.profile.money).toBe(5_000);
    expect(result.profile.ownedVehicleIds).toContain("car-a");
    expect(original.ownedVehicleIds).not.toContain("car-a");
  });

  test("blocks a duplicate purchase", () => {
    expect(purchaseVehicle(profile(30_000, ["car-a"]), vehicle("car-a")).reason).toBe("already-owned");
  });

  test("provides positive handling values for each required class", () => {
    expect(new Set(VEHICLES.map((item) => item.class))).toEqual(new Set(["road", "rally", "offroad"]));
    for (const item of VEHICLES) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.topSpeedKph).toBeGreaterThan(0);
      expect(item.acceleration).toBeGreaterThan(0);
      expect(item.braking).toBeGreaterThan(0);
      expect(item.steering).toBeGreaterThan(0);
    }
  });
});
