import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { VEHICLES, vehicleById } from "../content/vehicles";
import { purchaseVehicle } from "../domain/economy";
import { loadProfile, saveProfile } from "../domain/persistence";
import { startWaypointChallenge, updateWaypointChallenge, type WaypointChallenge } from "../domain/waypointChallenge";
import { KeyboardInput } from "../input/KeyboardInput";
import { VehicleRuntime } from "../simulation/VehicleRuntime";
import { GarageMenu } from "../ui/GarageMenu";
import { Hud } from "../ui/Hud";
import { MapOverlay } from "../ui/MapOverlay";
import { MysteryBoxView } from "../ui/MysteryBoxView";
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
  private mapKeyHandler?: (event: KeyboardEvent) => void;

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
    let profile = loadProfile(localStorage);
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

    const mapOverlay = new MapOverlay(this.world.map, this.world.bounds);
    this.root.append(mapOverlay.openButton, mapOverlay.element);
    const garage = new GarageMenu();
    garage.render(profile, VEHICLES);
    garage.onBuy((vehicleId) => {
      const vehicle = vehicleById(vehicleId);
      if (!vehicle) return;
      const result = purchaseVehicle(profile, vehicle);
      profile = result.profile;
      if (result.ok) saveProfile(localStorage, profile);
      garage.render(profile, VEHICLES);
    });
    garage.onSelect((vehicleId) => {
      const vehicle = vehicleById(vehicleId);
      if (!vehicle || !profile.ownedVehicleIds.includes(vehicleId)) return;
      profile = { ...profile, activeVehicleId: vehicleId };
      saveProfile(localStorage, profile);
      this.vehicle!.setVehicle(vehicle);
      garage.render(profile, VEHICLES);
    });
    const mysteryView = new MysteryBoxView();
    this.root.append(garage.openButton, garage.element, mysteryView.element);
    let waypoint: WaypointChallenge | undefined;
    let waypointMarker: THREE.Mesh | undefined;
    mapOverlay.onConfirm((target) => {
      const position = this.vehicle!.position();
      waypoint = startWaypointChallenge({ x: position.x, z: position.z }, target, performance.now());
      if (waypointMarker) scene.remove(waypointMarker);
      waypointMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 12, 16),
        new THREE.MeshStandardMaterial({ color: 0xe53935, transparent: true, opacity: 0.75 }),
      );
      waypointMarker.position.set(target.x, 6, target.z);
      scene.add(waypointMarker);
    });
    this.mapKeyHandler = (event) => {
      if (event.repeat) return;
      if (event.code === "KeyM") mapOverlay.toggle();
      if (event.code === "KeyG" && !garage.openButton.disabled) garage.toggle();
    };
    addEventListener("keydown", this.mapKeyHandler);

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
      const inMenu = mapOverlay.isOpen || garage.isOpen;
      const driveInput = inMenu ? { throttle: 0, brake: 0, steer: 0 } : this.keyboard!.sample();
      this.vehicle!.update(driveInput, dt);
      if (this.keyboard!.isPressed("KeyR")) this.vehicle!.reset();
      physics.step();
      chaseCamera.update(this.vehicle!.object, dt);
      const garageDistance = this.vehicle!.position().distanceTo(this.world!.spawn);
      garage.setAvailable(garageDistance < 28 && Math.abs(this.vehicle!.speedKph()) < 3);
      let timerText = garageDistance < 28 ? "Garage: G" : "Freie Fahrt";
      if (waypoint) {
        const position = this.vehicle!.position();
        const update = updateWaypointChallenge(waypoint, { x: position.x, z: position.z }, time);
        waypoint = update.challenge;
        const remaining = Math.hypot(position.x - waypoint.target.x, position.z - waypoint.target.z);
        timerText = update.completed ? `Ziel! +€${update.reward}` : `Wegpunkt ${Math.round(remaining)} m`;
        if (update.reward > 0) {
          profile = { ...profile, money: profile.money + update.reward };
          saveProfile(localStorage, profile);
          waypoint = undefined;
          if (waypointMarker) scene.remove(waypointMarker);
        }
      }
      hud.render({ speedKph: this.vehicle!.speedKph(), money: profile.money, timerText });
      this.renderer!.render(scene, camera);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.keyboard?.dispose();
    if (this.resizeHandler) removeEventListener("resize", this.resizeHandler);
    if (this.mapKeyHandler) removeEventListener("keydown", this.mapKeyHandler);
    this.world?.dispose();
    this.renderer?.dispose();
    this.root.replaceChildren();
  }
}
