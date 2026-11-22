import { expect, test } from "vitest";
import * as THREE from "three";
import { createGarageVisual } from "../../src/visuals/GarageVisual";

test("creates a discoverable workshop and yard without physics side effects",()=>{
  const garage=createGarageVisual({x:0,z:0}); expect(garage.name).toBe("Garage"); expect(Math.hypot(garage.position.x,garage.position.z)).toBeLessThan(20);
  for(const name of ["workshop-shell","workshop-roof","garage-door","workshop-window","garage-yard","garage-light"]) expect(garage.getObjectByName(name)).toBeTruthy();
  expect(garage.userData.collider).toBeUndefined();
  const meshes:THREE.Mesh[]=[];garage.traverse((object)=>{if(object instanceof THREE.Mesh)meshes.push(object);});expect(meshes.some((mesh)=>(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity>0)).toBe(true);expect(meshes.every((mesh)=>mesh.castShadow||mesh.name==="garage-yard")).toBe(true);
});
