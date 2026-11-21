import type { Point2 } from "../domain/waypointChallenge";
import type { RallyDefinition } from "../domain/rally";

export const createStarterRally = (origin: Point2): RallyDefinition => ({
  id: "oberwart-gravel-sprint",
  name: "Oberwart Gravel Sprint",
  allowedClasses: ["rally", "offroad"],
  start: { x: origin.x + 25, z: origin.z - 20 },
  checkpoints: [
    { x: origin.x + 55, z: origin.z - 40 },
    { x: origin.x + 75, z: origin.z + 10 },
    { x: origin.x + 35, z: origin.z + 45 },
  ],
  finish: { x: origin.x + 25, z: origin.z - 20 },
  moneyReward: 8_000,
  mysteryBoxes: 1,
  targetTimeMs: 120_000,
  maxCourseDistance: 55,
});
