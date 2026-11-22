import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { DecorationTransform, TileDecorationPlan } from "../world/TileDecoration";

type Category=keyof TileDecorationPlan;
interface Asset { geometry:THREE.BufferGeometry; material:THREE.MeshStandardMaterial; castShadow:boolean; }
const colored=(geometry:THREE.BufferGeometry,color:number):THREE.BufferGeometry=>{const value=new THREE.Color(color);const colors:number[]=[];for(let index=0;index<geometry.getAttribute("position").count;index+=1)colors.push(value.r,value.g,value.b);geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));return geometry;};
const merged=(...geometries:THREE.BufferGeometry[]):THREE.BufferGeometry=>{const result=mergeGeometries(geometries,false)!;geometries.forEach((geometry)=>geometry.dispose());return result;};
const treeGeometry=()=>{const trunk=colored(new THREE.CylinderGeometry(.22,.3,2,7).translate(0,1,0),0x64442b);const lower=colored(new THREE.ConeGeometry(1.55,3.2,9).translate(0,3.1,0),0x416b36);const upper=colored(new THREE.ConeGeometry(1.15,2.7,9).translate(0,4.65,0),0x527b3e);return merged(trunk,lower,upper);};
const delineatorGeometry=()=>merged(colored(new THREE.BoxGeometry(.18,1.15,.14).translate(0,.575,0),0xe8e6dc),colored(new THREE.BoxGeometry(.19,.2,.15).translate(0,.78,0),0x25282a));
const streetlightGeometry=()=>merged(colored(new THREE.CylinderGeometry(.07,.1,5,7).translate(0,2.5,0),0x54595b),colored(new THREE.BoxGeometry(.9,.08,.08).translate(.4,4.9,0),0x54595b),colored(new THREE.SphereGeometry(.18,8,5).translate(.85,4.78,0),0xffd89a));

export class WorldAssetLibrary{
  private disposed=false;
  private readonly assets:Record<Category,Asset>={
    trees:{geometry:treeGeometry(),material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92}),castShadow:false},
    bushes:{geometry:colored(new THREE.DodecahedronGeometry(1.05,0).translate(0,.85,0),0x527a3c),material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),castShadow:false},
    grass:{geometry:colored(new THREE.ConeGeometry(.42,.75,5).translate(0,.37,0),0x78974c),material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide}),castShadow:false},
    delineators:{geometry:delineatorGeometry(),material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72}),castShadow:false},
    streetlights:{geometry:streetlightGeometry(),material:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.35}),castShadow:false},
  };
  createTileDecoration(plan:TileDecorationPlan):THREE.Group{const group=new THREE.Group();group.name="tile-decoration";const dummy=new THREE.Object3D();for(const key of Object.keys(plan) as Category[]){const transforms=plan[key];if(!transforms.length)continue;const asset=this.assets[key];const instances=new THREE.InstancedMesh(asset.geometry,asset.material,transforms.length);instances.name=`decoration-${key}`;instances.userData.sharedResource=true;instances.castShadow=asset.castShadow;instances.receiveShadow=true;transforms.forEach((transform:DecorationTransform,index)=>{dummy.position.set(transform.x,transform.y,transform.z);dummy.rotation.set(0,transform.rotation,0);dummy.scale.setScalar(transform.scale);dummy.updateMatrix();instances.setMatrixAt(index,dummy.matrix);});instances.instanceMatrix.needsUpdate=true;group.add(instances);}return group;}
  dispose():void{if(this.disposed)return;this.disposed=true;for(const asset of Object.values(this.assets)){asset.geometry.dispose();asset.material.dispose();}}
}
