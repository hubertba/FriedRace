# Forza-Inspired Visual Upgrade Design

## Intent

Upgrade Fried Race from a visibly prototypical Three.js scene into a convincing, desktop-focused driving environment inspired by the warm, polished presentation of Forza Horizon. Unterwart must remain recognizable from its offline OSM geometry, while the vehicle and immediate roadside environment gain enough material, lighting, vegetation, and prop detail to feel like a finished game rather than a blockout.

The target is not AAA photorealism. It is a coherent, attractive browser rendering that uses the existing offline tile architecture efficiently and remains smooth on a normal computer.

## Goals

- Replace the red vehicle box with a detailed, unbranded 1990s sports-coupe presentation.
- Establish a warm late-afternoon atmosphere with golden sunlight, soft shadows, sky colour, haze, and filmic colour handling.
- Make roads look constructed rather than painted onto a green plane through asphalt variation, plausible markings, shoulders, and road-edge treatment.
- Add deterministic local vegetation and roadside props without blocking roads or changing map identity.
- Improve building material response and depth while preserving OSM-derived shapes and merged per-tile rendering.
- Keep all runtime assets local and retain visible OpenStreetMap attribution.
- Preserve acceptable desktop performance through instancing, capped density, shared materials, and distance-based detail.

## Non-goals

- Reproducing Forza Horizon assets, branding, vehicles, or exact graphics.
- Using a real vehicle manufacturer or model.
- Dynamic weather, day/night simulation, terrain elevation, destructible props, traffic, pedestrians, or changed driving physics.
- Runtime calls to asset sites, OSM, Overpass, or other remote services.
- Per-building or per-plant standalone draw calls at world scale.

## Anti-goals

The upgrade fails even if it is technically complete if it produces a large collection of unrelated assets, hides Unterwart beneath random scenery, blocks roads with vegetation, causes visible tile seams or popping around the player, breaks the existing offline map rollback guarantees, or makes normal desktop play noticeably stutter.

## Constraints

- Three.js, Rapier, TypeScript, and Vite remain the stack.
- The 3×3 local map-tile neighborhood remains the streaming unit.
- Runtime network access remains limited to local application assets.
- Existing building collisions remain simplified and independent of visual detail.
- Building rendering remains merged by tile; repeated vegetation and props use instancing.
- New third-party assets must permit redistribution. Prefer CC0/public-domain assets; record source and licence in `public/assets/ATTRIBUTION.md`.
- The generic coupe must contain no manufacturer names, logos, or copied protected livery.
- Existing gameplay, persistence, map overlay, events, and controls remain functional.

## Approaches considered

### 1. Polish the current primitives

Improve lighting and materials, retain the box vehicle, and add a small number of generated props. This is inexpensive and safe but would still read as a prototype and does not satisfy the requested Forza-inspired presentation.

### 2. Layered, desktop-optimized visual upgrade — selected

Combine a locally shipped generic coupe asset, physically based materials, a fixed cinematic lighting rig, procedural tile decoration, and instanced vegetation/props. This creates the largest visible improvement while preserving the current browser architecture and predictable performance.

### 3. Maximum photorealism

Use high-resolution scanned assets, dense vegetation, real-time reflections, and expensive post-processing. This raises download and GPU costs substantially and is too risky for a stable browser game.

## Visual direction

The scene represents a clear, warm late afternoon. The sun is low enough to create readable long shadows but high enough that roads remain easy to drive. A gradient or local environment texture supplies a blue-to-warm horizon, while distance fog uses the same horizon palette rather than the current uniform blue.

Colours should be natural and slightly saturated, not neon. Asphalt is dark grey with broad, low-contrast variation. Grass uses several green and dry-gold tones. Houses retain their OSM-driven facade and roof colours but gain physically plausible roughness and restrained tonal variation. The scene uses ACES filmic tone mapping and sRGB output.

## Vehicle presentation

`VehicleRuntime` will own a stable root object that may contain a visual model rather than exposing a single mesh. A purpose-built low-poly coupe assembled from focused Three.js geometry is the phase-one primary asset, eliminating brand and redistribution risk. The loader interface may later accept a verified local glTF; any optional vehicle model must be unbranded, redistributable, documented, and no larger than 5 MB compressed. Asset failure retains the generated coupe rather than preventing startup.

The visual hierarchy includes body paint, dark glass, lights, tyres, rims, and simple cabin depth. Shared geometry may be recoloured or proportionally adjusted for road, rally, and off-road classes, but the starter car must no longer be a box. The physics collider remains unchanged. Asset failure must produce a polished generated fallback rather than prevent startup.

## Rendering and atmosphere

A dedicated environment module configures:

- physically correct colour output and ACES tone mapping;
- a warm directional sun with tuned shadow map bounds around the active area;
- hemisphere/ambient fill that does not flatten facades;
- a sky dome or gradient sky material;
- matching exponential or linear distance fog;
- renderer shadow type and conservative pixel-ratio cap.

The camera remains a chase camera but may receive subtle speed-dependent field of view and look-ahead as visual polish; it must not alter controls or collision behaviour.

## Roads and ground

Road geometry gains UVs or deterministic shader coordinates suitable for a repeated local asphalt texture. Road surfaces use a shared material with normal/roughness variation. Road-edge meshes provide a narrow shoulder transition that softens the abrupt asphalt-to-green boundary.

Plausible centre markings are generated only for sufficiently wide, appropriate road classes. Narrow residential/service roads remain unmarked. Markings are slightly raised to avoid z-fighting and are merged per tile.

The world ground uses a tiling grass material with colour variation instead of a single flat colour. It remains a simple plane for physics and broad visual coverage.

## Vegetation and roadside props

A deterministic decorator derives placements from tile ID and map geometry. It creates candidates in tile space, rejects points inside or too close to roads and building footprints, and caps each category per tile. A conservative undecorated boundary band prevents placements from colliding with features owned by neighboring tiles; tests cover roads and buildings crossing tile edges. Identical map generations therefore produce identical scenery.

Near-world detail consists of several instanced categories:

- mixed deciduous tree silhouettes;
- bushes and hedges;
- sparse grass clumps near the camera-facing roadside;
- Austrian-style delineator posts on suitable roads;
- restrained streetlights and signs near built-up roads;
- fences or hedge runs where placement is unambiguous.

Instances are owned by the loaded tile group and disappear with that tile. Shared geometry and materials are owned by a visual asset library and disposed once by the manager. Tile unload and rollback remove instance objects without disposing library-owned geometry or materials; final manager disposal releases those shared resources exactly once. Dense grass is limited to a short radius and may be disabled by the fixed quality preset; trees and major props persist farther.

## Buildings and garage

Existing OSM wall, roof, and window layers remain. Their shared materials become more physically plausible and may use low-frequency procedural variation without requiring a separate texture per building. Additions such as foundation bands, restrained roof overhangs, and improved window reflectance may be merged into the existing tile layers.

The garage placeholder becomes a small believable roadside workshop/yard assembled from local geometry and shared materials. It must remain clearly discoverable from gameplay and must not add a collider that traps the spawn.

## Asset pipeline

Static visual assets live under `public/assets/visuals/`. Source URLs, authors, licence identifiers, and any modifications are recorded in `public/assets/ATTRIBUTION.md`. Runtime code references only local URLs.

Large textures are resized to desktop-appropriate dimensions and compressed where supported by the existing toolchain. The initial implementation should avoid adding a complex binary asset compiler unless measured download or GPU cost requires it. Deterministic generated textures may be checked in when that is smaller and easier to audit than third-party images.

## Architecture

- `src/visuals/Environment.ts` configures renderer, sky, lighting, fog, and shared visual constants.
- `src/visuals/VehicleVisual.ts` loads or constructs the generic coupe and provides the fallback.
- `src/world/RoadGeometry.ts` owns road surface, shoulder, and marking geometry.
- `src/world/TileDecoration.ts` deterministically plans vegetation and prop instances from tile data.
- `src/visuals/WorldAssetLibrary.ts` owns shared geometries, materials, textures, and instance construction.
- `MapTileManager` attaches and removes tile decoration groups while retaining current rollback and disposal behaviour.
- `createWorld` assembles environment, ground material, garage, and map manager without absorbing asset-specific algorithms.

The tile JSON format need not change for basic deterministic decoration because roads, buildings, tile bounds, and IDs already contain enough placement information. Any later OSM-driven prop metadata would be a separate importer extension.

## Loading and failure behaviour

Core startup must not depend on optional visual assets. The environment and generated fallback vehicle are immediately available. Local textures/models may load asynchronously, then replace fallbacks atomically. A missing or malformed visual asset logs a warning and retains the fallback; it does not fail map loading or gameplay.

Map tile failure behaviour remains unchanged: a failed tile retains any still-desired tiles that loaded successfully and reports the existing warning; it does not promise an atomic whole-neighborhood swap. Decoration creation failure for one tile omits that tile's decoration but must not discard valid roads/buildings.

## Performance budget

The design targets the owner's current desktop browser at 1920×1080. Acceptance is a 60 FPS median and a 95th-percentile frame time no worse than 25 ms during a representative spawn-area drive after warm-up; isolated loading frames are recorded separately. Concrete guards:

- pixel ratio capped at 2, with 1.5 acceptable if measurements justify it;
- one shared material per major visual layer where practical;
- vegetation and repeated props use `InstancedMesh` rather than one object each;
- deterministic per-tile instance caps;
- only the current 3×3 map neighborhood is decorated;
- shadow casting limited to the vehicle, buildings, and selected nearby vegetation;
- no screen-space reflections, dynamic weather, or per-frame environment-map capture;
- no regression in map-streaming cleanup or unbounded GPU resource growth.

## Testing and verification

Unit tests cover deterministic decoration, road/building exclusion, instance caps, road marking eligibility, vehicle fallback creation, and resource disposal. Map manager tests verify decoration lifecycle during load, rollback, unload, and disposal. E2E tests assert local-only asset requests, the continued three-layer building stream, visual layer presence before and after distant streaming, and successful fallback startup through an injected failing optional-asset loader even when phase one ships only the generated vehicle.

Automated gates remain `npm test`, `npm run test:e2e`, and `npm run build`. Manual browser verification must include screenshots from the spawn area and a second streamed location, inspection for tile seams and obstructed roads, and a basic frame-time check on the target computer.

## Delivery sequence

1. Rendering environment and ground materials.
2. Generic coupe visual with robust fallback.
3. Road surfaces, shoulders, and marking geometry.
4. Deterministic instanced vegetation and roadside props.
5. Improved building materials and garage presentation.
6. Integrated streaming, performance tuning, E2E coverage, attribution, and visual verification.
