import { drawArt } from './assets.ts';
import {drawBattlefieldScenery,type SceneryRoute} from './battlefield-scenery.ts';

type CampCenter=Readonly<{x:number;y:number}>;

/** Environment is presentation only: map positions and routes stay authoritative. */
const TERRAIN_BY_MAP={L01:'terrain-plains',A01:'terrain-plains',L02:'terrain-snow',A02:'terrain-snow',L03:'terrain-desert',A03:'terrain-desert'} as const;
const GROUND={
  'terrain-plains':['#D6D1BE','#C8CBB7','#DEDACE','#CDD0BE','#D8D6C6','#9DA991','#B1B7A1'],
  'terrain-snow':['#DCDFD8','#CFD7D2','#E5E8E1','#D2DBD5','#DCE2DB','#A3B2AC','#B8C4BC'],
  'terrain-desert':['#DBCEB5','#D0C1A8','#E3D8C2','#D3C6AF','#DFD2BA','#AFA58D','#C0B69F'],
} as const;

function oval(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string):void{
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}

/** Draw beneath battle routes and camps, in the caller's local battlefield rectangle. */
export function drawTerrain(ctx:CanvasRenderingContext2D,width:number,height:number,camps:readonly CampCenter[],mapId:string,routes:readonly SceneryRoute[]=[]):void{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
  const centers=camps.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  let seed=0;for(let i=0;i<mapId.length;i++)seed=(seed*31+mapId.charCodeAt(i))>>>0;
  const scale=Math.min(1,width/375,height/400);
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();
  const artwork=TERRAIN_BY_MAP[mapId as keyof typeof TERRAIN_BY_MAP]??'terrain-plains';
  const ground=GROUND[artwork];
  ctx.fillStyle=ground[0];ctx.fillRect(0,0,width,height);
  // Warm grey earth ties the battlefield to the courtyard's stone and foliage.
  // Existing landscape pigments use ordinary source-over drawing, without filters.
  ctx.save();ctx.globalAlpha*=.38;
  const painted=drawArt(ctx,artwork,0,0,width,height,'cover');ctx.restore();
  if(painted){drawBattlefieldScenery(ctx,width,height,centers,mapId,routes);ctx.restore();return;}
  // Broad, quiet colour planes leave the battle readable without suggesting impassable terrain.
  ctx.fillStyle=ground[1];ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(width,0);ctx.lineTo(width,height*.31);ctx.bezierCurveTo(width*.72,height*.2,width*.64,height*.39,width*.4,height*.27);ctx.bezierCurveTo(width*.16,height*.14,width*.14,height*.41,0,height*.3);ctx.closePath();ctx.fill();
  ctx.fillStyle=ground[2];ctx.beginPath();ctx.moveTo(0,height*.3);ctx.bezierCurveTo(width*.26,height*.18,width*.25,height*.49,width*.52,height*.36);ctx.bezierCurveTo(width*.8,height*.27,width*.86,height*.43,width,height*.34);ctx.lineTo(width,height*.78);ctx.bezierCurveTo(width*.68,height*.6,width*.29,height*.84,0,height*.65);ctx.closePath();ctx.fill();
  ctx.fillStyle=ground[3];ctx.beginPath();ctx.moveTo(0,height*.79);ctx.bezierCurveTo(width*.29,height*.63,width*.55,height*.89,width,height*.68);ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.closePath();ctx.fill();
  for(const [u,v,rx,ry]of [[.21,.17,.16,.043],[.76,.32,.2,.045],[.27,.54,.18,.035],[.68,.72,.18,.05],[.32,.91,.23,.045]]as const){
    oval(ctx,width*u,height*v,width*rx,height*ry,ground[4]);
  }
  // Small, low-contrast grass marks; the centre and every camp retain a clear foreground.
  const clear=(x:number,y:number,r:number)=>centers.every(p=>Math.hypot(x-p.x,y-p.y)>=42+r);
  for(let i=0;i<18;i++){
    const x=12+((i*73+seed%97)%(Math.max(1,width-24))),y=14+((i*127+seed%113)%(Math.max(1,height-28)));
    if(!clear(x,y,6)||x>width*.1&&x<width*.9&&y>height*.1&&y<height*.9)continue;
    ctx.strokeStyle=i%3===0?ground[5]:ground[6];ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-3,y+2);ctx.lineTo(x-5,y-2);ctx.moveTo(x,y+2);ctx.lineTo(x,y-3);ctx.moveTo(x+2,y+2);ctx.lineTo(x+5,y-1);ctx.stroke();
  }
  for(const p of centers){
    oval(ctx,p.x,p.y+9,43*scale,28*scale,ground[5]+'35');
    oval(ctx,p.x,p.y+7,39*scale,25*scale,ground[6]+'55');
    oval(ctx,p.x-1,p.y+5,35*scale,21*scale,'#C3BEAA');
    oval(ctx,p.x-5,p.y+2,26*scale,15*scale,'#D1CCB9');
    // Two flat foundation stones give the soil edge texture without suggesting a road.
    oval(ctx,p.x-27*scale,p.y+15*scale,3*scale,1.4*scale,'#A8AA9D');
    oval(ctx,p.x+24*scale,p.y+21*scale,4*scale,1.5*scale,'#A8AA9D');
  }
  drawBattlefieldScenery(ctx,width,height,centers,mapId,routes);
  ctx.restore();
}
