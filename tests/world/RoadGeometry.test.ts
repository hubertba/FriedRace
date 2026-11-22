import { expect, test } from "vitest";
import * as THREE from "three";
import { buildRoadGeometries, roadSupportsCenterMarking } from "../../src/world/RoadGeometry";
import type { MapTile, TiledRoad } from "../../src/world/tileData";

const road = (overrides: Partial<TiledRoad> = {}): TiledRoad => ({ id: "road", name: "Road", highway: "primary", width: 8, points: [{x:0,z:20},{x:50,z:20}], ...overrides });
const tile = (roads: TiledRoad[]): MapTile => ({ version: 2, id: "0-0", x: 0, z: 0, bounds: {minX:0,maxX:100,minZ:0,maxZ:100}, roads, buildings: [] });
const finite = (geometry: THREE.BufferGeometry): boolean => Object.values(geometry.attributes).every((attribute) => Array.from(attribute.array).every(Number.isFinite));

test("builds UV road surfaces, wider shoulders, and upward normals", () => {
  const geometries = buildRoadGeometries(tile([road()]));
  expect(geometries.surface.getAttribute("uv").count).toBe(geometries.surface.getAttribute("position").count);
  geometries.surface.computeBoundingBox(); geometries.shoulders.computeBoundingBox();
  expect(geometries.shoulders.boundingBox!.max.z-geometries.shoulders.boundingBox!.min.z).toBeGreaterThan(geometries.surface.boundingBox!.max.z-geometries.surface.boundingBox!.min.z);
  const normals = geometries.surface.getAttribute("normal"); expect(Array.from({length:normals.count},(_,index)=>normals.getY(index)).every((value)=>value>0.9)).toBe(true);
  Object.values(geometries).forEach((geometry)=>geometry.dispose());
});

test("adds dashed markings only to suitable wide road classes", () => {
  expect(roadSupportsCenterMarking(road())).toBe(true);
  expect(roadSupportsCenterMarking(road({highway:"residential",width:8}))).toBe(false);
  expect(roadSupportsCenterMarking(road({highway:"secondary",width:5}))).toBe(false);
  expect(buildRoadGeometries(tile([road()])).markings.getAttribute("position").count).toBeGreaterThan(0);
  expect(buildRoadGeometries(tile([road({highway:"service",width:5})])).markings.getAttribute("position").count).toBe(0);
});

test("returns finite empty geometry for zero-length segments", () => {
  const geometries = buildRoadGeometries(tile([road({points:[{x:2,z:2},{x:2,z:2}]})]));
  expect(Object.values(geometries).every((geometry)=>geometry.getAttribute("position").count===0)).toBe(true);
  expect(Object.values(geometries).every(finite)).toBe(true);
});

test("omits malformed roads while keeping valid siblings", () => {
  const geometries = buildRoadGeometries(tile([
    road({ id: "bad", width: Number.NaN, points: [{ x: 0, z: 0 }, { x: 1e9, z: 0 }] }),
    { id: "missing", name: "Missing", highway: "primary", width: 8 } as TiledRoad,
    road({ id: "ok", points: [{ x: 0, z: 20 }, { x: 40, z: 20 }] }),
  ]));
  expect(geometries.surface.getAttribute("position").count).toBeGreaterThan(0);
  expect(Object.values(geometries).every(finite)).toBe(true);
  Object.values(geometries).forEach((geometry) => geometry.dispose());
});
