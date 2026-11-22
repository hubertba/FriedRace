import * as THREE from "three";
import type { MapTile, TiledRoad } from "./tileData";

interface Buffers { positions: number[]; uvs: number[]; }
const appendStrip = (buffers: Buffers, start: {x:number;z:number}, end: {x:number;z:number}, width: number, y: number): void => {
  const dx=end.x-start.x; const dz=end.z-start.z; const length=Math.hypot(dx,dz); if (!length) return; const nx=-dz/length*width/2; const nz=dx/length*width/2;
  buffers.positions.push(start.x+nx,y,start.z+nz, end.x+nx,y,end.z+nz, start.x-nx,y,start.z-nz, end.x+nx,y,end.z+nz, end.x-nx,y,end.z-nz, start.x-nx,y,start.z-nz);
  buffers.uvs.push(0,0,length,0,0,1,length,0,length,1,0,1);
};
const geometryFrom = ({positions,uvs}: Buffers): THREE.BufferGeometry => { const geometry=new THREE.BufferGeometry(); geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3)); geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2)); geometry.computeVertexNormals(); return geometry; };

export const roadSupportsCenterMarking = (road: TiledRoad): boolean => new Set(["primary","secondary","tertiary"]).has(road.highway) && road.width >= 7;

export const buildRoadGeometries = (tile: MapTile): { surface: THREE.BufferGeometry; shoulders: THREE.BufferGeometry; markings: THREE.BufferGeometry } => {
  const surface: Buffers={positions:[],uvs:[]}; const shoulders: Buffers={positions:[],uvs:[]}; const markings: Buffers={positions:[],uvs:[]};
  for (const road of tile.roads) for (let index=1; index<road.points.length; index+=1) {
    const start=road.points[index-1]!; const end=road.points[index]!; appendStrip(shoulders,start,end,road.width+1.4,0.025); appendStrip(surface,start,end,road.width,0.045);
    if (!roadSupportsCenterMarking(road)) continue; const dx=end.x-start.x; const dz=end.z-start.z; const length=Math.hypot(dx,dz); if (!length) continue; const ux=dx/length; const uz=dz/length;
    for (let distance=1.5; distance<length; distance+=7) { const dashLength=Math.min(3,length-distance); if (dashLength<=0) continue; appendStrip(markings,{x:start.x+ux*distance,z:start.z+uz*distance},{x:start.x+ux*(distance+dashLength),z:start.z+uz*(distance+dashLength)},0.14,0.068); }
  }
  return { surface:geometryFrom(surface), shoulders:geometryFrom(shoulders), markings:geometryFrom(markings) };
};
