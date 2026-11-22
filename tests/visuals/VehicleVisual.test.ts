import { expect, test } from "vitest";
import * as THREE from "three";
import { VEHICLES } from "../../src/content/vehicles";
import { createVehicleVisual, loadOptionalVehicleVisual } from "../../src/visuals/VehicleVisual";

test("builds an unbranded detailed coupe with wheels, glass, and lights", () => {
  const visual = createVehicleVisual(VEHICLES[0]!); const names: string[] = []; let shadowMeshes = 0;
  visual.traverse((object) => { names.push(object.name.toLowerCase()); if (object instanceof THREE.Mesh && object.castShadow) shadowMeshes += 1; });
  expect(names).toContain("vehicle-body"); expect(names).toContain("vehicle-glass");
  expect(names.filter((name) => name.startsWith("tyre-")).length).toBe(4);
  expect(names.filter((name) => name.startsWith("rim-")).length).toBe(4);
  expect(names.filter((name) => name.startsWith("headlight-")).length).toBe(2);
  expect(names.filter((name) => name.startsWith("taillight-")).length).toBe(2);
  expect(names.join(" ")).not.toMatch(/mitsubishi|eclipse|alpine|trailmaster/);
  expect(shadowMeshes).toBeGreaterThan(8);
});

test("uses class-specific coupe proportions", () => {
  const road = createVehicleVisual(VEHICLES[0]!); const rally = createVehicleVisual(VEHICLES[1]!); const offroad = createVehicleVisual(VEHICLES[2]!);
  expect(rally.scale.y).toBeGreaterThan(road.scale.y);
  expect(offroad.scale.y).toBeGreaterThan(rally.scale.y);
  expect(offroad.scale.x).toBeGreaterThan(road.scale.x);
});

test("keeps the generated visual when an optional asset fails", async () => {
  await expect(loadOptionalVehicleVisual("/missing.glb", async () => { throw new Error("missing"); })).resolves.toBeNull();
});
