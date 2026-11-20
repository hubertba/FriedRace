export type VehicleClass = "road" | "rally" | "offroad";

export interface VehicleDefinition {
  id: string;
  name: string;
  price: number;
  class: VehicleClass;
  topSpeedKph: number;
  acceleration: number;
  braking: number;
  steering: number;
  offroadGrip: number;
  rarity: number;
  modelKey: string;
}

export interface PlayerProfile {
  money: number;
  ownedVehicleIds: string[];
  activeVehicleId: string;
  bestTimes: Record<string, number>;
  completedEvents: string[];
}
