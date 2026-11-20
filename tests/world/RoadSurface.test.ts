import { expect, test } from "vitest";
import fixture from "../fixtures/osm-region.json";
import { convertOsmToMap } from "../../src/world/mapData";
import { createRoadSurface } from "../../src/world/RoadSurface";

test("builds visible road strips and distinguishes road from terrain", () => {
  const map = convertOsmToMap(fixture);
  const surface = createRoadSurface(map, 6);
  expect(surface.vertices.length).toBeGreaterThan(0);
  const roadPoint = map.roads[0]!.points[0]!;
  expect(surface.isOnRoad(roadPoint)).toBe(true);
  expect(surface.isOnRoad({ x: map.bounds.maxX + 50, z: map.bounds.maxZ + 50 })).toBe(false);
});
