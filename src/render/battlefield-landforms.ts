import { drawArt } from './assets.ts';
import type { SceneryPoint, SceneryRoute } from './battlefield-scenery.ts';

export interface MountainLandform {x:number;y:number;width:number;height:number;seed:number}
export interface RiverLandform {points:readonly SceneryPoint[];width:number;bank:number}
export interface BridgeLandform {x:number;y:number;angle:number;length:number;width:number;routeIndex:number}
export interface BattlefieldLandforms {river:RiverLandform|null;bridges:readonly BridgeLandform[];mountains:readonly MountainLandform[];scale:number}
const empty=():BattlefieldLandforms=>({river:null,bridges:[],mountains:[],scale:1});
const finite=(p:SceneryPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function landformSegmentDistance(p:SceneryPoint,a:SceneryPoint,b:SceneryPoint):number {
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d,0,1):0;
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
function intersection(a:SceneryPoint,b:SceneryPoint,c:SceneryPoint,d:SceneryPoint):{x:number;y:number;sin:number}|null {
  const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,det=ux*vy-uy*vx;
  if(Math.abs(det)<1e-8)return null;
  const dx=c.x-a.x,dy=c.y-a.y,t=(dx*vy-dy*vx)/det,u=(dx*uy-dy*ux)/det;
  if(t<0||t>1||u<0||u>1)return null;
  return {x:a.x+t*ux,y:a.y+t*uy,sin:Math.abs(det)/(Math.hypot(ux,uy)*Math.hypot(vx,vy))};
}
function polylineDistance(p:SceneryPoint,points:readonly SceneryPoint[]):number {
  let distance=Infinity;for(let i=1;i<points.length;i++)distance=Math.min(distance,landformSegmentDistance(p,points[i-1]!,points[i]!));return distance;
}
function boxClear(m:MountainLandform,camps:readonly SceneryPoint[],routes:readonly SceneryRoute[],river:RiverLandform|null,scale:number):boolean {
  const left=m.x-m.width/2,right=m.x+m.width/2,top=m.y-m.height,bottom=m.y;
  if(camps.some(c=>Math.hypot(Math.max(left-c.x,0,c.x-right),Math.max(top-c.y,0,c.y-bottom))<43*scale))return false;
  // Expanded box clipping, including both ends; never paint a cliff over a legal road.
  for(const r of routes){let lo=0,hi=1;for(const [o,d,min,max]of [[r.from.x,r.to.x-r.from.x,left-13*scale,right+13*scale],[r.from.y,r.to.y-r.from.y,top-13*scale,bottom+13*scale]] as const){if(d===0){if(o<min||o>max){lo=2;break;}continue;}const a=(min-o)/d,b=(max-o)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}if(lo<=hi)return false;}
  if(river){const gap=river.width/2+river.bank+5*scale;for(let y=top;y<=bottom;y+=Math.max(2,5*scale))for(let x=left;x<=right;x+=Math.max(2,5*scale))if(polylineDistance({x,y},river.points)<gap)return false;}
  return true;
}

/** Geographic expression of the existing road graph, never new collision or line-of-sight rules. */
export function planBattlefieldLandforms(width:number,height:number,camps:readonly SceneryPoint[],routes:readonly SceneryRoute[],mapId:string):BattlefieldLandforms {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<120||height<160||camps.some(c=>!finite(c))||routes.some(r=>!finite(r.from)||!finite(r.to)||Math.hypot(r.to.x-r.from.x,r.to.y-r.from.y)<1))return empty();
  // No supplied graph means no certified crossing. Thumbnails must supply their real roads too.
  if(!routes.length||camps.length<2)return empty();
  const scale=Math.min(1.2,width/375,height/540),seed=Array.from(mapId).reduce((n,c)=>n+c.charCodeAt(0),0);
  const riverWidth=(mapId==='A03'||mapId==='L03'?14:20)*scale,bank=4*scale;
  const minY=Math.min(...camps.map(c=>c.y)),maxY=Math.max(...camps.map(c=>c.y));
  let river:RiverLandform|null=null,bridges:BridgeLandform[]=[],best=-Infinity;
  for(const f of [.34,.66,.27,.73,.42,.58,.2,.8])for(const amplitude of [9,20,0])for(const phase of [0,Math.PI]){
    const center=minY+(maxY-minY)*f,points=Array.from({length:25},(_,i)=>{const x=-20*scale+(width+40*scale)*i/24;return {x,y:center+amplitude*scale*Math.sin(x/width*Math.PI*2+phase+seed*.03)};});
    if(points.some(p=>p.y<65*scale||p.y>height-22*scale))continue;
    if(camps.some(c=>polylineDistance(c,points)<43*scale+riverWidth/2+bank))continue;
    const crossings:BridgeLandform[]=[];let valid=true;
    for(const [index,r]of routes.entries()){
      for(let i=1;i<points.length;i++){
        const at=intersection(r.from,r.to,points[i-1]!,points[i]!);if(!at)continue;
        if(crossings.some(b=>b.routeIndex===index&&Math.hypot(b.x-at.x,b.y-at.y)<scale))continue;
        if(at.sin<.4){valid=false;break;}
        const length=(riverWidth+2*bank+6*scale)/at.sin;
        if(Math.min(Math.hypot(at.x-r.from.x,at.y-r.from.y),Math.hypot(at.x-r.to.x,at.y-r.to.y))<length/2+30*scale){valid=false;break;}
        crossings.push({x:at.x,y:at.y,angle:Math.atan2(r.to.y-r.from.y,r.to.x-r.from.x),length,width:14*scale,routeIndex:index});
      }
      if(!valid)break;
      // A road hugging the bank without a crossing would look half submerged.
      for(let i=1;i<12;i++){const p={x:r.from.x+(r.to.x-r.from.x)*i/12,y:r.from.y+(r.to.y-r.from.y)*i/12};if(polylineDistance(p,points)<riverWidth/2+bank+7*scale&&!crossings.some(b=>b.routeIndex===index&&Math.hypot(p.x-b.x,p.y-b.y)<b.length/2+8*scale)){valid=false;break;}}
    }
    if(!valid||!crossings.length||crossings.length>5)continue;
    const score=100-crossings.length*7-Math.abs(f-.5)*10+(amplitude?2:0);
    if(score>best){best=score;river={points,width:riverWidth,bank};bridges=crossings;}
  }
  const mountains:MountainLandform[]=[];
  // Large clear pockets between roads become ridges; tiny residual slivers stay as open soil.
  for(const size of [1.35,1,.78,.58])for(const v of [.22,.36,.5,.64,.78,.9,.28,.42,.56,.7,.84])for(const u of [.12,.3,.5,.7,.88,.2,.4,.6,.8,.25,.35,.65,.75]){
    if(mountains.length>=5)break;
    const m={x:width*u,y:height*v+Math.sin(seed+u*19)*8*scale,width:68*scale*size,height:45*scale*size,seed:seed+Math.round(u*100+v*100)};
    if(m.x-m.width/2<3||m.x+m.width/2>width-3||m.y-m.height<8||m.y>height-8)continue;
    if(mountains.some(a=>Math.abs(a.x-m.x)<(a.width+m.width)/2+12*scale&&Math.abs(a.y-a.height/2-(m.y-m.height/2))<(a.height+m.height)/2+14*scale))continue;
    if(boxClear(m,camps,routes,river,scale))mountains.push(m);
  }
  return {river,bridges,mountains,scale};
}

// Fixed-size cache: geometry only, no army, ownership, clock or stored game state.
const cache=new Map<string,BattlefieldLandforms>();
export function battlefieldLandforms(width:number,height:number,camps:readonly SceneryPoint[],routes:readonly SceneryRoute[],mapId:string):BattlefieldLandforms {
  const key=JSON.stringify([width,height,mapId,camps,routes]);const existing=cache.get(key);if(existing)return existing;
  const plan=planBattlefieldLandforms(width,height,camps,routes,mapId);if(cache.size>=12)cache.delete(cache.keys().next().value!);cache.set(key,plan);return plan;
}
function riverPath(ctx:CanvasRenderingContext2D,river:RiverLandform):void {ctx.beginPath();river.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));}
function riverBand(ctx:CanvasRenderingContext2D,river:RiverLandform,halfWidth:number,color:string):void {
  ctx.fillStyle=color;ctx.beginPath();let started=false;
  for(const side of [-1,1])for(let j=0;j<river.points.length;j++){
    const i=side<0?j:river.points.length-1-j,p=river.points[i]!,a=river.points[Math.max(0,i-1)]!,b=river.points[Math.min(river.points.length-1,i+1)]!;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,w=halfWidth*(.92+.08*Math.sin(i*1.63));
    const x=p.x-dy/d*w*side,y=p.y+dx/d*w*side;if(started)ctx.lineTo(x,y);else{ctx.moveTo(x,y);started=true;}
  }
  ctx.closePath();ctx.fill();
}


/** Beneath roads/camps. Still water and etched rock need no particles or animation clock. */
export function drawBattlefieldLandforms(ctx:CanvasRenderingContext2D,plan:BattlefieldLandforms,mapId:string):void {
  const snow=mapId==='A02'||mapId==='L02',sand=mapId==='A03'||mapId==='L03',s=plan.scale;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(plan.river){const r=plan.river;
    riverBand(ctx,r,r.width/2+r.bank+2*s,snow?'#74847B':'#786C4D');
    riverBand(ctx,r,r.width/2+r.bank,snow?'#CCD5C8':sand?'#B6A179':'#ACAA80');
    riverBand(ctx,r,r.width/2,snow?'#6C8C92':sand?'#6D8C80':'#5F817A');
    riverPath(ctx,r);ctx.lineWidth=r.width*.48;ctx.strokeStyle=snow?'#92B0B0':'#83A69A';ctx.stroke();
    ctx.lineWidth=.8*s;ctx.strokeStyle=snow?'#D7E3D8':'#BDD0B4';
    for(let i=2;i<r.points.length-2;i+=2){const p=r.points[i]!;ctx.beginPath();ctx.moveTo(p.x-5*s,p.y-2*s);ctx.quadraticCurveTo(p.x,p.y-1*s,p.x+5*s,p.y-2*s);ctx.stroke();}
  }
  for(const m of plan.mountains){
    const climate=snow?'snow':sand?'desert':'plains';
    if(drawArt(ctx,`landform-${climate}-${m.seed%2===0?0:1}`,m.x-m.width/2,m.y-m.height,m.width,m.height,'bottom'))continue;
    ctx.save();ctx.translate(m.x-m.width/2,m.y-m.height);ctx.scale(m.width/68,m.height/45);
    const shadow=sand?'#75674A':'#53634F',stone=snow?'#7D8D87':sand?'#9A8967':'#7C8669',face=snow?'#B9C5B9':sand?'#BCAE8C':'#ABA98A';
    ctx.fillStyle=shadow+'70';ctx.beginPath();ctx.ellipse(34,39,32,5,0,0,Math.PI*2);ctx.fill();
    // Unequal overlapping flanks, a broken summit and lower rock shoulders.
    ctx.fillStyle=stone;ctx.beginPath();ctx.moveTo(1,39);ctx.lineTo(11,26);ctx.lineTo(18,21);ctx.lineTo(27,4);ctx.lineTo(32,1);ctx.lineTo(39,12);ctx.lineTo(44,10);ctx.lineTo(53,26);ctx.lineTo(62,29);ctx.lineTo(67,40);ctx.quadraticCurveTo(32,45,1,39);ctx.fill();
    ctx.fillStyle=face;ctx.beginPath();ctx.moveTo(8,35);ctx.lineTo(18,21);ctx.lineTo(27,4);ctx.lineTo(32,1);ctx.lineTo(27,22);ctx.lineTo(32,26);ctx.lineTo(24,38);ctx.closePath();ctx.fill();
    ctx.fillStyle=shadow+'B0';ctx.beginPath();ctx.moveTo(32,2);ctx.lineTo(39,12);ctx.lineTo(44,10);ctx.lineTo(53,26);ctx.lineTo(62,29);ctx.lineTo(67,40);ctx.lineTo(39,39);ctx.lineTo(34,24);ctx.closePath();ctx.fill();
    ctx.strokeStyle=snow?'#596F69':'#666B50';ctx.lineWidth=.7;
    for(let i=0;i<5;i++){const x=18+i*7;ctx.beginPath();ctx.moveTo(x,22+i%2*5);ctx.lineTo(x-3,29+i%2*3);ctx.lineTo(x+1,35);ctx.stroke();}
    if(snow){ctx.fillStyle='#DBE1D3';ctx.beginPath();ctx.moveTo(21,15);ctx.lineTo(27,4);ctx.lineTo(32,1);ctx.lineTo(39,12);ctx.lineTo(33,10);ctx.lineTo(30,14);ctx.lineTo(27,10);ctx.closePath();ctx.fill();}
    ctx.strokeStyle=sand?'#8D8059':'#5B7050';ctx.lineWidth=1.4;ctx.beginPath();for(const x of [7,15,52,60]){ctx.moveTo(x,40);ctx.lineTo(x-2,36);ctx.moveTo(x,40);ctx.lineTo(x+3,37);}ctx.stroke();ctx.restore();
  }
  ctx.restore();
}

/** Above the earth roads, below troops: every deck lies on one real road crossing. */
export function drawBattlefieldBridges(ctx:CanvasRenderingContext2D,plan:BattlefieldLandforms,activeRoutes:readonly number[]=[]):void {
  const s=plan.scale;ctx.save();
  for(const b of plan.bridges){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.angle);const start=-b.length/2,end=b.length/2,w=b.width/2;
    ctx.fillStyle='#433C2A66';ctx.fillRect(start-2*s,-w-2*s,b.length+4*s,b.width+5*s);
    ctx.fillStyle='#8D6C43';ctx.fillRect(start,-w,b.length,b.width);
    ctx.strokeStyle='#C1A36B';ctx.lineWidth=1.4*s;ctx.beginPath();ctx.moveTo(start,-w+1*s);ctx.lineTo(end,-w+1*s);ctx.moveTo(start,w-1*s);ctx.lineTo(end,w-1*s);ctx.stroke();
    ctx.strokeStyle='#59472F';ctx.lineWidth=.7*s;ctx.beginPath();for(let x=start+3*s;x<end;x+=4*s){ctx.moveTo(x,-w+2*s);ctx.lineTo(x+.6*s,w-2*s);}ctx.stroke();
    // Low timber rails indicate a deck, without hiding a squad or creating a new hit target.
    ctx.strokeStyle='#5D4B31';ctx.lineWidth=1.2*s;ctx.beginPath();for(const y of [-w-1*s,w+1*s]){ctx.moveTo(start,y);ctx.lineTo(end,y);for(let x=start;x<=end;x+=8*s){ctx.moveTo(x,y+2*s);ctx.lineTo(x,y-3*s);}}ctx.stroke();if(activeRoutes.includes(b.routeIndex)){ctx.strokeStyle='#6D6654';ctx.lineWidth=2.2*s;ctx.beginPath();ctx.moveTo(start,0);ctx.lineTo(end,0);ctx.stroke();}ctx.restore();
  }
  ctx.restore();
}
