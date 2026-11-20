import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { VehicleDefinition } from "../domain/types";
import { stepArcadeVehicle, type DriveInput } from "./ArcadeVehicle";

export const FIXED_STEP = 1 / 60;
export const forwardVelocity = (heading: number, speed: number): { x: number; z: number } => ({
  x: -Math.sin(heading) * speed,
  z: -Math.cos(heading) * speed,
});
export const consumeFixedSteps = (accumulator: number, elapsed: number): { steps: number; accumulator: number } => {
  let remaining = accumulator + Math.min(Math.max(elapsed, 0), 0.25);
  let steps = 0;
  while (remaining + Number.EPSILON >= FIXED_STEP && steps < 15) {
    remaining -= FIXED_STEP;
    steps += 1;
  }
  return { steps, accumulator: Math.max(0, remaining) };
};

export class VehicleRuntime {
  readonly object: THREE.Mesh;
  private speed = 0;
  private heading = 0;

  constructor(
    private readonly body: RAPIER.RigidBody,
    scene: THREE.Scene,
    private readonly spawn: THREE.Vector3,
    private vehicle: VehicleDefinition,
  ) {
    this.object = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.9, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.35, roughness: 0.45 }),
    );
    this.object.castShadow = true;
    scene.add(this.object);
    this.reset();
  }

  update(input: DriveInput, dt: number, onRoad = true): void {
    const grip = onRoad ? 1 : this.vehicle.offroadGrip;
    const tuning = {
      topSpeedMps: this.vehicle.topSpeedKph / 3.6,
      acceleration: this.vehicle.acceleration * grip,
      braking: this.vehicle.braking * (0.7 + grip * 0.3),
      steering: this.vehicle.steering * (0.6 + grip * 0.4),
    };
    const forces = stepArcadeVehicle({ forwardSpeedMps: this.speed }, input, tuning, dt);
    if (forces.driveForce > 0) this.speed += forces.driveForce * forces.dt;
    if (forces.driveForce < 0) this.speed = Math.max(0, this.speed + forces.driveForce * forces.dt);
    if (forces.reverseForce > 0) this.speed -= forces.reverseForce * forces.dt;
    if (!input.throttle && !input.brake) this.speed *= Math.pow(onRoad ? 0.985 : 0.96, forces.dt * 60);
    this.speed = Math.max(-tuning.topSpeedMps * 0.3, Math.min(tuning.topSpeedMps, this.speed));
    const direction = this.speed >= 0 ? 1 : -1;
    this.heading -= forces.steering * direction * Math.min(Math.abs(this.speed) / 12, 1) * forces.dt;
    const horizontal = forwardVelocity(this.heading, this.speed);
    const velocity = { ...horizontal, y: this.body.linvel().y };
    this.body.setLinvel(velocity, true);
    this.body.setRotation({ x: 0, y: Math.sin(this.heading / 2), z: 0, w: Math.cos(this.heading / 2) }, true);
  }

  reset(): void {
    this.speed = 0;
    this.heading = 0;
    this.body.setTranslation({ x: this.spawn.x, y: this.spawn.y, z: this.spawn.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.syncObject();
    document.body.dataset.atSpawn = "true";
  }

  syncAfterStep(): void { this.syncObject(); }

  teleport(point: { x: number; z: number }): void {
    this.speed = 0;
    this.body.setTranslation({ x: point.x, y: this.spawn.y, z: point.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.syncObject();
  }

  setVehicle(vehicle: VehicleDefinition): void {
    this.vehicle = vehicle;
    this.object.scale.set(vehicle.class === "offroad" ? 1.15 : 1, vehicle.class === "offroad" ? 1.25 : 1, 1);
    this.reset();
  }

  speedKph(): number { return this.speed * 3.6; }
  position(): THREE.Vector3 { return this.object.position.clone(); }

  private syncObject(): void {
    const position = this.body.translation();
    const rotation = this.body.rotation();
    this.object.position.set(position.x, position.y, position.z);
    this.object.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    if (this.object.position.distanceToSquared(this.spawn) > 1) document.body.dataset.atSpawn = "false";
  }
}
