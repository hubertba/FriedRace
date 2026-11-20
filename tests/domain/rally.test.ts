import { expect, test } from "vitest";
import { canEnterRally, startRally, updateRally, type RallyDefinition } from "../../src/domain/rally";
import type { VehicleDefinition } from "../../src/domain/types";

const rally: RallyDefinition = {
  id: "test-rally", name: "Test Rally", allowedClasses: ["rally", "offroad"],
  start: { x: 0, z: 0 }, checkpoints: [{ x: 20, z: 0 }, { x: 40, z: 0 }], finish: { x: 60, z: 0 },
  moneyReward: 5_000, mysteryBoxes: 1,
};
const vehicle = (vehicleClass: VehicleDefinition["class"]): VehicleDefinition => ({
  id: vehicleClass, name: vehicleClass, class: vehicleClass, price: 1, topSpeedKph: 1,
  acceleration: 1, braking: 1, steering: 1, offroadGrip: 1, rarity: 1, modelKey: "x",
});

test("restricts entry by vehicle class", () => {
  expect(canEnterRally(vehicle("road"), rally)).toBe(false);
  expect(canEnterRally(vehicle("rally"), rally)).toBe(true);
  expect(canEnterRally(vehicle("offroad"), rally)).toBe(true);
});

test("requires checkpoints in order and rejects a finish shortcut", () => {
  let run = startRally(rally, 0);
  expect(updateRally(run, rally.finish, 1_000).completed).toBe(false);
  expect(updateRally(run, rally.checkpoints[1]!, 2_000).run.nextCheckpoint).toBe(0);
  run = updateRally(run, rally.checkpoints[0]!, 3_000).run;
  expect(run.nextCheckpoint).toBe(1);
  run = updateRally(run, rally.checkpoints[1]!, 4_000).run;
  const finish = updateRally(run, rally.finish, 5_000);
  expect(finish).toMatchObject({ completed: true, moneyReward: 5_000, mysteryBoxes: 1 });
  expect(updateRally(finish.run, rally.finish, 6_000).moneyReward).toBe(0);
});
