import * as THREE from "three";
import { expect, test, vi } from "vitest";
import { MapTileManager } from "../../src/world/MapTileManager";
import type { MapManifest, MapTile } from "../../src/world/tileData";

const descriptors = Array.from({ length: 16 }, (_, index) => ({ id: `${index % 4}-${Math.floor(index / 4)}`, x: index % 4, z: Math.floor(index / 4), url: `/map/tile-${index}.json` }));
const manifest: MapManifest = { version: 2, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", grid: { minX: 0, minZ: 0, tileSize: 100, columns: 4, rows: 4 }, tiles: descriptors, towns: [{ name: "Unterwart", x: 50, z: 50 }], spawn: { x: 50, z: 50 }, overviewRoads: [] };
const makeTile = (id: string): MapTile => { const [x, z] = id.split("-").map(Number); const minX = x! * 100; const minZ = z! * 100; return { version: 2, id, x: x!, z: z!, bounds: { minX, maxX: minX + 100, minZ, maxZ: minZ + 100 }, roads: [], buildings: [{ id: `building-${id}`, outer: [{x:minX+10,z:minZ+10},{x:minX+20,z:minZ+10},{x:minX+20,z:minZ+20},{x:minX+10,z:minZ+20},{x:minX+10,z:minZ+10}], inners: [], height: 6, minHeight: 0, levels: 2, buildingType: "house", facadeMaterial: "plaster", facadeColor: "#d8b28f", roofShape: "gabled", roofMaterial: "tiles", roofColor: "#934b3d", roofHeight: 2 }] }; };

test("loads a 3x3 neighborhood without duplicates and unloads distant tiles", async () => {
  const loads: string[] = []; const removed: unknown[] = []; const scene = new THREE.Scene();
  const manager = new MapTileManager({ manifest, scene, loadTile: async (url) => { const id = descriptors.find((item) => item.url === url)!.id; loads.push(id); return makeTile(id); }, physics: { addBuildingCollider: () => ({}), removeCollider: (handle) => removed.push(handle) } });
  await manager.update({ x: 150, z: 150 });
  expect(manager.loadedTileIds).toHaveLength(9);
  expect(manager.loadedBuildingLayerNames.sort()).toEqual(["building-foundations", "building-roofs", "building-walls", "building-windows"]);
  expect(manager.loadedRoadLayerNames.sort()).toEqual(["road-markings", "road-shoulders", "road-surface"]);
  expect(manager.loadedDecorationLayerNames.sort()).toEqual(["decoration-bushes", "decoration-grass", "decoration-trees"]);
  const unloadingGroup = scene.getObjectByName("map-tile-0-0")!; const buildingMeshes = ["building-foundations", "building-walls", "building-roofs", "building-windows"].map((name) => unloadingGroup.getObjectByName(name) as THREE.Mesh); const roadMeshes = ["road-surface", "road-shoulders", "road-markings"].map((name) => unloadingGroup.getObjectByName(name) as THREE.Mesh);
  expect(buildingMeshes.every((mesh) => mesh instanceof THREE.Mesh)).toBe(true);
  expect(buildingMeshes.every((mesh) => (mesh.material as THREE.MeshStandardMaterial).vertexColors)).toBe(true);
  expect(roadMeshes.every((mesh) => mesh instanceof THREE.Mesh)).toBe(true); const sharedRoadMaterialDispose = vi.spyOn(roadMeshes[0]!.material as THREE.Material, "dispose"); const sharedTree = unloadingGroup.getObjectByName("decoration-trees") as THREE.InstancedMesh; expect(sharedTree).toBeInstanceOf(THREE.InstancedMesh); const sharedTreeDispose = vi.spyOn(sharedTree, "dispose"); const sharedTreeGeometryDispose = vi.spyOn(sharedTree.geometry, "dispose");
  const disposals = [...buildingMeshes, ...roadMeshes].map((mesh) => vi.spyOn(mesh.geometry, "dispose"));
  await manager.update({ x: 150, z: 150 });
  expect(loads).toHaveLength(9);
  await manager.update({ x: 350, z: 350 });
  expect(manager.loadedTileIds.sort()).toEqual(["2-2", "2-3", "3-2", "3-3"]);
  expect(removed.length).toBeGreaterThan(0);
  expect(disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true); expect(sharedTreeDispose).toHaveBeenCalledOnce(); expect(sharedRoadMaterialDispose).not.toHaveBeenCalled(); expect(sharedTreeGeometryDispose).not.toHaveBeenCalled();
  manager.dispose(); expect(sharedRoadMaterialDispose).toHaveBeenCalledOnce(); expect(sharedTreeGeometryDispose).toHaveBeenCalledOnce();
  expect(manager.loadedTileIds).toHaveLength(0);
});

test("releases instance meshes across revisit cycles without disposing shared assets or leaking colliders", async () => {
  const added: unknown[] = []; const removed: unknown[] = []; const scene = new THREE.Scene();
  const manager = new MapTileManager({ manifest, scene, loadTile: async (url) => makeTile(descriptors.find((item) => item.url === url)!.id), physics: { addBuildingCollider: () => { const handle = {}; added.push(handle); return handle; }, removeCollider: (handle) => removed.push(handle) } });
  await manager.update({ x: 150, z: 150 });
  const firstTree = scene.getObjectByName("map-tile-0-0")!.getObjectByName("decoration-trees") as THREE.InstancedMesh;
  const meshDispose = vi.spyOn(firstTree, "dispose"); const geometryDispose = vi.spyOn(firstTree.geometry, "dispose");
  const firstAdded = added.length;
  await manager.update({ x: 350, z: 350 });
  expect(meshDispose).toHaveBeenCalledOnce(); expect(geometryDispose).not.toHaveBeenCalled(); expect(removed.length).toBeGreaterThan(0);
  await manager.update({ x: 150, z: 150 });
  expect(meshDispose).toHaveBeenCalledOnce(); expect(geometryDispose).not.toHaveBeenCalled();
  expect(scene.getObjectByName("map-tile-0-0")!.getObjectByName("decoration-trees")).not.toBe(firstTree);
  expect(added.length).toBeGreaterThan(firstAdded);
  expect(removed.every((handle) => added.includes(handle))).toBe(true);
  manager.dispose(); expect(geometryDispose).toHaveBeenCalledOnce();
});

test("skips malformed road siblings without discarding valid buildings", async () => {
  const malformed = makeTile("0-0") as any; malformed.roads = [{id:"bad",name:"Bad",highway:"primary",width:Number.NaN,points:[{x:0,z:0},{x:1e9,z:0}]},{id:"missing",name:"Missing",highway:"primary",width:8}];
  const warnings:string[]=[]; const scene=new THREE.Scene(); const manager=new MapTileManager({manifest:{...manifest,tiles:[descriptors[0]!] },scene,loadTile:async()=>malformed,physics:{addBuildingCollider:()=>({}),removeCollider:()=>undefined},onWarning:(message)=>warnings.push(message)});
  await manager.update({x:50,z:50}); expect(manager.loadedTileIds).toEqual(["0-0"]); expect(scene.getObjectByName("building-walls")).toBeTruthy(); expect(warnings).toHaveLength(0); manager.dispose(); manager.dispose();
});

test("does not attach a delayed tile after disposal", async () => {
  let resolve!: (tile: MapTile) => void;
  const delayed = new Promise<MapTile>((done) => { resolve = done; });
  const scene = new THREE.Scene();
  const manager = new MapTileManager({ manifest, scene, loadTile: async () => delayed, physics: { addBuildingCollider: () => ({}), removeCollider: () => undefined } });
  const update = manager.update({ x: 50, z: 50 });
  manager.dispose();
  resolve(makeTile("0-0"));
  await update;
  expect(manager.loadedTileIds).toHaveLength(0);
  expect(scene.children.filter((child) => child.name.startsWith("map-tile"))).toHaveLength(0);
});

test("keeps existing tiles and warns when a tile fails", async () => {
  const warnings: string[] = [];
  const manager = new MapTileManager({ manifest, scene: new THREE.Scene(), loadTile: async (url) => { if (url.includes("5")) throw new Error("missing"); return makeTile(descriptors.find((item) => item.url === url)!.id); }, physics: { addBuildingCollider: () => ({}), removeCollider: () => undefined }, onWarning: (message) => warnings.push(message) });
  await manager.update({ x: 150, z: 150 });
  expect(manager.loadedTileIds.length).toBeGreaterThan(0);
  expect(warnings).toHaveLength(1);
  manager.dispose();
});
