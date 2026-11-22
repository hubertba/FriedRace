import * as THREE from "three";
import { expect, test } from "vitest";
import { buildBuildingGeometries, buildRoadGeometry } from "../../src/world/TileGeometry";
import type { ImportedBuilding, MapTile } from "../../src/world/tileData";

const building = (overrides: Partial<ImportedBuilding>): ImportedBuilding => ({
  id: "house", outer: [{ x: 10, z: 10 }, { x: 22, z: 10 }, { x: 22, z: 18 }, { x: 10, z: 18 }, { x: 10, z: 10 }], inners: [],
  height: 9, minHeight: 0, levels: 2, buildingType: "house", facadeMaterial: "plaster", facadeColor: "#d8b28f", roofShape: "gabled", roofMaterial: "tiles", roofColor: "#934b3d", roofHeight: 2.4,
  ...overrides,
});
const tile = (buildings: ImportedBuilding[]): MapTile => ({ version: 2, id: "0-0", x: 0, z: 0, bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, roads: [{ id: "r", name: "Street", highway: "residential", width: 6, points: [{ x: 0, z: 0 }, { x: 50, z: 0 }] }], buildings });
const finiteAttribute = (geometry: THREE.BufferGeometry, name: string) => Array.from(geometry.getAttribute(name).array).every(Number.isFinite);

test("builds merged road geometry with upward normals", () => {
  const roads = buildRoadGeometry(tile([]));
  const normals = roads.getAttribute("normal");
  expect(roads.getAttribute("position").count).toBeGreaterThan(0);
  expect(Array.from({ length: normals.count }, (_, index) => normals.getY(index)).every((value) => value > 0.9)).toBe(true);
  roads.dispose();
});

test("builds shallow foundation bands for both footprint windings and omits malformed rings", () => {
  for (const outer of [
    [{x:10,z:10},{x:22,z:10},{x:22,z:18},{x:10,z:18},{x:10,z:10}],
    [{x:10,z:10},{x:10,z:18},{x:22,z:18},{x:22,z:10},{x:10,z:10}],
  ]) {
    const geometries = buildBuildingGeometries(tile([building({outer}), building({id:"malformed",outer:[]})]));
    expect(geometries.foundations.getAttribute("position").count).toBeGreaterThan(0); geometries.foundations.computeBoundingBox(); expect(geometries.foundations.boundingBox!.min.y).toBe(0); expect(geometries.foundations.boundingBox!.max.y).toBeLessThanOrEqual(.55); Object.values(geometries).forEach((geometry)=>geometry.dispose());
  }
});

test("builds coloured walls, pitched roofs, and bounded residential windows", () => {
  const geometries = buildBuildingGeometries(tile([
    building({ id: "gabled" }),
    building({ id: "hipped", outer: [{x:30,z:10},{x:42,z:10},{x:42,z:20},{x:30,z:20},{x:30,z:10}], roofShape: "hipped", roofColor: "#55585b" }),
    building({ id: "courtyard", outer: [{x:10,z:30},{x:28,z:30},{x:28,z:48},{x:10,z:48},{x:10,z:30}], inners: [[{x:16,z:36},{x:22,z:36},{x:22,z:42},{x:16,z:42},{x:16,z:36}]], roofShape: "flat", roofHeight: 0.35 }),
  ]));
  expect(geometries.walls.getAttribute("position").count).toBeGreaterThan(0);
  expect(geometries.roofs.getAttribute("position").count).toBeGreaterThan(0);
  expect(geometries.windows.getAttribute("position").count).toBeGreaterThan(0);
  expect(finiteAttribute(geometries.walls, "position") && finiteAttribute(geometries.walls, "color")).toBe(true);
  expect(finiteAttribute(geometries.roofs, "position") && finiteAttribute(geometries.roofs, "color")).toBe(true);
  geometries.roofs.computeBoundingBox();
  expect(geometries.roofs.boundingBox!.max.y).toBeGreaterThan(6.6);
  geometries.windows.computeBoundingBox();
  expect(geometries.windows.boundingBox!.min.y).toBeGreaterThan(0);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
});

test("orients walls, windows, and pitched roofs outward for both footprint windings", () => {
  for (const outer of [
    [{x:10,z:10},{x:22,z:10},{x:22,z:18},{x:10,z:18},{x:10,z:10}],
    [{x:10,z:10},{x:10,z:18},{x:22,z:18},{x:22,z:10},{x:10,z:10}],
  ]) {
    const geometries = buildBuildingGeometries(tile([building({ id: "winding", outer })]));
    const center = { x: 16, z: 14 };
    for (const geometry of [geometries.walls, geometries.windows]) {
      const position = geometry.getAttribute("position"); const normal = geometry.getAttribute("normal");
      const triangleCenter = { x: (position.getX(0)+position.getX(1)+position.getX(2))/3, z: (position.getZ(0)+position.getZ(1)+position.getZ(2))/3 };
      expect(normal.getX(0)*(triangleCenter.x-center.x)+normal.getZ(0)*(triangleCenter.z-center.z)).toBeGreaterThan(0);
    }
    const roofNormals = geometries.roofs.getAttribute("normal");
    expect(Array.from({length:roofNormals.count},(_,index)=>roofNormals.getY(index)).every((value)=>value>0)).toBe(true);
    Object.values(geometries).forEach((geometry) => geometry.dispose());
  }
});

test("falls back to a flat roof for concave pitched footprints", () => {
  const concave = building({ id: "concave", roofShape: "gabled", outer: [{x:10,z:10},{x:24,z:10},{x:24,z:18},{x:18,z:18},{x:18,z:14},{x:10,z:14},{x:10,z:10}] });
  const geometries = buildBuildingGeometries(tile([concave])); geometries.roofs.computeBoundingBox();
  expect(geometries.roofs.boundingBox!.min.y).toBeCloseTo(concave.height);
  expect(geometries.roofs.boundingBox!.max.y).toBeCloseTo(concave.height);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
});

test("keeps fractional-level windows below the eave", () => {
  for (const levels of [0.5, 1.5, 99]) {
    const item = building({ id: `levels-${levels}`, levels }); const geometries = buildBuildingGeometries(tile([item])); geometries.windows.computeBoundingBox();
    expect(geometries.windows.boundingBox!.max.y).toBeLessThanOrEqual(item.height-item.roofHeight);
    Object.values(geometries).forEach((geometry) => geometry.dispose());
  }
});

test("offsets windows outside clockwise OSM footprints", () => {
  const clockwise = building({ id: "clockwise", outer: [{x:10,z:10},{x:10,z:18},{x:22,z:18},{x:22,z:10},{x:10,z:10}] });
  const geometries = buildBuildingGeometries(tile([clockwise]));
  geometries.windows.computeBoundingBox();
  expect(geometries.windows.boundingBox!.min.x).toBeLessThan(10);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
});

test("omits windows for garages", () => {
  const geometries = buildBuildingGeometries(tile([building({ id: "garage", buildingType: "garage", height: 3.5, levels: 1, roofShape: "flat", roofHeight: 0.35 })]));
  expect(geometries.walls.getAttribute("position").count).toBeGreaterThan(0);
  expect(geometries.roofs.getAttribute("position").count).toBeGreaterThan(0);
  expect(geometries.windows.getAttribute("position").count).toBe(0);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
});
