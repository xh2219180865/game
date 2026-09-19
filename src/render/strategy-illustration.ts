import type { CardId } from '../core/types.ts';
import { building, soldier } from './art.ts';

type Palette={dark:string;shade:string;mid:string;light:string;edge:string;fire:string;ember:string};
const COLOR:Palette={dark:'#514738',shade:'#79593E',mid:'#AE8251',light:'#DCC698',edge:'#EEE0B9',fire:'#B95435',ember:'#EBC275'};
const GRAY:Palette={dark:'#505050',shade:'#747474',mid:'#999999',light:'#BBBBBB',edge:'#D5D5D5',fire:'#888888',ember:'#C8C8C8'};
function face(ctx:CanvasRenderingContext2D,fill:string,points:readonly (readonly [number,number])[]):void{
  ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}
function sack(ctx:CanvasRenderingContext2D,x:number,y:number,p:Palette):void{
  ctx.save();ctx.translate(x,y);ctx.lineWidth=.7;ctx.strokeStyle=p.shade;
  ctx.fillStyle=p.mid;ctx.beginPath();ctx.moveTo(-4,-8);ctx.quadraticCurveTo(-9,-2,-8,7);ctx.quadraticCurveTo(0,12,7,6);ctx.quadraticCurveTo(8,0,3,-8);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle=p.light;ctx.beginPath();ctx.moveTo(-3,-7);ctx.quadraticCurveTo(-7,1,-5,7);ctx.quadraticCurveTo(-2,9,0,7);ctx.quadraticCurveTo(-2,0,0,-7);ctx.closePath();ctx.fill();
  face(ctx,p.mid,[[-4,-8],[-5,-12],[3,-12],[2,-8]]);
  ctx.strokeStyle=p.dark;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-4,-8);ctx.lineTo(3,-8);ctx.moveTo(3,-7);ctx.quadraticCurveTo(5,1,4,7);ctx.stroke();
  ctx.strokeStyle=p.edge;ctx.lineWidth=.6;ctx.beginPath();for(const y of [-3,0,3,6]){ctx.moveTo(3,y);ctx.lineTo(5,y+1);}ctx.stroke();ctx.restore();
}
/** Props use light and dark material faces; stitching stays readable in close views. */
function prop(ctx:CanvasRenderingContext2D,id:'mobilize'|'feint'|'farming',p:Palette):void{
  ctx.save();ctx.lineJoin='round';ctx.lineWidth=.8;ctx.strokeStyle=p.dark;
  if(id==='mobilize'){
    face(ctx,p.shade,[[-8,4],[-5,5],[-10,15],[-13,15]]);face(ctx,p.mid,[[6,4],[9,4],[13,15],[10,15]]);
    ctx.fillStyle=p.shade;ctx.fillRect(-11,-5,22,12);ctx.beginPath();ctx.ellipse(0,7,11,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=p.mid;ctx.fillRect(-8,-4,10,12);ctx.fillStyle=p.dark;ctx.fillRect(7,-4,3,11);
    ctx.strokeStyle=p.light;ctx.beginPath();for(const x of [-8,-3,2,7]){ctx.moveTo(x,-3);ctx.lineTo(x+2,8);}ctx.stroke();
    ctx.fillStyle=p.light;ctx.strokeStyle=p.dark;ctx.beginPath();ctx.ellipse(0,-5,12,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=p.edge;ctx.beginPath();ctx.ellipse(-3,-6,7,2.5,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.shade;ctx.lineWidth=.55;ctx.beginPath();ctx.ellipse(0,-5,9,3.4,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=p.dark;for(const x of [-8,-4,0,4,8]){ctx.beginPath();ctx.arc(x,-1,.6,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle=p.shade;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-11,-15);ctx.lineTo(-3,-8);ctx.moveTo(11,-15);ctx.lineTo(3,-8);ctx.stroke();
    ctx.fillStyle=p.light;for(const x of [-3,3]){ctx.beginPath();ctx.ellipse(x,-8,2,1.5,0,0,Math.PI*2);ctx.fill();}
  }else if(id==='feint'){
    sack(ctx,-3,4,p);
    ctx.fillStyle=p.fire;ctx.beginPath();ctx.moveTo(8,-16);ctx.bezierCurveTo(13,-10,10,-7,14,-2);ctx.bezierCurveTo(17,5,6,8,4,0);ctx.quadraticCurveTo(3,-6,8,-16);ctx.fill();
    ctx.fillStyle=p.shade;ctx.beginPath();ctx.moveTo(8,-13);ctx.quadraticCurveTo(6,-2,8,4);ctx.quadraticCurveTo(2,0,8,-13);ctx.fill();
    ctx.fillStyle=p.ember;ctx.beginPath();ctx.moveTo(10,-8);ctx.quadraticCurveTo(9,-3,12,0);ctx.quadraticCurveTo(10,6,7,2);ctx.quadraticCurveTo(6,-1,10,-8);ctx.fill();
    ctx.fillStyle=p.edge;ctx.beginPath();ctx.moveTo(9,-1);ctx.quadraticCurveTo(12,3,9,4);ctx.quadraticCurveTo(7,3,9,-1);ctx.fill();
  }else{
    sack(ctx,7,5,p);
    ctx.strokeStyle=p.shade;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-6,15);ctx.lineTo(-6,-15);ctx.stroke();
    for(let i=0;i<4;i++)for(const side of [-1,1]){
      const x=-6+side*3,y=-11+i*5;ctx.fillStyle=p.mid;ctx.beginPath();ctx.ellipse(x,y,4.5,2.3,-side*.6,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=p.edge;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x-side*2,y+1);ctx.lineTo(x+side*2,y-1);ctx.stroke();
      ctx.strokeStyle=p.shade;ctx.beginPath();ctx.moveTo(x+side*3,y-1);ctx.lineTo(x+side*5,y-4);ctx.stroke();
    }
  }
  ctx.restore();
}
/** Unlocked artwork remains painted; locked artwork uses grey material contours without pixel access. */
function grayTroop(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number,cavalry=false,walking=false):void{
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const p=GRAY;
  if(cavalry){
    face(ctx,p.shade,[[-16,-11],[-4,-14],[7,-12],[12,-23],[17,-23],[20,-17],[14,-17],[12,-4],[8,-1],[-12,-2]]);
    face(ctx,p.mid,[[-14,-10],[-3,-12],[8,-10],[6,-3],[-12,-3]]);
    face(ctx,p.dark,[[-15,-4],[-11,-4],[-13,8],[-17,8]]);face(ctx,p.shade,[[5,-4],[9,-4],[13,6],[9,7]]);
    ctx.strokeStyle=p.dark;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-15,-10);ctx.quadraticCurveTo(-20,-8,-20,-3);ctx.stroke();
    ctx.translate(-2,-8);ctx.scale(.62,.62);
  }
  face(ctx,p.dark,[[-5,-1],[0,-1],[-3,8],[-7,8]]);face(ctx,p.shade,[[1,-1],[5,-1],[walking?9:5,8],[walking?5:1,8]]);
  face(ctx,p.mid,[[-6,-17],[5,-17],[8,0],[-7,0]]);face(ctx,p.shade,[[1,-17],[5,-17],[8,0],[1,0]]);
  ctx.fillStyle=p.light;ctx.beginPath();ctx.arc(0,-21,4,0,Math.PI*2);ctx.fill();
  face(ctx,p.dark,[[-5,-21],[-4,-25],[0,-27],[4,-25],[5,-21]]);face(ctx,p.mid,[[-4,-22],[-3,-24],[0,-25],[0,-22]]);
  ctx.strokeStyle=p.light;ctx.lineWidth=.6;ctx.beginPath();for(const y of [-12,-8,-4]){ctx.moveTo(-4,y);ctx.lineTo(4,y);}ctx.stroke();
  face(ctx,p.dark,[[-9,-13],[-3,-13],[-3,-4],[-6,-1],[-9,-4]]);face(ctx,p.light,[[-8,-12],[-5,-12],[-5,-4],[-6,-3],[-8,-5]]);
  ctx.strokeStyle=p.shade;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(8,-24);ctx.lineTo(8,5);ctx.stroke();face(ctx,p.light,[[8,-27],[6,-23],[10,-23]]);ctx.restore();
}
function grayCamp(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,tier:number):void{
  ctx.save();ctx.translate(x,y);ctx.scale(size/28,size/28);const p=GRAY;
  face(ctx,p.shade,[[-28,13],[-16,7],[24,7],[30,15],[23,22],[-23,22]]);
  face(ctx,p.light,[[-22,0],[19,0],[19,18],[-22,18]]);face(ctx,p.mid,[[19,0],[25,5],[25,16],[19,18]]);
  face(ctx,p.dark,[[-27,0],[-19,-5],[-8,-15],[10,-15],[23,-3],[28,1],[21,4],[-23,4]]);
  face(ctx,p.shade,[[-25,-1],[-18,-5],[-7,-13],[9,-13],[18,-2],[-5,1]]);
  ctx.fillStyle=p.dark;ctx.fillRect(-5,6,11,12);ctx.strokeStyle=p.mid;ctx.lineWidth=.8;ctx.beginPath();
  for(const row of [7,12]){ctx.moveTo(-21,row);ctx.lineTo(-7,row);ctx.moveTo(8,row);ctx.lineTo(18,row);}ctx.stroke();
  if(tier===3)for(const x of [-23,23]){
    ctx.fillStyle=p.light;ctx.fillRect(x-5,-20,10,38);ctx.fillStyle=p.mid;ctx.fillRect(x+2,-20,3,38);
    face(ctx,p.dark,[[x-8,-21],[x-4,-26],[x,-32],[x+4,-26],[x+8,-21],[x+6,-18],[x-6,-18]]);
    ctx.fillStyle=p.dark;ctx.fillRect(x-1,-14,3,6);ctx.fillRect(x-1,-3,3,6);
  }
  ctx.restore();
}

/** Close military subjects share the battlefield's camps, troops and material palette. */
export function drawStrategyIllustration(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:CardId,muted=false):void{
  if(![x,y,w,h,x+w,y+h].every(Number.isFinite)||w<=0||h<=0||!['mobilize','march','supply','feint','farming','logistics','fortification'].includes(id))return;
  const field=h<=48&&w/h>1.4,k=Math.min(w*(field?.7:.94)/48,h*.94/40),p=muted?GRAY:COLOR;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x+w*(field?.36:.5),y+h*.5);ctx.scale(k,k);ctx.setLineDash([]);
  ctx.lineCap='round';ctx.lineJoin='round';ctx.fillStyle=muted?'#77777725':'#82796925';ctx.beginPath();ctx.ellipse(0,14,21,4,0,0,Math.PI*2);ctx.fill();
  const troop=(x:number,y:number,s:number,cavalry=false,walking=false)=>muted?grayTroop(ctx,x,y,s,cavalry,walking):soldier(ctx,x,y,cavalry?'cavalry':'infantry','P',s,0,0,1,walking?2:0);
  const camp=(x:number,y:number,s:number,tier:number)=>muted?grayCamp(ctx,x,y,s,tier):building(ctx,x,y,s,'barracks',tier,id==='feint'?'E1':'P');
  if(id==='mobilize'){
    troop(11,2,.67);ctx.save();ctx.translate(-6,0);prop(ctx,id,p);ctx.restore();
  }else if(id==='march'){
    ctx.strokeStyle=muted?p.mid:'#9B8B70';ctx.lineWidth=1.3;ctx.beginPath();
    for(const [a,b,dy]of [[-21,-12,-7],[-23,-13,-1],[-19,-11,5]]){ctx.moveTo(a!,dy!);ctx.lineTo(b!,dy!);}ctx.stroke();troop(4,7,1,false,true);
  }else if(id==='supply'){
    troop(-10,2,.7);troop(10,2,.7);troop(0,8,.9);
  }else if(id==='feint'){
    camp(-5,-1,15,1);ctx.save();ctx.translate(9,2);prop(ctx,id,p);ctx.restore();
  }else if(id==='farming'){
    ctx.strokeStyle=muted?p.mid:'#9C8B69';ctx.lineWidth=1;ctx.beginPath();for(const dy of [9,13,17]){ctx.moveTo(-20,dy);ctx.lineTo(-10,dy-4);}ctx.stroke();
    ctx.save();ctx.translate(1,0);prop(ctx,id,p);ctx.restore();
  }else if(id==='logistics')troop(0,7,1,true,true);
  else camp(0,1,17,3);
  ctx.restore();
}
