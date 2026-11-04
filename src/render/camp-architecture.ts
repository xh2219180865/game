import type { CampType, FactionId, Tier } from '../core/types.ts';
import { drawArt } from './assets.ts';
import { drawSchemeABuilding } from './scheme-a-buildings.ts';
import { BATTLE_SPRITE_CROPS } from './battle-sprite-regions.ts';

type Point=readonly [number,number];
// Small source-over roof panels keep faction colour inside the new painted architecture.
export const CAMP_ROOF_PANELS:Record<CampType,Record<Tier,readonly (readonly Point[])[]>>={
  barracks:{1:[[[.25,.22],[.51,.11],[.64,.23],[.39,.35]]],2:[[[.26,.20],[.49,.11],[.65,.23],[.41,.33]]],3:[[[.30,.18],[.49,.10],[.64,.21],[.44,.29]]]},
  archery:{1:[[[.25,.22],[.51,.11],[.64,.23],[.39,.35]]],2:[[[.26,.20],[.49,.11],[.65,.23],[.41,.33]]],3:[[[.30,.18],[.49,.10],[.64,.21],[.44,.29]]]},
  relay:{1:[[[.25,.22],[.51,.11],[.64,.23],[.39,.35]]],2:[[[.26,.20],[.49,.11],[.65,.23],[.41,.33]]],3:[[[.28,.20],[.38,.13],[.49,.20],[.38,.28]]]},
  fort:{1:[[[.46,.12],[.52,.09],[.61,.13],[.55,.18]]],2:[[[.46,.12],[.52,.09],[.61,.13],[.55,.18]]],3:[[[.46,.12],[.52,.09],[.61,.13],[.55,.18]]]},
};
// Only interior stone/wood faces receive neutral wash; doorways, targets and horses remain exposed.
export const CAMP_WALL_PANELS:Record<CampType,readonly (readonly Point[])[]>={
  barracks:[[[.24,.60],[.39,.65],[.39,.85],[.24,.79]],[[.74,.61],[.88,.53],[.88,.74],[.74,.82]]],
  archery:[[[.68,.65],[.89,.54],[.89,.76],[.68,.87]]],
  relay:[[[.70,.65],[.84,.57],[.84,.74],[.70,.82]]],
  fort:[[[.48,.43],[.63,.48],[.63,.72],[.48,.68]],[[.64,.50],[.71,.46],[.71,.68],[.64,.73]]],
};
function roofGlaze(ctx:CanvasRenderingContext2D,type:CampType,level:Tier,width:number,height:number,owner:FactionId|null):void{
  const crop=BATTLE_SPRITE_CROPS[`camp-${type}-${level}`];
  const ratio=crop[2]/crop[3],w=Math.min(width,height*ratio),h=w/ratio;
  const polygons=CAMP_ROOF_PANELS[type][level];
  const color=owner==='P'?'#49A28D':owner==='E'||owner==='E1'?'#D06C50':owner==='E2'?'#D2AC4F':owner==='E3'?'#A38CC4':'#858B90';
  ctx.save();ctx.globalAlpha*=owner===null?.78:.66;
  for(const polygon of polygons)face(ctx,color,polygon.map(([u,v])=>[-w/2+u*w,22-h+v*h] as const));
  ctx.restore();
  if(owner===null){
    ctx.save();ctx.globalAlpha*=.42;
    for(const polygon of CAMP_WALL_PANELS[type])face(ctx,'#A5A8AA',polygon.map(([u,v])=>[-w/2+u*w,22-h+v*h] as const));
    ctx.restore();
  }
  if(type==='fort'){
    // The lookout roof is small: a painted band on the stone face carries the same ownership colour.
    ctx.save();ctx.globalAlpha*=.38;
    face(ctx,color,[[.43,.54],[.69,.59],[.69,.76],[.42,.70]].map(([u,v])=>[-w/2+u!*w,22-h+v!*h] as const));
    ctx.restore();
  }
}
const STONE='#BFC6B1',LIGHT='#E2DFCA',SHADE='#8B9B8A',TILE='#506D66',RIDGE='#A9B7A0';
function face(ctx:CanvasRenderingContext2D,color:string,points:readonly Point[]):void{
  ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}

/** Broad architecture, not extra tier marks: open camp, walled court, twin-tower fortress. */
function enclosure(ctx:CanvasRenderingContext2D,level:Tier,owner:FactionId|null):void{
  if(level===1)return;
  const stone=owner===null?'#B9BDC0':STONE,light=owner===null?'#D9DCDE':LIGHT,shade=owner===null?'#92999E':SHADE,tile=owner===null?'#68727B':TILE,ridge=owner===null?'#A8B0B6':RIDGE;
  const reach=level===2?27:32;
  face(ctx,shade,[[-reach,17],[-reach+6,11],[reach-6,11],[reach,17],[reach-4,22],[-reach+4,22]]);
  if(level===2){
    // Low flanking roofs leave the central doorway and troop pennant clear.
    for(const side of [-1,1]){
      const x=side*23;
      ctx.fillStyle=light;ctx.fillRect(x-3,-1,6,20);
      face(ctx,stone,[[x+3,-1],[x+5,2],[x+5,17],[x+3,19]]);
      face(ctx,tile,[[x-5,0],[x-3,-4],[x+2,-4],[x+5,0],[x+4,2],[x-5,2]]);
    }
    return;
  }
  // Full-height outlying bastions are visible even with no number or colour cue.
  face(ctx,stone,[[-28,-12],[28,-12],[28,17],[-28,17]]);
  ctx.fillStyle=light;ctx.fillRect(-27,-13,54,3);
  for(const x of [-26,26]){
    ctx.fillStyle=light;ctx.fillRect(x-5,-23,10,42);
    ctx.fillStyle=shade;ctx.fillRect(x+2,-23,3,42);
    face(ctx,tile,[[x-7,-24],[x-4,-28],[x-2,-33],[x+2,-33],[x+4,-28],[x+7,-24],[x+6,-21],[x-6,-21]]);
    face(ctx,ridge,[[x-7,-24],[x-4,-28],[x-2,-33],[x+1,-33],[x-1,-26],[x-6,-23]]);
    ctx.fillStyle='#455951';ctx.fillRect(x-2,-17,3,6);ctx.fillRect(x-2,-5,3,6);
    ctx.fillStyle=stone;ctx.fillRect(x-5,7,10,2);
  }
}

/** Keeps the original camp anchor and 66 × 56 art clearance; aim is never rescaled with the tier. */
export function drawCampArchitecture(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,type:CampType,tier:number,owner:FactionId|null,aim?:number):void{
  if(![x,y,size].every(Number.isFinite)||size<=0||!['barracks','archery','relay','fort'].includes(type))return;
  const level=(Number.isFinite(tier)?Math.max(1,Math.min(3,Math.floor(tier))):1) as Tier;
  const k=size/28,width=([40,54,66] as const)[level-1]!,height=([34,46,56] as const)[level-1]!;
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.save();ctx.beginPath();ctx.rect(-33,-34,66,56);ctx.clip();
  // Every type and tier is a complete original settlement, never a generic fort with a prop pasted on it.
  const painted=drawArt(ctx,`camp-${type}-${level}`,-width/2,22-height,width,height,'bottom');
  if(painted)roofGlaze(ctx,type,level,width,height,owner);
  if(!painted){
    enclosure(ctx,level,owner);
    const factor=([.64,.81,.92] as const)[level-1]!;
    drawSchemeABuilding(ctx,0,22-25*factor,28*factor,type,level,owner,aim,false);
  }
  ctx.restore();
  if(type==='fort'&&((aim!==undefined&&Number.isFinite(aim))||!painted)){
    // The firing cue remains anchored to the real tower, including downward aim.
    const directed=aim!==undefined&&Number.isFinite(aim),length=Math.hypot(24,5);
    ctx.lineCap='round';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(0,0);
    ctx.lineTo(directed?Math.cos(aim)*length:24,directed?Math.sin(aim)*length:-5);
    ctx.strokeStyle='#F8E6BA';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#715B38';ctx.lineWidth=1.8;ctx.stroke();
  }
  ctx.restore();
}
