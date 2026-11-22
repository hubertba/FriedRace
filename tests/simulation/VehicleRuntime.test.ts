import { expect, test, vi } from "vitest";
import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { VEHICLES } from "../../src/content/vehicles";
import { consumeFixedSteps, forwardVelocity, VehicleRuntime } from "../../src/simulation/VehicleRuntime";

test("velocity follows the same yaw as the car nose", () => {
  const right = forwardVelocity(-Math.PI / 2, 10);
  const left = forwardVelocity(Math.PI / 2, 10);
  expect(right.x).toBeCloseTo(10);
  expect(right.z).toBeCloseTo(0);
  expect(left.x).toBeCloseTo(-10);
  expect(left.z).toBeCloseTo(0);
});

test("keeps a stable visual root and disposes replaced vehicle visuals", () => {
  const body = { translation: () => ({x:0,y:1.2,z:0}), rotation: () => ({x:0,y:0,z:0,w:1}), linvel: () => ({x:0,y:0,z:0}), setTranslation: vi.fn(), setLinvel: vi.fn(), setAngvel: vi.fn(), setRotation: vi.fn() } as unknown as RAPIER.RigidBody;
  const scene = new THREE.Scene(); const runtime = new VehicleRuntime(body, scene, new THREE.Vector3(0,1.2,0), VEHICLES[0]!); const root = runtime.object;
  const oldMesh = root.getObjectByName("vehicle-body") as THREE.Mesh; const oldDispose = vi.spyOn(oldMesh.geometry, "dispose");
  runtime.setVehicle(VEHICLES[1]!);
  expect(runtime.object).toBe(root); expect(root.getObjectByName("vehicle-body")).toBeTruthy(); expect(oldDispose).toHaveBeenCalledOnce();
  const currentMesh = root.getObjectByName("vehicle-body") as THREE.Mesh; const currentDispose = vi.spyOn(currentMesh.geometry, "dispose"); runtime.dispose(); expect(currentDispose).toHaveBeenCalledOnce(); expect(scene.children).not.toContain(root);
});

test("equal wall time produces equal fixed physics steps at different refresh rates", () => {
  const simulate = (hz: number): number => {
    let accumulator = 0;
    let steps = 0;
    for (let frame = 0; frame < hz; frame += 1) {
      const result = consumeFixedSteps(accumulator, 1 / hz);
      accumulator = result.accumulator;
      steps += result.steps;
    }
    return steps;
  };
  expect(simulate(30)).toBe(60);
  expect(simulate(60)).toBe(60);
  expect(simulate(120)).toBe(60);
});
