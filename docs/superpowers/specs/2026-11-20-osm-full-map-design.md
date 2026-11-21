# Fried Race – Full OpenStreetMap Map Design

## Intent

Replace the reduced regional map in the first expansion phase with a locally bundled, tiled OpenStreetMap world containing all normal drivable streets and all available building footprints in Unterwart. The tile format remains extensible so Oberwart, Pinkafeld, Oberschützen, and Großpetersdorf can be added later without another runtime redesign.

## Goals

- Import motorway, trunk, primary, secondary, tertiary, unclassified, residential, living-street, service, and drivable track ways.
- Import building ways and multipolygon building relations.
- Preserve OSM building height, levels, and name tags when present; use deterministic fallback heights otherwise.
- Divide processed data into local map tiles instead of one oversized runtime JSON file.
- Load and unload nearby tiles while driving.
- Render roads as surfaces and buildings as simple extruded low-poly geometry.
- Give nearby buildings approximate static collision while keeping distant/unloaded buildings cost-free.
- Keep an overview road network and the Unterwart town label for the map overlay.
- Place the garage and player spawn at Dr.-Galambos-Gasse 12, 7502 Unterwart, using the OSM/Nominatim result `47.2571447, 16.2342699` as the authoritative source coordinate.
- Keep runtime fully offline and display the existing OpenStreetMap attribution.
- Preserve the last valid generated map if any download, conversion, or validation step fails.

## Non-goals

- Importing indoor geometry, facade textures, roofs with exact shapes, street furniture, vegetation, footpaths, cycleways, or every OSM object category.
- Photorealistic rendering.
- Exact building collision polygons; collisions may use bounding boxes.
- Runtime requests to Overpass or OpenStreetMap.

## Approach

The importer divides a compact bounding box around Unterwart into a fixed grid and queries Overpass per source tile. This avoids one oversized query and allows retries. It converts OSM coordinates to local game coordinates centered on Dr.-Galambos-Gasse 12, resolves building way and relation polygons, and writes a temporary output directory containing a manifest and tile JSON files. Only after every tile validates does it atomically replace `public/map/`. Later phases may expand the bounding box while preserving the same format.

The runtime loads the manifest once. A `MapTileManager` keeps the current tile and neighboring tiles loaded around the vehicle. Each loaded tile owns one merged road mesh and one merged building mesh. Tiles near the player also own approximate Rapier building colliders. Unloading a tile removes and disposes its meshes and colliders.

The map overlay uses a simplified overview road network from the manifest instead of waiting for runtime tiles.

## Data Model

`manifest.json` contains version, attribution, compression/projection metadata, world bounds, tile size, tile descriptors, town labels, simplified overview roads, and the projected spawn/garage position derived from Dr.-Galambos-Gasse 12.

Each tile contains:

- road polylines with OSM ID, class, width, and points;
- building polygons with OSM ID, outer ring, optional inner rings, height, levels, and optional name;
- tile bounds.

## Performance Rules

- Load a 3×3 neighborhood around the current vehicle tile.
- Merge geometry per tile rather than creating one Three.js object per OSM feature.
- Use deterministic low-poly extrusions and flat materials.
- Create building colliders only for the current tile and immediate neighbors; dispose them on unload.
- Keep source coordinates rounded to practical precision and JSON minified.
- Cap fallback building height and reject invalid polygons.

## Failure Handling

- Missing node/member references invalidate the affected import batch.
- Invalid polygons are omitted only when they are individual malformed OSM features; systemic or empty output fails the import.
- A failed import never replaces the previous valid `public/map/` directory.
- Runtime tile load failures show a warning, leave already loaded tiles active, and allow driving on the base terrain.

## Testing

- Unit tests cover road-class inclusion, building way/relation conversion, fallback heights, tile assignment, manifest validation, and atomic directory preservation.
- Runtime tests cover tile load/unload radius, geometry ownership, and building collider cleanup.
- Browser tests verify startup, nearby buildings, driving, and loading a second tile without runtime OSM requests.
