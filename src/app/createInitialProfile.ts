import { STARTER_VEHICLE_ID } from "../content/vehicles";
import type { PlayerProfile } from "../domain/types";

export const createInitialProfile = (): PlayerProfile => ({
  money: 30_000,
  ownedVehicleIds: [STARTER_VEHICLE_ID],
  activeVehicleId: STARTER_VEHICLE_ID,
  bestTimes: {},
  completedEvents: [],
});
