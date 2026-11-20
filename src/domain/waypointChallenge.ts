import type { WorldBounds } from "../world/worldBounds";

export interface Point2 { x: number; z: number; }
export interface WaypointChallenge {
  start: Point2;
  target: Point2;
  startedAt: number;
  distance: number;
  completedAt?: number;
}
export interface WaypointUpdate { challenge: WaypointChallenge; completed: boolean; reward: number; }

const distance = (a: Point2, b: Point2): number => Math.hypot(a.x - b.x, a.z - b.z);

export const isValidWaypoint = (point: Point2, bounds: WorldBounds): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.z)
  && point.x >= bounds.minX && point.x <= bounds.maxX
  && point.z >= bounds.minZ && point.z <= bounds.maxZ;

export const startWaypointChallenge = (start: Point2, target: Point2, now: number): WaypointChallenge => {
  if (![start.x, start.z, target.x, target.z, now].every(Number.isFinite)) throw new Error("Waypoint values must be finite");
  const routeDistance = distance(start, target);
  if (routeDistance <= 15) throw new Error("Waypoint must be farther than the arrival radius");
  return {
    start: { ...start },
    target: { ...target },
    startedAt: now,
    distance: routeDistance,
  };
};

export const updateWaypointChallenge = (
  challenge: WaypointChallenge,
  position: Point2,
  now: number,
): WaypointUpdate => {
  if (challenge.completedAt !== undefined || distance(position, challenge.target) > 15) {
    return { challenge, completed: challenge.completedAt !== undefined, reward: 0 };
  }
  const seconds = Math.max(1, (now - challenge.startedAt) / 1000);
  const targetSeconds = Math.max(8, challenge.distance / 18);
  const speedBonus = Math.max(0.25, Math.min(2.5, targetSeconds / seconds));
  const reward = 100 + Math.round(challenge.distance * 1.2 * speedBonus);
  return { challenge: { ...challenge, completedAt: now }, completed: true, reward };
};
