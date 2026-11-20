import type { Point2 } from "../domain/waypointChallenge";
import type { RallyDefinition } from "../domain/rally";

export const createStarterRally = (origin: Point2): RallyDefinition => ({
  id: "oberwart-gravel-sprint",
  name: "Oberwart Gravel Sprint",
  allowedClasses: ["rally", "offroad"],
  start: { x: origin.x + 35, z: origin.z - 30 },
  checkpoints: [
    { x: origin.x + 90, z: origin.z - 70 },
    { x: origin.x + 130, z: origin.z + 10 },
    { x: origin.x + 65, z: origin.z + 65 },
  ],
  finish: { x: origin.x + 35, z: origin.z - 30 },
  moneyReward: 8_000,
  mysteryBoxes: 1,
});
