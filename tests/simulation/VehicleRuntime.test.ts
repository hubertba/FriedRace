import { expect, test } from "vitest";
import { consumeFixedSteps, forwardVelocity } from "../../src/simulation/VehicleRuntime";

test("velocity follows the same yaw as the car nose", () => {
  const right = forwardVelocity(-Math.PI / 2, 10);
  const left = forwardVelocity(Math.PI / 2, 10);
  expect(right.x).toBeCloseTo(10);
  expect(right.z).toBeCloseTo(0);
  expect(left.x).toBeCloseTo(-10);
  expect(left.z).toBeCloseTo(0);
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
