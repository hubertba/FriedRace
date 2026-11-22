# Hybrid Streets-GL Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Unterwart's streamed OSM buildings with deterministic facade colours, roof forms, and windows inspired by Streets GL while preserving offline performance.

**Architecture:** Enrich building tile records during development import, then build three merged vertex-coloured geometries per runtime tile: walls, roofs, and windows. `MapTileManager` owns three shared building materials and continues to unload tile geometry and approximate colliders with the existing lifecycle.

**Tech Stack:** TypeScript, Three.js, Rapier, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-20-streets-gl-buildings-design.md`

## Global Constraints

- Explicit OSM building and roof tags always override fallback styling.
- Missing style metadata uses a stable ID-based resolver; never use `Math.random()`.
- Runtime remains offline and loads only local `/map/` assets.
- Keep 3×3 tile streaming and merged geometry rather than per-building scene objects.
- Building collision remains approximate and roof-independent.
- Invalid individual buildings or style tags must not invalidate the whole map.
- Preserve visible `© OpenStreetMap contributors` attribution.

## Review Focus

- Sparse Unterwart tags must still produce varied but deterministic buildings.
- Pitched roof generation must not emit NaN coordinates or geometry below the wall eave.
- Courtyard holes and complex footprints must fall back safely rather than filling invalid roofs.
- Added window geometry must remain bounded and omit garages/sheds.
- Every wall, roof, and window geometry/material must be disposed when a tile unloads or a load rolls back.

---

### Task 1: Enrich OSM building records and deterministic styles

**Files:**
- Modify: `src/world/tileData.ts`
- Modify: `scripts/import-osm.ts`
- Modify: `tests/fixtures/osm-buildings.json`
- Modify: `tests/world/tileData.test.ts`
- Modify: `tests/scripts/importOsm.test.ts`

**Interfaces:**
- Produces: `ImportedBuilding` fields `buildingType`, `minHeight`, `levels`, `facadeMaterial`, `facadeColor`, `roofShape`, `roofMaterial`, `roofColor`, and `roofHeight`.
- Produces: `resolveBuildingAppearance(tags: Record<string,string> | undefined, id: number): BuildingAppearance`.
- Consumes: existing OSM way/relation tags and validated footprint assembly.

- [ ] **Step 1: Write failing style and import tests**

Assert that explicit colour/material/roof tags survive conversion, two calls for the same ID produce identical fallbacks, residential and garage fallbacks differ, height/min-height/levels parse correctly, and a `building:part=yes` way is imported. Assert the Overpass query includes `building:part`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/world/tileData.test.ts tests/scripts/importOsm.test.ts`
Expected: FAIL because the enriched fields/resolver and `building:part` query do not exist.

- [ ] **Step 3: Implement the enriched building model**

Add `BuildingAppearance`, normalize supported OSM colours/materials/roof shapes, implement deterministic ID hashing and type-specific fallback palettes, and apply the result to standalone and relation buildings. Parse `min_height`, `roof:height`, and `roof:levels`; query `building:part` features.

- [ ] **Step 4: Verify focused and full unit tests**

Run: `npm test -- tests/world/tileData.test.ts tests/scripts/importOsm.test.ts && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: enrich OSM building styles`.

---

### Task 2: Generate merged walls, roofs, and windows

**Files:**
- Modify: `src/world/TileGeometry.ts`
- Modify: `tests/world/TileGeometry.test.ts`

**Interfaces:**
- Consumes: enriched `ImportedBuilding` records from Task 1.
- Produces: `buildBuildingGeometries(tile: MapTile): { walls: THREE.BufferGeometry; roofs: THREE.BufferGeometry; windows: THREE.BufferGeometry }`.

- [ ] **Step 1: Write failing geometry tests**

Create fixtures for a residential gabled building, a hipped building, a flat courtyard building, and a garage. Assert all position/color attributes are finite, wall and roof geometries are nonempty, pitched roof maximum Y exceeds the wall eave, residential windows are nonempty and above ground, garage windows are empty, and flat courtyard geometry remains valid.

- [ ] **Step 2: Run the geometry test and verify RED**

Run: `npm test -- tests/world/TileGeometry.test.ts`
Expected: FAIL because `buildBuildingGeometries` does not exist.

- [ ] **Step 3: Implement merged low-poly geometry**

Build coloured wall quads from outer and inner rings, flat roofs with `ShapeGeometry`, stable longest-edge ridges for supported simple gabled/hipped footprints, gable end triangles, and bounded window quads based on levels and wall length. Fall back to flat roofs for holes or unsupported shapes.

- [ ] **Step 4: Run geometry and full unit tests**

Run: `npm test -- tests/world/TileGeometry.test.ts && npm test`
Expected: all tests pass without NaN attributes.

- [ ] **Step 5: Commit**

Commit message: `feat: build detailed low-poly buildings`.

---

### Task 3: Integrate building layers with tile streaming

**Files:**
- Modify: `src/world/MapTileManager.ts`
- Modify: `tests/world/MapTileManager.test.ts`

**Interfaces:**
- Consumes: `buildBuildingGeometries` from Task 2.
- Produces: tile groups containing named `building-walls`, `building-roofs`, and `building-windows` meshes with shared manager-owned materials.
- Produces: `loadedBuildingLayerNames: string[]` for runtime verification hooks.

- [ ] **Step 1: Write failing lifecycle tests**

Assert a loaded building tile creates all three named mesh layers, wall/roof materials use vertex colours, and moving away or disposing removes the group, collider handles, and all three tile-owned geometries. Preserve delayed-load and rollback coverage.

- [ ] **Step 2: Run manager tests and verify RED**

Run: `npm test -- tests/world/MapTileManager.test.ts`
Expected: FAIL because the manager still creates one `buildings` mesh.

- [ ] **Step 3: Integrate the three layers**

Replace the single building mesh/material with shared wall, roof, and window materials. Attach all three meshes to each tile group, set appropriate shadow flags, and rely on group traversal for geometry cleanup and rollback.

- [ ] **Step 4: Run manager and full tests**

Run: `npm test -- tests/world/MapTileManager.test.ts && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: stream detailed building layers`.

---

### Task 4: Regenerate Unterwart assets and verify the game

**Files:**
- Modify: `public/map/manifest.json`
- Replace: `public/map/generations/<hash>/tile-*.json`
- Modify: `tests/world/tileData.test.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `tests/e2e/map-streaming.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: enriched importer and runtime from Tasks 1–3.
- Produces: checked-in local Unterwart generation with detailed building metadata.

- [ ] **Step 1: Add failing release assertions**

Assert checked-in assets contain facade colours, roof shapes, roof colours, residential windows-capable levels, multiple facade colours, and at least one explicit or fallback pitched roof. Extend E2E hooks/assertions to confirm all three building mesh layers exist after startup and after a distant tile load, with no OSM/Overpass requests.

- [ ] **Step 2: Run release tests and verify RED**

Run: `npm test -- tests/world/tileData.test.ts && npm run test:e2e -- tests/e2e/map-streaming.spec.ts`
Expected: FAIL against the old generation/runtime hooks.

- [ ] **Step 3: Regenerate and document assets**

Run `npm run map:import`, retain only the generation referenced by the new manifest, and update README building-rendering documentation.

- [ ] **Step 4: Verify complete delivery**

Run: `npm test && npm run test:e2e && npm run build`
Expected: all unit tests, browser tests, and production build pass.

- [ ] **Step 5: Commit**

Commit message: `feat: ship Streets GL inspired Unterwart buildings`.
