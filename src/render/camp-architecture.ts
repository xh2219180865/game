import type { CampType, FactionId, Tier } from '../core/types.ts';
import { drawArt } from './assets.ts';
import { drawSchemeABuilding } from './scheme-a-buildings.ts';
import { SAMPLE_SPRITE_CROPS } from './sample-sprite-regions.ts';
import { BATTLE_SPRITE_CROPS } from './battle-sprite-regions.ts';

type Point=readonly [number,number];
// Polygons follow the interior of the existing roof paintings, in cropped-image UVs.
// Source-over glazing leaves the tile texture visible and never tints the map behind it.
const COURT_ROOFS:Record<Tier,readonly (readonly Point[])[]>={
  1:[[[.21,.18],[.70,.09],[.77,.30],[.31,.46],[.15,.32]]],
  2:[[[.10,.33],[.27,.25],[.35,.39],[.20,.49]],[[.37,.16],[.63,.09],[.69,.24],[.44,.29]],[[.68,.29],[.82,.34],[.87,.44],[.72,.49]]],
  3:[[[.06,.15],[.19,.05],[.27,.14],[.19,.20]],[[.71,.12],[.80,.04],[.91,.12],[.86,.18]],[[.34,.25],[.59,.23],[.68,.32],[.42,.37]],[[.33,.43],[.61,.39],[.70,.46],[.39,.51]]],
};
const FRONT_ROOFS:Record<CampType,Record<Tier,readonly (readonly Point[])[]>>={
  barracks:{1:[[[.27,.19],[.71,.15],[.65,.39],[.24,.32]]],2:[[[.40,.18],[.74,.11],[.85,.29],[.51,.35]]],3:[[[.41,.16],[.68,.09],[.78,.25],[.49,.31]]]},
  archery:{1:[[[.23,.30],[.61,.09],[.77,.26],[.39,.47]]],2:[[[.26,.23],[.57,.10],[.77,.27],[.40,.40]]],3:[[[.29,.18],[.57,.08],[.72,.23],[.43,.31]],[[.25,.40],[.70,.36],[.81,.47],[.40,.53]]]},
  relay:{1:[[[.35,.31],[.76,.08],[.93,.29],[.48,.48]]],2:[[[.31,.21],[.63,.06],[.80,.28],[.48,.39]],[[.13,.42],[.24,.34],[.40,.48],[.25,.56]]],3:[[[.28,.20],[.57,.07],[.76,.24],[.49,.38]],[[.10,.38],[.25,.30],[.38,.42],[.22,.48]]]},
  fort:{1:[[[.28,.08],[.47,.04],[.57,.11],[.36,.17]]],2:[[[.18,.12],[.37,.06],[.56,.16],[.29,.22]]],3:[[[.23,.08],[.43,.04],[.63,.13],[.34,.19]]]},
};
// Only interior stone/wood faces receive neutral wash; doorways, targets and horses remain exposed.
const COURT_WALLS:Record<Tier,readonly (readonly Point[])[]>={
  1:[[[.10,.68],[.29,.79],[.29,.91],[.10,.81]],[[.76,.73],[.94,.60],[.94,.76],[.76,.89]]],
  2:[[[.08,.61],[.32,.77],[.32,.94],[.08,.78]],[[.70,.72],[.94,.64],[.94,.83],[.70,.93]]],
  3:[[[.07,.31],[.14,.33],[.14,.58],[.07,.57]],[[.77,.29],[.88,.28],[.88,.58],[.77,.60]],[[.06,.72],[.29,.79],[.29,.93],[.06,.85]],[[.76,.76],[.95,.69],[.95,.86],[.76,.93]]],
};
const FRONT_WALLS:Record<CampType,readonly (readonly Point[])[]>={
  barracks:[[[.24,.60],[.39,.65],[.39,.85],[.24,.79]],[[.74,.61],[.88,.53],[.88,.74],[.74,.82]]],
  archery:[[[.68,.65],[.89,.54],[.89,.76],[.68,.87]]],
  relay:[[[.70,.65],[.91,.53],[.91,.74],[.70,.87]]],
  fort:[[[.42,.51],[.66,.55],[.69,.90],[.41,.86]],[[.69,.56],[.88,.49],[.88,.84],[.72,.91]]],
};
function roofGlaze(ctx:CanvasRenderingContext2D,type:CampType,level:Tier,width:number,height:number,owner:FactionId|null,court=type==='barracks'):void{
  const crop=court?SAMPLE_SPRITE_CROPS[`sample-barracks-${level}`]:BATTLE_SPRITE_CROPS[`camp-${type}-${level}`];
  const ratio=crop[2]/crop[3]*(court?1.5:1),w=Math.min(width,height*ratio),h=w/ratio;
  const polygons=court?COURT_ROOFS[level]:FRONT_ROOFS[type][level];
  const color=owner==='P'?'#49A28D':owner==='E'||owner==='E1'?'#D06C50':owner==='E2'?'#D2AC4F':owner==='E3'?'#A38CC4':'#858B90';
  ctx.save();ctx.globalAlpha*=owner===null?.78:.66;
  for(const polygon of polygons)face(ctx,color,polygon.map(([u,v])=>[-w/2+u*w,22-h+v*h] as const));
  ctx.restore();
  if(owner===null){
    ctx.save();ctx.globalAlpha*=.42;
    for(const polygon of court?COURT_WALLS[level]:FRONT_WALLS[type])face(ctx,'#A5A8AA',polygon.map(([u,v])=>[-w/2+u*w,22-h+v*h] as const));
    ctx.restore();
  }
  if(type==='fort'&&!court){
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
  const k=size/28,width=([40,54,66] as const)[level-1]!,height=([34,45,56] as const)[level-1]!;
  ctx.save();ctx.translate(x,y);ctx.scale(k,k);
  ctx.save();ctx.beginPath();ctx.rect(-33,-34,66,56);ctx.clip();
  // Painted courts and towers share the central building's material and lighting.
  const court=(type==='barracks'||level>1)&&drawArt(ctx,`sample-barracks-${level}`,-width/2,22-height,width,height,'bottom');
  if(court)roofGlaze(ctx,'barracks',level,width,height,owner);
  const frontWidth=type==='barracks'?width:level===1?40:type==='fort'?(level===2?30:38):(level===2?39:44);
  const frontHeight=type==='barracks'?height:level===1?34:type==='fort'?(level===2?41:50):(level===2?34:38);
  const painted=(type==='barracks'&&court)||drawArt(ctx,`camp-${type}-${level}`,-frontWidth/2,22-frontHeight,frontWidth,frontHeight,'bottom');
  if(painted&&(type!=='barracks'||!court))roofGlaze(ctx,type,level,frontWidth,frontHeight,owner,false);
  if(!painted){
    if(!court)enclosure(ctx,level,owner);
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
