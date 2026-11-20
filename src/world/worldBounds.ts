import type { ImportedMap } from "./mapData";

export interface WorldBounds { minX: number; maxX: number; minZ: number; maxZ: number; }

export const worldBoundsFromMap = (map: ImportedMap, margin = 40): WorldBounds => ({
  minX: map.bounds.minX - margin,
  maxX: map.bounds.maxX + margin,
  minZ: map.bounds.minZ - margin,
  maxZ: map.bounds.maxZ + margin,
});

export const containsPoint = (bounds: WorldBounds, point: { x: number; z: number }): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.z)
  && point.x >= bounds.minX && point.x <= bounds.maxX
  && point.z >= bounds.minZ && point.z <= bounds.maxZ;
