import { expect, test } from "vitest";
import fixture from "../fixtures/osm-buildings.json";
import { assignFeaturesToTiles, buildManifest, convertOsmBatch, validateMapManifest, validateMapTile } from "../../src/world/tileData";

const projection = { originLat: 47.2, originLon: 16.1, compression: 0.035 };

test("converts all normal drivable streets and excludes non-drivable ways", () => {
  const batch = convertOsmBatch(fixture, projection);
  expect(batch.roads.map((road) => road.highway)).toEqual(["residential", "living_street", "service", "track"]);
});

test("converts building ways and multipolygon relations with deterministic heights", () => {
  const batch = convertOsmBatch(fixture, projection);
  const way = batch.buildings.find((building) => building.id === "way/200")!;
  const relation = batch.buildings.find((building) => building.id === "relation/300")!;
  expect(way.height).toBe(6);
  expect(way.outer.at(0)).toEqual(way.outer.at(-1));
  expect(relation.height).toBe(12.5);
  expect(relation.inners).toHaveLength(1);
  expect(convertOsmBatch(fixture, projection).buildings).toEqual(batch.buildings);
});

test("rejects missing referenced geometry", () => {
  const broken = structuredClone(fixture);
  const way = broken.elements.find((element) => element.type === "way" && element.id === 100)! as any;
  way.nodes.push(99999);
  expect(() => convertOsmBatch(broken, projection)).toThrow(/missing node/i);
  const brokenRelation = structuredClone(fixture);
  const relation = brokenRelation.elements.find((element) => element.type === "relation")! as any;
  relation.members.push({ type: "way", ref: 99999, role: "outer" });
  expect(() => convertOsmBatch(brokenRelation, projection)).toThrow(/missing way/i);
});

test("assigns boundary features to touched tiles without duplicates", () => {
  const batch = convertOsmBatch(fixture, projection);
  const grid = { minX: -50, minZ: -50, tileSize: 100, columns: 6, rows: 6 };
  const tiles = assignFeaturesToTiles(batch, grid).filter((tile) => tile.roads.length || tile.buildings.length);
  expect(tiles.length).toBeGreaterThan(1);
  for (const tile of tiles) {
    expect(new Set(tile.roads.map((road) => road.id)).size).toBe(tile.roads.length);
    expect(new Set(tile.buildings.map((building) => building.id)).size).toBe(tile.buildings.length);
    expect(validateMapTile(tile)).toEqual(tile);
  }
  const manifest = buildManifest(tiles, grid, batch.towns);
  expect(validateMapManifest(manifest)).toEqual(manifest);
  expect(manifest.overviewRoads.length).toBeGreaterThan(0);
});
