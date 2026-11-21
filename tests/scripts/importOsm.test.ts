import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { buildOverpassQuery, buildSourceGrid, fetchGridBatches, importUnterwart, parseOsmXml, PHASE_ONE_PROJECTION, publishMapDirectory } from "../../scripts/import-osm";
import type { MapManifest, MapTile } from "../../src/world/tileData";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

test("builds a deterministic Unterwart source grid and complete query", () => {
  const grid = buildSourceGrid({ south: 47.235, west: 16.205, north: 47.280, east: 16.265 }, 3, 3);
  expect(grid).toHaveLength(9);
  expect(PHASE_ONE_PROJECTION.compression).toBe(1);
  expect(grid[0]).toMatchObject({ row: 0, column: 0, south: 47.235, west: 16.205 });
  const query = buildOverpassQuery(grid[0]!);
  for (const value of ["residential", "living_street", "service", "track", "building", "relation"]) expect(query).toContain(value);
});

test("parses OSM XML fallback data into nodes, ways, and relations", () => {
  const xml = `<?xml version="1.0"?><osm><node id="1" lat="47.2" lon="16.2"><tag k="name" v="Unterwart"/></node><way id="2"><nd ref="1"/><tag k="building" v="yes"/></way><relation id="3"><member type="way" ref="2" role="outer"/><tag k="type" v="multipolygon"/><tag k="building" v="yes"/></relation></osm>`;
  const parsed = parseOsmXml(xml);
  expect(parsed.elements.map((element: any) => element.type)).toEqual(["node", "way", "relation"]);
  expect((parsed.elements[1] as any).nodes).toEqual([1]);
  expect((parsed.elements[2] as any).members[0]).toEqual({ type: "way", ref: 2, role: "outer" });
});

test("rejects successful-looking partial or invalid source responses", async () => {
  const cells = buildSourceGrid({ south: 0, west: 0, north: 1, east: 1 }, 1, 1);
  const fetcher: typeof fetch = async (input) => String(input).includes("api.openstreetmap.org")
    ? new Response("<html>error</html>", { status: 200 })
    : Response.json({ remark: "runtime error: Query timed out", elements: [{ type: "node", id: 1, lat: 0, lon: 0 }] });
  await expect(fetchGridBatches(cells, fetcher, ["overpass"])).rejects.toThrow();
});

test("fetches every grid cell with source fallback", async () => {
  const cells = buildSourceGrid({ south: 0, west: 0, north: 1, east: 1 }, 1, 2);
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return calls === 1 ? new Response("bad", { status: 502 }) : Response.json({ elements: [] });
  };
  const batches = await fetchGridBatches(cells, fetcher, ["first", "second"]);
  expect(batches).toHaveLength(2);
  expect(calls).toBe(4);
});

test("preserves the published manifest when any source cell fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "fried-map-fail-")); dirs.push(root);
  const output = join(root, "map"); await mkdir(output); await writeFile(join(output, "manifest.json"), "last-valid", "utf8");
  const fetcher: typeof fetch = async (input) => String(input).includes("api.openstreetmap.org")
    ? new Response("<html>error</html>", { status: 200 })
    : Response.json({ remark: "runtime error: timed out", elements: [] });
  await expect(importUnterwart(output, fetcher)).rejects.toThrow();
  expect(await readFile(join(output, "manifest.json"), "utf8")).toBe("last-valid");
});

test("publishes minified map tiles atomically", async () => {
  const root = await mkdtemp(join(tmpdir(), "fried-map-")); dirs.push(root);
  const output = join(root, "map");
  await mkdir(output); await writeFile(join(output, "old.txt"), "keep", "utf8");
  const tile: MapTile = { version: 2, id: "0-0", x: 0, z: 0, bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, roads: [], buildings: [] };
  const manifest: MapManifest = { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", grid: { minX: 0, minZ: 0, tileSize: 100, columns: 1, rows: 1 }, tiles: [{ id: "0-0", x: 0, z: 0, url: "/map/tile-0-0.json" }], towns: [{ name: "Unterwart", x: 0, z: 0 }], spawn: { x: 2, z: 3 }, overviewRoads: [] };
  await publishMapDirectory(output, manifest, [tile]);
  const published = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
  expect(published.spawn).toEqual(manifest.spawn);
  expect(published.tiles[0].url).toMatch(/^\/map\/generations\/[a-f0-9]+\/tile-0-0.json$/);
  expect(await readFile(join(root, published.tiles[0].url), "utf8")).not.toContain("\n  ");
  expect(await readFile(join(output, "old.txt"), "utf8")).toBe("keep");
});
