import * as THREE from "three";

const addMesh=(group:THREE.Group,name:string,geometry:THREE.BufferGeometry,material:THREE.Material,position:[number,number,number],rotation:[number,number,number]=[0,0,0]):THREE.Mesh=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=name!=="garage-yard";mesh.receiveShadow=true;group.add(mesh);return mesh;};
export const createGarageVisual=(position:{x:number;z:number}):THREE.Group=>{
  const group=new THREE.Group();group.name="Garage";group.position.set(position.x+10,0,position.z+8);
  const plaster=new THREE.MeshStandardMaterial({color:0xb7aa8f,roughness:.9});const roof=new THREE.MeshStandardMaterial({color:0x72433a,roughness:.82});const metal=new THREE.MeshStandardMaterial({color:0x3f4a4d,roughness:.48,metalness:.42});const glass=new THREE.MeshPhysicalMaterial({color:0x50707d,roughness:.12,metalness:.12,transparent:true,opacity:.82});const ground=new THREE.MeshStandardMaterial({color:0x77746b,roughness:1});const light=new THREE.MeshStandardMaterial({color:0xffe1a3,emissive:0xffb85e,emissiveIntensity:2});
  addMesh(group,"garage-yard",new THREE.BoxGeometry(23,.08,19),ground,[0,.02,1]);addMesh(group,"workshop-shell",new THREE.BoxGeometry(14,5,10),plaster,[0,2.5,0]);
  addMesh(group,"workshop-roof",new THREE.BoxGeometry(7.7,.35,10.7),roof,[-3.35,5.8,0],[0,0,-.25]);addMesh(group,"workshop-roof",new THREE.BoxGeometry(7.7,.35,10.7),roof,[3.35,5.8,0],[0,0,.25]);
  addMesh(group,"garage-door",new THREE.BoxGeometry(5.5,3.5,.18),metal,[-2.8,2,-5.08]);addMesh(group,"workshop-window",new THREE.BoxGeometry(2.8,1.7,.12),glass,[4.3,2.5,-5.1]);addMesh(group,"garage-light",new THREE.BoxGeometry(.65,.18,.22),light,[4.3,4.3,-5.16]);
  return group;
};
