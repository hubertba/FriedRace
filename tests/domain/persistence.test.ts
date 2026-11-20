import { expect, test } from "vitest";
import { createInitialProfile } from "../../src/app/createInitialProfile";
import { loadProfile, SAVE_KEY, saveProfile, type StorageLike } from "../../src/domain/persistence";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

const containing = (raw: string): MemoryStorage => {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, raw);
  return storage;
};

test("round-trips a profile", () => {
  const storage = new MemoryStorage();
  const profile = { ...createInitialProfile(), money: 42_000 };
  saveProfile(storage, profile);
  expect(loadProfile(storage)).toEqual(profile);
});

test("uses the initial profile for missing or malformed saves", () => {
  expect(loadProfile(new MemoryStorage())).toEqual(createInitialProfile());
  expect(loadProfile(containing("not-json"))).toEqual(createInitialProfile());
});

test("normalizes corrupt money and unknown vehicles", () => {
  const corrupt = {
    version: 1,
    profile: {
      money: -20,
      ownedVehicleIds: ["unknown-car"],
      activeVehicleId: "unknown-car",
      bestTimes: {},
      completedEvents: [],
    },
  };
  expect(loadProfile(containing(JSON.stringify(corrupt)))).toEqual(createInitialProfile());
});

test("migrates a version zero profile", () => {
  const old = { version: 0, money: 12_000, cars: ["mitsubishi-eclipse-1995"], activeCar: "mitsubishi-eclipse-1995" };
  expect(loadProfile(containing(JSON.stringify(old)))).toMatchObject({
    money: 12_000,
    activeVehicleId: "mitsubishi-eclipse-1995",
  });
});
