import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import fixture from "../fixtures/osm-region.json";
import { fetchOverpass, replaceMapFileIfValid } from "../../scripts/import-osm";
import { convertOsmToMap, validateImportedMap } from "../../src/world/mapData";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))));

describe("OSM map conversion", () => {
  test("creates a finite connected road map for all five towns", () => {
    const map = convertOsmToMap(fixture);
    expect(map.towns.map((town) => town.name)).toEqual([
      "Unterwart", "Oberwart", "Pinkafeld", "Oberschützen", "Großpetersdorf",
    ]);
    expect(map.roads.map((road) => road.highway)).not.toContain("footway");
    expect(map.roads.map((road) => road.highway)).not.toContain("residential");
    expect(map.roads.flatMap((road) => road.points).every((point) => Number.isFinite(point.x) && Number.isFinite(point.z))).toBe(true);
    expect(map.roads[0]?.points).toHaveLength(4);
    expect(validateImportedMap(map)).toEqual(map);
    const allX = map.towns.map((town) => town.x);
    expect(Math.min(...allX)).toBeLessThan(0);
    expect(Math.max(...allX)).toBeGreaterThan(0);
  });

  test("uses configured town centers when Overpass omits place labels", () => {
    const withoutPlaces = {
      elements: fixture.elements.filter((element) => !(element.type === "node" && "tags" in element && element.tags?.place)),
    };
    expect(convertOsmToMap(withoutPlaces).towns.map((town) => town.name)).toEqual([
      "Unterwart", "Oberwart", "Pinkafeld", "Oberschützen", "Großpetersdorf",
    ]);
  });

  test("falls back to a second Overpass endpoint after a server error", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input): Promise<Response> => {
      calls.push(String(input));
      return calls.length === 1
        ? new Response("bad gateway", { status: 502 })
        : Response.json(fixture);
    };
    await expect(fetchOverpass("query", fetcher, ["first", "second"])).resolves.toEqual(fixture);
    expect(calls).toEqual(["first", "second"]);
  });

  test("does not replace a valid map with incomplete data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fried-race-osm-"));
    dirs.push(dir);
    const output = join(dir, "region.json");
    await writeFile(output, "existing-map", "utf8");
    await expect(replaceMapFileIfValid(output, { elements: [] })).rejects.toThrow();
    expect(await readFile(output, "utf8")).toBe("existing-map");
  });
});
