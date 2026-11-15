import type { Battle, BattleEvent, FactionId, Point } from '../core/types.ts';
import { MAPS } from '../core/maps.ts';
import { arrow, factionColor } from './art.ts';

export function tacticalDuration(type:BattleEvent['type']):number {
  return type==='capture'?800:type==='dispatch'?450:type==='tower-shot'||type==='volley'?300:type==='arrival'?550:600;
}

/** Ground roads stop at the city footprint; their endpoints never cover counters. */
export function roadSegment(from:Point,to:Point,padding:number):{from:Point;to:Point}|null {
  const length=Math.hypot(to.x-from.x,to.y-from.y);
  if(!Number.isFinite(length)||length<=padding*2)return null;
  const x=(to.x-from.x)/length,y=(to.y-from.y)/length;
  return {from:{x:from.x+x*padding,y:from.y+y*padding},to:{x:to.x-x*padding,y:to.y-y*padding}};
}

/** Each side follows the real centreline; only the earth edge is irregular. */
function roadRibbon(ctx:CanvasRenderingContext2D,from:Point,to:Point,halfWidth:number,seed:number,color:string):void{
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
  const steps=Math.max(5,Math.min(12,Math.ceil(length/14))),points:Point[]=[];
  for(const side of [-1,1])for(let j=0;j<=steps;j++){
    const i=side<0?j:steps-j,t=i/steps;
    const edge=halfWidth*(.86+.08*Math.sin(i*.9+seed+side*2.4)+.06*Math.sin(i*2.2+seed*.7));
    points.push({x:from.x+dx*t+nx*side*edge,y:from.y+dy*t+ny*side*edge});
  }
  ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
}

export function drawRoads(ctx:CanvasRenderingContext2D,b:Pick<Battle,'ruleRevision'|'mapId'>&{camps:ReadonlyArray<Point&{id:string}>},point:(p:Point)=>Point,selectedId:string|null,scale=1):void {
  if(b.ruleRevision!=='1.6'||!Number.isFinite(scale)||scale<=0)return;
  const camps=new Map(b.camps.map(c=>[c.id,c]));
  const snow=b.mapId==='A02'||b.mapId==='L02',sand=b.mapId==='A03'||b.mapId==='L03';
  const palette=snow?['#8C938A25','#93988B3D','#ABB09B70','#343D354C']:sand?['#9D845A2B','#AA8E6245','#B59A707A','#493A264C']:['#8A775A22','#A38B6240','#B09B767A','#352C204B'];
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const [index,[a,z]] of MAPS[b.mapId].roads.entries()){
    const source=camps.get(a),target=camps.get(z);if(!source||!target)continue;
    const segment=roadSegment(point(source),point(target),Math.max(16,28*scale));if(!segment)continue;
    const active=a===selectedId||z===selectedId,seed=index*1.71+b.mapId.charCodeAt(0);
    const {from,to}=segment,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    // Translucent shoulders expose the actual terrain instead of outlining an opaque ribbon.
    roadRibbon(ctx,from,to,8*scale,seed,palette[0]!);
    roadRibbon(ctx,from,to,6.2*scale,seed,palette[1]!);
    roadRibbon(ctx,from,to,4.2*scale,seed,palette[2]!);
    ctx.strokeStyle=palette[3]!;ctx.lineWidth=.7*scale;ctx.beginPath();
    const marks=Math.max(2,Math.min(10,Math.floor(length/(15*scale))));
    for(let i=0;i<marks;i++)for(const side of [-1,1]){
      // Offset and length vary independently, so neither rut reads as a continuous rail.
      const t=(i+.5+side*.12)/marks,step=length*t,offset=side*(1.8+.5*Math.sin(i*1.8+seed+side))*scale;
      const run=Math.min((4+4*(.5+.5*Math.sin(seed+i*2.1+side)))*scale,length-step);
      const x=from.x+ux*step-uy*offset,y=from.y+uy*step+ux*offset;
      ctx.moveTo(x,y);ctx.lineTo(x+ux*run,y+uy*run);
    }
    ctx.stroke();
    // Sparse worn patches break the centre's flat fill; all marks stay within the road shoulder.
    ctx.fillStyle=snow?'#343D3522':'#30271925';ctx.beginPath();
    for(let i=0;i<Math.min(4,marks);i++){
      const t=(i+.65)/(Math.min(4,marks)+.4),step=length*t,offset=Math.sin(seed+i*2.3)*2*scale;
      const x=from.x+ux*step-uy*offset,y=from.y+uy*step+ux*offset,run=Math.min(6*scale,length-step);
      ctx.moveTo(x-uy*scale,y+ux*scale);ctx.lineTo(x+ux*run-uy*.5*scale,y+uy*run+ux*.5*scale);
      ctx.lineTo(x+ux*run*.7+uy*scale,y+uy*run*.7-ux*scale);ctx.lineTo(x+uy*.3*scale,y-ux*.3*scale);ctx.closePath();
    }
    ctx.fill();
    if(active){
      // A temporary bronze guide marks legal exits; the physical road stays on its real centreline.
      ctx.strokeStyle='#6D6654';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
      ctx.strokeStyle='#E8D4A680';ctx.lineWidth=1;ctx.stroke();
      const start=a===selectedId?from:to,end=a===selectedId?to:from;
      const mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      arrow(ctx,{x:mid.x-(end.x-start.x)/length*5,y:mid.y-(end.y-start.y)/length*5},{x:mid.x+(end.x-start.x)/length*5,y:mid.y+(end.y-start.y)/length*5},'#F0EBD8',1.6);
      ctx.fillStyle='#6D6654';ctx.beginPath();ctx.arc(end.x,end.y,2.5,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

/** Formation direction stays visible without animation or additional simulated soldiers. */
export function marchTrail(ctx:CanvasRenderingContext2D,p:Point,angle:number,faction:FactionId,clock:number,reduced:boolean,crowded:boolean,hastened=false):void {
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.lineCap='round';
  ctx.strokeStyle='#FCF1D8';ctx.lineWidth=3.5;ctx.beginPath();
  for(let i=0;i<(hastened?2:1);i++){const x=8+i*6;ctx.moveTo(x,-4);ctx.lineTo(x+5,0);ctx.lineTo(x,4);}ctx.stroke();
  ctx.strokeStyle=factionColor(faction);ctx.lineWidth=1.5;ctx.stroke();
  if(!reduced&&!crowded){
    ctx.fillStyle='#C6AF84';
    const opacity=ctx.globalAlpha;
    for(let i=0;i<3;i++){
      const t=((clock/650+i/3)%1+1)%1;ctx.globalAlpha=opacity*.42*(1-t);ctx.beginPath();ctx.ellipse(-14-t*18,(i%2?1:-1)*(3+t*3),2+t*4,1.2+t*2,0,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

/** A short timber assembly surrounds the committed new building; it never substitutes for its tier. */
export function upgradeAccent(ctx:CanvasRenderingContext2D,p:Point,tier:number,scale:number,age:number,reduced:boolean):void {
  if(reduced||age<0||age>=220||tier<2)return;
  const t=age/220,settled=1-(1-Math.min(1,age/150))**3;
  const half=(tier===3?35:29)*scale,top=-6-(tier===3?33:23)*scale;
  ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha*=Math.min(1,(1-t)*3);ctx.lineCap='square';
  const beam=(ax:number,ay:number,bx:number,by:number)=>{
    ctx.strokeStyle='#9C773C';ctx.lineWidth=3*scale;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    ctx.strokeStyle='#E3C18A';ctx.lineWidth=.8*scale;ctx.beginPath();ctx.moveTo(ax,ay-scale);ctx.lineTo(bx,by-scale);ctx.stroke();
  };
  for(const side of [-1,1]){
    beam(side*half,10*scale,side*half,top);
    const gap=(1-settled)*5*scale;
    beam(side*half,top-gap,side*(1-settled)*half*.55,top-gap);
    beam(side*half,top+14*scale,side*(half-8*scale),top+6*scale);
  }
  ctx.restore();
}

export function tacticalAccent(ctx:CanvasRenderingContext2D,kind:'dispatch'|'arrival'|'capture',p:Point,other:Point|null,faction:FactionId,age:number,reduced:boolean,crowded:boolean):void {
  const duration=tacticalDuration(kind);if(age<0||age>=duration)return;
  const t=age/duration,phase=reduced?.5:t,angle=other?Math.atan2(p.y-other.y,p.x-other.x):0;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha*=reduced?1:Math.min(1,(1-t)*3);
  const opacity=ctx.globalAlpha;
  ctx.strokeStyle=factionColor(faction);
  if(kind==='capture'){
    // Ground seal sits around the footprint; the building and count draw above it.
    ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y+6,31+phase*7,17+phase*4,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=factionColor(faction);ctx.globalAlpha*=.1;ctx.fill();ctx.globalAlpha=opacity;
    if(!reduced&&!crowded){ctx.strokeStyle='#BC8B3D';ctx.lineWidth=2;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(p.x+side*36,p.y+8);ctx.lineTo(p.x+side*(36+phase*6),p.y-8-phase*7);ctx.stroke();}}
  }else{
    const direction=angle+Math.PI;
    const x=p.x+Math.cos(direction)*30,y=p.y+Math.sin(direction)*30;
    ctx.translate(x,y);ctx.rotate(direction);ctx.lineWidth=2.5;
    if(kind==='dispatch'){
      for(const i of [0,1]){const offset=i*8+phase*7;ctx.beginPath();ctx.moveTo(offset-4,-6);ctx.lineTo(offset+2,0);ctx.lineTo(offset-4,6);ctx.stroke();}
    }else{
      const contact=age>=120&&age<280;
      const recoil=reduced||!contact?0:Math.sin(Math.PI*(age-120)/160)*4;
      const approach=reduced?0:age<120?12*(1-age/120):age>=280?6*(age-280)/270:0;
      ctx.strokeStyle='#B58B47';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,4,13+phase*5,8+phase*3,0,0,Math.PI*2);ctx.stroke();
      // Two readable steel blades meet once at the real arrival point.
      for(const side of [-1,1]){
        const blade=()=>{ctx.beginPath();ctx.moveTo(-9-recoil,side*(10+approach));ctx.lineTo(9+recoil,-side*(10-approach));};
        ctx.strokeStyle='#493E30';ctx.lineWidth=5;blade();ctx.stroke();
        ctx.strokeStyle='#F9EBCB';ctx.lineWidth=3;blade();ctx.stroke();
        ctx.strokeStyle='#BD873D';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-12,side*6);ctx.lineTo(-5,side*13);ctx.stroke();
      }
      if(!reduced&&!crowded&&contact){
        ctx.strokeStyle='#DFAB4E';ctx.lineWidth=2;
        for(const [sx,sy]of [[-1,-1],[1,-1],[1,1]] as const){const r=7+phase*7;ctx.beginPath();ctx.moveTo(sx*r,sy*r*.8);ctx.lineTo(sx*(r+4),sy*(r+4)*.8);ctx.stroke();}
      }
    }
    if(kind==='arrival'&&age>=120&&!reduced&&!crowded){const settle=(age-120)/430;ctx.fillStyle='#C2AA7B';ctx.globalAlpha*=.48*(1-settle);for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(-7-settle*10,(-1+i*2)*(5+settle*6),2+settle*4,0,Math.PI*2);ctx.fill();}}
  }
  ctx.restore();
}

export function shotAccent(ctx:CanvasRenderingContext2D,from:Point,to:Point,faction:FactionId|null,age:number,volley:boolean,reduced:boolean,crowded:boolean):void {
  if(age<0||age>=300)return;
  const t=reduced?.82:Math.min(1,age/240),length=Math.hypot(to.x-from.x,to.y-from.y)||1;
  const tail=Math.max(0,t-Math.min(24/length,.45)),dx=(to.x-from.x)/length,dy=(to.y-from.y)/length;
  ctx.save();ctx.globalAlpha*=reduced?1:Math.min(1,(300-age)/60);
  for(let i=0;i<(volley&&!crowded?3:1);i++){
    const offset=volley?(i-1)*4:0,arc=reduced?0:Math.sin(t*Math.PI)*(volley?8:4);
    const start={x:from.x+(to.x-from.x)*tail-dy*offset,y:from.y+(to.y-from.y)*tail+dx*offset-arc};
    const end={x:from.x+(to.x-from.x)*t-dy*offset,y:from.y+(to.y-from.y)*t+dx*offset-arc};
    arrow(ctx,start,end,'#FFF1CD',3.5);arrow(ctx,start,end,factionColor(faction),1.7);
  }
  ctx.restore();
}
