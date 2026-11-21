import * as THREE from "three";
import type { MapPoint } from "./mapData";
import { buildBuildingGeometry, buildRoadGeometry } from "./TileGeometry";
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

const pointSegmentDistance = (point: MapPoint, a: MapPoint, b: MapPoint): number => {
  const dx = b.x - a.x; const dz = b.z - a.z; const squared = dx * dx + dz * dz;
  const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / squared)) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
};

export class MapTileManager {
  private readonly loaded = new Map<string, LoadedTile>();
  private readonly roadMaterial = new THREE.MeshStandardMaterial({ color: 0x4e5358, roughness: 0.95 });
  private readonly buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xb7a58e, roughness: 0.9 });
  constructor(private readonly options: MapTileManagerOptions) {}
  get loadedTileIds(): string[] { return [...this.loaded.keys()]; }

  async update(position: MapPoint): Promise<void> {
    const { grid } = this.options.manifest;
    const centerX = Math.floor((position.x - grid.minX) / grid.tileSize);
    const centerZ = Math.floor((position.z - grid.minZ) / grid.tileSize);
    const desired = this.options.manifest.tiles.filter((tile) => Math.abs(tile.x - centerX) <= 1 && Math.abs(tile.z - centerZ) <= 1);
    const desiredIds = new Set(desired.map((tile) => tile.id));
    for (const [id, loaded] of this.loaded) if (!desiredIds.has(id)) this.unload(id, loaded);
    await Promise.all(desired.filter((descriptor) => !this.loaded.has(descriptor.id)).map(async (descriptor) => {
      try {
        const tile = validateMapTile(await this.options.loadTile(descriptor.url));
        if (!tile) throw new Error("invalid tile data");
        const group = new THREE.Group(); group.name = `map-tile-${tile.id}`;
        const roadGeometry = buildRoadGeometry(tile);
        const buildingGeometry = buildBuildingGeometry(tile);
        const roads = new THREE.Mesh(roadGeometry, this.roadMaterial); roads.receiveShadow = true; roads.name = "roads";
        const buildings = new THREE.Mesh(buildingGeometry, this.buildingMaterial); buildings.castShadow = true; buildings.receiveShadow = true; buildings.name = "buildings";
        group.add(roads, buildings); this.options.scene.add(group);
        const colliders = tile.buildings.map((building) => this.options.physics.addBuildingCollider(building));
        this.loaded.set(tile.id, { tile, group, colliders });
      } catch (error) { this.options.onWarning?.(`Map tile ${descriptor.id} failed: ${error instanceof Error ? error.message : String(error)}`); }
    }));
  }

  isOnRoad(point: MapPoint): boolean {
    for (const { tile } of this.loaded.values()) for (const road of tile.roads) for (let index = 1; index < road.points.length; index += 1) {
      if (pointSegmentDistance(point, road.points[index - 1]!, road.points[index]!) <= road.width / 2 + 1) return true;
    }
    return false;
  }

  dispose(): void {
    for (const [id, tile] of [...this.loaded]) this.unload(id, tile);
    this.roadMaterial.dispose(); this.buildingMaterial.dispose();
  }

  private unload(id: string, loaded: LoadedTile): void {
    this.options.scene.remove(loaded.group);
    loaded.group.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    loaded.colliders.forEach((handle) => this.options.physics.removeCollider(handle));
    this.loaded.delete(id);
  }
}
