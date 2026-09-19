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

export function drawRoads(ctx:CanvasRenderingContext2D,b:Battle,point:(p:Point)=>Point,selectedId:string|null,scale=1):void {
  if(b.ruleRevision!=='1.6')return;
  const camps=new Map(b.camps.map(c=>[c.id,c]));
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const [a,z] of MAPS[b.mapId].roads){
    const source=camps.get(a),target=camps.get(z);if(!source||!target)continue;
    const segment=roadSegment(point(source),point(target),Math.max(16,28*scale));if(!segment)continue;
    const active=a===selectedId||z===selectedId;
    const stroke=(width:number,color:string)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(segment.from.x,segment.from.y);ctx.lineTo(segment.to.x,segment.to.y);ctx.stroke();};
    stroke(6.5,active?'#C8BEA2':b.mapId==='A02'?'#879C9460':'#85857560');
    stroke(active?3:4.5,active?'#6D6654':b.mapId==='A02'?'#C5CFC3':b.mapId==='A03'?'#C7B99B':'#C3BEA6');
    if(!active){
      const dx=segment.to.x-segment.from.x,dy=segment.to.y-segment.from.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
      // Broken wheel ruts follow the real road, instead of transverse diagram ticks.
      ctx.strokeStyle=b.mapId==='A02'?'#869D9544':'#87836E44';ctx.lineWidth=.55;
      for(let step=8;step<length-7;step+=23)for(const side of [-1,1]){const x=segment.from.x+ux*step-uy*side*1.25,y=segment.from.y+uy*step+ux*side*1.25;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+ux*Math.min(10,length-step),y+uy*Math.min(10,length-step));ctx.stroke();}
    }
    if(active){
      const from=a===selectedId?segment.from:segment.to,to=a===selectedId?segment.to:segment.from;
      const mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2},length=Math.hypot(to.x-from.x,to.y-from.y);
      arrow(ctx,{x:mid.x-(to.x-from.x)/length*5,y:mid.y-(to.y-from.y)/length*5},{x:mid.x+(to.x-from.x)/length*5,y:mid.y+(to.y-from.y)/length*5},'#F0EBD8',1.6);
      ctx.fillStyle='#6D6654';ctx.beginPath();ctx.arc(to.x,to.y,2.5,0,Math.PI*2);ctx.fill();
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
    ctx.fillStyle='#8C7650';
    for(let i=0;i<3;i++){
      const t=((clock/650+i/3)%1+1)%1;ctx.globalAlpha=.22*(1-t);ctx.beginPath();ctx.ellipse(-14-t*18,(i%2?1:-1)*(3+t*3),2+t*3,1.2+t*1.5,0,0,Math.PI*2);ctx.fill();
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
      const recoil=reduced?0:Math.sin(Math.PI*phase)*2;
      ctx.strokeStyle='#B58B47';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,4,13+phase*5,8+phase*3,0,0,Math.PI*2);ctx.stroke();
      // Two readable steel blades meet once at the real arrival point.
      for(const side of [-1,1]){
        const blade=()=>{ctx.beginPath();ctx.moveTo(-9-recoil,side*10);ctx.lineTo(9+recoil,-side*10);};
        ctx.strokeStyle='#493E30';ctx.lineWidth=5;blade();ctx.stroke();
        ctx.strokeStyle='#F9EBCB';ctx.lineWidth=3;blade();ctx.stroke();
        ctx.strokeStyle='#BD873D';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-12,side*6);ctx.lineTo(-5,side*13);ctx.stroke();
      }
      if(!reduced&&!crowded){
        ctx.strokeStyle='#DFAB4E';ctx.lineWidth=2;
        for(const [sx,sy]of [[-1,-1],[1,-1],[1,1]] as const){const r=7+phase*7;ctx.beginPath();ctx.moveTo(sx*r,sy*r*.8);ctx.lineTo(sx*(r+4),sy*(r+4)*.8);ctx.stroke();}
      }
    }
    if(!reduced&&!crowded){ctx.fillStyle='#A18355';ctx.globalAlpha*=.3;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(-7-phase*10,(-1+i)*(5+phase*6),2+phase*3,0,Math.PI*2);ctx.fill();}}
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
