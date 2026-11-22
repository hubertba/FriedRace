import * as THREE from "three";
import { createAsphaltTexture } from "../visuals/ProceduralTextures";
import { WorldAssetLibrary } from "../visuals/WorldAssetLibrary";
import type { MapPoint } from "./mapData";
import { buildBuildingGeometries } from "./TileGeometry";
import { buildRoadGeometries } from "./RoadGeometry";
import { planTileDecoration } from "./TileDecoration";
import { validateMapTile, type ImportedBuilding, type MapManifest, type MapTile } from "./tileData";

export interface TilePhysics {
  addBuildingCollider(building: ImportedBuilding): unknown;
  removeCollider(handle: unknown): void;
}
interface LoadedTile { tile: MapTile; group: THREE.Group; colliders: unknown[]; }
export interface MapTileManagerOptions {
  manifest: MapManifest;
  scene: THREE.Scene;
  loadTile: (url: string) => Promise<unknown>;
  physics: TilePhysics;
  onWarning?: (message: string) => void;
}

const disposeTileOwnedGeometries = (group: THREE.Object3D): void => group.traverse((object) => { if (object instanceof THREE.Mesh && !object.userData.sharedResource) object.geometry.dispose(); });
const pointSegmentDistance = (point: MapPoint, a: MapPoint, b: MapPoint): number => {
  const dx = b.x - a.x; const dz = b.z - a.z; const squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / squared)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
};

export class MapTileManager {
  private readonly loaded = new Map<string, LoadedTile>();
  private readonly loading = new Set<string>();
  private readonly failed = new Set<string>();
  private desiredIds = new Set<string>();
  private disposed = false;
  private readonly assetLibrary = new WorldAssetLibrary();
  private readonly asphaltTexture = createAsphaltTexture();
  private readonly roadMaterial = new THREE.MeshStandardMaterial({ color: 0x777b7f, map: this.asphaltTexture, roughness: 0.96 });
  private readonly shoulderMaterial = new THREE.MeshStandardMaterial({ color: 0x7d765f, roughness: 1 });
  private readonly markingMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e8cf, roughness: 0.72 });
  private readonly foundationMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
  private readonly wallMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  private readonly roofMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  private readonly windowMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 });
  constructor(private readonly options: MapTileManagerOptions) {}
  get loadedTileIds(): string[] { return [...this.loaded.keys()]; }
  get loadedBuildingCount(): number { return [...this.loaded.values()].reduce((sum, entry) => sum + entry.tile.buildings.length, 0); }
  get loadedBuildingLayerNames(): string[] { return this.loaded.size ? ["building-foundations", "building-walls", "building-roofs", "building-windows"] : []; }
  get loadedRoadLayerNames(): string[] { return this.loaded.size ? ["road-surface", "road-shoulders", "road-markings"] : []; }
  get loadedDecorationLayerNames(): string[] { const names = new Set<string>(); for (const { group } of this.loaded.values()) group.traverse((object) => { if (object.name.startsWith("decoration-")) names.add(object.name); }); return [...names]; }
  tileIdAt(position: MapPoint): string {
    const { grid } = this.options.manifest;
    return `${Math.floor((position.x - grid.minX) / grid.tileSize)}-${Math.floor((position.z - grid.minZ) / grid.tileSize)}`;
  }

  async update(position: MapPoint): Promise<void> {
    if (this.disposed) return;
    const { grid } = this.options.manifest;
    const centerX = Math.floor((position.x - grid.minX) / grid.tileSize);
    const centerZ = Math.floor((position.z - grid.minZ) / grid.tileSize);
    const desired = this.options.manifest.tiles.filter((tile) => Math.abs(tile.x - centerX) <= 1 && Math.abs(tile.z - centerZ) <= 1);
    this.desiredIds = new Set(desired.map((tile) => tile.id));
    for (const id of [...this.failed]) if (!this.desiredIds.has(id)) this.failed.delete(id);
    for (const [id, loaded] of this.loaded) if (!this.desiredIds.has(id)) this.unload(id, loaded);
    await Promise.all(desired.filter((descriptor) => !this.loaded.has(descriptor.id) && !this.loading.has(descriptor.id) && !this.failed.has(descriptor.id)).map(async (descriptor) => {
      this.loading.add(descriptor.id);
      try {
        const tile = validateMapTile(await this.options.loadTile(descriptor.url));
        if (!tile) throw new Error("invalid tile data");
        if (this.disposed || !this.desiredIds.has(descriptor.id)) return;
        const group = new THREE.Group(); group.name = `map-tile-${tile.id}`;
        const roadGeometries = buildRoadGeometries(tile);
        const buildingGeometries = buildBuildingGeometries(tile);
        const roads = new THREE.Mesh(roadGeometries.surface, this.roadMaterial); roads.receiveShadow = true; roads.name = "road-surface";
        const shoulders = new THREE.Mesh(roadGeometries.shoulders, this.shoulderMaterial); shoulders.receiveShadow = true; shoulders.name = "road-shoulders";
        const markings = new THREE.Mesh(roadGeometries.markings, this.markingMaterial); markings.receiveShadow = true; markings.name = "road-markings";
        const foundations = new THREE.Mesh(buildingGeometries.foundations, this.foundationMaterial); foundations.receiveShadow = true; foundations.name = "building-foundations";
        const walls = new THREE.Mesh(buildingGeometries.walls, this.wallMaterial); walls.castShadow = true; walls.receiveShadow = true; walls.name = "building-walls";
        const roofs = new THREE.Mesh(buildingGeometries.roofs, this.roofMaterial); roofs.castShadow = true; roofs.receiveShadow = true; roofs.name = "building-roofs";
        const windows = new THREE.Mesh(buildingGeometries.windows, this.windowMaterial); windows.receiveShadow = true; windows.name = "building-windows";
        group.add(shoulders, roads, markings, foundations, walls, roofs, windows);
        try { group.add(this.assetLibrary.createTileDecoration(planTileDecoration(tile, this.options.manifest.grid.tileSize))); } catch (error) { this.options.onWarning?.(`Map tile ${tile.id} decoration failed: ${error instanceof Error ? error.message : String(error)}`); }
        const colliders: unknown[] = [];
        try {
          for (const building of tile.buildings) { const handle = this.options.physics.addBuildingCollider(building); if (handle != null) colliders.push(handle); }
          if (this.disposed || !this.desiredIds.has(descriptor.id)) { colliders.forEach((handle) => this.options.physics.removeCollider(handle)); disposeTileOwnedGeometries(group); return; }
          this.options.scene.add(group); this.loaded.set(tile.id, { tile, group, colliders }); this.failed.delete(descriptor.id);
        } catch (error) { colliders.forEach((handle) => this.options.physics.removeCollider(handle)); disposeTileOwnedGeometries(group); throw error; }
      } catch (error) { this.failed.add(descriptor.id); this.options.onWarning?.(`Map tile ${descriptor.id} failed: ${error instanceof Error ? error.message : String(error)}`); }
      finally { this.loading.delete(descriptor.id); }
    }));
  }

  isOnRoad(point: MapPoint): boolean {
    for (const { tile } of this.loaded.values()) for (const road of tile.roads) for (let index = 1; index < road.points.length; index += 1) {
      if (pointSegmentDistance(point, road.points[index - 1]!, road.points[index]!) <= road.width / 2 + 1) return true;
    }
    return false;
  }

  dispose(): void {
    this.disposed = true; this.desiredIds.clear();
    for (const [id, tile] of [...this.loaded]) this.unload(id, tile);
    this.assetLibrary.dispose(); this.roadMaterial.dispose(); this.shoulderMaterial.dispose(); this.markingMaterial.dispose(); this.asphaltTexture.dispose(); this.foundationMaterial.dispose(); this.wallMaterial.dispose(); this.roofMaterial.dispose(); this.windowMaterial.dispose();
  }

  private unload(id: string, loaded: LoadedTile): void {
    this.options.scene.remove(loaded.group);
    disposeTileOwnedGeometries(loaded.group);
    loaded.colliders.forEach((handle) => this.options.physics.removeCollider(handle));
    this.loaded.delete(id);
  }
}
