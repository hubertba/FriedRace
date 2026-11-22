# Hybrid Streets-GL Buildings Design

## Intent
Replace the current uniform beige building blocks with low-poly OSM-aware buildings inspired by Streets GL and the workflow described in the referenced Kaffeeringe article. The result must create a stronger street-level sense of place in Unterwart while remaining offline and compatible with the existing 3×3 tile streamer.

## References
- https://kaffeeringe.de/2023/05/13/3d-stadt-modelle-aus-openstreetmap-daten-erstellen/
- https://streets.gl/#47.25773,16.23421,45.00,0.00,362.33

The article emphasizes `building:material`, `building:colour`, `roof:shape`, `roof:material`, `roof:colour`, height/levels, and `building:part`. Streets GL demonstrates colored facades, pitched roofs, visible floor rhythm, windows, sunlight, and shadows.

## Constraints discovered in Unterwart
A central sample contained 745 buildings, but only four had `roof:shape`, four had `building:levels`, and essentially none had material or colour tags. Rendering only explicit tags would therefore leave almost all buildings generic.

## Selected approach
Use a hybrid style resolver:
1. Explicit OSM tags always win.
2. Missing values receive deterministic fallbacks derived from building type and OSM ID.
3. The same source data always generates the same appearance.
4. Unknown or malformed values fall back safely rather than failing the map import.

A tags-only renderer was rejected because Unterwart's metadata is too sparse. A full Streets GL clone with vegetation, fences, street furniture, textures, and dynamic time-of-day is outside this phase.

## Imported building data
Each building or building part stores:
- footprint outer ring and holes;
- `building` or `building:part` type;
- height, minimum height, and estimated levels;
- facade material and resolved facade colour;
- roof shape, material, colour, and roof height;
- whether the appearance came from explicit tags or deterministic fallback values where useful for tests.

The importer queries both `building=*` and `building:part=*`. Existing multipolygon assembly and malformed-footprint rejection remain authoritative.

## Deterministic fallback rules
- Houses, detached homes, residential buildings, and apartments: warm plaster/brick facade palette; mostly gabled or hipped roofs; red, brown, or charcoal roofs.
- Garages, sheds, and carports: 3–4.5 m walls, subdued facade, predominantly flat roofs, few or no windows.
- Industrial and warehouse buildings: pale grey facade, flat or low-pitched charcoal roof, wider window spacing.
- Churches: light stone/plaster facade, gabled dark or red roof.
- Schools and public buildings: light facade, flat or hipped roof, regular window rows.
- Unknown buildings: neutral plaster palette with a stable mix of flat, gabled, and hipped roofs.

Fallback selection uses a stable hash of the building ID, never `Math.random()`.

## Geometry
`TileGeometry` produces three merged geometries per tile:
- walls, including upper gable triangles where required;
- roofs, including flat, gabled, and hipped low-poly forms;
- windows as slightly offset dark quads arranged by wall length and estimated levels.

Facade and roof colours are stored as vertex colours, allowing many building colours while retaining one wall material and one roof material per tile. Window geometry uses one shared dark material. Buildings with holes keep those holes for flat roofs; complex unsupported pitched footprints safely fall back to flat roofs.

Pitched-roof construction uses a stable ridge aligned to the footprint's longest dominant edge. Gabled roofs retain a full ridge and gable end walls. Hipped roofs use a shortened ridge. Garages and tiny footprints omit window geometry.

## Runtime and performance
- One tile group contains roads plus wall, roof, and window meshes.
- Materials are shared by `MapTileManager`, not allocated per building.
- Existing tile unload disposes all tile-owned geometries and nearby building colliders.
- Collision remains the existing approximate footprint bounding box and does not model roof shapes.
- Runtime makes no OSM or Streets GL requests.

## Lighting
Keep the existing hemisphere and directional sunlight. Wall and roof meshes cast and receive shadows; windows receive shadows but do not need to cast them. No dynamic time-of-day system is added.

## Error handling
- Invalid colours, materials, or roof values use deterministic defaults.
- Unsupported roof shapes use flat or gabled fallback according to building type.
- A malformed individual building remains omitted without preventing the rest of the tile from loading.
- Failed imports preserve the last valid generation as before.

## Verification
Tests cover:
- explicit OSM tags overriding fallbacks;
- stable fallback styles by ID and building type;
- `building:part` import;
- height, minimum height, levels, and roof-height parsing;
- separate nonempty wall, roof, and window geometry;
- pitched roofs extending above wall eaves;
- garages omitting windows;
- geometry/material disposal during tile unload;
- regenerated Unterwart assets containing resolved facade and roof metadata;
- browser startup and tile streaming remaining offline.
