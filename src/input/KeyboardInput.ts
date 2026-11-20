import type { DriveInput } from "../simulation/ArcadeVehicle";

export class KeyboardInput {
  private readonly pressed = new Set<string>();
  private readonly onDown = (event: KeyboardEvent): void => { this.pressed.add(event.code); };
  private readonly onUp = (event: KeyboardEvent): void => { this.pressed.delete(event.code); };

  constructor(private readonly target: Window = window) {
    target.addEventListener("keydown", this.onDown);
    target.addEventListener("keyup", this.onUp);
  }

  sample(): DriveInput {
    const left = this.pressed.has("KeyA") ? 1 : 0;
    const right = this.pressed.has("KeyD") ? 1 : 0;
    return {
      throttle: this.pressed.has("KeyW") ? 1 : 0,
      brake: this.pressed.has("KeyS") ? 1 : 0,
      steer: right - left,
    };
  }

  isPressed(code: string): boolean { return this.pressed.has(code); }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onDown);
    this.target.removeEventListener("keyup", this.onUp);
    this.pressed.clear();
  }
}
