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
}
export interface RallyRun { rally: RallyDefinition; startedAt: number; nextCheckpoint: number; completedAt?: number; }
export interface RallyUpdate { run: RallyRun; completed: boolean; moneyReward: number; mysteryBoxes: number; }

const near = (a: Point2, b: Point2): boolean => Math.hypot(a.x - b.x, a.z - b.z) <= 12;
export const canEnterRally = (vehicle: VehicleDefinition, rally: RallyDefinition): boolean => rally.allowedClasses.includes(vehicle.class);
export const startRally = (rally: RallyDefinition, now: number): RallyRun => ({ rally, startedAt: now, nextCheckpoint: 0 });
export const updateRally = (run: RallyRun, position: Point2, now: number): RallyUpdate => {
  if (run.completedAt !== undefined) return { run, completed: true, moneyReward: 0, mysteryBoxes: 0 };
  const next = run.rally.checkpoints[run.nextCheckpoint];
  if (next && near(position, next)) {
    return { run: { ...run, nextCheckpoint: run.nextCheckpoint + 1 }, completed: false, moneyReward: 0, mysteryBoxes: 0 };
  }
  if (!next && near(position, run.rally.finish)) {
    const completedRun = { ...run, completedAt: now };
    return { run: completedRun, completed: true, moneyReward: run.rally.moneyReward, mysteryBoxes: run.rally.mysteryBoxes };
  }
  return { run, completed: false, moneyReward: 0, mysteryBoxes: 0 };
};
