import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ImportedBuilding, MapTile } from "./tileData";

const geometryFrom = (positions: number[], colors: number[]): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};
const appendVertex = (positions: number[], colors: number[], point: { x: number; y: number; z: number }, color: THREE.Color): void => {
  positions.push(point.x, point.y, point.z); colors.push(color.r, color.g, color.b);
};
const triangle = (positions: number[], colors: number[], a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }, color: THREE.Color): void => {
  appendVertex(positions, colors, a, color); appendVertex(positions, colors, b, color); appendVertex(positions, colors, c, color);
};
const quad = (positions: number[], colors: number[], a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, c: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, color: THREE.Color): void => {
  triangle(positions, colors, a, b, c, color); triangle(positions, colors, a, c, d, color);
};
const addColor = (geometry: THREE.BufferGeometry, value: string): THREE.BufferGeometry => {
  const result = geometry.index ? geometry.toNonIndexed() : geometry; if (result !== geometry) geometry.dispose();
  const color = new THREE.Color(value); const count = result.getAttribute("position").count; const colors: number[] = [];
  for (let index = 0; index < count; index += 1) colors.push(color.r, color.g, color.b);
  result.deleteAttribute("uv"); result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); result.computeVertexNormals(); return result;
};

export const buildRoadGeometry = (tile: MapTile): THREE.BufferGeometry => {
  const vertices: number[] = [];
  for (const road of tile.roads) for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!; const end = road.points[index]!;
    const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz);
    if (!length) continue;
    const nx = (-dz / length) * road.width / 2; const nz = (dx / length) * road.width / 2;
    vertices.push(start.x + nx, 0.04, start.z + nz, end.x + nx, 0.04, end.z + nz, start.x - nx, 0.04, start.z - nz, end.x + nx, 0.04, end.z + nz, end.x - nx, 0.04, end.z - nz, start.x - nx, 0.04, start.z - nz);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); return geometry;
};

const roofGeometry = (building: ImportedBuilding, wallPositions: number[], wallColors: number[]): THREE.BufferGeometry => {
  const outer = building.outer.slice(0, -1); const roofColor = new THREE.Color(building.roofColor); const facadeColor = new THREE.Color(building.facadeColor);
  const pitched = building.roofShape !== "flat" && building.inners.length === 0 && outer.length >= 4;
  if (!pitched) {
    const shape = new THREE.Shape(outer.map((point) => new THREE.Vector2(point.x, -point.z)));
    for (const inner of building.inners) shape.holes.push(new THREE.Path(inner.slice(0, -1).map((point) => new THREE.Vector2(point.x, -point.z))));
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2); geometry.translate(0, building.height, 0); return addColor(geometry, building.roofColor);
  }
  let longest = { dx: 1, dz: 0, length: 0 };
  for (let index = 0; index < outer.length; index += 1) { const next = outer[(index + 1) % outer.length]!; const dx = next.x - outer[index]!.x; const dz = next.z - outer[index]!.z; const length = Math.hypot(dx, dz); if (length > longest.length) longest = { dx, dz, length }; }
  const ux = longest.dx / longest.length; const uz = longest.dz / longest.length; const vx = -uz; const vz = ux;
  const projections = outer.map((point) => ({ u: point.x * ux + point.z * uz, v: point.x * vx + point.z * vz }));
  const minU = Math.min(...projections.map((point) => point.u)); const maxU = Math.max(...projections.map((point) => point.u)); const centerV = (Math.min(...projections.map((point) => point.v)) + Math.max(...projections.map((point) => point.v))) / 2;
  const inset = building.roofShape === "hipped" ? (maxU - minU) * 0.2 : 0; const ridgeMin = minU + inset; const ridgeMax = maxU - inset;
  const ridgePoint = (point: { x: number; z: number }) => { const projected = Math.max(ridgeMin, Math.min(ridgeMax, point.x * ux + point.z * uz)); return { x: ux * projected + vx * centerV, y: building.height, z: uz * projected + vz * centerV }; };
  const positions: number[] = []; const colors: number[] = []; const eave = Math.max(building.minHeight + 0.5, building.height - building.roofHeight);
  for (let index = 0; index < outer.length; index += 1) {
    const start = outer[index]!; const end = outer[(index + 1) % outer.length]!; const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz); if (!length) continue;
    const startRidge = ridgePoint(start); const endRidge = ridgePoint(end); const a = { x: start.x, y: eave, z: start.z }; const b = { x: end.x, y: eave, z: end.z };
    const parallel = Math.abs((dx / length) * ux + (dz / length) * uz) > 0.7;
    if (building.roofShape === "hipped" || parallel) quad(positions, colors, a, b, endRidge, startRidge, roofColor);
    else triangle(wallPositions, wallColors, a, b, ridgePoint({ x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 }), facadeColor);
  }
  return geometryFrom(positions, colors);
};

export const buildBuildingGeometries = (tile: MapTile): { walls: THREE.BufferGeometry; roofs: THREE.BufferGeometry; windows: THREE.BufferGeometry } => {
  const wallPositions: number[] = []; const wallColors: number[] = []; const windowPositions: number[] = []; const windowColors: number[] = []; const roofs: THREE.BufferGeometry[] = [];
  const noWindows = new Set(["garage", "garages", "shed", "carport", "barn", "industrial", "warehouse", "hangar", "farm_auxiliary"]);
  for (const building of tile.buildings) {
    try {
      const facadeColor = new THREE.Color(building.facadeColor); const windowColor = new THREE.Color("#27343c"); const eave = building.roofShape === "flat" ? building.height : Math.max(building.minHeight + 0.5, building.height - building.roofHeight);
      for (const ring of [building.outer, ...building.inners]) for (let index = 1; index < ring.length; index += 1) {
        const start = ring[index - 1]!; const end = ring[index]!; const bottom = building.minHeight;
        quad(wallPositions, wallColors, {x:start.x,y:bottom,z:start.z}, {x:end.x,y:bottom,z:end.z}, {x:end.x,y:eave,z:end.z}, {x:start.x,y:eave,z:start.z}, facadeColor);
      }
      roofs.push(roofGeometry(building, wallPositions, wallColors));
      const signedArea = building.outer.slice(0, -1).reduce((sum, point, index) => { const next = building.outer[index + 1]!; return sum + point.x * next.z - next.x * point.z; }, 0); const outward = signedArea >= 0 ? 1 : -1;
      if (!noWindows.has(building.buildingType)) for (let index = 1; index < building.outer.length; index += 1) {
        const start = building.outer[index - 1]!; const end = building.outer[index]!; const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz); if (length < 3.5) continue;
        const columns = Math.max(1, Math.min(6, Math.floor(length / 3))); const nx = dz / length * 0.035 * outward; const nz = -dx / length * 0.035 * outward; const wallHeight = eave - building.minHeight;
        for (let floor = 0; floor < Math.max(1, Math.min(8, Math.round(building.levels))); floor += 1) for (let column = 0; column < columns; column += 1) {
          const centerT = (column + 1) / (columns + 1); const cx = start.x + dx * centerT + nx; const cz = start.z + dz * centerT + nz; const halfWidth = Math.min(0.7, length / (columns + 1) * 0.28); const halfHeight = Math.min(0.75, wallHeight / Math.max(1, building.levels) * 0.28); const cy = building.minHeight + wallHeight * (floor + 0.5) / Math.max(1, building.levels);
          const tx = dx / length * halfWidth; const tz = dz / length * halfWidth;
          quad(windowPositions, windowColors, {x:cx-tx,y:cy-halfHeight,z:cz-tz}, {x:cx+tx,y:cy-halfHeight,z:cz+tz}, {x:cx+tx,y:cy+halfHeight,z:cz+tz}, {x:cx-tx,y:cy+halfHeight,z:cz-tz}, windowColor);
        }
      }
    } catch { /* malformed individual building is omitted */ }
  }
  const roofMerged = roofs.length ? mergeGeometries(roofs, false)! : geometryFrom([], []); roofs.forEach((geometry) => geometry.dispose()); roofMerged.computeBoundingBox();
  const walls = geometryFrom(wallPositions, wallColors); const windows = geometryFrom(windowPositions, windowColors); walls.computeBoundingBox(); windows.computeBoundingBox();
  return { walls, roofs: roofMerged, windows };
};

export const buildBuildingGeometry = (tile: MapTile): THREE.BufferGeometry => {
  const geometries = buildBuildingGeometries(tile); const merged = mergeGeometries([geometries.walls, geometries.roofs, geometries.windows], false) ?? new THREE.BufferGeometry(); Object.values(geometries).forEach((geometry) => geometry.dispose()); merged.computeBoundingBox(); return merged;
};
