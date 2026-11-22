import type { MapPoint } from "./mapData";
import type { OsmNode, OsmRelation, OsmWay, OverpassData, ProjectionConfig } from "./osmTypes";

export interface TiledRoad { id: string; name: string; highway: string; width: number; points: MapPoint[]; }
export type RoofShape = "flat" | "gabled" | "hipped";
export interface BuildingAppearance { buildingType: string; facadeMaterial: string; facadeColor: string; roofShape: RoofShape; roofMaterial: string; roofColor: string; roofHeight: number; }
export interface ImportedBuilding extends BuildingAppearance { id: string; name?: string; outer: MapPoint[]; inners: MapPoint[][]; height: number; minHeight: number; levels: number; }
export interface ConvertedBatch { roads: TiledRoad[]; buildings: ImportedBuilding[]; towns: Array<MapPoint & { name: string }>; }
export interface TileGrid { minX: number; minZ: number; tileSize: number; columns: number; rows: number; }
export interface MapTile { version: 2; id: string; x: number; z: number; bounds: { minX: number; maxX: number; minZ: number; maxZ: number }; roads: TiledRoad[]; buildings: ImportedBuilding[]; }
export interface MapManifest { version: 2; attribution: string; attributionUrl: string; projection?: ProjectionConfig; grid: TileGrid; tiles: Array<{ id: string; x: number; z: number; url: string }>; towns: ConvertedBatch["towns"]; spawn: MapPoint; garage?: MapPoint; overviewRoads: TiledRoad[]; }

const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service"]);
const isNode = (value: unknown): value is OsmNode => (value as OsmNode)?.type === "node" && Number.isFinite((value as OsmNode).lat) && Number.isFinite((value as OsmNode).lon);
const isWay = (value: unknown): value is OsmWay => (value as OsmWay)?.type === "way" && Array.isArray((value as OsmWay).nodes);
const isRelation = (value: unknown): value is OsmRelation => (value as OsmRelation)?.type === "relation" && Array.isArray((value as OsmRelation).members);
const round = (value: number): number => Math.round(value * 1000) / 1000;
const orientation = (a: MapPoint, b: MapPoint, c: MapPoint): number => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const onSegment = (a: MapPoint, b: MapPoint, point: MapPoint): boolean => Math.abs(orientation(a, b, point)) < 1e-6 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) && point.z >= Math.min(a.z, b.z) && point.z <= Math.max(a.z, b.z);
const segmentsIntersect = (a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean => {
  const abC = orientation(a, b, c); const abD = orientation(a, b, d); const cdA = orientation(c, d, a); const cdB = orientation(c, d, b);
  if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return true;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
};
const isSimpleRing = (ring: MapPoint[]): boolean => {
  const edges = ring.length - 1;
  for (let first = 0; first < edges; first += 1) for (let second = first + 1; second < edges; second += 1) {
    if (Math.abs(first - second) <= 1 || (first === 0 && second === edges - 1)) continue;
    if (segmentsIntersect(ring[first]!, ring[first + 1]!, ring[second]!, ring[second + 1]!)) return false;
  }
  return true;
};
const closeRing = (points: MapPoint[]): MapPoint[] => {
  if (points.length < 3) throw new Error("Degenerate building polygon");
  const ring = points.map((point) => ({ x: round(point.x), z: round(point.z) }));
  const first = ring[0]!;
  const last = ring.at(-1)!;
  if (first.x !== last.x || first.z !== last.z) ring.push({ ...first });
  if (ring.length < 4) throw new Error("Degenerate building polygon");
  const uniqueVertices = new Set(ring.slice(0, -1).map((point) => `${point.x}:${point.z}`));
  const area = Math.abs(ring.slice(0, -1).reduce((sum, point, index) => { const next = ring[index + 1]!; return sum + point.x * next.z - next.x * point.z; }, 0) / 2);
  if (uniqueVertices.size !== ring.length - 1 || area < 0.01 || !isSimpleRing(ring)) throw new Error("Degenerate building polygon");
  return ring;
};
const pointInRing = (point: MapPoint, ring: MapPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]!; const b = ring[previous]!;
    if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};
const ringEdgesIntersect = (first: MapPoint[], second: MapPoint[]): boolean => {
  for (let a = 0; a < first.length - 1; a += 1) for (let b = 0; b < second.length - 1; b += 1) if (segmentsIntersect(first[a]!, first[a + 1]!, second[b]!, second[b + 1]!)) return true;
  return false;
};
const ringsOverlap = (first: MapPoint[], second: MapPoint[]): boolean => ringEdgesIntersect(first, second) || pointInRing(first[0]!, second) || pointInRing(second[0]!, first);
const validHoles = (holes: MapPoint[][], outer: MapPoint[]): MapPoint[][] => {
  const accepted: MapPoint[][] = [];
  for (const hole of holes) {
    if (!hole.slice(0, -1).every((point) => pointInRing(point, outer))) continue;
    if (ringEdgesIntersect(hole, outer) || accepted.some((other) => ringsOverlap(hole, other))) continue;
    accepted.push(hole);
  }
  return accepted;
};
const stableIndex = (id: number, length: number, salt = 0): number => Math.abs((id * 1103515245 + 12345 + salt * 2654435761) | 0) % length;
const colorNames: Record<string, string> = { red: "#b54a3a", brown: "#795548", grey: "#777b80", gray: "#777b80", white: "#e8e3d8", beige: "#d1b995", yellow: "#d6bd73", black: "#34373a", green: "#58705a", blue: "#66839a" };
const normalizedColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${color.slice(1).split("").map((part) => part + part).join("")}`;
  return colorNames[color] ?? fallback;
};
const residentialTypes = new Set(["house", "detached", "residential", "apartments", "terrace", "semidetached_house"]);
const utilityTypes = new Set(["garage", "garages", "shed", "carport", "barn"]);
const industrialTypes = new Set(["industrial", "warehouse", "hangar", "farm_auxiliary"]);
const publicTypes = new Set(["public", "school", "civic", "government", "hospital"]);
export const resolveBuildingAppearance = (tags: Record<string, string> | undefined, id: number): BuildingAppearance => {
  const buildingType = tags?.["building:part"] && !tags?.building ? "part" : (tags?.building ?? "yes");
  const residential = residentialTypes.has(buildingType); const utility = utilityTypes.has(buildingType); const industrial = industrialTypes.has(buildingType); const church = buildingType === "church" || buildingType === "chapel"; const publicBuilding = publicTypes.has(buildingType);
  const facadePalette = utility ? ["#a99f8c", "#8f9695", "#b2aa98"] : industrial ? ["#afb6b6", "#c1b9a8", "#929b9e"] : church ? ["#d6cfbd", "#c9bea7"] : publicBuilding ? ["#d7d2c5", "#c7d0cf", "#d5c5ad"] : residential ? ["#d8b28f", "#c98f72", "#e0c9a7", "#c7b7a2", "#d5d1c3"] : ["#c8b49d", "#d4c7b5", "#b9aaa0", "#d5c7aa"];
  const roofPalette = industrial || utility ? ["#555b60", "#6b6760", "#777b80"] : ["#934b3d", "#a85a43", "#6b554c", "#55585b"];
  const fallbackShape: RoofShape = utility || industrial ? "flat" : church ? "gabled" : residential ? (["gabled", "hipped"] as RoofShape[])[stableIndex(id, 2, 3)]! : (["flat", "gabled", "hipped"] as RoofShape[])[stableIndex(id, 3, 3)]!;
  const explicitShape = tags?.["roof:shape"]?.toLowerCase();
  const roofShape: RoofShape = explicitShape === "gabled" ? "gabled" : ["hipped", "pyramidal", "half-hipped"].includes(explicitShape ?? "") ? "hipped" : explicitShape === "flat" ? "flat" : fallbackShape;
  const explicitRoofHeight = Number.parseFloat(tags?.["roof:height"] ?? ""); const roofLevels = Number.parseFloat(tags?.["roof:levels"] ?? "");
  const roofHeight = Number.isFinite(explicitRoofHeight) && explicitRoofHeight >= 0 ? explicitRoofHeight : Number.isFinite(roofLevels) && roofLevels > 0 ? roofLevels * 3 : roofShape === "flat" ? 0.35 : utility ? 0.8 : 2.4;
  const facadeFallback = facadePalette[stableIndex(id, facadePalette.length, 1)]!; const roofFallback = roofPalette[stableIndex(id, roofPalette.length, 2)]!;
  return { buildingType, facadeMaterial: tags?.["building:material"] ?? (industrial ? "metal" : utility ? "concrete" : church ? "stone" : "plaster"), facadeColor: normalizedColor(tags?.["building:colour"], facadeFallback), roofShape, roofMaterial: tags?.["roof:material"] ?? (roofShape === "flat" ? "concrete" : "tiles"), roofColor: normalizedColor(tags?.["roof:colour"], roofFallback), roofHeight };
};
const fallbackHeight = (tags: Record<string, string> | undefined, id: number): number => utilityTypes.has(tags?.building ?? "") ? 3 + stableIndex(id, 2) * 1.5 : 6 + Math.abs(id % 4) * 3;
const buildingDetails = (tags: Record<string, string> | undefined, id: number): BuildingAppearance & { height: number; minHeight: number; levels: number } => {
  const appearance = resolveBuildingAppearance(tags, id); const direct = Number.parseFloat(tags?.height ?? ""); const taggedLevels = Number.parseFloat(tags?.["building:levels"] ?? ""); const taggedMinHeight = Number.parseFloat(tags?.min_height ?? "");
  const minHeight = Number.isFinite(taggedMinHeight) && taggedMinHeight >= 0 ? Math.min(taggedMinHeight, 40) : 0;
  const height = Number.isFinite(direct) && direct > minHeight ? Math.min(direct, 80) : Number.isFinite(taggedLevels) && taggedLevels > 0 ? Math.min(minHeight + taggedLevels * 3, 80) : fallbackHeight(tags, id);
  const roofHeight = Math.min(appearance.roofHeight, Math.max(0, height - minHeight - 0.5));
  const levels = Number.isFinite(taggedLevels) && taggedLevels > 0 ? taggedLevels : Math.max(1, Math.round((height - minHeight - roofHeight) / 3));
  return { ...appearance, roofHeight, height, minHeight, levels };
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

  const representedOuterIds = new Set<number>();
  const relationBuildings = relations.filter((relation) => relation.tags?.type === "multipolygon" && ((relation.tags?.building && relation.tags.building !== "no") || relation.tags?.["building:part"])).flatMap((relation): ImportedBuilding[] => {
    for (const member of relation.members.filter((item) => item.type === "way")) if (!wayById.has(member.ref)) throw new Error(`Missing way ${member.ref}`);
    const rings = (role: string): MapPoint[][] => {
      const remaining = relation.members.filter((member) => member.type === "way" && member.role === role).map((member) => {
        const way = wayById.get(member.ref)!; return [...way.nodes];
      });
      const complete: number[][] = [];
      while (remaining.length) {
        const ring = remaining.shift()!;
        while (ring[0] !== ring.at(-1)) {
          const end = ring.at(-1)!;
          const match = remaining.findIndex((candidate) => candidate[0] === end || candidate.at(-1) === end);
          if (match < 0) throw new Error(`Building relation ${relation.id} has an open ${role} ring`);
          const next = remaining.splice(match, 1)[0]!;
          if (next.at(-1) === end) next.reverse();
          ring.push(...next.slice(1));
        }
        complete.push(ring);
      }
      return complete.map((ring) => closeRing(ring.map(project)));
    };
    try {
      const outers = rings("outer"); const inners = rings("inner");
      if (!outers.length) return [];
      relation.members.filter((member) => member.type === "way" && member.role === "outer").forEach((member) => representedOuterIds.add(member.ref));
      return outers.map((outer, index) => ({ id: `relation/${relation.id}/${index}`, name: relation.tags?.name, outer, inners: validHoles(inners, outer), ...buildingDetails(relation.tags, relation.id) }));
    } catch (error) { if (error instanceof Error && error.message.startsWith("Missing ")) throw error; return []; }
  });
  const standaloneBuildings = ways.filter((way) => ((way.tags?.building && way.tags.building !== "no") || way.tags?.["building:part"]) && !representedOuterIds.has(way.id)).flatMap((way): ImportedBuilding[] => {
    try { return [{ id: `way/${way.id}`, name: way.tags?.name, outer: closeRing(pointsForWay(way)), inners: [], ...buildingDetails(way.tags, way.id) }]; }
    catch (error) { if (error instanceof Error && error.message.startsWith("Missing ")) throw error; return []; }
  });
  const towns = nodes.filter((node) => node.tags?.place && node.tags?.name).map((node) => ({ name: node.tags!.name!, ...project(node.id) }));
  return { roads, buildings: [...standaloneBuildings, ...relationBuildings], towns };
};

export const nearestRoadPoint = (roads: TiledRoad[], origin: MapPoint): { point: MapPoint; distance: number } => {
  let nearest = { point: { ...origin }, distance: Number.POSITIVE_INFINITY };
  for (const road of roads) for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!; const end = road.points[index]!; const dx = end.x - start.x; const dz = end.z - start.z; const lengthSquared = dx * dx + dz * dz;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((origin.x - start.x) * dx + (origin.z - start.z) * dz) / lengthSquared)) : 0;
    const point = { x: round(start.x + t * dx), z: round(start.z + t * dz) }; const distance = Math.hypot(point.x - origin.x, point.z - origin.z);
    if (distance < nearest.distance) nearest = { point, distance };
  }
  if (!Number.isFinite(nearest.distance)) throw new Error("No drivable road available for spawn");
  return nearest;
};

const boundsOfPoints = (points: MapPoint[]): { minX: number; maxX: number; minZ: number; maxZ: number } => ({
  minX: Math.min(...points.map((point) => point.x)), maxX: Math.max(...points.map((point) => point.x)),
  minZ: Math.min(...points.map((point) => point.z)), maxZ: Math.max(...points.map((point) => point.z)),
});
export const assignFeaturesToTiles = (batch: ConvertedBatch, grid: TileGrid): MapTile[] => {
  const owner = (points: MapPoint[]): string => {
    const bounds = boundsOfPoints(points); const centerX = (bounds.minX + bounds.maxX) / 2; const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const x = Math.max(0, Math.min(grid.columns - 1, Math.floor((centerX - grid.minX) / grid.tileSize)));
    const z = Math.max(0, Math.min(grid.rows - 1, Math.floor((centerZ - grid.minZ) / grid.tileSize)));
    return `${x}-${z}`;
  };
  const roadsByTile = new Map<string, TiledRoad[]>(); const buildingsByTile = new Map<string, ImportedBuilding[]>();
  for (const road of batch.roads) for (let index = 1; index < road.points.length; index += 1) {
    const start = road.points[index - 1]!; const end = road.points[index]!; const ts = [0, 1];
    for (let x = grid.minX + grid.tileSize; x < grid.minX + grid.columns * grid.tileSize; x += grid.tileSize) { const t = (x - start.x) / (end.x - start.x); if (t > 0 && t < 1) ts.push(t); }
    for (let z = grid.minZ + grid.tileSize; z < grid.minZ + grid.rows * grid.tileSize; z += grid.tileSize) { const t = (z - start.z) / (end.z - start.z); if (t > 0 && t < 1) ts.push(t); }
    const sorted = [...new Set(ts.filter(Number.isFinite))].sort((a, b) => a - b);
    for (let piece = 1; piece < sorted.length; piece += 1) {
      const fromT = sorted[piece - 1]!; const toT = sorted[piece]!;
      const points = [fromT, toT].map((t) => ({ x: round(start.x + (end.x - start.x) * t), z: round(start.z + (end.z - start.z) * t) }));
      const id = owner(points); const clipped = { ...road, id: `${road.id}#${index - 1}-${piece - 1}`, points };
      roadsByTile.set(id, [...(roadsByTile.get(id) ?? []), clipped]);
    }
  }
  for (const building of batch.buildings) { const id = owner(building.outer); buildingsByTile.set(id, [...(buildingsByTile.get(id) ?? []), building]); }
  const tiles: MapTile[] = [];
  for (let z = 0; z < grid.rows; z += 1) for (let x = 0; x < grid.columns; x += 1) {
    const id = `${x}-${z}`; const bounds = { minX: grid.minX + x * grid.tileSize, maxX: grid.minX + (x + 1) * grid.tileSize, minZ: grid.minZ + z * grid.tileSize, maxZ: grid.minZ + (z + 1) * grid.tileSize };
    tiles.push({ version: 2, id, x, z, bounds, roads: roadsByTile.get(id) ?? [], buildings: buildingsByTile.get(id) ?? [] });
  }
  return tiles;
};

export const buildManifest = (tiles: MapTile[], grid: TileGrid, towns: ConvertedBatch["towns"], spawn: MapPoint = { x: 0, z: 0 }, projection?: ProjectionConfig, sourceRoads?: TiledRoad[], garage: MapPoint = spawn): MapManifest => {
  const roads = sourceRoads ?? [...new Map(tiles.flatMap((tile) => tile.roads).map((road) => [road.id, road])).values()];
  return { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", projection, grid, tiles: tiles.map((tile) => ({ id: tile.id, x: tile.x, z: tile.z, url: `/map/tile-${tile.id}.json` })), towns, spawn, garage, overviewRoads: roads.map((road) => ({ ...road, points: road.points.filter((_, index) => index === 0 || index === road.points.length - 1 || index % 4 === 0) })) };
};

export const validateMapTile = (value: unknown): MapTile | null => {
  const tile = value as MapTile;
  return tile?.version === 2 && typeof tile.id === "string" && Array.isArray(tile.roads) && Array.isArray(tile.buildings) ? tile : null;
};
export const validateMapManifest = (value: unknown): MapManifest | null => {
  const manifest = value as MapManifest;
  const grid = manifest?.grid;
  const validGrid = Number.isFinite(grid?.minX) && Number.isFinite(grid?.minZ) && Number.isFinite(grid?.tileSize) && grid.tileSize > 0 && Number.isInteger(grid?.columns) && grid.columns > 0 && Number.isInteger(grid?.rows) && grid.rows > 0;
  const validTiles = Array.isArray(manifest?.tiles) && new Set(manifest.tiles.map((tile) => tile.id)).size === manifest.tiles.length && manifest.tiles.every((tile) => typeof tile.id === "string" && Number.isInteger(tile.x) && Number.isInteger(tile.z) && tile.url.startsWith("/map/"));
  return manifest?.version === 2 && validGrid && validTiles && Array.isArray(manifest.overviewRoads) && Array.isArray(manifest.towns) && Number.isFinite(manifest.spawn?.x) && Number.isFinite(manifest.spawn?.z) ? manifest : null;
};
