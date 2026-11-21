import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MapTile } from "./tileData";

export const buildRoadGeometry = (tile: MapTile): THREE.BufferGeometry => {
  const vertices: number[] = [];
  for (const road of tile.roads) for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!; const end = road.points[index]!;
    const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz);
    if (!length) continue;
    const nx = (-dz / length) * road.width / 2; const nz = (dx / length) * road.width / 2;
    vertices.push(start.x + nx, 0.04, start.z + nz, start.x - nx, 0.04, start.z - nz, end.x + nx, 0.04, end.z + nz, end.x + nx, 0.04, end.z + nz, start.x - nx, 0.04, start.z - nz, end.x - nx, 0.04, end.z - nz);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
};

export const buildBuildingGeometry = (tile: MapTile): THREE.BufferGeometry => {
  const geometries: THREE.BufferGeometry[] = [];
  for (const building of tile.buildings) {
    try {
      const outer = building.outer.slice(0, -1);
      if (outer.length < 3) continue;
      const shape = new THREE.Shape(outer.map((point) => new THREE.Vector2(point.x, -point.z)));
      for (const inner of building.inners) {
        const ring = inner.slice(0, -1);
        if (ring.length >= 3) shape.holes.push(new THREE.Path(ring.map((point) => new THREE.Vector2(point.x, -point.z))));
      }
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false, steps: 1 });
      geometry.rotateX(-Math.PI / 2);
      geometry.computeVertexNormals();
      geometries.push(geometry);
    } catch { /* malformed individual polygon is omitted */ }
  }
  const merged = geometries.length ? mergeGeometries(geometries, false) : new THREE.BufferGeometry();
  geometries.forEach((geometry) => geometry.dispose());
  merged.computeBoundingBox();
  return merged;
};
