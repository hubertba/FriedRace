import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { ImportedBuilding, MapTile } from "./tileData";
import { buildRoadGeometries } from "./RoadGeometry";

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
const ringArea = (ring: Array<{ x: number; z: number }>): number => ring.slice(0, -1).reduce((sum, point, index) => { const next = ring[index + 1]!; return sum + point.x * next.z - next.x * point.z; }, 0) / 2;
const normalizeRing = <T extends { x: number; z: number }>(ring: T[], clockwise: boolean): T[] => {
  const points = ring.slice(0, -1); const shouldReverse = clockwise ? ringArea(ring) > 0 : ringArea(ring) < 0; const ordered = shouldReverse ? [...points].reverse() : [...points]; return [...ordered, ordered[0]!];
};
const isConvex = (ring: Array<{ x: number; z: number }>): boolean => {
  const points = ring.slice(0, -1); let sign = 0;
  for (let index = 0; index < points.length; index += 1) { const a = points[index]!; const b = points[(index + 1) % points.length]!; const c = points[(index + 2) % points.length]!; const cross = (b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x); if (Math.abs(cross) < 1e-6) continue; const nextSign = Math.sign(cross); if (sign && nextSign !== sign) return false; sign = nextSign; }
  return sign !== 0;
};
const supportsPitchedRoof = (building: ImportedBuilding): boolean => building.roofShape !== "flat" && building.inners.length === 0 && building.outer.length - 1 === 4 && isConvex(normalizeRing(building.outer, true));
const addColor = (geometry: THREE.BufferGeometry, value: string): THREE.BufferGeometry => {
  const result = geometry.index ? geometry.toNonIndexed() : geometry; if (result !== geometry) geometry.dispose();
  const color = new THREE.Color(value); const count = result.getAttribute("position").count; const colors: number[] = [];
  for (let index = 0; index < count; index += 1) colors.push(color.r, color.g, color.b);
  result.deleteAttribute("uv"); result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); result.computeVertexNormals(); return result;
};

export const buildRoadGeometry = (tile: MapTile): THREE.BufferGeometry => { const geometries = buildRoadGeometries(tile); geometries.shoulders.dispose(); geometries.markings.dispose(); return geometries.surface; };

const roofGeometry = (building: ImportedBuilding, wallPositions: number[], wallColors: number[]): THREE.BufferGeometry => {
  const normalizedOuter = normalizeRing(building.outer, true); const outer = normalizedOuter.slice(0, -1); const normalizedInners = building.inners.map((ring) => normalizeRing(ring, false)); const roofColor = new THREE.Color(building.roofColor); const facadeColor = new THREE.Color(building.facadeColor);
  const pitched = supportsPitchedRoof(building);
  if (!pitched) {
    const shape = new THREE.Shape(outer.map((point) => new THREE.Vector2(point.x, -point.z)));
    for (const inner of normalizedInners) shape.holes.push(new THREE.Path(inner.slice(0, -1).map((point) => new THREE.Vector2(point.x, -point.z))));
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

export const buildBuildingGeometries = (tile: MapTile): { foundations: THREE.BufferGeometry; walls: THREE.BufferGeometry; roofs: THREE.BufferGeometry; windows: THREE.BufferGeometry } => {
  const foundationPositions: number[] = []; const foundationColors: number[] = []; const wallPositions: number[] = []; const wallColors: number[] = []; const windowPositions: number[] = []; const windowColors: number[] = []; const roofs: THREE.BufferGeometry[] = [];
  const noWindows = new Set(["garage", "garages", "shed", "carport", "barn", "industrial", "warehouse", "hangar", "farm_auxiliary"]);
  for (const building of tile.buildings) {
    try {
      const facadeColor = new THREE.Color(building.facadeColor); const foundationColor = new THREE.Color("#77736b"); const windowColor = new THREE.Color("#27343c"); const eave = supportsPitchedRoof(building) ? Math.max(building.minHeight + 0.5, building.height - building.roofHeight) : building.height; const outer = normalizeRing(building.outer, true); const inners = building.inners.map((ring) => normalizeRing(ring, false));
      for (let index = 1; index < outer.length; index += 1) { const start=outer[index-1]!; const end=outer[index]!; quad(foundationPositions,foundationColors,{x:start.x,y:building.minHeight,z:start.z},{x:end.x,y:building.minHeight,z:end.z},{x:end.x,y:building.minHeight+.45,z:end.z},{x:start.x,y:building.minHeight+.45,z:start.z},foundationColor); }
      for (const ring of [outer, ...inners]) for (let index = 1; index < ring.length; index += 1) {
        const start = ring[index - 1]!; const end = ring[index]!; const bottom = building.minHeight;
        quad(wallPositions, wallColors, {x:start.x,y:bottom,z:start.z}, {x:end.x,y:bottom,z:end.z}, {x:end.x,y:eave,z:end.z}, {x:start.x,y:eave,z:start.z}, facadeColor);
      }
      roofs.push(roofGeometry(building, wallPositions, wallColors));
      if (!noWindows.has(building.buildingType)) for (let index = 1; index < outer.length; index += 1) {
        const start = outer[index - 1]!; const end = outer[index]!; const dx = end.x - start.x; const dz = end.z - start.z; const length = Math.hypot(dx, dz); if (length < 3.5) continue;
        const columns = Math.max(1, Math.min(6, Math.floor(length / 3))); const nx = -dz / length * 0.035; const nz = dx / length * 0.035; const wallHeight = eave - building.minHeight; const rows = Math.max(1, Math.min(8, Math.round(building.levels)));
        for (let floor = 0; floor < rows; floor += 1) for (let column = 0; column < columns; column += 1) {
          const centerT = (column + 1) / (columns + 1); const cx = start.x + dx * centerT + nx; const cz = start.z + dz * centerT + nz; const halfWidth = Math.min(0.7, length / (columns + 1) * 0.28); const halfHeight = Math.min(0.75, wallHeight / rows * 0.28); const cy = building.minHeight + wallHeight * (floor + 0.5) / rows;
          const tx = dx / length * halfWidth; const tz = dz / length * halfWidth;
          quad(windowPositions, windowColors, {x:cx-tx,y:cy-halfHeight,z:cz-tz}, {x:cx+tx,y:cy-halfHeight,z:cz+tz}, {x:cx+tx,y:cy+halfHeight,z:cz+tz}, {x:cx-tx,y:cy+halfHeight,z:cz-tz}, windowColor);
        }
      }
    } catch { /* malformed individual building is omitted */ }
  }
  const roofMerged = roofs.length ? mergeGeometries(roofs, false)! : geometryFrom([], []); roofs.forEach((geometry) => geometry.dispose()); roofMerged.computeBoundingBox();
  const foundations = geometryFrom(foundationPositions, foundationColors); const walls = geometryFrom(wallPositions, wallColors); const windows = geometryFrom(windowPositions, windowColors); foundations.computeBoundingBox(); walls.computeBoundingBox(); windows.computeBoundingBox();
  return { foundations, walls, roofs: roofMerged, windows };
};

export const buildBuildingGeometry = (tile: MapTile): THREE.BufferGeometry => {
  const geometries = buildBuildingGeometries(tile); const merged = mergeGeometries([geometries.walls, geometries.roofs, geometries.windows], false) ?? new THREE.BufferGeometry(); Object.values(geometries).forEach((geometry) => geometry.dispose()); merged.computeBoundingBox(); return merged;
};
