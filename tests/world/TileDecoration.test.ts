import { expect, test } from "vitest";
import { planTileDecoration } from "../../src/world/TileDecoration";
import type { MapTile } from "../../src/world/tileData";

const tile = (id="0-0"): MapTile => ({ version:2,id,x:0,z:0,bounds:{minX:0,maxX:100,minZ:0,maxZ:100},roads:[{id:"r",name:"Road",highway:"residential",width:8,points:[{x:8,z:50},{x:92,z:50}]}],buildings:[{id:"b",outer:[{x:35,z:20},{x:55,z:20},{x:55,z:35},{x:35,z:35},{x:35,z:20}],inners:[],height:8,minHeight:0,levels:2,buildingType:"house",facadeMaterial:"plaster",facadeColor:"#ddd",roofShape:"gabled",roofMaterial:"tiles",roofColor:"#933",roofHeight:2}] });

const distanceToRoad = (point:{x:number;z:number}) => Math.abs(point.z-50);

test("plans deterministic bounded decoration with road, building, and boundary clearance", () => {
  const first=planTileDecoration(tile(),100); const second=planTileDecoration(tile(),100); expect(first).toEqual(second);
  expect(planTileDecoration(tile("other"),100)).not.toEqual(first);
  expect(first.trees.length).toBeLessThanOrEqual(28); expect(first.bushes.length).toBeLessThanOrEqual(36); expect(first.grass.length).toBeLessThanOrEqual(80); expect(first.delineators.length).toBeLessThanOrEqual(24); expect(first.streetlights.length).toBeLessThanOrEqual(12);
  for (const point of [...first.trees,...first.bushes,...first.grass]) {
    expect(Math.min(point.x,100-point.x,point.z,100-point.z)).toBeGreaterThanOrEqual(8);
    expect(distanceToRoad(point)).toBeGreaterThan(5);
    expect(point.x>=32&&point.x<=58&&point.z>=17&&point.z<=38).toBe(false);
  }
});

test("handles empty and malformed features with finite capped output", () => {
  const malformed={...tile(),roads:[{...tile().roads[0]!,points:[{x:Number.NaN,z:2},{x:3,z:4}]}],buildings:[{...tile().buildings[0]!,outer:[]}]} as MapTile;
  const plan=planTileDecoration(malformed,100); const all=Object.values(plan).flat();
  expect(all.length).toBeLessThanOrEqual(180); expect(all.every((point)=>Number.isFinite(point.x)&&Number.isFinite(point.z)&&Number.isFinite(point.scale)&&Number.isFinite(point.rotation))).toBe(true);
});
