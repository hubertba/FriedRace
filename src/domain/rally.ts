import type { Point2 } from "./waypointChallenge";
import type { VehicleClass, VehicleDefinition } from "./types";

export interface RallyDefinition {
  id: string;
  name: string;
  allowedClasses: VehicleClass[];
  start: Point2;
  checkpoints: Point2[];
  finish: Point2;
  moneyReward: number;
  mysteryBoxes: number;
  targetTimeMs: number;
  maxCourseDistance: number;
}
export interface RallyRun { rally: RallyDefinition; startedAt: number; nextCheckpoint: number; completedAt?: number; failedAt?: number; }
export interface RallyUpdate { run: RallyRun; completed: boolean; failed: boolean; moneyReward: number; mysteryBoxes: number; }

const near = (a: Point2, b: Point2): boolean => Math.hypot(a.x - b.x, a.z - b.z) <= 12;
const distanceToSegment = (point: Point2, start: Point2, end: Point2): number => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const squared = dx * dx + dz * dz;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / squared));
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
};
export const canEnterRally = (vehicle: VehicleDefinition, rally: RallyDefinition): boolean => rally.allowedClasses.includes(vehicle.class);
export const startRally = (rally: RallyDefinition, now: number): RallyRun => ({ rally, startedAt: now, nextCheckpoint: 0 });
export const updateRally = (run: RallyRun, position: Point2, now: number): RallyUpdate => {
  if (run.completedAt !== undefined) return { run, completed: true, failed: false, moneyReward: 0, mysteryBoxes: 0 };
  if (run.failedAt !== undefined) return { run, completed: false, failed: true, moneyReward: 0, mysteryBoxes: 0 };
  const course = [run.rally.start, ...run.rally.checkpoints, run.rally.finish];
  const onCourse = course.slice(1).some((point, index) => distanceToSegment(position, course[index]!, point) <= run.rally.maxCourseDistance);
  if (!onCourse || now - run.startedAt > run.rally.targetTimeMs) {
    return { run: { ...run, failedAt: now }, completed: false, failed: true, moneyReward: 0, mysteryBoxes: 0 };
  }
  const next = run.rally.checkpoints[run.nextCheckpoint];
  if (next && near(position, next)) {
    return { run: { ...run, nextCheckpoint: run.nextCheckpoint + 1 }, completed: false, failed: false, moneyReward: 0, mysteryBoxes: 0 };
  }
  if (!next && near(position, run.rally.finish)) {
    const completedRun = { ...run, completedAt: now };
    return { run: completedRun, completed: true, failed: false, moneyReward: run.rally.moneyReward, mysteryBoxes: run.rally.mysteryBoxes };
  }
  return { run, completed: false, failed: false, moneyReward: 0, mysteryBoxes: 0 };
};
