export interface DriveInput {
  throttle: number;
  brake: number;
  steer: number;
}

export interface VehicleMotionState { forwardSpeedMps: number; }
export interface VehicleTuning {
  topSpeedMps: number;
  acceleration: number;
  braking: number;
  steering: number;
}
export interface VehicleForces {
  driveForce: number;
  reverseForce: number;
  brakingForce: number;
  steering: number;
  dt: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const stepArcadeVehicle = (
  state: VehicleMotionState,
  input: DriveInput,
  tuning: VehicleTuning,
  dt: number,
): VehicleForces => {
  const safeDt = clamp(dt, 0, 0.05);
  const speedRatio = clamp(Math.abs(state.forwardSpeedMps) / tuning.topSpeedMps, 0, 1);
  const steeringScale = speedRatio <= 0.3 ? 1 : 1 - ((speedRatio - 0.3) / 0.7) * 0.65;
  const brakingForward = input.brake > 0 && state.forwardSpeedMps > 0.5;
  return {
    driveForce: input.throttle > 0 && state.forwardSpeedMps < tuning.topSpeedMps
      ? tuning.acceleration * input.throttle
      : brakingForward ? -tuning.braking * input.brake : 0,
    reverseForce: input.brake > 0 && state.forwardSpeedMps <= 0.5 && state.forwardSpeedMps > -tuning.topSpeedMps * 0.3
      ? tuning.acceleration * 0.55 * input.brake
      : 0,
    brakingForce: brakingForward ? tuning.braking * input.brake : 0,
    steering: clamp(input.steer, -1, 1) * tuning.steering * steeringScale,
    dt: safeDt,
  };
};
