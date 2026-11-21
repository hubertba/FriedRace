import * as THREE from "three";
import { expect, test } from "vitest";
import { MapTileManager } from "../../src/world/MapTileManager";
import type { MapManifest, MapTile } from "../../src/world/tileData";

const descriptors = Array.from({ length: 16 }, (_, index) => ({ id: `${index % 4}-${Math.floor(index / 4)}`, x: index % 4, z: Math.floor(index / 4), url: `/map/tile-${index}.json` }));
const manifest: MapManifest = { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", grid: { minX: 0, minZ: 0, tileSize: 100, columns: 4, rows: 4 }, tiles: descriptors, towns: [{ name: "Unterwart", x: 50, z: 50 }], spawn: { x: 50, z: 50 }, overviewRoads: [] };
const makeTile = (id: string): MapTile => { const [x, z] = id.split("-").map(Number); return { version: 2, id, x: x!, z: z!, bounds: { minX: x! * 100, maxX: x! * 100 + 100, minZ: z! * 100, maxZ: z! * 100 + 100 }, roads: [], buildings: [] }; };

test("loads a 3x3 neighborhood without duplicates and unloads distant tiles", async () => {
  const loads: string[] = []; const removed: unknown[] = [];
  const manager = new MapTileManager({ manifest, scene: new THREE.Scene(), loadTile: async (url) => { const id = descriptors.find((item) => item.url === url)!.id; loads.push(id); return makeTile(id); }, physics: { addBuildingCollider: () => ({}), removeCollider: (handle) => removed.push(handle) } });
  await manager.update({ x: 150, z: 150 });
  expect(manager.loadedTileIds).toHaveLength(9);
  await manager.update({ x: 150, z: 150 });
  expect(loads).toHaveLength(9);
  await manager.update({ x: 350, z: 350 });
  expect(manager.loadedTileIds.sort()).toEqual(["2-2", "2-3", "3-2", "3-3"]);
  manager.dispose();
  expect(manager.loadedTileIds).toHaveLength(0);
});

test("keeps existing tiles and warns when a tile fails", async () => {
  const warnings: string[] = [];
  const manager = new MapTileManager({ manifest, scene: new THREE.Scene(), loadTile: async (url) => { if (url.includes("5")) throw new Error("missing"); return makeTile(descriptors.find((item) => item.url === url)!.id); }, physics: { addBuildingCollider: () => ({}), removeCollider: () => undefined }, onWarning: (message) => warnings.push(message) });
  await manager.update({ x: 150, z: 150 });
  expect(manager.loadedTileIds.length).toBeGreaterThan(0);
  expect(warnings).toHaveLength(1);
  manager.dispose();
});
