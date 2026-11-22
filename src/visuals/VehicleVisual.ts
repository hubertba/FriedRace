import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { VehicleDefinition } from "../domain/types";

const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], rotation?: [number, number, number]): THREE.Mesh => {
  const result = new THREE.Mesh(geometry, material); result.name = name; result.position.set(...position); if (rotation) result.rotation.set(...rotation); result.castShadow = true; result.receiveShadow = true; return result;
};

export const createVehicleVisual = (definition: VehicleDefinition): THREE.Group => {
  const root = new THREE.Group(); root.name = "vehicle-visual";
  const paint = new THREE.MeshPhysicalMaterial({ color: definition.class === "rally" ? 0xd9d7cf : definition.class === "offroad" ? 0x315743 : 0xb51f2a, metalness: 0.72, roughness: 0.24, clearcoat: 0.9, clearcoatRoughness: 0.18 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.48, metalness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x183442, roughness: 0.08, metalness: 0.15, transmission: 0.18, transparent: true, opacity: 0.82 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.92 }); const rim = new THREE.MeshStandardMaterial({ color: 0xb8bdc1, roughness: 0.24, metalness: 0.9 });
  const whiteLight = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffd8a1, emissiveIntensity: 1.2 }); const redLight = new THREE.MeshStandardMaterial({ color: 0xaa1118, emissive: 0x7c0508, emissiveIntensity: 1.1 });
  root.add(mesh("vehicle-body", new RoundedBoxGeometry(2, 0.62, 4.25, 5, 0.16), paint, [0, 0.68, 0]));
  root.add(mesh("vehicle-glass", new RoundedBoxGeometry(1.58, 0.62, 1.92, 4, 0.14), glass, [0, 1.18, 0.18], [-0.02, 0, 0]));
  root.add(mesh("front-bumper", new RoundedBoxGeometry(1.88, 0.22, 0.22, 3, 0.06), trim, [0, 0.47, -2.12])); root.add(mesh("rear-bumper", new RoundedBoxGeometry(1.88, 0.2, 0.2, 3, 0.05), trim, [0, 0.48, 2.12]));
  for (const side of [-1, 1]) {
    root.add(mesh(`headlight-${side}`, new RoundedBoxGeometry(0.55, 0.16, 0.07, 2, 0.025), whiteLight, [side * 0.58, 0.78, -2.14]));
    root.add(mesh(`taillight-${side}`, new RoundedBoxGeometry(0.5, 0.16, 0.07, 2, 0.025), redLight, [side * 0.58, 0.75, 2.14]));
  }
  const wheelPositions: Array<[number, number, number]> = [[-1.02,0.46,-1.34],[1.02,0.46,-1.34],[-1.02,0.46,1.35],[1.02,0.46,1.35]];
  wheelPositions.forEach((position, index) => { root.add(mesh(`tyre-${index}`, new THREE.CylinderGeometry(0.4, 0.4, 0.28, 20), tyre, position, [0, 0, Math.PI / 2])); root.add(mesh(`rim-${index}`, new THREE.CylinderGeometry(0.23, 0.23, 0.29, 12), rim, position, [0, 0, Math.PI / 2])); });
  if (definition.class !== "road") root.add(mesh("rear-spoiler", new RoundedBoxGeometry(1.5, 0.1, 0.3, 2, 0.03), trim, [0, 1.18, 1.82]));
  root.scale.set(definition.class === "offroad" ? 1.12 : definition.class === "rally" ? 1.04 : 1, definition.class === "offroad" ? 1.2 : definition.class === "rally" ? 1.08 : 1, 1);
  root.position.y = -(0.45 + 0.06 * root.scale.y);
  return root;
};

export const disposeVehicleVisual = (visual: THREE.Object3D): void => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  visual.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
};

export const loadOptionalVehicleVisual = async (url: string, load: (url: string) => Promise<THREE.Object3D>): Promise<THREE.Object3D | null> => {
  try { return await load(url); } catch { return null; }
};
