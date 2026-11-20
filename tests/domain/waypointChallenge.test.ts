import { expect, test } from "vitest";
import { isValidWaypoint, startWaypointChallenge, updateWaypointChallenge } from "../../src/domain/waypointChallenge";

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
const start = { x: 0, z: 0 };
const target = { x: 60, z: 0 };

test("rejects non-finite and off-world waypoints", () => {
  expect(isValidWaypoint({ x: Infinity, z: 0 }, bounds)).toBe(false);
  expect(isValidWaypoint({ x: 101, z: 0 }, bounds)).toBe(false);
  expect(isValidWaypoint(target, bounds)).toBe(true);
});

test("completes within fifteen meters and rewards faster driving more", () => {
  const challenge = startWaypointChallenge(start, target, 1_000);
  const fast = updateWaypointChallenge(challenge, { x: 50, z: 0 }, 11_000);
  const slow = updateWaypointChallenge(challenge, { x: 50, z: 0 }, 61_000);
  expect(fast.completed).toBe(true);
  expect(fast.reward).toBeGreaterThan(0);
  expect(fast.reward).toBeGreaterThan(slow.reward);
});

test("does not award twice after completion", () => {
  const challenge = startWaypointChallenge(start, target, 0);
  const first = updateWaypointChallenge(challenge, target, 10_000);
  expect(updateWaypointChallenge(first.challenge, target, 11_000).reward).toBe(0);
});
