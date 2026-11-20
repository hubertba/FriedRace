# Fried Race MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally saved, browser-based 3D arcade driving MVP with a connected OpenStreetMap-derived region, garage, waypoint challenges, one rally event, vehicle purchases, and mystery-box rewards.

**Architecture:** Keep deterministic game rules in framework-free TypeScript modules and isolate Three.js/Rapier behind runtime adapters. A development-time importer converts selected OSM/Overpass road data into compact local JSON; a single `GameApp` composes that map data with simulation, rendering, HTML overlays, and versioned browser persistence.

**Tech Stack:** TypeScript, Vite, Three.js, `@dimforge/rapier3d-compat`, Vitest with jsdom, Playwright, CSS, browser `localStorage`, OpenStreetMap/Overpass data processed at development time.

**Spec:** `docs/superpowers/specs/2026-11-20-fried-race-design.md`

## Global Constraints

- Target current desktop browsers; mobile and touch controls are out of scope.
- Start every new profile with €30,000 and ownership of the 1995 Mitsubishi Eclipse placeholder vehicle.
- Controls are W to accelerate, S to brake/reverse, and A/D to steer.
- Use arcade handling, a third-person chase camera, and km/h speed display.
- The initial world contains connected, simplified OSM roads for Unterwart, Oberwart, Pinkafeld, Oberschützen, and Großpetersdorf; distances may be compressed and are not geographically exact.
- Fetch OSM data only during development, bundle the last valid generated map, and display `© OpenStreetMap contributors` linked to `https://www.openstreetmap.org/copyright`.
- Runtime gameplay must not depend on OSM or Overpass availability.
- Multiplayer, accounts, traffic, damage, tuning, police, and real-money purchases are out of scope.
- Use only project-created or license-compatible placeholder models, textures, and sounds.
- Keep economy and race-rule modules independent of the browser and renderer so a future server can reuse them.

## Review Focus

- Corrupt or outdated local saves must fall back or migrate without preventing startup; pinned in Task 3 persistence tests.
- Holding S while moving forward must brake before reverse acceleration begins; pinned in Task 4 controller tests.
- Invalid or incomplete OSM responses must not overwrite the last valid bundled map; pinned in Task 5 importer tests.
- Invalid/off-world waypoint placement must not start a challenge; pinned in Task 7 waypoint tests.
- Rally checkpoints completed out of order must not award a finish; pinned in Task 9 rally tests.
- Duplicate mystery-box vehicles must become configured cash rather than duplicate ownership; pinned in Task 8 reward tests.

---

## Planned File Structure

```text
index.html                         Browser entry document
package.json                       Scripts and dependencies
src/main.ts                        Creates and starts GameApp
src/app/GameApp.ts                 Runtime composition and main loop
src/app/createInitialProfile.ts    Initial player state
src/content/vehicles.ts            Vehicle catalog and handling values
src/content/events.ts              Rally and reward configuration
src/content/map/region.json        Generated, bundled OSM road network
src/domain/types.ts                Shared domain types
src/domain/economy.ts              Purchases and balance changes
src/domain/persistence.ts          Save validation, migration, storage adapter
src/domain/waypointChallenge.ts    Waypoint validation, timing, rewards
src/domain/rally.ts                Checkpoint order and rally completion
src/domain/mysteryBox.ts           Weighted rewards and duplicate conversion
src/input/KeyboardInput.ts         W/A/S/D and reset/map actions
src/simulation/ArcadeVehicle.ts    Pure vehicle control calculations
src/simulation/VehicleRuntime.ts   Rapier vehicle body adapter
src/world/mapData.ts               Map schema, validation, and local projection
src/world/createWorld.ts           Three.js scene from OSM roads, towns, garage, rally area
src/world/ChaseCamera.ts           Third-person camera behavior
src/world/worldBounds.ts           Valid play and waypoint bounds
src/ui/Hud.ts                      Speed, money, timer, direction display
src/ui/MapOverlay.ts               Map and waypoint selection
src/ui/GarageMenu.ts               Vehicle selection and purchases
src/ui/MysteryBoxView.ts           Reward reveal overlay
src/styles.css                     Fullscreen canvas and overlay styling
tests/domain/*.test.ts             Unit tests for game rules
tests/simulation/*.test.ts         Vehicle-control tests
tests/world/osmMap.test.ts         OSM conversion and fallback tests
tests/fixtures/osm-region.json     Small deterministic Overpass fixture
scripts/import-osm.ts              Development-time OSM downloader/converter
tests/e2e/mvp.spec.ts              Browser-level playable-flow test
playwright.config.ts               Browser test configuration
vite.config.ts                     Build and test configuration
```

### Task 1: Browser Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `playwright.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/app/GameApp.ts`
- Create: `src/styles.css`
- Create: `tests/e2e/app-shell.spec.ts`

**Interfaces:**
- Consumes: none.
- Produces: `GameApp.start(): Promise<void>` and `GameApp.dispose(): void`; npm scripts `dev`, `build`, `test`, and `test:e2e`.

- [ ] **Step 1: Write the failing browser shell test**

Create `tests/e2e/app-shell.spec.ts` with a test named `loads the Fried Race canvas and loading status` asserting that `/` has title `Fried Race`, one `canvas[data-game-canvas]`, and `[data-testid="loading-status"]`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm install && npx playwright install chromium && npm run test:e2e -- tests/e2e/app-shell.spec.ts`

Expected: FAIL because the Vite app and required elements do not exist.

- [ ] **Step 3: Implement the minimal app shell**

Use dependencies `three` and `@dimforge/rapier3d-compat`; use dev dependencies `typescript`, `vite`, `vitest`, `jsdom`, `@playwright/test`, and `@types/three`. Configure `GameApp.start()` to create the marked canvas and loading element, without implementing gameplay.

- [ ] **Step 4: Verify foundation checks**

Run: `npm run test:e2e -- tests/e2e/app-shell.spec.ts && npm run build`

Expected: browser test PASS and Vite production build exits 0.

- [ ] **Step 5: Initialize version control and commit**

```bash
git init
git add package.json package-lock.json tsconfig.json vite.config.ts playwright.config.ts index.html src tests docs
git commit -m "chore: scaffold Fried Race web game"
```

### Task 2: Vehicle Catalog, Profile, and Economy

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/content/vehicles.ts`
- Create: `src/app/createInitialProfile.ts`
- Create: `src/domain/economy.ts`
- Create: `tests/domain/economy.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `VehicleDefinition`, `PlayerProfile`, `VEHICLES`, `STARTER_VEHICLE_ID`, `createInitialProfile(): PlayerProfile`, and `purchaseVehicle(profile: PlayerProfile, vehicle: VehicleDefinition): PurchaseResult`.

- [ ] **Step 1: Write failing profile and purchase tests**

Create tests asserting:

```ts
expect(createInitialProfile()).toMatchObject({
  money: 30_000,
  ownedVehicleIds: ["mitsubishi-eclipse-1995"],
  activeVehicleId: "mitsubishi-eclipse-1995",
});
expect(purchaseVehicle(profileWith(20_000), vehicleCosting(25_000)).ok).toBe(false);
expect(purchaseVehicle(profileWith(30_000), vehicleCosting(25_000)).profile.money).toBe(5_000);
expect(purchaseVehicle(profileOwning("car-a"), carA).reason).toBe("already-owned");
```

Also assert that the catalog contains at least one `road`, one `rally`, and one `offroad` vehicle, each with positive price and handling values.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/economy.test.ts`

Expected: FAIL because domain modules do not exist.

- [ ] **Step 3: Implement profile and economy types**

Define `VehicleClass = "road" | "rally" | "offroad"`; include id, name, price, class, top speed, acceleration, braking, steering, off-road grip, rarity, and model key on `VehicleDefinition`. Make `purchaseVehicle` immutable and return `{ ok, reason?, profile }`.

- [ ] **Step 4: Run unit tests and build**

Run: `npm test -- tests/domain/economy.test.ts && npm run build`

Expected: all assertions PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/content/vehicles.ts src/app/createInitialProfile.ts tests/domain/economy.test.ts
git commit -m "feat: add vehicle catalog and player economy"
```

### Task 3: Versioned Local Save

**Files:**
- Create: `src/domain/persistence.ts`
- Create: `tests/domain/persistence.test.ts`

**Interfaces:**
- Consumes: `PlayerProfile`, `createInitialProfile()`, and valid vehicle IDs from Task 2.
- Produces: `SAVE_KEY`, `SaveEnvelope`, `loadProfile(storage: StorageLike): PlayerProfile`, and `saveProfile(storage: StorageLike, profile: PlayerProfile): void`.

- [ ] **Step 1: Write failing persistence tests**

Test round-trip save/load, missing save fallback, malformed JSON fallback, unknown active vehicle fallback to the starter, removal of unknown owned IDs, and migration from version `0` to the current version `1`.

```ts
expect(loadProfile(storageContaining("not-json"))).toEqual(createInitialProfile());
expect(loadProfile(storageContainingJson({ version: 1, profile: corruptProfile }))).toMatchObject({
  activeVehicleId: "mitsubishi-eclipse-1995",
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/persistence.test.ts`

Expected: FAIL because persistence functions do not exist.

- [ ] **Step 3: Implement validation and migration**

Define the narrow interface `StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }`. Never throw from `loadProfile`; normalize non-finite/negative money, unknown vehicles, empty ownership, and an invalid active vehicle.

- [ ] **Step 4: Verify persistence tests**

Run: `npm test -- tests/domain/persistence.test.ts`

Expected: PASS, including corrupt and outdated-save cases.

- [ ] **Step 5: Commit**

```bash
git add src/domain/persistence.ts tests/domain/persistence.test.ts
git commit -m "feat: persist versioned player profiles"
```

### Task 4: Arcade Vehicle Controls

**Files:**
- Create: `src/input/KeyboardInput.ts`
- Create: `src/simulation/ArcadeVehicle.ts`
- Create: `tests/simulation/ArcadeVehicle.test.ts`

**Interfaces:**
- Consumes: handling values from `VehicleDefinition`.
- Produces: `DriveInput { throttle: number; brake: number; steer: number }`, `KeyboardInput.sample(): DriveInput`, and `stepArcadeVehicle(state: VehicleMotionState, input: DriveInput, tuning: VehicleTuning, dt: number): VehicleForces`.

- [ ] **Step 1: Write failing control tests**

Assert W maps to throttle `1`, A/D map to steer `-1/1`, steering force decreases above 70% of top speed, speed is capped at configured top speed, and S produces braking while forward speed is positive before it produces reverse force near zero.

```ts
expect(stepArcadeVehicle(forwardAt(20), sPressed, tuning, 1 / 60).driveForce).toBeLessThanOrEqual(0);
expect(stepArcadeVehicle(stopped(), sPressed, tuning, 1 / 60).reverseForce).toBeGreaterThan(0);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/simulation/ArcadeVehicle.test.ts`

Expected: FAIL because control modules do not exist.

- [ ] **Step 3: Implement keyboard mapping and pure force calculation**

Clamp `dt` to `0..0.05`, normalize simultaneous opposite keys to zero, reduce steering linearly from full below 30% top speed to 35% at top speed, and keep reverse top speed at 30% of forward top speed.

- [ ] **Step 4: Verify control tests**

Run: `npm test -- tests/simulation/ArcadeVehicle.test.ts`

Expected: PASS for braking-before-reverse and all control calculations.

- [ ] **Step 5: Commit**

```bash
git add src/input src/simulation/ArcadeVehicle.ts tests/simulation
git commit -m "feat: add arcade keyboard driving controls"
```

### Task 5: OpenStreetMap Import Pipeline

**Files:**
- Create: `scripts/import-osm.ts`
- Create: `src/world/mapData.ts`
- Create: `src/content/map/region.json`
- Create: `tests/fixtures/osm-region.json`
- Create: `tests/world/osmMap.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Overpass JSON containing nodes and highway ways for the five-town region.
- Produces: `ImportedMap`, `convertOsmToMap(input: OverpassResponse): ImportedMap`, `validateImportedMap(value: unknown): ImportedMap | null`, and npm script `map:import`.

- [ ] **Step 1: Write failing OSM conversion and fallback tests**

Use a deterministic fixture to assert that only driveable highway classes are retained, projected coordinates are finite and centered near zero, duplicate consecutive points are removed, all five place labels exist, and the generated graph contains a route connecting Unterwart, Oberwart, Pinkafeld, Oberschützen, and Großpetersdorf. Test the file-update helper with an invalid/incomplete response and assert that it leaves existing map JSON byte-for-byte unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/world/osmMap.test.ts`

Expected: FAIL because the importer and map schema do not exist.

- [ ] **Step 3: Implement development-time import and checked-in fallback**

Add `tsx` as a development dependency and `map:import` as `tsx scripts/import-osm.ts`. Query a bounding area covering all five towns for named places and driveable `highway` ways, send a descriptive User-Agent, project latitude/longitude to local meters, retain `motorway|trunk|primary|secondary|tertiary|unclassified|residential|service`, simplify dense polylines, and compress long distances with one documented constant. Validate town labels, non-empty roads, finite coordinates, and graph connectivity before atomically replacing `src/content/map/region.json`; on fetch or validation failure, exit non-zero without changing the existing file.

- [ ] **Step 4: Verify importer tests and bundled data**

Run: `npm test -- tests/world/osmMap.test.ts && npm run map:import && npm run build`

Expected: tests PASS; import writes valid local JSON containing all five connected towns; build exits 0 without making any runtime network request.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json scripts src/world/mapData.ts src/content/map tests/fixtures tests/world/osmMap.test.ts
git commit -m "feat: import connected OpenStreetMap road data"
```

### Task 6: Playable 3D World, Rapier Runtime, Camera, and HUD

**Files:**
- Create: `src/simulation/VehicleRuntime.ts`
- Create: `src/world/createWorld.ts`
- Create: `src/world/ChaseCamera.ts`
- Create: `src/world/worldBounds.ts`
- Create: `src/ui/Hud.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`
- Create: `tests/e2e/driving.spec.ts`

**Interfaces:**
- Consumes: active `VehicleDefinition`, `KeyboardInput`, `stepArcadeVehicle()`, and validated `ImportedMap` from Task 5.
- Produces: `VehicleRuntime.update(input, dt): void`, `VehicleRuntime.reset(): void`, `VehicleRuntime.speedKph(): number`, `createWorld(scene, physics): WorldDefinition`, `ChaseCamera.update(target, dt): void`, and `Hud.render({ speedKph, money, timerText }): void`.

- [ ] **Step 1: Write the failing driving smoke test**

Create a Playwright test asserting the loading status disappears, the HUD initially displays `0 km/h` and `€30,000`, holding W changes speed to a value above zero, and clicking `[data-testid="reset-car"]` returns the vehicle to its spawn marker.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:e2e -- tests/e2e/driving.spec.ts`

Expected: FAIL because no world, runtime, or HUD exists.

- [ ] **Step 3: Implement the minimal playable world**

Initialize Rapier asynchronously. Build a low-poly ground, road meshes and colliders from the bundled OSM polylines, five labeled town zones, garage landmark, rally area, lighting, fog, and bounded play area. Show the required OpenStreetMap attribution link in the UI. Use a box-based placeholder car, dynamic rigid body with locked excessive roll/pitch, ray-based ground detection, force application from Task 4, chase camera smoothing, and an R-key/reset button action.

- [ ] **Step 4: Verify driving and regression checks**

Run: `npm test && npm run test:e2e -- tests/e2e/app-shell.spec.ts tests/e2e/driving.spec.ts && npm run build`

Expected: all unit/browser tests PASS and production build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app src/simulation/VehicleRuntime.ts src/world src/ui/Hud.ts src/styles.css tests/e2e/driving.spec.ts
git commit -m "feat: add playable 3d driving world"
```

### Task 7: Map and Waypoint Time Challenges

**Files:**
- Create: `src/domain/waypointChallenge.ts`
- Create: `src/ui/MapOverlay.ts`
- Create: `tests/domain/waypointChallenge.test.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/ui/Hud.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: player/world positions, world bounds, HUD, and profile money.
- Produces: `isValidWaypoint(point, bounds): boolean`, `startWaypointChallenge(start, target, now): WaypointChallenge`, `updateWaypointChallenge(challenge, position, now): WaypointUpdate`, and `MapOverlay.onConfirm(handler): void`.

- [ ] **Step 1: Write failing waypoint-rule tests**

Assert points outside bounds and non-finite coordinates are rejected; a target within 15 meters completes; reward is always positive; and a faster completion for the same distance earns more than a slower completion.

```ts
expect(isValidWaypoint({ x: Infinity, z: 0 }, bounds)).toBe(false);
expect(updateWaypointChallenge(challenge, target, fastTime).reward)
  .toBeGreaterThan(updateWaypointChallenge(challenge, target, slowTime).reward);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/waypointChallenge.test.ts`

Expected: FAIL because waypoint modules do not exist.

- [ ] **Step 3: Implement rules and map overlay**

Open the schematic top-down map with M or its HUD button. Convert map clicks to bounded world coordinates, reject invalid points, require confirmation, show a world marker and direction arrow, start timing on confirmation, award money once on arrival, and persist the updated profile.

- [ ] **Step 4: Verify waypoint behavior**

Run: `npm test -- tests/domain/waypointChallenge.test.ts && npm run build`

Expected: unit tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/domain/waypointChallenge.ts src/ui/MapOverlay.ts src/app/GameApp.ts src/ui/Hud.ts src/styles.css tests/domain/waypointChallenge.test.ts
git commit -m "feat: add waypoint time challenges"
```

### Task 8: Garage, Vehicle Shop, and Mystery Boxes

**Files:**
- Create: `src/domain/mysteryBox.ts`
- Create: `src/ui/GarageMenu.ts`
- Create: `src/ui/MysteryBoxView.ts`
- Create: `tests/domain/mysteryBox.test.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `VEHICLES`, `purchaseVehicle()`, `PlayerProfile`, save functions, and garage-zone state.
- Produces: `drawMysteryReward(profile, pool, random): MysteryRewardResult`, `GarageMenu.render(profile, vehicles): void`, and callbacks `onBuy(vehicleId)` and `onSelect(vehicleId)`.

- [ ] **Step 1: Write failing mystery reward tests**

Inject a deterministic `random(): number`. Assert rarity weights select expected vehicles, a new vehicle is added exactly once, and a duplicate awards `Math.floor(vehicle.price * 0.35)` without duplicating the owned ID.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/mysteryBox.test.ts`

Expected: FAIL because reward logic does not exist.

- [ ] **Step 3: Implement garage, shop, selection, and reveal UI**

Allow the menu only while parked in the garage zone. Show owned/available state, price, class, and core stats. Block insufficient funds and duplicate purchases, save successful changes, replace the runtime vehicle after selection, and show a short non-blocking mystery reward reveal.

- [ ] **Step 4: Verify garage and reward checks**

Run: `npm test -- tests/domain/economy.test.ts tests/domain/mysteryBox.test.ts && npm run build`

Expected: tests PASS, including duplicate-to-cash behavior, and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/domain/mysteryBox.ts src/ui/GarageMenu.ts src/ui/MysteryBoxView.ts src/app/GameApp.ts src/styles.css tests/domain/mysteryBox.test.ts
git commit -m "feat: add garage shop and mystery rewards"
```

### Task 9: Class-Restricted Rally Event

**Files:**
- Create: `src/content/events.ts`
- Create: `src/domain/rally.ts`
- Create: `tests/domain/rally.test.ts`
- Modify: `src/world/createWorld.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/ui/Hud.ts`

**Interfaces:**
- Consumes: active vehicle class, vehicle position, profile, mystery rewards, and HUD.
- Produces: `RallyDefinition`, `canEnterRally(vehicle, rally): boolean`, `startRally(rally, now): RallyRun`, and `updateRally(run, position, now): RallyUpdate`.

- [ ] **Step 1: Write failing rally tests**

Assert road vehicles cannot enter an event allowing only `rally` and `offroad`; eligible vehicles can enter; checkpoints must be crossed in configured order; skipping to the finish does not complete; and valid completion awards the configured money and mystery-box count exactly once.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/domain/rally.test.ts`

Expected: FAIL because rally modules do not exist.

- [ ] **Step 3: Implement one rally event and integrate it**

Define visible start/finish and checkpoint gates in the rally area. Show eligibility at the start marker, begin only on explicit confirmation, update the next required gate, invalidate shortcuts, display elapsed time, and apply configured rewards through economy/mystery modules.

- [ ] **Step 4: Verify rally and full unit suite**

Run: `npm test && npm run build`

Expected: all unit tests PASS and production build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/content/events.ts src/domain/rally.ts src/world/createWorld.ts src/app/GameApp.ts src/ui/Hud.ts tests/domain/rally.test.ts
git commit -m "feat: add class restricted rally event"
```

### Task 10: Complete MVP Flow and Release Verification

**Files:**
- Create: `tests/e2e/mvp.spec.ts`
- Modify: `src/app/GameApp.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Create: `README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a documented, buildable MVP with a stable startup and save/continue flow.

- [ ] **Step 1: Write the failing end-to-end MVP test**

Use a test-only deterministic configuration exposed through `?e2e=1`. Assert a new game starts with €30,000 and the Eclipse, driving changes speed, a nearby waypoint can be completed for money, garage purchase/select updates ownership and active vehicle, reload preserves the profile, an ineligible rally entry is blocked, and an eligible seeded profile can complete the rally and reveal a reward.

- [ ] **Step 2: Run the end-to-end test to expose integration gaps**

Run: `npm run test:e2e -- tests/e2e/mvp.spec.ts`

Expected: FAIL on any missing orchestration or stable test hook.

- [ ] **Step 3: Complete orchestration and user documentation**

Keep test hooks unavailable unless `import.meta.env.DEV` and `?e2e=1` are both true. Add loading/error handling, pause driving input while menus are open, save after every economy/reward change, dispose listeners and Three/Rapier resources, and document setup, controls, gameplay loop, asset policy, and build commands in `README.md`.

- [ ] **Step 4: Run release verification**

Run: `npm test && npm run test:e2e && npm run build`

Expected: all unit and Chromium tests PASS; Vite production build exits 0 with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src tests/e2e/mvp.spec.ts README.md
git commit -m "feat: complete Fried Race MVP"
```
