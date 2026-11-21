import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { buildOverpassQuery, buildSourceGrid, fetchGridBatches, publishMapDirectory } from "../../scripts/import-osm";
import type { MapManifest, MapTile } from "../../src/world/tileData";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

test("builds a deterministic Unterwart source grid and complete query", () => {
  const grid = buildSourceGrid({ south: 47.235, west: 16.205, north: 47.280, east: 16.265 }, 3, 3);
  expect(grid).toHaveLength(9);
  expect(grid[0]).toMatchObject({ row: 0, column: 0, south: 47.235, west: 16.205 });
  const query = buildOverpassQuery(grid[0]!);
  for (const value of ["residential", "living_street", "service", "track", "building", "relation"]) expect(query).toContain(value);
});

test("fetches grid batches with endpoint fallback", async () => {
  const cells = buildSourceGrid({ south: 0, west: 0, north: 1, east: 1 }, 1, 2);
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return calls === 1 ? new Response("bad", { status: 502 }) : Response.json({ elements: [] });
  };
  const batches = await fetchGridBatches(cells, fetcher, ["first", "second"]);
  expect(batches).toHaveLength(2);
  expect(calls).toBe(3);
});

test("publishes minified map tiles atomically", async () => {
  const root = await mkdtemp(join(tmpdir(), "fried-map-")); dirs.push(root);
  const output = join(root, "map");
  await mkdir(output); await writeFile(join(output, "old.txt"), "keep", "utf8");
  const tile: MapTile = { version: 2, id: "0-0", x: 0, z: 0, bounds: { minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, roads: [], buildings: [] };
  const manifest: MapManifest = { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", grid: { minX: 0, minZ: 0, tileSize: 100, columns: 1, rows: 1 }, tiles: [{ id: "0-0", x: 0, z: 0, url: "/map/tile-0-0.json" }], towns: [{ name: "Unterwart", x: 0, z: 0 }], spawn: { x: 2, z: 3 }, overviewRoads: [] };
  await publishMapDirectory(output, manifest, [tile]);
  expect(JSON.parse(await readFile(join(output, "manifest.json"), "utf8"))).toEqual(manifest);
  expect(await readFile(join(output, "tile-0-0.json"), "utf8")).not.toContain("\n  ");
  expect(await readFile(join(output, "old.txt"), "utf8").catch(() => "missing")).toBe("missing");
});
