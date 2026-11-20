import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import rawMap from "../content/map/region.json";
import { createStarterRally } from "../content/events";
import { validateImportedMap, type ImportedMap } from "./mapData";
import { createRoadSurface } from "./RoadSurface";
import { worldBoundsFromMap, type WorldBounds } from "./worldBounds";

export interface WorldDefinition {
  map: ImportedMap;
  bounds: WorldBounds;
  spawn: THREE.Vector3;
  isOnRoad(point: { x: number; z: number }): boolean;
  setActiveRallyGate(index: number | null): void;
  dispose(): void;
}

const addRoads = (scene: THREE.Scene, map: ImportedMap): ReturnType<typeof createRoadSurface> => {
  const surface = createRoadSurface(map);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(surface.vertices, 3));
  geometry.computeVertexNormals();
  const roads = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x4e5358, roughness: 0.95 }));
  roads.name = "OSM road surfaces";
  roads.receiveShadow = true;
  scene.add(roads);
  return surface;
};

export const createWorld = (scene: THREE.Scene, physics: RAPIER.World): WorldDefinition => {
  const map = validateImportedMap(rawMap);
  if (!map) throw new Error("Bundled OSM map is invalid");
  const bounds = worldBoundsFromMap(map);
  scene.background = new THREE.Color(0x8bb9d8);
  scene.fog = new THREE.Fog(0x8bb9d8, 300, 1200);
  scene.add(new THREE.HemisphereLight(0xddeeff, 0x43552f, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(80, 140, 60);
  sun.castShadow = true;
  scene.add(sun);

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x5d8b45, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(centerX, 0, centerZ);
  ground.receiveShadow = true;
  scene.add(ground);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.1, depth / 2).setTranslation(centerX, -0.1, centerZ));
  const wallHeight = 6;
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, wallHeight, 1).setTranslation(centerX, wallHeight, bounds.minZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, wallHeight, 1).setTranslation(centerX, wallHeight, bounds.maxZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(1, wallHeight, depth / 2).setTranslation(bounds.minX, wallHeight, centerZ));
  physics.createCollider(RAPIER.ColliderDesc.cuboid(1, wallHeight, depth / 2).setTranslation(bounds.maxX, wallHeight, centerZ));
  const roadSurface = addRoads(scene, map);

  const markerGeometry = new THREE.CylinderGeometry(2, 3, 8, 8);
  for (const town of map.towns) {
    const marker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: 0xffc107 }));
    marker.position.set(town.x, 4, town.z);
    marker.name = town.name;
    marker.userData.town = town.name;
    scene.add(marker);
  }

  const oberwart = map.towns.find((town) => town.name === "Oberwart")!;
  const spawn = new THREE.Vector3(oberwart.x, 1.2, oberwart.z);
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(14, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0x263238 }),
  );
  garage.position.set(spawn.x + 10, 3, spawn.z + 8);
  garage.name = "Garage";
  scene.add(garage);

  const rally = createStarterRally({ x: spawn.x, z: spawn.z });
  const gatePoints = [rally.start, ...rally.checkpoints, rally.finish];
  const rallyGates: THREE.Mesh[] = [];
  gatePoints.forEach((point, index) => {
    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(index === 0 || index === gatePoints.length - 1 ? 8 : 5, 0.7, 8, 32),
      new THREE.MeshStandardMaterial({ color: index === 0 ? 0xff5722 : 0x29b6f6 }),
    );
    gate.rotation.x = Math.PI / 2;
    gate.position.set(point.x, 1.2, point.z);
    gate.name = index === 0 ? "Rally start" : `Rally checkpoint ${index}`;
    scene.add(gate);
    rallyGates.push(gate);
  });

  return {
    map,
    bounds,
    spawn,
    isOnRoad: roadSurface.isOnRoad,
    setActiveRallyGate: (activeIndex) => {
      rallyGates.forEach((gate, index) => {
        const material = gate.material as THREE.MeshStandardMaterial;
        material.color.setHex(index === activeIndex ? 0xffeb3b : index === 0 ? 0xff5722 : 0x29b6f6);
      });
    },
    dispose: () => {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    },
  };
};
