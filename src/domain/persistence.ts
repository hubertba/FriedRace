import { createInitialProfile } from "../app/createInitialProfile";
import { STARTER_VEHICLE_ID, VEHICLES } from "../content/vehicles";
import type { PlayerProfile } from "./types";

export const SAVE_KEY = "fried-race-save";
export const SAVE_VERSION = 1;

export interface StorageLike {
  readonly persistent?: boolean;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MemoryStorage implements StorageLike {
  readonly persistent = false;
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

export const resolveStorage = (getStorage: () => StorageLike): StorageLike => {
  try {
    const storage = getStorage();
    storage.getItem(SAVE_KEY);
    return {
      persistent: storage.persistent ?? true,
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
    };
  } catch {
    return new MemoryStorage();
  }
};

export interface SaveEnvelope {
  version: 1;
  profile: PlayerProfile;
}

const validIds = new Set(VEHICLES.map((vehicle) => vehicle.id));

const normalize = (candidate: Partial<PlayerProfile>): PlayerProfile => {
  const fallback = createInitialProfile();
  const owned = Array.isArray(candidate.ownedVehicleIds)
    ? [...new Set(candidate.ownedVehicleIds.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
    : [];
  if (!owned.includes(STARTER_VEHICLE_ID)) owned.unshift(STARTER_VEHICLE_ID);
  const active = typeof candidate.activeVehicleId === "string" && owned.includes(candidate.activeVehicleId)
    ? candidate.activeVehicleId
    : STARTER_VEHICLE_ID;
  return {
    money: typeof candidate.money === "number" && Number.isFinite(candidate.money) && candidate.money >= 0
      ? candidate.money
      : fallback.money,
    ownedVehicleIds: owned,
    activeVehicleId: active,
    bestTimes: candidate.bestTimes && typeof candidate.bestTimes === "object" ? candidate.bestTimes : {},
    completedEvents: Array.isArray(candidate.completedEvents)
      ? candidate.completedEvents.filter((item): item is string => typeof item === "string")
      : [],
  };
};

export const loadProfile = (storage: StorageLike): PlayerProfile => {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createInitialProfile();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version === 1 && parsed.profile && typeof parsed.profile === "object") {
      return normalize(parsed.profile as Partial<PlayerProfile>);
    }
    if (parsed.version === 0) {
      return normalize({
        money: parsed.money as number,
        ownedVehicleIds: parsed.cars as string[],
        activeVehicleId: parsed.activeCar as string,
      });
    }
  } catch {
    return createInitialProfile();
  }
  return createInitialProfile();
};

export const saveProfile = (storage: StorageLike, profile: PlayerProfile): boolean => {
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, profile: normalize(profile) };
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
};
