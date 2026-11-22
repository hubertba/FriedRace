import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { convertOsmToMap, validateImportedMap, type OverpassResponse } from "../src/world/mapData";
import { assignFeaturesToTiles, buildManifest, convertOsmBatch, nearestRoadPoint, validateMapManifest, validateMapTile, type MapManifest, type MapTile, type TileGrid } from "../src/world/tileData";
import type { OverpassData } from "../src/world/osmTypes";

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.nchc.org.tw/api/interpreter"];
export interface GeoBounds { south: number; west: number; north: number; east: number; }
export interface SourceCell extends GeoBounds { row: number; column: number; }
const SPAWN = { lat: 47.2571447, lon: 16.2342699 };
const PHASE_ONE_BOUNDS: GeoBounds = { south: 47.235, west: 16.205, north: 47.280, east: 16.265 };
export const PHASE_ONE_PROJECTION = { originLat: SPAWN.lat, originLon: SPAWN.lon, compression: 1 } as const;

export const buildSourceGrid = (bounds: GeoBounds, rows: number, columns: number): SourceCell[] => {
  const latStep = (bounds.north - bounds.south) / rows;
  const lonStep = (bounds.east - bounds.west) / columns;
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns); const column = index % columns;
    return { row, column, south: bounds.south + row * latStep, north: bounds.south + (row + 1) * latStep, west: bounds.west + column * lonStep, east: bounds.west + (column + 1) * lonStep };
  });
};

export const buildOverpassQuery = (cell: GeoBounds): string => `[out:json][timeout:120];(
  node[place][name="Unterwart"](${cell.south},${cell.west},${cell.north},${cell.east});
  way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track)$"](${cell.south},${cell.west},${cell.north},${cell.east});
  way[building](${cell.south},${cell.west},${cell.north},${cell.east});
  way["building:part"](${cell.south},${cell.west},${cell.north},${cell.east});
  relation[type=multipolygon][building](${cell.south},${cell.west},${cell.north},${cell.east});
  relation[type=multipolygon]["building:part"](${cell.south},${cell.west},${cell.north},${cell.east});
);(._;>;);out body;`;

const fetchQuery = async (query: string, fetcher: typeof fetch, endpoints: string[]): Promise<OverpassData> => {
  const failures: string[] = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetcher(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "FriedRace tiled map importer" }, body: new URLSearchParams({ data: query }) });
      if (response.ok) {
        const data = await response.json() as OverpassData & { remark?: string };
        if (!Array.isArray(data.elements) || data.remark) throw new Error(data.remark ?? "invalid Overpass response");
        return data;
      }
      failures.push(`${endpoint}: ${response.status}`);
    } catch (error) { failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  throw new Error(`All Overpass endpoints failed: ${failures.join("; ")}`);
};

export const parseOsmXml = (xml: string): OverpassData => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", isArray: (name) => ["node", "way", "relation", "tag", "nd", "member"].includes(name) });
  const parsedDocument = parser.parse(xml);
  if (!parsedDocument?.osm || typeof parsedDocument.osm !== "object") throw new Error("Invalid OSM XML response");
  const parsed = parsedDocument.osm;
  if (parsed.error != null || parsed.remark != null) throw new Error(`OSM XML error: ${String(parsed.error ?? parsed.remark)}`);
  const tags = (items: Array<{ k: string; v: string }> = []): Record<string, string> => Object.fromEntries(items.map((item) => [item.k, item.v]));
  const elements: OverpassData["elements"] = [];
  for (const node of parsed.node ?? []) elements.push({ type: "node", id: Number(node.id), lat: Number(node.lat), lon: Number(node.lon), tags: tags(node.tag) });
  for (const way of parsed.way ?? []) elements.push({ type: "way", id: Number(way.id), nodes: (way.nd ?? []).map((item: { ref: string }) => Number(item.ref)), tags: tags(way.tag) });
  for (const relation of parsed.relation ?? []) elements.push({ type: "relation", id: Number(relation.id), members: (relation.member ?? []).map((item: { type: "way" | "node" | "relation"; ref: string; role?: string }) => ({ type: item.type, ref: Number(item.ref), role: item.role ?? "" })), tags: tags(relation.tag) });
  return { elements };
};

const fetchOsmMapCell = async (cell: SourceCell, fetcher: typeof fetch): Promise<OverpassData> => {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${cell.west},${cell.south},${cell.east},${cell.north}`;
  const response = await fetcher(url, { headers: { "User-Agent": "FriedRace tiled map importer" } });
  if (!response.ok) throw new Error(`OSM map fallback failed: ${response.status}`);
  return parseOsmXml(await response.text());
};

export const fetchGridBatches = async (cells: SourceCell[], fetcher: typeof fetch = fetch, endpoints = ENDPOINTS): Promise<OverpassData[]> => {
  const results: OverpassData[] = [];
  for (const cell of cells) {
    try { results.push(await fetchOsmMapCell(cell, fetcher)); }
    catch { results.push(await fetchQuery(buildOverpassQuery(cell), fetcher, endpoints)); }
  }
  return results;
};

export const publishMapDirectory = async (outputDir: string, manifest: MapManifest, tiles: MapTile[]): Promise<void> => {
  if (!validateMapManifest(manifest) || tiles.some((tile) => !validateMapTile(tile))) throw new Error("Invalid generated map output");
  const descriptorKeys = manifest.tiles.map((tile) => `${tile.id}:${tile.x}:${tile.z}`).sort(); const tileKeys = tiles.map((tile) => `${tile.id}:${tile.x}:${tile.z}`).sort();
  if (descriptorKeys.length !== tileKeys.length || descriptorKeys.some((key, index) => key !== tileKeys[index])) throw new Error("Manifest and tile files do not correspond");
  const generation = createHash("sha256").update(JSON.stringify(tiles)).digest("hex").slice(0, 12);
  const generationDir = resolve(outputDir, "generations", generation);
  const temporaryGeneration = `${generationDir}.tmp-${process.pid}`;
  await rm(temporaryGeneration, { recursive: true, force: true }); await mkdir(temporaryGeneration, { recursive: true });
  for (const tile of tiles) await writeFile(resolve(temporaryGeneration, `tile-${tile.id}.json`), JSON.stringify(tile), "utf8");
  for (const tile of tiles) if (!validateMapTile(JSON.parse(await readFile(resolve(temporaryGeneration, `tile-${tile.id}.json`), "utf8")))) throw new Error(`Invalid staged tile ${tile.id}`);
  await mkdir(resolve(outputDir, "generations"), { recursive: true });
  try { await rename(temporaryGeneration, generationDir); } catch { await rm(temporaryGeneration, { recursive: true, force: true }); }
  for (const tile of tiles) if (!validateMapTile(JSON.parse(await readFile(resolve(generationDir, `tile-${tile.id}.json`), "utf8")))) throw new Error(`Invalid published tile ${tile.id}`);
  const publishedManifest: MapManifest = { ...manifest, tiles: manifest.tiles.map((tile) => ({ ...tile, url: `/map/generations/${generation}/tile-${tile.id}.json` })) };
  if (!validateMapManifest(publishedManifest)) throw new Error("Invalid staged manifest");
  await mkdir(outputDir, { recursive: true });
  const temporaryManifest = resolve(outputDir, `.manifest-${process.pid}.tmp`);
  await writeFile(temporaryManifest, JSON.stringify(publishedManifest), "utf8");
  await rename(temporaryManifest, resolve(outputDir, "manifest.json"));
};

// Compatibility helpers retained until the streaming runtime replaces the legacy map.
export const replaceMapFileIfValid = async (outputPath: string, response: OverpassResponse): Promise<void> => {
  const valid = validateImportedMap(convertOsmToMap(response));
  if (!valid) throw new Error("Converted map did not pass validation");
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(valid)}\n`, "utf8");
  await rename(temporary, outputPath);
};
export const fetchOverpass = async (query: string, fetcher: typeof fetch = fetch, endpoints = ENDPOINTS): Promise<OverpassResponse> => fetchQuery(query, fetcher, endpoints) as Promise<OverpassResponse>;

export const importUnterwart = async (outputDir: string, fetcher: typeof fetch = fetch): Promise<void> => {
  const batches = await fetchGridBatches(buildSourceGrid(PHASE_ONE_BOUNDS, 3, 3), fetcher);
  const unique = new Map<string, OverpassData["elements"][number]>();
  for (const batch of batches) for (const element of batch.elements) {
    const item = element as { type?: string; id?: number };
    if (item.type && typeof item.id === "number") unique.set(`${item.type}/${item.id}`, element);
  }
  const converted = convertOsmBatch({ elements: [...unique.values()] }, PHASE_ONE_PROJECTION);
  converted.towns = converted.towns.filter((town) => town.name.includes("Unterwart"));
  if (!converted.towns.length) converted.towns.push({ name: "Unterwart", x: 0, z: 0 });
  const allPoints = [...converted.roads.flatMap((road) => road.points), ...converted.buildings.flatMap((building) => building.outer)];
  if (allPoints.length === 0) throw new Error("Import produced no map features");
  const tileSize = 120;
  const minX = Math.floor(Math.min(...allPoints.map((point) => point.x)) / tileSize) * tileSize;
  const minZ = Math.floor(Math.min(...allPoints.map((point) => point.z)) / tileSize) * tileSize;
  const maxX = Math.ceil(Math.max(...allPoints.map((point) => point.x)) / tileSize) * tileSize;
  const maxZ = Math.ceil(Math.max(...allPoints.map((point) => point.z)) / tileSize) * tileSize;
  const grid: TileGrid = { minX, minZ, tileSize, columns: Math.max(1, Math.ceil((maxX - minX) / tileSize)), rows: Math.max(1, Math.ceil((maxZ - minZ) / tileSize)) };
  const tiles = assignFeaturesToTiles(converted, grid).filter((tile) => tile.roads.length || tile.buildings.length);
  const garage = { x: 0, z: 0 }; const spawn = nearestRoadPoint(converted.roads, garage).point;
  const manifest = buildManifest(tiles, grid, converted.towns, spawn, PHASE_ONE_PROJECTION, converted.roads, garage);
  await publishMapDirectory(outputDir, manifest, tiles);
  console.log(`Published ${tiles.length} Unterwart map tiles with ${converted.roads.length} roads and ${converted.buildings.length} buildings.`);
};

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  const here = dirname(fileURLToPath(import.meta.url));
  importUnterwart(resolve(here, "../public/map")).catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
