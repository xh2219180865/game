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
    const edge=halfWidth*(.7+.2*Math.sin(i*2.17+seed+side)+.1*Math.sin(i*.83+seed));
    points.push({x:from.x+dx*t+nx*side*edge,y:from.y+dy*t+ny*side*edge});
  }
  ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
}

export function drawRoads(ctx:CanvasRenderingContext2D,b:Battle,point:(p:Point)=>Point,selectedId:string|null,scale=1):void {
  if(b.ruleRevision!=='1.6'||!Number.isFinite(scale)||scale<=0)return;
  const camps=new Map(b.camps.map(c=>[c.id,c]));
  const snow=b.mapId==='A02'||b.mapId==='L02',sand=b.mapId==='A03'||b.mapId==='L03';
  const palette=snow?['#71807845','#A4ADA0','#CCD0BA','#6F7C6A70']:sand?['#7B654343','#BAA47D','#C8B38C','#8D785656']:['#67543848','#A58A61','#B49A70','#79634160'];
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const [index,[a,z]] of MAPS[b.mapId].roads.entries()){
    const source=camps.get(a),target=camps.get(z);if(!source||!target)continue;
    const segment=roadSegment(point(source),point(target),Math.max(16,28*scale));if(!segment)continue;
    const active=a===selectedId||z===selectedId,seed=index*1.71+b.mapId.charCodeAt(0);
    const {from,to}=segment,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
    roadRibbon(ctx,from,to,7*scale,seed,palette[0]!);
    roadRibbon(ctx,from,to,5*scale,seed,palette[1]!);
    roadRibbon(ctx,from,to,3.2*scale,seed+.3,palette[2]!);
    // Two broken wheel ruts and small transverse chips read as a worn road, never a new route.
    ctx.strokeStyle=palette[3]!;ctx.lineWidth=.65*scale;
    for(let step=7;step<length-5;step+=17*scale){
      for(const side of [-1,1]){
        const x=from.x+ux*step-uy*side*1.7*scale,y=from.y+uy*step+ux*side*1.7*scale;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+ux*Math.min(9*scale,length-step-3),y+uy*Math.min(9*scale,length-step-3));ctx.stroke();
      }
    }
    if(active){
      // A temporary bronze guide marks legal exits; the physical road stays on its real centreline.
      ctx.strokeStyle='#6D6654';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
      const start=a===selectedId?from:to,end=a===selectedId?to:from;
      const mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2};
      arrow(ctx,{x:mid.x-(end.x-start.x)/length*5,y:mid.y-(end.y-start.y)/length*5},{x:mid.x+(end.x-start.x)/length*5,y:mid.y+(end.y-start.y)/length*5},'#F0EBD8',1.6);
      ctx.fillStyle='#6D6654';ctx.beginPath();ctx.arc(end.x,end.y,2.5,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

/** Formation direction stays visible without animation or additional simulated soldiers. */
export function marchTrail(ctx:CanvasRenderingContext2D,p:Point,angle:number,faction:FactionId,clock:number,reduced:boolean,crowded:boolean):void {
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.lineCap='round';
  ctx.strokeStyle='#FCF1D8';ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(8,-4);ctx.lineTo(13,0);ctx.lineTo(8,4);ctx.stroke();
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

export function tacticalAccent(ctx:CanvasRenderingContext2D,kind:'dispatch'|'arrival'|'capture',p:Point,other:Point|null,faction:FactionId,age:number,reduced:boolean,crowded:boolean):void {
  const duration=tacticalDuration(kind);if(age<0||age>=duration)return;
  const t=age/duration,phase=reduced?.5:t,angle=other?Math.atan2(p.y-other.y,p.x-other.x):0;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=reduced?1:Math.min(1,(1-t)*3);
  ctx.strokeStyle=factionColor(faction);
  if(kind==='capture'){
    // Ground seal sits around the footprint; the building and count draw above it.
    ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y+6,31+phase*7,17+phase*4,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=factionColor(faction);ctx.globalAlpha*=.1;ctx.fill();ctx.globalAlpha=reduced?1:Math.min(1,(1-t)*3);
    if(!reduced&&!crowded){ctx.strokeStyle='#BC8B3D';ctx.lineWidth=2;for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(p.x+side*36,p.y+8);ctx.lineTo(p.x+side*(36+phase*6),p.y-8-phase*7);ctx.stroke();}}
  }else{
    const direction=angle+Math.PI;
    const x=p.x+Math.cos(direction)*30,y=p.y+Math.sin(direction)*30;
    ctx.translate(x,y);ctx.rotate(direction);ctx.lineWidth=2.5;
    if(kind==='dispatch'){
      for(const i of [0,1]){const offset=i*8+phase*7;ctx.beginPath();ctx.moveTo(offset-4,-6);ctx.lineTo(offset+2,0);ctx.lineTo(offset-4,6);ctx.stroke();}
    }else{
      const recoil=reduced?0:Math.sin(Math.PI*phase)*4;
      const approach=reduced?0:12*(1-Math.min(1,phase*3));
      ctx.strokeStyle='#B58B47';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,4,13+phase*5,8+phase*3,0,0,Math.PI*2);ctx.stroke();
      // Two readable steel blades meet once at the real arrival point.
      for(const side of [-1,1]){
        const blade=()=>{ctx.beginPath();ctx.moveTo(-9-recoil,side*(10+approach));ctx.lineTo(9+recoil,-side*(10-approach));};
        ctx.strokeStyle='#493E30';ctx.lineWidth=5;blade();ctx.stroke();
        ctx.strokeStyle='#F9EBCB';ctx.lineWidth=3;blade();ctx.stroke();
        ctx.strokeStyle='#BD873D';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-12,side*6);ctx.lineTo(-5,side*13);ctx.stroke();
      }
      if(!reduced&&!crowded){
        ctx.strokeStyle='#DFAB4E';ctx.lineWidth=2;
        for(const [sx,sy]of [[-1,-1],[1,-1],[1,1]] as const){const r=7+phase*7;ctx.beginPath();ctx.moveTo(sx*r,sy*r*.8);ctx.lineTo(sx*(r+4),sy*(r+4)*.8);ctx.stroke();}
      }
    }
    if(kind==='arrival'&&!reduced&&!crowded){ctx.fillStyle='#C2AA7B';ctx.globalAlpha*=.48;for(let i=0;i<2;i++){ctx.beginPath();ctx.arc(-7-phase*10,(-1+i*2)*(5+phase*6),2+phase*4,0,Math.PI*2);ctx.fill();}}
  }
  ctx.restore();
}

export function shotAccent(ctx:CanvasRenderingContext2D,from:Point,to:Point,faction:FactionId|null,age:number,volley:boolean,reduced:boolean,crowded:boolean):void {
  if(age<0||age>=300)return;
  const t=reduced?.82:Math.min(1,age/240),length=Math.hypot(to.x-from.x,to.y-from.y)||1;
  const tail=Math.max(0,t-Math.min(24/length,.45)),dx=(to.x-from.x)/length,dy=(to.y-from.y)/length;
  ctx.save();ctx.globalAlpha=reduced?1:Math.min(1,(300-age)/60);
  for(let i=0;i<(volley&&!crowded?3:1);i++){
    const offset=volley?(i-1)*4:0,arc=reduced?0:Math.sin(t*Math.PI)*(volley?8:4);
    const start={x:from.x+(to.x-from.x)*tail-dy*offset,y:from.y+(to.y-from.y)*tail+dx*offset-arc};
    const end={x:from.x+(to.x-from.x)*t-dy*offset,y:from.y+(to.y-from.y)*t+dx*offset-arc};
    arrow(ctx,start,end,'#FFF1CD',3.5);arrow(ctx,start,end,factionColor(faction),1.7);
  }
  ctx.restore();
}
