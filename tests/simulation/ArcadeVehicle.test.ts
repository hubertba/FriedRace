import { afterEach, describe, expect, test } from "vitest";
import { KeyboardInput } from "../../src/input/KeyboardInput";
import { stepArcadeVehicle, type VehicleTuning } from "../../src/simulation/ArcadeVehicle";

const tuning: VehicleTuning = { topSpeedMps: 50, acceleration: 20, braking: 30, steering: 1 };
const input = { throttle: 0, brake: 0, steer: 0 };

afterEach(() => document.body.replaceChildren());

describe("keyboard input", () => {
  test("maps W A S D and cancels opposite inputs", () => {
    const keyboard = new KeyboardInput(window);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    expect(keyboard.sample()).toEqual({ throttle: 1, brake: 0, steer: -1 });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    expect(keyboard.sample().steer).toBe(0);
    keyboard.dispose();
  });
});

describe("arcade forces", () => {
  test("brakes before applying reverse force", () => {
    const braking = stepArcadeVehicle({ forwardSpeedMps: 20 }, { ...input, brake: 1 }, tuning, 1 / 60);
    expect(braking.driveForce).toBeLessThanOrEqual(0);
    expect(braking.reverseForce).toBe(0);
    const reverse = stepArcadeVehicle({ forwardSpeedMps: 0 }, { ...input, brake: 1 }, tuning, 1 / 60);
    expect(reverse.reverseForce).toBeGreaterThan(0);
  });

  test("reduces steering at high speed", () => {
    const slow = stepArcadeVehicle({ forwardSpeedMps: 5 }, { ...input, steer: 1 }, tuning, 1 / 60);
    const fast = stepArcadeVehicle({ forwardSpeedMps: 45 }, { ...input, steer: 1 }, tuning, 1 / 60);
    expect(fast.steering).toBeLessThan(slow.steering);
  });

  test("does not accelerate past forward or reverse speed limits", () => {
    expect(stepArcadeVehicle({ forwardSpeedMps: 51 }, { ...input, throttle: 1 }, tuning, 1).driveForce).toBe(0);
    expect(stepArcadeVehicle({ forwardSpeedMps: -16 }, { ...input, brake: 1 }, tuning, 1).reverseForce).toBe(0);
  });
});
