# Full OSM Streets and Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reduced single-file map with an offline tiled OSM world containing all normal drivable streets and available building footprints in Unterwart, starting at Dr.-Galambos-Gasse 12.

**Architecture:** A development-time importer queries a fixed geographic grid, converts roads and building polygons into minified local tile JSON, and atomically publishes a manifest plus tiles under `public/map/`. At runtime a tile manager streams a 3×3 neighborhood, owns merged Three.js road/building geometry, and creates removable approximate Rapier building colliders.

**Tech Stack:** TypeScript, Node/tsx importer, Overpass JSON, Vite public assets, Three.js, Rapier, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-osm-full-map-design.md`

## Global Constraints

- Runtime must make no request to OpenStreetMap or Overpass; only local `/map/*.json` requests are allowed.
- Include normal drivable OSM highway classes: motorway, trunk, primary, secondary, tertiary, unclassified, residential, living_street, service, and drivable track.
- Import building ways and building multipolygon relations when their referenced geometry is complete.
- Preserve `© OpenStreetMap contributors` and the copyright link.
- Keep the previous valid map directory untouched when an import fails.
- Load at most a 3×3 tile neighborhood during normal gameplay.
- Merge render geometry per tile and remove meshes and colliders when a tile unloads.
- Building collisions are approximate and exist only for loaded nearby buildings.
- The authoritative spawn source is Dr.-Galambos-Gasse 12 at latitude `47.2571447`, longitude `16.2342699`; the manifest stores its projected game position.
- Phase 1 imports only Unterwart while preserving an expandable tile format for later towns.

## Review Focus

- Partial Overpass batches or missing relation members must not replace the previous map; pinned in Task 2 importer tests.
- Roads crossing source-tile boundaries must not be truncated or duplicated into disconnected runtime fragments; pinned in Task 1 conversion tests.
- Building holes and malformed polygons must not create inverted or unbounded geometry; pinned in Tasks 1 and 3 tests.
- Tile movement must dispose old Three.js resources and Rapier colliders; pinned in Task 3 lifecycle tests.
- Runtime startup and tile changes must never contact an OSM/Overpass host; pinned in Task 4 browser tests.

---

### Task 1: Tiled OSM Road and Building Data Model

**Files:**
- Create: `src/world/osmTypes.ts`
- Create: `src/world/tileData.ts`
- Create: `tests/world/tileData.test.ts`
- Create: `tests/fixtures/osm-buildings.json`
- Modify: `src/world/mapData.ts`

**Interfaces:**
- Consumes: Overpass nodes, ways, and relations.
- Produces: `MapManifest`, `MapTile`, `ImportedBuilding`, `convertOsmBatch(input, projection): ConvertedBatch`, `assignFeaturesToTiles(batch, grid): MapTile[]`, and validation functions.

- [ ] **Step 1: Write failing conversion tests**

Assert inclusion of residential, living-street, service, and drivable track roads; exclusion of foot/path/cycleway and private/non-drivable track; conversion of a building way; conversion of a multipolygon building relation with an inner ring; deterministic fallback height; rejection of missing node/member references; and assignment of boundary-crossing roads/buildings to every touched output tile without duplicate feature IDs inside one tile.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/world/tileData.test.ts`

Expected: FAIL because tiled road/building conversion does not exist.

- [ ] **Step 3: Implement schema, projection, relation resolution, and tiling**

Use exact output types from the Interfaces block. Derive building height from valid `height`, otherwise `building:levels * 3`, otherwise a deterministic 6–15 m fallback from OSM ID. Normalize closed rings, preserve valid inner rings, reject non-finite/degenerate polygons, round coordinates to three decimals, and keep an overview-road simplification in the manifest builder.

- [ ] **Step 4: Verify GREEN and full unit suite**

Run: `npm test -- tests/world/tileData.test.ts && npm test && npm run build`

Expected: all tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/world tests/world tests/fixtures
git commit -m "feat: model tiled OSM roads and buildings"
```

### Task 2: Atomic Multi-Tile Overpass Importer

**Files:**
- Modify: `scripts/import-osm.ts`
- Create: `tests/scripts/importOsm.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 conversion/tiling functions.
- Produces: `buildSourceGrid(bounds, rows, columns)`, `fetchGridBatches(grid, fetcher)`, and `publishMapDirectory(outputDir, manifest, tiles)`.

- [ ] **Step 1: Write failing importer tests**

Test deterministic source-grid generation, bounded parallel/retried batch fetches, query inclusion for all road classes plus building ways/relations, output manifest/tile filenames, minified JSON, and atomic preservation of an existing directory when one batch is partial, one relation member is missing, or publication fails before final rename.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/scripts/importOsm.test.ts`

Expected: FAIL because the current importer writes one file and has no grid publication API.

- [ ] **Step 3: Implement multi-query import and atomic directory swap**

Query a 3×3 source grid over the Unterwart phase-1 bounds `47.235,16.205,47.280,16.265`, include required node recursion, limit concurrency to two requests, retry alternate endpoints, deduplicate OSM IDs across overlapping source batches, project the Dr.-Galambos-Gasse 12 coordinate into `manifest.spawn`, generate `public/map/manifest.json` and `public/map/tile-<x>-<z>.json` in a sibling temporary directory, validate all outputs, then rename. Keep `src/content/map/region.json` only as a temporary compatibility fallback until Task 4.

- [ ] **Step 4: Verify importer tests**

Run: `npm test -- tests/scripts/importOsm.test.ts && npm test && npm run build`

Expected: tests PASS without live network access.

- [ ] **Step 5: Commit**

```bash
git add scripts package.json package-lock.json tests/scripts
git commit -m "feat: import OSM region as atomic map tiles"
```

### Task 3: Tile Geometry and Runtime Lifecycle

**Files:**
- Create: `src/world/TileGeometry.ts`
- Create: `src/world/MapTileManager.ts`
- Create: `tests/world/TileGeometry.test.ts`
- Create: `tests/world/MapTileManager.test.ts`
- Modify: `src/world/RoadSurface.ts`

**Interfaces:**
- Consumes: `MapManifest`, `MapTile`, Three.js scene, Rapier world, and injected local tile loader.
- Produces: `buildRoadGeometry(tile)`, `buildBuildingGeometry(tile)`, `MapTileManager.update(position): Promise<void>`, `isOnRoad(point): boolean`, and `dispose(): void`.

- [ ] **Step 1: Write failing geometry and lifecycle tests**

Assert road strips for every included road class, valid upward-facing building extrusion with inner-ring holes ignored safely when triangulation cannot preserve them, one merged road mesh and one merged building mesh per tile, 3×3 desired-tile calculation, no duplicate loads, unloading outside-radius tiles, collider removal, geometry/material disposal, and graceful retention of existing tiles after one local tile-load failure.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/world/TileGeometry.test.ts tests/world/MapTileManager.test.ts`

Expected: FAIL because runtime tile geometry and management do not exist.

- [ ] **Step 3: Implement merged meshes and removable collisions**

Use `THREE.Shape`/`ExtrudeGeometry` for buildings, merge per-tile position/normal buffers, create one material per road/building category, approximate each building collider with a bounding cuboid, and retain collider handles for removal. The manager loads only local `/map/` URLs through an injected loader and exposes a warning callback.

- [ ] **Step 4: Verify lifecycle and full suite**

Run: `npm test -- tests/world/TileGeometry.test.ts tests/world/MapTileManager.test.ts && npm test && npm run build`

Expected: tests PASS and no leaked resources remain in lifecycle assertions.

- [ ] **Step 5: Commit**

```bash
git add src/world tests/world
git commit -m "feat: stream tiled road and building geometry"
```

### Task 4: Integrate Streaming World into Gameplay and Map UI

**Files:**
- Modify: `src/world/createWorld.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/ui/MapOverlay.ts`
- Modify: `src/world/worldBounds.ts`
- Create: `tests/e2e/map-streaming.spec.ts`

**Interfaces:**
- Consumes: Task 3 `MapTileManager` and `public/map/manifest.json`.
- Produces: async `createWorld(scene, physics): Promise<WorldDefinition>` with `updateMap(position): Promise<void>` and runtime warning state.

- [ ] **Step 1: Write the failing browser streaming test**

Intercept browser requests and assert startup fetches only local `/map/` assets, nearby buildings are rendered, moving through the e2e hook to a neighboring tile loads that tile, the old far tile unloads after moving beyond the radius, and no request URL contains `openstreetmap`, `overpass`, or `osm.org`.

- [ ] **Step 2: Verify RED**

Run: `npm run test:e2e -- tests/e2e/map-streaming.spec.ts`

Expected: FAIL because gameplay still imports one bundled map synchronously.

- [ ] **Step 3: Integrate async manifest and tile loading**

Load the manifest during the existing loading screen, initialize the tile manager before removing that screen, await tile updates outside the physics fixed-step loop, use the manager for road grip, show nonfatal tile warnings in the HUD, feed manifest overview roads/towns into `MapOverlay`, and dispose the manager before freeing Rapier.

- [ ] **Step 4: Verify browser and regression suites**

Run: `npm test && npm run test:e2e && npm run build`

Expected: all tests PASS; browser network log contains only local map requests.

- [ ] **Step 5: Commit**

```bash
git add src tests/e2e/map-streaming.spec.ts
git commit -m "feat: load nearby OSM streets and buildings"
```

### Task 5: Generate Full Regional Data and Release Verification

**Files:**
- Create: `public/map/manifest.json`
- Create: `public/map/tile-*.json`
- Modify: `README.md`
- Remove: `src/content/map/region.json`
- Modify: `tests/e2e/mvp.spec.ts`

**Interfaces:**
- Consumes: completed importer and runtime.
- Produces: checked-in offline Unterwart map assets, Dr.-Galambos-Gasse 12 spawn data, and documented regeneration workflow.

- [ ] **Step 1: Add failing release assertions**

Assert the checked-in manifest validates, the Unterwart label and projected Dr.-Galambos-Gasse 12 spawn exist, residential/service roads and buildings are nonzero, every listed tile file exists, total runtime tile count is bounded by the configured grid, and the MVP browser flow still completes with streamed tiles.

- [ ] **Step 2: Verify RED against the old bundled map**

Run: `npm test -- tests/world/tileData.test.ts && npm run test:e2e -- tests/e2e/mvp.spec.ts`

Expected: FAIL because generated tile assets do not exist yet.

- [ ] **Step 3: Run the real importer and update documentation**

Run `npm run map:import`, inspect manifest counts and total asset size, remove the legacy single-file map, and document map regeneration, expected network dependence during import only, attribution, tile streaming, building collision approximation, and troubleshooting failed Overpass batches.

- [ ] **Step 4: Run release verification**

Run: `npm test && npm run test:e2e && npm run build`

Expected: all unit and Chromium tests PASS; production build exits 0; no runtime OSM requests occur.

- [ ] **Step 5: Commit**

```bash
git add public/map README.md tests src/content/map/region.json
git commit -m "feat: bundle full OSM streets and buildings"
```
