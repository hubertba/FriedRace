import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { vehicleById } from "../content/vehicles";
import { loadProfile } from "../domain/persistence";
import { KeyboardInput } from "../input/KeyboardInput";
import { VehicleRuntime } from "../simulation/VehicleRuntime";
import { Hud } from "../ui/Hud";
import { ChaseCamera } from "../world/ChaseCamera";
import { createWorld, type WorldDefinition } from "../world/createWorld";

export class GameApp {
  private readonly canvas = document.createElement("canvas");
  private readonly loadingStatus = document.createElement("div");
  private renderer?: THREE.WebGLRenderer;
  private keyboard?: KeyboardInput;
  private world?: WorldDefinition;
  private vehicle?: VehicleRuntime;
  private frame = 0;
  private previousTime = 0;
  private resizeHandler?: () => void;

  constructor(private readonly root: HTMLElement) {
    this.canvas.dataset.gameCanvas = "";
    this.canvas.setAttribute("aria-label", "Fried Race Spielfläche");
    this.loadingStatus.dataset.testid = "loading-status";
    this.loadingStatus.className = "loading-status";
    this.loadingStatus.textContent = "Fried Race wird geladen …";
  }

  async start(): Promise<void> {
    this.root.replaceChildren(this.canvas, this.loadingStatus);
    await RAPIER.init();
    const profile = loadProfile(localStorage);
    const activeVehicle = vehicleById(profile.activeVehicleId);
    if (!activeVehicle) throw new Error("Active vehicle is missing from catalog");

    const scene = new THREE.Scene();
    const physics = new RAPIER.World({ x: 0, y: -20, z: 0 });
    this.world = createWorld(scene, physics);
    const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 2500);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    const body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.world.spawn.x, this.world.spawn.y, this.world.spawn.z)
        .setLinearDamping(0.4)
        .setAngularDamping(8),
    );
    physics.createCollider(RAPIER.ColliderDesc.cuboid(1, 0.45, 2.1).setFriction(1.2), body);
    this.vehicle = new VehicleRuntime(body, scene, this.world.spawn, activeVehicle);
    this.keyboard = new KeyboardInput();
    const chaseCamera = new ChaseCamera(camera);
    const hud = new Hud();
    hud.resetButton.addEventListener("click", () => this.vehicle?.reset());
    this.root.append(hud.element);

    const attribution = document.createElement("a");
    attribution.className = "osm-attribution";
    attribution.href = this.world.map.attributionUrl;
    attribution.target = "_blank";
    attribution.rel = "noreferrer";
    attribution.textContent = this.world.map.attribution;
    this.root.append(attribution);

    this.resizeHandler = () => {
      const width = this.root.clientWidth || innerWidth;
      const height = this.root.clientHeight || innerHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      this.renderer?.setSize(width, height, false);
    };
    addEventListener("resize", this.resizeHandler);
    this.resizeHandler();
    this.loadingStatus.remove();

    const tick = (time: number): void => {
      const dt = Math.min((time - this.previousTime) / 1000 || 1 / 60, 0.05);
      this.previousTime = time;
      const driveInput = this.keyboard!.sample();
      this.vehicle!.update(driveInput, dt);
      if (this.keyboard!.isPressed("KeyR")) this.vehicle!.reset();
      physics.step();
      chaseCamera.update(this.vehicle!.object, dt);
      hud.render({ speedKph: this.vehicle!.speedKph(), money: profile.money });
      this.renderer!.render(scene, camera);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.keyboard?.dispose();
    if (this.resizeHandler) removeEventListener("resize", this.resizeHandler);
    this.world?.dispose();
    this.renderer?.dispose();
    this.root.replaceChildren();
  }
}
