import { expect, test, vi } from "vitest";
import * as THREE from "three";
import { WorldAssetLibrary } from "../../src/visuals/WorldAssetLibrary";
import type { TileDecorationPlan } from "../../src/world/TileDecoration";

const transform=(x:number)=>({x,y:0,z:x+2,rotation:0.4,scale:1});
const plan:TileDecorationPlan={trees:[transform(1),transform(2)],bushes:[transform(3)],grass:[transform(4),transform(5),transform(6)],delineators:[transform(7)],streetlights:[transform(8)]};

test("creates one shared instanced mesh per non-empty decoration category",()=>{
  const library=new WorldAssetLibrary(); const first=library.createTileDecoration(plan); const second=library.createTileDecoration(plan);
  for(const [key,items] of Object.entries(plan)){const mesh=first.getObjectByName(`decoration-${key}`);expect(mesh).toBeInstanceOf(THREE.InstancedMesh);expect((mesh as THREE.InstancedMesh).count).toBe(items.length);expect(mesh!.userData.sharedResource).toBe(true);expect((second.getObjectByName(`decoration-${key}`) as THREE.InstancedMesh).geometry).toBe((mesh as THREE.InstancedMesh).geometry);}
  library.dispose();
});

test("disposes shared resources once at library shutdown rather than tile removal",()=>{
  const library=new WorldAssetLibrary(); const group=library.createTileDecoration(plan); const mesh=group.getObjectByName("decoration-trees") as THREE.InstancedMesh; const geometryDispose=vi.spyOn(mesh.geometry,"dispose"); const materialDispose=vi.spyOn(mesh.material as THREE.Material,"dispose");
  group.removeFromParent(); expect(geometryDispose).not.toHaveBeenCalled(); expect(materialDispose).not.toHaveBeenCalled(); library.dispose(); expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce(); library.dispose(); expect(geometryDispose).toHaveBeenCalledOnce();
});
