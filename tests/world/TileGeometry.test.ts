import { expect, test } from "vitest";
import { buildBuildingGeometry, buildRoadGeometry } from "../../src/world/TileGeometry";
import type { MapTile } from "../../src/world/tileData";

const tile: MapTile = { version: 2, id: "0-0", x: 0, z: 0, bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, roads: [{ id: "r", name: "Street", highway: "residential", width: 6, points: [{ x: 0, z: 0 }, { x: 50, z: 0 }] }], buildings: [{ id: "b", outer: [{ x: 10, z: 10 }, { x: 20, z: 10 }, { x: 20, z: 20 }, { x: 10, z: 20 }, { x: 10, z: 10 }], inners: [[{ x: 13, z: 13 }, { x: 15, z: 13 }, { x: 15, z: 15 }, { x: 13, z: 15 }, { x: 13, z: 13 }]], height: 9 }] };

test("builds merged road and extruded building geometry", () => {
  const roads = buildRoadGeometry(tile);
  const buildings = buildBuildingGeometry(tile);
  expect(roads.getAttribute("position").count).toBeGreaterThan(0);
  const normals = roads.getAttribute("normal");
  expect(Array.from({ length: normals.count }, (_, index) => normals.getY(index)).every((value) => value > 0.9)).toBe(true);
  expect(buildings.getAttribute("position").count).toBeGreaterThan(0);
  expect(buildings.boundingBox?.max.y ?? 0).toBeGreaterThan(0);
  roads.dispose(); buildings.dispose();
});
