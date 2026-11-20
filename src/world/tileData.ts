import type { MapPoint } from "./mapData";
import type { OsmNode, OsmRelation, OsmWay, OverpassData, ProjectionConfig } from "./osmTypes";

export interface TiledRoad { id: string; name: string; highway: string; width: number; points: MapPoint[]; }
export interface ImportedBuilding { id: string; name?: string; outer: MapPoint[]; inners: MapPoint[][]; height: number; levels?: number; }
export interface ConvertedBatch { roads: TiledRoad[]; buildings: ImportedBuilding[]; towns: Array<MapPoint & { name: string }>; }
export interface TileGrid { minX: number; minZ: number; tileSize: number; columns: number; rows: number; }
export interface MapTile { version: 2; id: string; x: number; z: number; bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; roads: TiledRoad[]; buildings: ImportedBuilding[]; }
export interface MapManifest { version: 2; attribution: string; attributionUrl: string; grid: TileGrid; tiles: Array<{ id: string; x: number; z: number; url: string }>; towns: ConvertedBatch["towns"]; overviewRoads: TiledRoad[]; }

const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service"]);
const isNode = (value: unknown): value is OsmNode => (value as OsmNode)?.type === "node" && Number.isFinite((value as OsmNode).lat) && Number.isFinite((value as OsmNode).lon);
const isWay = (value: unknown): value is OsmWay => (value as OsmWay)?.type === "way" && Array.isArray((value as OsmWay).nodes);
const isRelation = (value: unknown): value is OsmRelation => (value as OsmRelation)?.type === "relation" && Array.isArray((value as OsmRelation).members);
const round = (value: number): number => Math.round(value * 1000) / 1000;
const closeRing = (points: MapPoint[]): MapPoint[] => {
  if (points.length < 3) throw new Error("Degenerate building polygon");
  const ring = points.map((point) => ({ x: round(point.x), z: round(point.z) }));
  const first = ring[0]!;
  const last = ring.at(-1)!;
  if (first.x !== last.x || first.z !== last.z) ring.push({ ...first });
  if (ring.length < 4) throw new Error("Degenerate building polygon");
  return ring;
};
const fallbackHeight = (id: number): number => 6 + Math.abs(id % 4) * 3;
const buildingHeight = (tags: Record<string, string> | undefined, id: number): { height: number; levels?: number } => {
  const direct = Number.parseFloat(tags?.height ?? "");
  const levels = Number.parseFloat(tags?.["building:levels"] ?? "");
  if (Number.isFinite(direct) && direct > 0) return { height: Math.min(direct, 80), levels: Number.isFinite(levels) ? levels : undefined };
  if (Number.isFinite(levels) && levels > 0) return { height: Math.min(levels * 3, 80), levels };
  return { height: fallbackHeight(id) };
};

export const convertOsmBatch = (input: OverpassData, projection: ProjectionConfig): ConvertedBatch => {
  if (!input || !Array.isArray(input.elements)) throw new Error("Invalid Overpass batch");
  const nodes = input.elements.filter(isNode);
  const ways = input.elements.filter(isWay);
  const relations = input.elements.filter(isRelation);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const wayById = new Map(ways.map((way) => [way.id, way]));
  const cosLat = Math.cos(projection.originLat * Math.PI / 180);
  const project = (nodeId: number): MapPoint => {
    const node = nodeById.get(nodeId);
    if (!node) throw new Error(`Missing node ${nodeId}`);
    return {
      x: round((node.lon - projection.originLon) * 111_320 * cosLat * projection.compression),
      z: round(-(node.lat - projection.originLat) * 110_540 * projection.compression),
    };
  };
  const pointsForWay = (way: OsmWay): MapPoint[] => way.nodes.map(project);
  const roads = ways.filter((way) => {
    const highway = way.tags?.highway ?? "";
    if (ROAD_CLASSES.has(highway)) return way.tags?.access !== "private" && way.tags?.motor_vehicle !== "no";
    return highway === "track" && way.tags?.access !== "private" && way.tags?.motor_vehicle !== "no" && ["grade1", "grade2"].includes(way.tags?.tracktype ?? "grade1");
  }).map((way): TiledRoad => ({
    id: `way/${way.id}`,
    name: way.tags?.name ?? `Road ${way.id}`,
    highway: way.tags!.highway!,
    width: Number.parseFloat(way.tags?.width ?? "") || (way.tags?.highway === "service" ? 4 : 7),
    points: pointsForWay(way),
  })).filter((road) => road.points.length >= 2);

  const standaloneBuildings = ways.filter((way) => way.tags?.building && way.tags.building !== "no").map((way): ImportedBuilding => ({
    id: `way/${way.id}`,
    name: way.tags?.name,
    outer: closeRing(pointsForWay(way)),
    inners: [],
    ...buildingHeight(way.tags, way.id),
  }));
  const relationBuildings = relations.filter((relation) => relation.tags?.type === "multipolygon" && relation.tags?.building && relation.tags.building !== "no").map((relation): ImportedBuilding => {
    const rings = (role: string): MapPoint[][] => relation.members.filter((member) => member.type === "way" && member.role === role).map((member) => {
      const way = wayById.get(member.ref);
      if (!way) throw new Error(`Missing way ${member.ref}`);
      return closeRing(pointsForWay(way));
    });
    const outers = rings("outer");
    if (outers.length === 0) throw new Error(`Building relation ${relation.id} has no outer ring`);
    return { id: `relation/${relation.id}`, name: relation.tags?.name, outer: outers[0]!, inners: rings("inner"), ...buildingHeight(relation.tags, relation.id) };
  });
  const towns = nodes.filter((node) => node.tags?.place && node.tags?.name).map((node) => ({ name: node.tags!.name!, ...project(node.id) }));
  return { roads, buildings: [...standaloneBuildings, ...relationBuildings], towns };
};

const boundsOfPoints = (points: MapPoint[]): { minX: number; maxX: number; minZ: number; maxZ: number } => ({
  minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
  minZ: Math.min(...points.map((point) => point.z)), maxZ: Math.max(...points.map((point) => point.z)),
});
const touches = (a: ReturnType<typeof boundsOfPoints>, b: ReturnType<typeof boundsOfPoints>): boolean => a.maxX >= b.minX && a.minX <= b.maxX && a.maxZ >= b.minZ && a.minZ <= b.maxZ;

export const assignFeaturesToTiles = (batch: ConvertedBatch, grid: TileGrid): MapTile[] => {
  const tiles: MapTile[] = [];
  for (let z = 0; z < grid.rows; z += 1) for (let x = 0; x < grid.columns; x += 1) {
    const bounds = { minX: grid.minX + x * grid.tileSize, maxX: grid.minX + (x + 1) * grid.tileSize, minZ: grid.minZ + z * grid.tileSize, maxZ: grid.minZ + (z + 1) * grid.tileSize };
    const roads = batch.roads.filter((road) => touches(boundsOfPoints(road.points), bounds));
    const buildings = batch.buildings.filter((building) => touches(boundsOfPoints(building.outer), bounds));
    tiles.push({ version: 2, id: `${x}-${z}`, x, z, bounds, roads: [...new Map(roads.map((road) => [road.id, road])).values()], buildings: [...new Map(buildings.map((building) => [building.id, building])).values()] });
  }
  return tiles;
};

export const buildManifest = (tiles: MapTile[], grid: TileGrid, towns: ConvertedBatch["towns"]): MapManifest => {
  const roads = [...new Map(tiles.flatMap((tile) => tile.roads).map((road) => [road.id, road])).values()];
  return { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", grid, tiles: tiles.map((tile) => ({ id: tile.id, x: tile.x, z: tile.z, url: `/map/tile-${tile.id}.json` })), towns, overviewRoads: roads.map((road) => ({ ...road, points: road.points.filter((_, index) => index === 0 || index === road.points.length - 1 || index % 4 === 0) })) };
};

export const validateMapTile = (value: unknown): MapTile | null => {
  const tile = value as MapTile;
  return tile?.version === 2 && typeof tile.id === "string" && Array.isArray(tile.roads) && Array.isArray(tile.buildings) ? tile : null;
};
export const validateMapManifest = (value: unknown): MapManifest | null => {
  const manifest = value as MapManifest;
  return manifest?.version === 2 && Array.isArray(manifest.tiles) && Array.isArray(manifest.overviewRoads) && Array.isArray(manifest.towns) ? manifest : null;
};
