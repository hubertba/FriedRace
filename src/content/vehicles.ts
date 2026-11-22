import type { VehicleDefinition } from "../domain/types";

export const STARTER_VEHICLE_ID = "mitsubishi-eclipse-1995";

export const VEHICLES: VehicleDefinition[] = [
  {
    id: STARTER_VEHICLE_ID,
    name: "Mitsubishi Eclipse 1995",
    price: 24_000,
    class: "road",
    topSpeedKph: 210,
    acceleration: 6,
    braking: 34,
    steering: 1,
    offroadGrip: 0.45,
    rarity: 1,
    modelKey: "eclipse-placeholder",
  },
  {
    id: "alpine-rally-rs",
    name: "Alpine Rally RS",
    price: 42_000,
    class: "rally",
    topSpeedKph: 190,
    acceleration: 7,
    braking: 38,
    steering: 1.15,
    offroadGrip: 0.85,
    rarity: 2,
    modelKey: "rally-placeholder",
  },
  {
    id: "trailmaster-4x4",
    name: "Trailmaster 4x4",
    price: 38_000,
    class: "offroad",
    topSpeedKph: 155,
    acceleration: 5,
    braking: 32,
    steering: 0.9,
    offroadGrip: 1,
    rarity: 2,
    modelKey: "offroad-placeholder",
  },
];

export const vehicleById = (id: string): VehicleDefinition | undefined =>
  VEHICLES.find((vehicle) => vehicle.id === id);
