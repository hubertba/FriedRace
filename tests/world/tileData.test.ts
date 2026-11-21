import { readFile } from "node:fs/promises";
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
  const relation = batch.buildings.find((building) => building.id.startsWith("relation/300/"))!;
  expect(way.height).toBe(6);
  expect(way.outer.at(0)).toEqual(way.outer.at(-1));
  expect(relation.height).toBe(12.5);
  expect(relation.inners).toHaveLength(1);
  expect(convertOsmBatch(fixture, projection).buildings).toEqual(batch.buildings);
});

test("joins split relation ways and preserves multiple outer parts", () => {
  const data: any = { elements: [
    { type: "node", id: 1, lat: 47.2, lon: 16.1 }, { type: "node", id: 2, lat: 47.2, lon: 16.11 }, { type: "node", id: 3, lat: 47.21, lon: 16.11 }, { type: "node", id: 4, lat: 47.21, lon: 16.1 },
    { type: "node", id: 5, lat: 47.22, lon: 16.1 }, { type: "node", id: 6, lat: 47.22, lon: 16.11 }, { type: "node", id: 7, lat: 47.23, lon: 16.11 }, { type: "node", id: 8, lat: 47.23, lon: 16.1 },
    { type: "way", id: 10, nodes: [1,2,3], tags: {} }, { type: "way", id: 11, nodes: [3,4,1], tags: {} }, { type: "way", id: 12, nodes: [5,6,7,8,5], tags: {} },
    { type: "relation", id: 20, members: [{type:"way",ref:10,role:"outer"},{type:"way",ref:11,role:"outer"},{type:"way",ref:12,role:"outer"}], tags: {type:"multipolygon",building:"yes"} },
  ] };
  const buildings = convertOsmBatch(data, projection).buildings.filter((building) => building.id.startsWith("relation/20"));
  expect(buildings).toHaveLength(2);
  expect(buildings.every((building) => building.outer.at(0)?.x === building.outer.at(-1)?.x && building.outer.at(0)?.z === building.outer.at(-1)?.z)).toBe(true);
});

test("rejects self-crossing footprints and holes that leave their outer ring", () => {
  const elements: any[] = [
    {type:"node",id:1,lat:47.2,lon:16.1},{type:"node",id:2,lat:47.21,lon:16.11},{type:"node",id:3,lat:47.21,lon:16.1},{type:"node",id:4,lat:47.2,lon:16.105},
    {type:"way",id:30,nodes:[1,2,3,4,1],tags:{building:"yes"}},
    {type:"node",id:10,lat:47.2,lon:16.2},{type:"node",id:11,lat:47.2,lon:16.22},{type:"node",id:12,lat:47.22,lon:16.22},{type:"node",id:13,lat:47.22,lon:16.2},
    {type:"node",id:14,lat:47.205,lon:16.205},{type:"node",id:15,lat:47.205,lon:16.23},{type:"node",id:16,lat:47.21,lon:16.205},
    {type:"way",id:31,nodes:[10,11,12,13,10],tags:{}},{type:"way",id:32,nodes:[14,15,16,14],tags:{building:"yes"}},
    {type:"relation",id:33,members:[{type:"way",ref:31,role:"outer"},{type:"way",ref:32,role:"inner"}],tags:{type:"multipolygon",building:"yes"}},
  ];
  const buildings = convertOsmBatch({elements} as any, projection).buildings;
  expect(buildings.some((building) => building.id === "way/30")).toBe(false);
  expect(buildings.some((building) => building.id === "way/32")).toBe(true);
  expect(buildings.find((building) => building.id.startsWith("relation/33/"))?.inners).toHaveLength(0);
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

test("checked-in Unterwart assets contain real streets, buildings, and the address spawn", async () => {
  const manifest = JSON.parse(await readFile("public/map/manifest.json", "utf8"));
  expect(validateMapManifest(manifest)).not.toBeNull();
  expect(manifest.towns.some((town: { name: string }) => town.name.includes("Unterwart"))).toBe(true);
  expect(manifest.spawn).toEqual({ x: 0, z: 0 });
  const tiles = await Promise.all(manifest.tiles.map(async (descriptor: { url: string }) => JSON.parse(await readFile(`public${descriptor.url}`, "utf8"))));
  expect(tiles.reduce((sum: number, tile: { buildings: unknown[] }) => sum + tile.buildings.length, 0)).toBeGreaterThan(100);
  expect(tiles.flatMap((tile: { roads: Array<{ highway: string }> }) => tile.roads).some((road: { highway: string }) => road.highway === "residential" || road.highway === "service")).toBe(true);
});

test("assigns each boundary feature to one owning tile without duplicates", () => {
  const batch = convertOsmBatch(fixture, projection);
  const grid = { minX: -50, minZ: -50, tileSize: 100, columns: 6, rows: 6 };
  const tiles = assignFeaturesToTiles(batch, grid).filter((tile) => tile.roads.length || tile.buildings.length);
  expect(tiles.length).toBeGreaterThan(0);
  const roadPieces = tiles.flatMap((tile) => tile.roads).filter((road) => road.id.startsWith("way/100#"));
  expect(roadPieces.length).toBeGreaterThan(0);
  expect(new Set(roadPieces.map((road) => road.id)).size).toBe(roadPieces.length);
  expect(tiles.flatMap((tile) => tile.buildings).filter((building) => building.id === "way/200")).toHaveLength(1);
  for (const tile of tiles) {
    expect(new Set(tile.roads.map((road) => road.id)).size).toBe(tile.roads.length);
    expect(new Set(tile.buildings.map((building) => building.id)).size).toBe(tile.buildings.length);
    expect(validateMapTile(tile)).toEqual(tile);
  }
  const manifest = buildManifest(tiles, grid, batch.towns);
  expect(validateMapManifest(manifest)).toEqual(manifest);
  expect(manifest.overviewRoads.length).toBeGreaterThan(0);
});
