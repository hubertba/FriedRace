# Forza-Inspired Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Fried Race into a warm, detailed, desktop-focused driving scene with a generic sports coupe, richer roads, deterministic vegetation/props, improved buildings, and robust offline streaming.

**Architecture:** Add focused visual modules for renderer/environment configuration, generated vehicle construction, road layers, deterministic tile decoration, and shared assets. `MapTileManager` continues to own tile lifecycle while distinguishing tile-owned geometries from shared instanced resources. Optional assets never gate startup; phase one ships generated/local visuals only.

**Tech Stack:** TypeScript, Three.js 0.181, Rapier, Vite, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-22-forza-inspired-visuals-design.md`

## Global Constraints

- Runtime performs no external network requests; every visual asset is local.
- Keep the existing 3×3 tile neighborhood and OSM attribution.
- Preserve current gameplay, persistence, events, controls, map failure handling, and simplified building collision.
- Buildings remain merged by tile; repeated vegetation and props use `THREE.InstancedMesh`.
- The phase-one vehicle is generated, unbranded, and has no manufacturer logos or copied livery.
- Tile unload must not dispose shared library geometry/materials; final disposal releases each shared resource exactly once.
- Use a conservative tile-boundary decoration exclusion and deterministic per-category caps.
- Desktop target: 1920×1080, 60 FPS median, 95th-percentile frame time ≤25 ms after warm-up; loading frames reported separately.
- Run each task test-first and commit its independently working result.

## Review Focus

- Degenerate/empty road segments must not generate NaN UVs, shoulders, or markings (Task 3 test).
- Decoration candidates near a tile edge must not collide with roads/buildings owned by neighboring tiles (Task 4 test).
- Empty or malformed tiles must still create removable visual groups without leaking shared resources (Task 4 test).
- Missing optional vehicle assets must preserve the generated coupe and complete startup (Tasks 2 and 6 tests).
- Repeated map streaming and disposal must keep instance counts bounded and dispose shared resources exactly once (Task 4 test).

---

### Task 1: Cinematic environment and textured ground

**Files:**
- Create: `src/visuals/Environment.ts`
- Create: `src/visuals/ProceduralTextures.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/world/createWorld.ts`
- Test: `tests/visuals/Environment.test.ts`
- Test: `tests/visuals/ProceduralTextures.test.ts`

**Interfaces:**
- Produces: `configureRenderer(renderer: THREE.WebGLRenderer): void`
- Produces: `createEnvironment(scene: THREE.Scene): { sun: THREE.DirectionalLight; dispose(): void }`
- Produces: `createGrassTexture(size?: number): THREE.CanvasTexture`
- `createWorld` consumes the grass texture for its shared ground material.

- [ ] **Step 1: Write failing procedural-texture tests**

Assert that `createGrassTexture(64)` returns a repeating canvas texture, uses sRGB colour space, and generates deterministic pixel data for repeated calls.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/visuals/ProceduralTextures.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic local grass texture generation**

Create `src/visuals/ProceduralTextures.ts` with seeded, low-contrast green/gold noise and repeat wrapping. Do not fetch an image.

- [ ] **Step 4: Write failing environment tests**

Use lightweight Three.js objects and spies to assert warm fog/background, a shadow-casting directional sun, sky object creation, ACES tone mapping, sRGB output, and configured shadow-map type.

- [ ] **Step 5: Implement environment setup and integrate it**

Create `Environment.ts`; call `configureRenderer` immediately after renderer construction in `GameApp`; replace inline sky/fog/lights and flat ground material in `createWorld`. Environment disposal must remove/dispose only resources it creates.

- [ ] **Step 6: Run focused and baseline tests**

Run: `npm test -- tests/visuals/Environment.test.ts tests/visuals/ProceduralTextures.test.ts && npm run test:e2e -- tests/e2e/app-shell.spec.ts`
Expected: focused unit tests and the app-shell Playwright test PASS.

- [ ] **Step 7: Commit**

```bash
git add src/visuals src/app/GameApp.ts src/world/createWorld.ts tests/visuals
git commit -m "feat: add cinematic driving environment"
```

### Task 2: Generated unbranded sports-coupe visuals

**Files:**
- Create: `src/visuals/VehicleVisual.ts`
- Modify: `src/simulation/VehicleRuntime.ts`
- Modify: `src/app/GameApp.ts`
- Test: `tests/visuals/VehicleVisual.test.ts`
- Modify: `tests/simulation/VehicleRuntime.test.ts`

**Interfaces:**
- Produces: `createVehicleVisual(definition: VehicleDefinition): THREE.Group`
- Produces: `loadOptionalVehicleVisual(url: string, load: (url: string) => Promise<THREE.Object3D>): Promise<THREE.Object3D | null>`
- `VehicleRuntime.object` becomes a stable `THREE.Group`; physics/body interfaces remain unchanged.
- `VehicleRuntime.dispose(): void` disposes vehicle-owned geometry/materials.

- [ ] **Step 1: Write failing coupe-structure tests**

Assert that the generated group contains named body, cabin/glass, front/rear lights, four tyres, and four rims; contains no brand text; has shadows enabled; and differs proportionally for road, rally, and off-road classes.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/visuals/VehicleVisual.test.ts`
Expected: FAIL because `VehicleVisual` does not exist.

- [ ] **Step 3: Implement the generated coupe**

Use shared primitive-based body panels with separate physical materials for paint, glass, lights, tyres, and rims. Keep its root origin and dimensions compatible with the existing collider.

- [ ] **Step 4: Write failing runtime lifecycle and fallback tests**

Assert stable root identity across vehicle selection, old visual disposal during replacement, final disposal, and `loadOptionalVehicleVisual` returning `null` for a rejected loader without throwing.

- [ ] **Step 5: Integrate the visual root into `VehicleRuntime`**

Replace the box mesh; retain reset, teleport, transform sync, and public position/speed behaviour. Dispose the vehicle from `GameApp.dispose()`.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/visuals/VehicleVisual.test.ts tests/simulation/VehicleRuntime.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/visuals/VehicleVisual.ts src/simulation/VehicleRuntime.ts src/app/GameApp.ts tests/visuals/VehicleVisual.test.ts tests/simulation/VehicleRuntime.test.ts
git commit -m "feat: replace car block with detailed coupe"
```

### Task 3: Layered roads, shoulders, and markings

**Files:**
- Create: `src/world/RoadGeometry.ts`
- Modify: `src/world/TileGeometry.ts`
- Modify: `src/world/MapTileManager.ts`
- Test: `tests/world/RoadGeometry.test.ts`
- Modify: `tests/world/TileGeometry.test.ts`
- Modify: `tests/world/MapTileManager.test.ts`

**Interfaces:**
- Produces: `buildRoadGeometries(tile: MapTile): { surface: THREE.BufferGeometry; shoulders: THREE.BufferGeometry; markings: THREE.BufferGeometry }`
- Produces: `roadSupportsCenterMarking(road: ImportedRoad): boolean`
- `MapTileManager.loadedRoadLayerNames: string[]` returns `road-surface`, `road-shoulders`, `road-markings` for loaded tiles.

- [ ] **Step 1: Write failing road-layer tests**

Assert UV-bearing road surfaces, wider low shoulder strips, dashed centre markings for sufficiently wide primary/secondary/tertiary roads, no markings for narrow residential/service roads, stable upward winding, and empty finite geometry for zero-length segments.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/world/RoadGeometry.test.ts`
Expected: FAIL because the API does not exist.

- [ ] **Step 3: Implement `RoadGeometry.ts`**

Move road construction out of `TileGeometry.ts`. Generate tile-owned merged buffers; markings sit at a distinct small Y offset; all generated attributes remain finite.

- [ ] **Step 4: Add shared procedural road materials**

Use a local deterministic asphalt texture and shared rough materials in `MapTileManager`; preserve the existing `buildRoadGeometry` compatibility wrapper if tests or callers still require it.

- [ ] **Step 5: Add manager lifecycle assertions**

Verify all three road layers load, unload, roll back, and dispose with tile-owned geometry while shared materials survive unload and dispose once at manager shutdown.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- tests/world/RoadGeometry.test.ts tests/world/TileGeometry.test.ts tests/world/MapTileManager.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/world/RoadGeometry.ts src/world/TileGeometry.ts src/world/MapTileManager.ts tests/world
git commit -m "feat: add detailed road surface layers"
```

### Task 4: Deterministic vegetation and roadside-prop streaming

**Files:**
- Create: `src/world/TileDecoration.ts`
- Create: `src/visuals/WorldAssetLibrary.ts`
- Modify: `src/world/MapTileManager.ts`
- Test: `tests/world/TileDecoration.test.ts`
- Test: `tests/visuals/WorldAssetLibrary.test.ts`
- Modify: `tests/world/MapTileManager.test.ts`

**Interfaces:**
- Produces: `planTileDecoration(tile: MapTile, tileSize: number, options?: DecorationOptions): TileDecorationPlan`
- `TileDecorationPlan` contains capped transforms for `trees`, `bushes`, `grass`, `delineators`, and `streetlights`.
- Produces: `WorldAssetLibrary.createTileDecoration(plan: TileDecorationPlan): THREE.Group`
- Produces: `WorldAssetLibrary.dispose(): void`
- `MapTileManager.loadedDecorationLayerNames: string[]` exposes non-empty decoration categories.

- [ ] **Step 1: Write failing deterministic-placement tests**

Assert same tile gives byte-equivalent plans, different tile IDs vary, candidates keep required road/building clearance, the boundary band remains empty, counts never exceed caps, and empty/malformed feature arrays produce a valid bounded plan.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- tests/world/TileDecoration.test.ts`
Expected: FAIL because the planner does not exist.

- [ ] **Step 3: Implement the pure planner**

Use a stable string seed and rejection sampling with fixed attempt limits. Default caps: 28 trees, 36 bushes, 80 grass clumps, 24 delineators, and 12 streetlights per tile; reserve an 8-metre boundary band and road/building safety margins.

- [ ] **Step 4: Write failing shared-library tests**

Assert each category is represented by at most one `InstancedMesh` per tile, instance counts match the plan, tile groups do not own/dispose shared geometry, and library disposal releases every shared geometry/material exactly once.

- [ ] **Step 5: Implement `WorldAssetLibrary`**

Create compact generated tree, bush, grass, delineator, and streetlight geometry/materials. Mark shared resources in `userData` or dispose tile-owned resources explicitly rather than traversing indiscriminately.

- [ ] **Step 6: Integrate decoration into tile lifecycle**

Decoration planning/creation failure must omit decoration while preserving valid roads/buildings. Tests cover delayed loads, failed tiles, distant streaming, repeated unload/reload, bounded counts, and final disposal.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- tests/world/TileDecoration.test.ts tests/visuals/WorldAssetLibrary.test.ts tests/world/MapTileManager.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/world/TileDecoration.ts src/visuals/WorldAssetLibrary.ts src/world/MapTileManager.ts tests/world tests/visuals
git commit -m "feat: stream deterministic roadside scenery"
```

### Task 5: Building materials and believable garage yard

**Files:**
- Create: `src/visuals/GarageVisual.ts`
- Modify: `src/world/TileGeometry.ts`
- Modify: `src/world/MapTileManager.ts`
- Modify: `src/world/createWorld.ts`
- Test: `tests/visuals/GarageVisual.test.ts`
- Modify: `tests/world/TileGeometry.test.ts`
- Modify: `tests/world/MapTileManager.test.ts`

**Interfaces:**
- Produces: `createGarageVisual(position: { x: number; z: number }): THREE.Group`
- `buildBuildingGeometries` additionally returns `foundations: THREE.BufferGeometry` while preserving walls, roofs, and windows.
- `MapTileManager.loadedBuildingLayerNames` includes `building-foundations` after integration.

- [ ] **Step 1: Write failing garage tests**

Assert workshop shell, pitched roof, doors/windows, yard apron, warm lights, discoverable `Garage` group name, local placement, and no physics/collider side effects.

- [ ] **Step 2: Write failing foundation/material tests**

Assert a shallow foundation band follows valid outer footprints, respects both winding directions, omits malformed buildings, and unloads with tile geometry.

- [ ] **Step 3: Implement garage and foundation layer**

Replace the box garage; add physically plausible shared wall/roof/window/foundation materials with restrained roughness/metalness. Do not add a garage collider near spawn.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- tests/visuals/GarageVisual.test.ts tests/world/TileGeometry.test.ts tests/world/MapTileManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/GarageVisual.ts src/world/TileGeometry.ts src/world/MapTileManager.ts src/world/createWorld.ts tests
git commit -m "feat: enrich buildings and garage yard"
```

### Task 6: Integrated visual contract, attribution, and performance evidence

**Files:**
- Modify: `src/app/GameApp.ts`
- Modify: `src/world/createWorld.ts`
- Modify: `tests/e2e/app-shell.spec.ts`
- Modify: `tests/e2e/map-streaming.spec.ts`
- Create: `tests/e2e/visuals.spec.ts`
- Create: `public/assets/ATTRIBUTION.md`
- Modify: `README.md`

**Interfaces:**
- Body datasets expose `data-loaded-road-layers`, `data-loaded-building-layers`, and `data-loaded-decoration-layers`.
- Development test hooks expose `visualObjectNames(): string[]`, `sampleFrameTimes(count: number): Promise<number[]>`, and an injected optional-asset failure path.

- [ ] **Step 1: Write failing E2E visual-contract tests**

Assert generated coupe parts, sky, garage, road layers, building layers, and at least one decoration layer are visible after startup and after distant streaming. Reject runtime requests whose host differs from the application host. Exercise injected optional-loader failure and verify startup/coupe fallback.

- [ ] **Step 2: Add frame-sampling test hook and bounded performance smoke check**

Collect post-warm-up frame deltas without treating loading frames as steady state. The automated test records median/p95 and uses a generous non-flaky ceiling; manual acceptance uses the spec's 60 FPS median and ≤25 ms p95 target on the owner's computer.

- [ ] **Step 3: Implement datasets, hooks, documentation, and asset attribution**

Document that phase one uses generated assets; list any included third-party source and licence exactly. Update README controls/visual description without claiming AAA parity.

- [ ] **Step 4: Run full automated verification**

Run: `npm test && npm run test:e2e && npm run build`
Expected: all unit tests, all Playwright tests, and TypeScript/Vite build PASS.

- [ ] **Step 5: Perform manual browser verification**

Capture spawn and distant-location screenshots at 1440×900 or larger. Inspect road clearance, tile seams, shadows, garage access, vehicle readability, and browser console. Record median/p95 frame timing on the target computer.

- [ ] **Step 6: Commit**

```bash
git add src tests/e2e public/assets/ATTRIBUTION.md README.md
git commit -m "feat: ship Forza inspired Fried Race visuals"
```

### Task 7: Independent review and integration gate

**Files:**
- Modify only if review finds verified issues.

**Interfaces:**
- Consumes the complete branch diff and verification evidence.
- Produces a clear merge verdict with no unresolved Critical/Important findings.

- [ ] **Step 1: Generate a whole-branch review package**

Include the spec, plan, commits, exact diff, automated logs, screenshots, and performance evidence.

- [ ] **Step 2: Request independent review**

Review visual correctness, deterministic placement, resource ownership, offline behavior, tile failure handling, browser performance risk, and test coverage.

- [ ] **Step 3: Resolve findings test-first**

For every accepted Critical/Important finding, add a failing regression test, implement the smallest correction, and rerun focused plus full verification.

- [ ] **Step 4: Verify integrated `main`**

Fast-forward only after a clean verdict; run `npm test && npm run test:e2e && npm run build` from the integrated checkout, then push and reopen the game.
