export const REQUIRED_TOWNS = ["Unterwart", "Oberwart", "Pinkafeld", "Oberschützen", "Großpetersdorf"] as const;
export const MAP_COMPRESSION = 0.035;
const TOWN_CENTERS: Record<(typeof REQUIRED_TOWNS)[number], { lat: number; lon: number }> = {
  Unterwart: { lat: 47.258, lon: 16.232 },
  Oberwart: { lat: 47.289, lon: 16.205 },
  Pinkafeld: { lat: 47.371, lon: 16.124 },
  Oberschützen: { lat: 47.352, lon: 16.207 },
  Großpetersdorf: { lat: 47.238, lon: 16.317 },
};
const DRIVEABLE = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified"]);

interface OsmNode { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string>; }
interface OsmWay { type: "way"; id: number; nodes: number[]; tags?: Record<string, string>; }
export interface OverpassResponse { elements: Array<OsmNode | OsmWay | Record<string, unknown>>; }
export interface MapPoint { x: number; z: number; }
export interface ImportedRoad { id: number; name: string; highway: string; points: MapPoint[]; }
export interface ImportedTown extends MapPoint { name: string; }
export interface ImportedMap {
  version: 1;
  attribution: "© OpenStreetMap contributors";
  attributionUrl: "https://www.openstreetmap.org/copyright";
  towns: ImportedTown[];
  roads: ImportedRoad[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const isNode = (value: unknown): value is OsmNode => {
  const item = value as Partial<OsmNode>;
  return item?.type === "node" && typeof item.id === "number" && Number.isFinite(item.lat) && Number.isFinite(item.lon);
};
const isWay = (value: unknown): value is OsmWay => {
  const item = value as Partial<OsmWay>;
  return item?.type === "way" && typeof item.id === "number" && Array.isArray(item.nodes);
};
const key = (point: MapPoint): string => `${point.x.toFixed(4)},${point.z.toFixed(4)}`;

const largestConnectedWays = (ways: OsmWay[]): OsmWay[] => {
  if (ways.length === 0) return [];
  const nodeWays = new Map<number, number[]>();
  ways.forEach((way, index) => way.nodes.forEach((node) => nodeWays.set(node, [...(nodeWays.get(node) ?? []), index])));
  const remaining = new Set(ways.map((_, index) => index));
  let largest: number[] = [];
  while (remaining.size) {
    const seed = remaining.values().next().value as number;
    const queue = [seed];
    const component: number[] = [];
    remaining.delete(seed);
    while (queue.length) {
      const index = queue.pop()!;
      component.push(index);
      for (const node of ways[index]!.nodes) {
        for (const neighbor of nodeWays.get(node) ?? []) {
          if (remaining.delete(neighbor)) queue.push(neighbor);
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  return largest.map((index) => ways[index]!);
};

export const convertOsmToMap = (input: OverpassResponse): ImportedMap => {
  if (!input || !Array.isArray(input.elements)) throw new Error("Invalid Overpass response");
  const nodes = input.elements.filter(isNode);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const townNodes = REQUIRED_TOWNS.map((name, index): OsmNode => nodes.find((node) => node.tags?.name === name && node.tags.place) ?? ({
    type: "node",
    id: -(index + 1),
    ...TOWN_CENTERS[name],
    tags: { place: "town", name },
  }));
  const originLat = townNodes.reduce((sum, town) => sum + town.lat, 0) / townNodes.length;
  const originLon = townNodes.reduce((sum, town) => sum + town.lon, 0) / townNodes.length;
  const cosLat = Math.cos(originLat * Math.PI / 180);
  const project = (node: OsmNode): MapPoint => ({
    x: (node.lon - originLon) * 111_320 * cosLat * MAP_COMPRESSION,
    z: -(node.lat - originLat) * 110_540 * MAP_COMPRESSION,
  });
  const driveableWays = input.elements.filter(isWay).filter((way) => DRIVEABLE.has(way.tags?.highway ?? ""));
  const connectedWays = largestConnectedWays(driveableWays);
  const roads = connectedWays.map((way) => {
    const points: MapPoint[] = [];
    for (const nodeId of way.nodes) {
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const point = project(node);
      if (points.length === 0 || key(points.at(-1)!) !== key(point)) points.push(point);
    }
    return { id: way.id, name: way.tags?.name ?? `Straße ${way.id}`, highway: way.tags?.highway ?? "road", points };
  }).filter((road) => road.points.length >= 2);
  if (roads.length === 0) throw new Error("No connected driveable roads");
  const towns = townNodes.map((town, index) => ({ name: REQUIRED_TOWNS[index]!, ...project(town) }));
  const points = [...towns, ...roads.flatMap((road) => road.points)];
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  return {
    version: 1,
    attribution: "© OpenStreetMap contributors",
    attributionUrl: "https://www.openstreetmap.org/copyright",
    towns,
    roads,
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
  };
};

export const validateImportedMap = (value: unknown): ImportedMap | null => {
  const map = value as Partial<ImportedMap>;
  if (map?.version !== 1 || !Array.isArray(map.towns) || !Array.isArray(map.roads) || map.roads.length === 0) return null;
  if (!REQUIRED_TOWNS.every((name) => map.towns!.some((town) => town.name === name))) return null;
  const points = [...map.towns, ...map.roads.flatMap((road) => road.points ?? [])];
  if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.z))) return null;
  return map as ImportedMap;
};
