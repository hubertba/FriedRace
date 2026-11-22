import type { MapPoint } from "./mapData";
import type { MapTile, TiledRoad } from "./tileData";

export interface DecorationTransform { x:number; y:number; z:number; rotation:number; scale:number; }
export interface TileDecorationPlan { trees:DecorationTransform[]; bushes:DecorationTransform[]; grass:DecorationTransform[]; delineators:DecorationTransform[]; streetlights:DecorationTransform[]; }
export interface DecorationOptions { boundary?:number; caps?:Partial<Record<keyof TileDecorationPlan,number>>; exclusionTiles?:MapTile[]; }
interface RoadSegment { road:TiledRoad; a:MapPoint; b:MapPoint; }
const defaults:Record<keyof TileDecorationPlan,number>={trees:28,bushes:36,grass:80,delineators:24,streetlights:12};
const density:Record<keyof TileDecorationPlan,number>={trees:10,bushes:12,grass:20,delineators:12,streetlights:6};
const seedFor=(value:string):number=>{let hash=2166136261;for(const char of value){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
const generator=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const finitePoint=(point:MapPoint|undefined):point is MapPoint=>Boolean(point&&Number.isFinite(point.x)&&Number.isFinite(point.z));
const segmentDistance=(point:MapPoint,a:MapPoint,b:MapPoint):number=>{const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;if(!length)return Math.hypot(point.x-a.x,point.z-a.z);const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/length));return Math.hypot(point.x-a.x-dx*t,point.z-a.z-dz*t);};
const segmentsFrom=(tiles:MapTile[]):RoadSegment[]=>tiles.flatMap((entry)=>entry.roads.flatMap((road)=>{if(!Array.isArray(road?.points)||!Number.isFinite(road.width)||road.width<=0||road.width>40)return[];return road.points.slice(1).map((b,index)=>({road,a:road.points[index]!,b})).filter(({a,b})=>finitePoint(a)&&finitePoint(b)&&Math.hypot(b.x-a.x,b.z-a.z)>0);}));

export const planTileDecoration=(tile:MapTile,_tileSize:number,options:DecorationOptions={}):TileDecorationPlan=>{
  const result:TileDecorationPlan={trees:[],bushes:[],grass:[],delineators:[],streetlights:[]};const random=generator(seedFor(tile.id));const boundary=options.boundary??8;const caps={...defaults,...options.caps};const featureTiles=[tile,...(options.exclusionTiles??[]).filter((entry)=>entry!==tile)];
  const sourceRoads=segmentsFrom([tile]);const roads=[...sourceRoads,...segmentsFrom(featureTiles.filter((entry)=>entry!==tile))];
  const buildings=featureTiles.flatMap((entry)=>entry.buildings.map((building)=>Array.isArray(building?.outer)?building.outer.filter(finitePoint):[])).filter((ring)=>ring.length>=3).map((ring)=>({minX:Math.min(...ring.map(p=>p.x))-3,maxX:Math.max(...ring.map(p=>p.x))+3,minZ:Math.min(...ring.map(p=>p.z))-3,maxZ:Math.max(...ring.map(p=>p.z))+3}));
  const allowed=(point:MapPoint,margin:number,ignored?:RoadSegment)=>point.x>=tile.bounds.minX+boundary&&point.x<=tile.bounds.maxX-boundary&&point.z>=tile.bounds.minZ+boundary&&point.z<=tile.bounds.maxZ-boundary&&!roads.some((segment)=>segment===ignored?false:segmentDistance(point,segment.a,segment.b)<=segment.road.width/2+margin)&&!buildings.some((box)=>point.x>=box.minX&&point.x<=box.maxX&&point.z>=box.minZ&&point.z<=box.maxZ);
  const scatter=(key:"trees"|"bushes"|"grass",margin:number,minScale:number,maxScale:number)=>{const target=Math.min(caps[key],density[key]);for(let attempt=0;result[key].length<target&&attempt<target*18;attempt+=1){const point={x:tile.bounds.minX+boundary+random()*(tile.bounds.maxX-tile.bounds.minX-boundary*2),z:tile.bounds.minZ+boundary+random()*(tile.bounds.maxZ-tile.bounds.minZ-boundary*2)};if(allowed(point,margin))result[key].push({...point,y:0,rotation:random()*Math.PI*2,scale:minScale+random()*(maxScale-minScale)});}};
  scatter("trees",3.2,.78,1.35);scatter("bushes",2,.65,1.25);scatter("grass",1.2,.65,1.15);
  for(const segment of sourceRoads){const {road,a,b}=segment;const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length,angle=Math.atan2(dx,dz);for(let distance=12;distance<length;distance+=24){for(const side of [-1,1]){if(result.delineators.length>=Math.min(caps.delineators,density.delineators))break;const point={x:a.x+dx/length*distance+nx*(road.width/2+1.2)*side,z:a.z+dz/length*distance+nz*(road.width/2+1.2)*side};if(allowed(point,.8,segment))result.delineators.push({...point,y:0,rotation:angle,scale:1});}}
    if(new Set(["residential","living_street","unclassified"]).has(road.highway))for(let distance=18;distance<length&&result.streetlights.length<Math.min(caps.streetlights,density.streetlights);distance+=36){const point={x:a.x+dx/length*distance+nx*(road.width/2+2.2),z:a.z+dz/length*distance+nz*(road.width/2+2.2)};if(allowed(point,.8,segment))result.streetlights.push({...point,y:0,rotation:angle,scale:1});}
  }
  return result;
};
