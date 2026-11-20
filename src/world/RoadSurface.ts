import type { ImportedMap, MapPoint } from "./mapData";

interface Segment { start: MapPoint; end: MapPoint; }
export interface RoadSurface { vertices: number[]; isOnRoad(point: MapPoint): boolean; }

const distanceToSegment = (point: MapPoint, segment: Segment): number => {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const squared = dx * dx + dz * dz;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) / squared));
  return Math.hypot(point.x - (segment.start.x + t * dx), point.z - (segment.start.z + t * dz));
};

export const createRoadSurface = (map: ImportedMap, width = 7): RoadSurface => {
  const vertices: number[] = [];
  const segments: Segment[] = [];
  const grid = new Map<string, Segment[]>();
  const cellSize = 32;
  const cellKey = (x: number, z: number): string => `${x},${z}`;
  for (const road of map.roads) {
    for (let index = 1; index < road.points.length; index += 1) {
      const start = road.points[index - 1]!;
      const end = road.points[index]!;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      if (length === 0) continue;
      const nx = (-dz / length) * width / 2;
      const nz = (dx / length) * width / 2;
      vertices.push(
        start.x + nx, 0.035, start.z + nz,
        start.x - nx, 0.035, start.z - nz,
        end.x + nx, 0.035, end.z + nz,
        end.x + nx, 0.035, end.z + nz,
        start.x - nx, 0.035, start.z - nz,
        end.x - nx, 0.035, end.z - nz,
      );
      const segment = { start, end };
      segments.push(segment);
      const minX = Math.floor((Math.min(start.x, end.x) - width) / cellSize);
      const maxX = Math.floor((Math.max(start.x, end.x) + width) / cellSize);
      const minZ = Math.floor((Math.min(start.z, end.z) - width) / cellSize);
      const maxZ = Math.floor((Math.max(start.z, end.z) + width) / cellSize);
      for (let x = minX; x <= maxX; x += 1) for (let z = minZ; z <= maxZ; z += 1) {
        const key = cellKey(x, z);
        grid.set(key, [...(grid.get(key) ?? []), segment]);
      }
    }
  }
  return {
    vertices,
    isOnRoad: (point) => {
      const x = Math.floor(point.x / cellSize);
      const z = Math.floor(point.z / cellSize);
      return (grid.get(cellKey(x, z)) ?? segments).some((segment) => distanceToSegment(point, segment) <= width / 2 + 1);
    },
  };
};
