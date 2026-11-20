export interface OsmNode { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string>; }
export interface OsmWay { type: "way"; id: number; nodes: number[]; tags?: Record<string, string>; }
export interface OsmRelationMember { type: "way" | "node" | "relation"; ref: number; role: string; }
export interface OsmRelation { type: "relation"; id: number; members: OsmRelationMember[]; tags?: Record<string, string>; }
export interface OverpassData { elements: Array<OsmNode | OsmWay | OsmRelation | Record<string, unknown>>; }
export interface ProjectionConfig { originLat: number; originLon: number; compression: number; }
