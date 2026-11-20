import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import rawMap from "../content/map/region.json";
import { createStarterRally } from "../content/events";
import { validateImportedMap, type ImportedMap } from "./mapData";
import { worldBoundsFromMap, type WorldBounds } from "./worldBounds";

export interface WorldDefinition {
  map: ImportedMap;
  bounds: WorldBounds;
  spawn: THREE.Vector3;
  dispose(): void;
}

const addRoads = (scene: THREE.Scene, map: ImportedMap): void => {
  const vertices: number[] = [];
  for (const road of map.roads) {
    for (let index = 1; index < road.points.length; index += 1) {
      const previous = road.points[index - 1]!;
      const current = road.points[index]!;
      vertices.push(previous.x, 0.04, previous.z, current.x, 0.04, current.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const roads = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xd7d7d7 }));
  roads.name = "OSM roads";
  scene.add(roads);
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
  addRoads(scene, map);

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
  gatePoints.forEach((point, index) => {
    const gate = new THREE.Mesh(
      new THREE.TorusGeometry(index === 0 || index === gatePoints.length - 1 ? 8 : 5, 0.7, 8, 32),
      new THREE.MeshStandardMaterial({ color: index === 0 ? 0xff5722 : 0x29b6f6 }),
    );
    gate.rotation.x = Math.PI / 2;
    gate.position.set(point.x, 1.2, point.z);
    gate.name = index === 0 ? "Rally start" : `Rally checkpoint ${index}`;
    scene.add(gate);
  });

  return {
    map,
    bounds,
    spawn,
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
