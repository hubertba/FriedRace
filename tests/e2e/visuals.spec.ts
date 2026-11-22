import { expect, test } from "@playwright/test";

test("streams the complete local visual world and keeps the generated vehicle fallback", async ({ page }) => {
  const requests:string[]=[]; page.on("request",(request)=>requests.push(request.url()));
  await page.goto("/?e2e=1"); await expect(page.getByTestId("loading-status")).toBeHidden({timeout:20_000});
  await expect.poll(()=>page.locator("body").getAttribute("data-loaded-road-layers")).toBe("road-markings,road-shoulders,road-surface");
  await expect.poll(()=>page.locator("body").getAttribute("data-loaded-building-layers")).toBe("building-foundations,building-roofs,building-walls,building-windows");
  await expect.poll(async()=>await page.locator("body").getAttribute("data-loaded-decoration-layers")).toContain("decoration-trees");
  const names=await page.evaluate(()=>(window as any).__friedRaceTest.visualObjectNames()); for(const name of ["warm-sky","Garage","vehicle-body","vehicle-glass","road-surface","building-foundations","decoration-trees"])expect(names).toContain(name);
  expect(await page.evaluate(()=>(window as any).__friedRaceTest.optionalVehicleFailureKeepsFallback())).toBe(true);
  await page.evaluate(()=>(window as any).__friedRaceTest.teleportToNeighborTile()); const target=await page.evaluate(()=>(window as any).__friedRaceTest.targetMapTile()); await expect.poll(()=>page.locator("body").getAttribute("data-current-map-tile")).toBe(target); await expect.poll(()=>page.locator("body").getAttribute("data-loaded-decoration-layers")).toContain("decoration-trees");
  const frames:number[]=await page.evaluate(()=>(window as any).__friedRaceTest.sampleFrameTimes(20)); const sorted=[...frames].sort((a,b)=>a-b); const p95=sorted[Math.floor(sorted.length*.95)]!; expect(p95).toBeLessThan(500); const appHost=new URL(page.url()).host; expect(requests.filter((url)=>{const parsed=new URL(url);return parsed.protocol.startsWith("http")&&parsed.host!==appHost;})).toEqual([]);
});
