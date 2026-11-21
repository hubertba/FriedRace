import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createStarterRally } from "../content/events";
import type { ImportedMap } from "./mapData";
import { MapTileManager } from "./MapTileManager";
import { validateMapManifest, type ImportedBuilding, type MapManifest } from "./tileData";
import type { WorldBounds } from "./worldBounds";

export interface WorldDefinition {
  map: ImportedMap;
  manifest: MapManifest;
  bounds: WorldBounds;
  spawn: THREE.Vector3;
  isOnRoad(point: { x: number; z: number }): boolean;
  updateMap(point: { x: number; z: number }): Promise<void>;
  mapWarning(): string;
  setActiveRallyGate(index: number | null): void;
  dispose(): void;
}

const colliderForBuilding = (physics: RAPIER.World, building: ImportedBuilding): RAPIER.Collider => {
  const xs = building.outer.map((point) => point.x); const zs = building.outer.map((point) => point.z);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minZ = Math.min(...zs); const maxZ = Math.max(...zs);
  return physics.createCollider(RAPIER.ColliderDesc.cuboid(Math.max(0.5, (maxX - minX) / 2), building.height / 2, Math.max(0.5, (maxZ - minZ) / 2)).setTranslation((minX + maxX) / 2, building.height / 2, (minZ + maxZ) / 2));
};

export const createWorld = async (scene: THREE.Scene, physics: RAPIER.World): Promise<WorldDefinition> => {
  const response = await fetch("/map/manifest.json");
  if (!response.ok) throw new Error(`Map manifest failed: ${response.status}`);
  const manifest = validateMapManifest(await response.json());
  if (!manifest) throw new Error("Map manifest is invalid");
  const bounds: WorldBounds = { minX: manifest.grid.minX, minZ: manifest.grid.minZ, maxX: manifest.grid.minX + manifest.grid.columns * manifest.grid.tileSize, maxZ: manifest.grid.minZ + manifest.grid.rows * manifest.grid.tileSize };
  scene.background = new THREE.Color(0x8bb9d8); scene.fog = new THREE.Fog(0x8bb9d8, 300, 1200);
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x43552f, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(80, 140, 60); sun.castShadow = true; scene.add(sun);
  const width = bounds.maxX - bounds.minX; const depth = bounds.maxZ - bounds.minZ; const centerX = (bounds.minX + bounds.maxX) / 2; const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ color: 0x5d8b45, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(centerX, 0, centerZ); ground.receiveShadow = true; scene.add(ground);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.1, depth / 2).setTranslation(centerX, -0.1, centerZ));
  const wallHeight = 6;
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, wallHeight, 1).setTranslation(centerX, wallHeight, bounds.minZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, wallHeight, 1).setTranslation(centerX, wallHeight, bounds.maxZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(1, wallHeight, depth / 2).setTranslation(bounds.minX, wallHeight, centerZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(1, wallHeight, depth / 2).setTranslation(bounds.maxX, wallHeight, centerZ));

  let warning = "";
  const manager = new MapTileManager({ manifest, scene, loadTile: async (url) => { const tileResponse = await fetch(url); if (!tileResponse.ok) throw new Error(`${tileResponse.status}`); return tileResponse.json(); }, physics: { addBuildingCollider: (building) => colliderForBuilding(physics, building), removeCollider: (handle) => physics.removeCollider(handle as RAPIER.Collider, true) }, onWarning: (message) => { warning = message; } });
  const spawn = new THREE.Vector3(manifest.spawn.x, 1.2, manifest.spawn.z);
  await manager.update(spawn);

  const markerGeometry = new THREE.CylinderGeometry(2, 3, 8, 8);
  for (const town of manifest.towns) { const marker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0xffc107 })); marker.position.set(town.x, 4, town.z); marker.name = town.name; scene.add(marker); }
  const garage = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), new THREE.MeshStandardMaterial({ color: 0x263238 })); garage.position.set(spawn.x + 10, 3, spawn.z + 8); garage.name = "Garage"; scene.add(garage);
  const rally = createStarterRally({ x: spawn.x, z: spawn.z }); const gatePoints = [rally.start, ...rally.checkpoints, rally.finish]; const rallyGates: THREE.Mesh[] = [];
  gatePoints.forEach((point, index) => { const gate = new THREE.Mesh(new THREE.TorusGeometry(index === 0 || index === gatePoints.length - 1 ? 8 : 5, 0.7, 8, 32), new THREE.MeshStandardMaterial({ color: index === 0 ? 0xff5722 : 0x29b6f6 })); gate.rotation.x = Math.PI / 2; gate.position.set(point.x, 1.2, point.z); scene.add(gate); rallyGates.push(gate); });

  const map: ImportedMap = { version: 1, attribution: manifest.attribution as ImportedMap["attribution"], attributionUrl: manifest.attributionUrl as ImportedMap["attributionUrl"], towns: manifest.towns, roads: manifest.overviewRoads, bounds };
  return { map, manifest, bounds, spawn, isOnRoad: (point) => manager.isOnRoad(point), updateMap: async (point) => { await manager.update(point); document.body.dataset.loadedMapTiles = manager.loadedTileIds.sort().join(","); document.body.dataset.loadedBuildings = String(manager.loadedBuildingCount); document.body.dataset.currentMapTile = manager.tileIdAt(point); }, mapWarning: () => warning, setActiveRallyGate: (activeIndex) => rallyGates.forEach((gate, index) => (gate.material as THREE.MeshStandardMaterial).color.setHex(index === activeIndex ? 0xffeb3b : index === 0 ? 0xff5722 : 0x29b6f6)), dispose: () => { manager.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); } }); } };
};
