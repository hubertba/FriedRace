import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createStarterRally } from "../content/events";
import { VEHICLES, vehicleById } from "../content/vehicles";
import { purchaseVehicle } from "../domain/economy";
import { drawMysteryReward } from "../domain/mysteryBox";
import { loadProfile, resolveStorage, saveProfile } from "../domain/persistence";
import { canEnterRally, startRally, updateRally, type RallyRun } from "../domain/rally";
import { startWaypointChallenge, updateWaypointChallenge, type WaypointChallenge } from "../domain/waypointChallenge";
import { KeyboardInput } from "../input/KeyboardInput";
import { consumeFixedSteps, FIXED_STEP, VehicleRuntime } from "../simulation/VehicleRuntime";
import { GarageMenu } from "../ui/GarageMenu";
import { Hud } from "../ui/Hud";
import { MapOverlay } from "../ui/MapOverlay";
import { MysteryBoxView } from "../ui/MysteryBoxView";
import { ChaseCamera } from "../world/ChaseCamera";
import { createWorld, type WorldDefinition } from "../world/createWorld";
import { containsPoint } from "../world/worldBounds";

const DIRECTION_ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

export class GameApp {
  private readonly canvas = document.createElement("canvas");
  private readonly loadingStatus = document.createElement("div");
  private renderer?: THREE.WebGLRenderer;
  private physics?: RAPIER.World;
  private keyboard?: KeyboardInput;
  private world?: WorldDefinition;
  private vehicle?: VehicleRuntime;
  private frame = 0;
  private previousTime = 0;
  private resizeHandler?: () => void;
  private mapKeyHandler?: (event: KeyboardEvent) => void;
  private hasTestHooks = false;

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
    const storage = resolveStorage(() => window.localStorage);
    let saveWarning = storage.persistent === false;
    let profile = loadProfile(storage);
    const persist = (): void => { if (!saveProfile(storage, profile)) saveWarning = true; };
    const activeVehicle = vehicleById(profile.activeVehicleId);
    if (!activeVehicle) throw new Error("Active vehicle is missing from catalog");

    const scene = new THREE.Scene();
    const physics = new RAPIER.World({ x: 0, y: -20, z: 0 });
    physics.timestep = FIXED_STEP;
    this.physics = physics;
    this.world = await createWorld(scene, physics);
    await this.world.updateMap(this.world.spawn);
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
    this.root.append(hud.element);

    const mapOverlay = new MapOverlay(this.world.map, this.world.bounds);
    this.root.append(mapOverlay.openButton, mapOverlay.element);
    const garage = new GarageMenu();
    garage.render(profile, VEHICLES);
    const mysteryView = new MysteryBoxView();
    const rally = createStarterRally({ x: this.world.spawn.x, z: this.world.spawn.z });
    let waypoint: WaypointChallenge | undefined;
    let waypointMarker: THREE.Mesh | undefined;
    let rallyRun: RallyRun | undefined;
    let statusMessage = "";
    let statusUntil = 0;

    const disposeWaypointMarker = (): void => {
      if (!waypointMarker) return;
      scene.remove(waypointMarker);
      waypointMarker.geometry.dispose();
      const material = waypointMarker.material;
      (Array.isArray(material) ? material : [material]).forEach((entry) => entry.dispose());
      waypointMarker = undefined;
    };
    const cancelActiveEvent = (message = ""): void => {
      const hadEvent = Boolean(waypoint || rallyRun);
      waypoint = undefined;
      rallyRun = undefined;
      disposeWaypointMarker();
      this.world!.setActiveRallyGate(null);
      if (hadEvent && message) {
        statusMessage = message;
        statusUntil = performance.now() + 2200;
      }
    };
    const resetCar = (): void => {
      cancelActiveEvent("Event abgebrochen");
      this.vehicle!.reset();
    };
    hud.resetButton.addEventListener("click", resetCar);

    garage.onBuy((vehicleId) => {
      const vehicle = vehicleById(vehicleId);
      if (!vehicle) return;
      const result = purchaseVehicle(profile, vehicle);
      profile = result.profile;
      if (result.ok) persist();
      garage.render(profile, VEHICLES);
    });
    garage.onSelect((vehicleId) => {
      const vehicle = vehicleById(vehicleId);
      if (!vehicle || !profile.ownedVehicleIds.includes(vehicleId)) return;
      cancelActiveEvent("Event wegen Fahrzeugwechsel abgebrochen");
      profile = { ...profile, activeVehicleId: vehicleId };
      persist();
      this.vehicle!.setVehicle(vehicle);
      garage.render(profile, VEHICLES);
    });

    const rallyButton = document.createElement("button");
    rallyButton.className = "rally-button";
    rallyButton.dataset.testid = "start-rally";
    rallyButton.textContent = "Rallye starten";
    rallyButton.disabled = true;
    rallyButton.addEventListener("click", () => {
      const vehicle = vehicleById(profile.activeVehicleId);
      if (!waypoint && vehicle && canEnterRally(vehicle, rally)) {
        rallyRun = startRally(rally, performance.now());
        this.world!.setActiveRallyGate(1);
      }
    });
    this.root.append(garage.openButton, garage.element, mysteryView.element, rallyButton);

    mapOverlay.onConfirm((target) => {
      if (rallyRun) return;
      const position = this.vehicle!.position();
      try {
        waypoint = startWaypointChallenge({ x: position.x, z: position.z }, target, performance.now());
      } catch {
        statusMessage = "Wegpunkt muss weiter entfernt sein";
        statusUntil = performance.now() + 2200;
        return;
      }
      disposeWaypointMarker();
      waypointMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 12, 16),
        new THREE.MeshStandardMaterial({ color: 0xe53935, transparent: true, opacity: 0.75 }),
      );
      waypointMarker.position.set(target.x, 6, target.z);
      scene.add(waypointMarker);
    });

    if (import.meta.env.DEV && new URLSearchParams(location.search).get("e2e") === "1") {
      this.hasTestHooks = true;
      (window as typeof window & { __friedRaceTest?: unknown }).__friedRaceTest = {
        profile: () => structuredClone(profile),
        setMoney: (money: number) => {
          profile = { ...profile, money };
          persist();
          garage.render(profile, VEHICLES);
        },
        teleportToGarage: () => this.vehicle!.teleport({ x: this.world!.spawn.x, z: this.world!.spawn.z }),
        teleportToRallyStart: () => this.vehicle!.teleport(rally.start),
        teleportToNeighborTile: () => {
          const { grid } = this.world!.manifest;
          this.vehicle!.teleport({ x: grid.minX + (grid.columns - 0.5) * grid.tileSize, z: grid.minZ + (grid.rows - 0.5) * grid.tileSize });
        },
        startNearbyWaypoint: () => {
          const position = this.vehicle!.position();
          waypoint = startWaypointChallenge(
            { x: position.x, z: position.z },
            { x: position.x + 20, z: position.z },
            performance.now(),
          );
        },
        finishWaypoint: () => { if (waypoint) this.vehicle!.teleport(waypoint.target); },
        completeRally: async () => {
          for (const point of [...rally.checkpoints, rally.finish]) {
            this.vehicle!.teleport(point);
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          }
        },
      };
    }

    this.mapKeyHandler = (event) => {
      if (event.repeat) return;
      if (event.code === "KeyM" && !rallyRun) mapOverlay.toggle();
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

    let accumulator = 0;
    let resetHeld = false;
    const tick = (time: number): void => {
      const elapsed = Math.min((time - this.previousTime) / 1000 || FIXED_STEP, 0.25);
      this.previousTime = time;
      const inMenu = mapOverlay.isOpen || garage.isOpen;
      const driveInput = inMenu ? { throttle: 0, brake: 0, steer: 0 } : this.keyboard!.sample();
      const resetPressed = this.keyboard!.isPressed("KeyR");
      if (resetPressed && !resetHeld) resetCar();
      resetHeld = resetPressed;

      const fixed = consumeFixedSteps(accumulator, elapsed);
      accumulator = fixed.accumulator;
      for (let step = 0; step < fixed.steps; step += 1) {
        const position = this.vehicle!.position();
        this.vehicle!.update(driveInput, FIXED_STEP, this.world!.isOnRoad({ x: position.x, z: position.z }));
        physics.step();
        this.vehicle!.syncAfterStep();
      }
      chaseCamera.update(this.vehicle!.object, elapsed);
      let currentPosition = this.vehicle!.position();
      if (!containsPoint(this.world!.bounds, currentPosition) || currentPosition.y < -3) {
        resetCar();
        currentPosition = this.vehicle!.position();
      }
      mapOverlay.setPlayerPosition({ x: currentPosition.x, z: currentPosition.z });
      void this.world!.updateMap({ x: currentPosition.x, z: currentPosition.z });

      const garageDistance = currentPosition.distanceTo(this.world!.spawn);
      const hasEvent = Boolean(waypoint || rallyRun);
      garage.setAvailable(!hasEvent && garageDistance < 28 && Math.abs(this.vehicle!.speedKph()) < 3);
      mapOverlay.openButton.disabled = Boolean(rallyRun);
      const rallyDistance = Math.hypot(currentPosition.x - rally.start.x, currentPosition.z - rally.start.z);
      const currentVehicle = vehicleById(profile.activeVehicleId)!;
      rallyButton.disabled = hasEvent || rallyDistance >= 15 || !canEnterRally(currentVehicle, rally);
      rallyButton.textContent = canEnterRally(currentVehicle, rally) ? "Rallye starten" : "Rallye: Rally-/Geländewagen nötig";

      let timerText = garageDistance < 28 ? "Garage: G" : "Freie Fahrt";
      if (rallyRun) {
        const update = updateRally(rallyRun, { x: currentPosition.x, z: currentPosition.z }, time);
        rallyRun = update.run;
        this.world!.setActiveRallyGate(rallyRun.nextCheckpoint < rally.checkpoints.length ? rallyRun.nextCheckpoint + 1 : rally.checkpoints.length + 1);
        timerText = `Rallye ${Math.round((time - rallyRun.startedAt) / 1000)} s · Tor ${Math.min(rallyRun.nextCheckpoint + 1, rally.checkpoints.length + 1)}`;
        if (update.failed) {
          statusMessage = "Rallye nicht geschafft – Strecke oder Zielzeit verfehlt";
          statusUntil = time + 3000;
          rallyRun = undefined;
          this.world!.setActiveRallyGate(null);
        } else if (update.moneyReward > 0) {
          profile = { ...profile, money: profile.money + update.moneyReward, completedEvents: [...new Set([...profile.completedEvents, rally.id])] };
          for (let box = 0; box < update.mysteryBoxes; box += 1) {
            const reward = drawMysteryReward(profile, VEHICLES);
            profile = reward.profile;
            mysteryView.show(reward);
          }
          persist();
          garage.render(profile, VEHICLES);
          statusMessage = `Rallye geschafft: +€${update.moneyReward}`;
          statusUntil = time + 3000;
          rallyRun = undefined;
          this.world!.setActiveRallyGate(null);
        }
      } else if (waypoint) {
        const update = updateWaypointChallenge(waypoint, { x: currentPosition.x, z: currentPosition.z }, time);
        waypoint = update.challenge;
        const delta = new THREE.Vector3(waypoint.target.x - currentPosition.x, 0, waypoint.target.z - currentPosition.z);
        delta.applyQuaternion(this.vehicle!.object.quaternion.clone().invert());
        const directionIndex = (Math.round(Math.atan2(delta.x, -delta.z) / (Math.PI / 4)) + 8) % 8;
        const remaining = Math.hypot(delta.x, delta.z);
        const elapsedSeconds = Math.max(0, (time - waypoint.startedAt) / 1000);
        timerText = `${DIRECTION_ARROWS[directionIndex]} Wegpunkt ${Math.round(remaining)} m · ${elapsedSeconds.toFixed(1)} s`;
        if (update.reward > 0) {
          profile = { ...profile, money: profile.money + update.reward };
          persist();
          garage.render(profile, VEHICLES);
          statusMessage = `Ziel! +€${update.reward}`;
          statusUntil = time + 2800;
          waypoint = undefined;
          disposeWaypointMarker();
        }
      }
      if (time < statusUntil) timerText = statusMessage;
      if (this.world!.mapWarning()) timerText += " · Kartenteil konnte nicht geladen werden";
      if (saveWarning) timerText += " · Speichern nicht verfügbar";
      hud.render({ speedKph: this.vehicle!.speedKph(), money: profile.money, timerText, activeVehicle: currentVehicle.name });
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
    this.physics?.free();
    if (this.hasTestHooks) delete (window as typeof window & { __friedRaceTest?: unknown }).__friedRaceTest;
    this.root.replaceChildren();
  }
}
