import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { convertOsmToMap, validateImportedMap, type OverpassResponse } from "../src/world/mapData";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

const QUERY = `[out:json][timeout:90];
(
  node[place][name~"^(Unterwart|Oberwart|Pinkafeld|Oberschützen|Großpetersdorf)$"](47.15,16.00,47.45,16.45);
  way[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"](47.15,16.00,47.45,16.45);
);
(._;>;);
out body;`;

export const replaceMapFileIfValid = async (outputPath: string, response: OverpassResponse): Promise<void> => {
  const converted = convertOsmToMap(response);
  const valid = validateImportedMap(converted);
  if (!valid) throw new Error("Converted map did not pass validation");
  await mkdir(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(valid)}\n`, "utf8");
  await rename(temporary, outputPath);
};

export const fetchOverpass = async (
  query: string,
  fetcher: typeof fetch = fetch,
  endpoints: string[] = ENDPOINTS,
): Promise<OverpassResponse> => {
  const failures: string[] = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "FriedRace map importer (local development)",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return await response.json() as OverpassResponse;
      failures.push(`${endpoint}: HTTP ${response.status}`);
    } catch (error) {
      failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`All Overpass endpoints failed (${failures.join("; ")})`);
};

const run = async (): Promise<void> => {
  const data = await fetchOverpass(QUERY);
  const here = dirname(fileURLToPath(import.meta.url));
  await replaceMapFileIfValid(resolve(here, "../src/content/map/region.json"), data);
  console.log("Updated src/content/map/region.json from OpenStreetMap.");
};

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
