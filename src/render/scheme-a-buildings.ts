import type {CampType,FactionId} from '../core/types.ts';

const P={wall:'#F5EFDB',side:'#D5D4BE',stone:'#BBC4B4',step:'#E7E6D2',wood:'#94704E',woodLight:'#C0A477',dark:'#3D534C',tile:'#657E7B',tileLight:'#94AAA0',tileShade:'#415F5C',gold:'#C4AC76'};
const NEUTRAL={...P,wall:'#D9DCDE',side:'#AFB5B9',stone:'#ADB5BB',step:'#D5D9DC',dark:'#495159',tile:'#7D858D',tileLight:'#A7AFB5',tileShade:'#535E68'};
type Vertex=readonly [number,number];
function face(ctx:CanvasRenderingContext2D,color:string,points:readonly Vertex[]):void{
  ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}
function line(ctx:CanvasRenderingContext2D,color:string,width:number,points:readonly Vertex[]):void{
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
}
function roof(ctx:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,color:string,p=P):void{
  face(ctx,color,[[x-width*.5,y-1],[x-width*.3,y-3],[x-width*.17,y-height],[x+width*.14,y-height],[x+width*.33,y-3],[x+width*.5,y-1],[x+width*.48,y+2],[x-width*.46,y+3]]);
  face(ctx,color,[[x-width*.5,y-1],[x-width*.3,y-3],[x-width*.17,y-height],[x+width*.14,y-height],[x+width*.27,y],[x-width*.46,y+1]]);
  face(ctx,p.tileShade,[[x+width*.14,y-height],[x+width*.33,y-3],[x+width*.5,y-1],[x+width*.48,y+2],[x+width*.27,y+2]]);
  for(const t of [-.12,-.03,.06,.15])line(ctx,'#BBC9B7',.65,[[x+t*width*.7,y-height+2],[x+t*width*2,y]]);
  line(ctx,p.tileShade,1.2,[[x-width*.47,y+2],[x-width*.03,y+3],[x+width*.48,y+1]]);
  line(ctx,p.gold,1.3,[[x-width*.2,y-height-1],[x-width*.13,y-height],[x+width*.13,y-height],[x+width*.2,y-height-1]]);
}
function hall(ctx:CanvasRenderingContext2D,top:number,width:number,p=P):void{
  const left=-width*.5,right=width*.5-7;
  face(ctx,p.side,[[right,top],[right+7,top+4],[right+7,15],[right,18]]);
  ctx.fillStyle=p.wall;ctx.fillRect(left,top,right-left,18-top);
  ctx.fillStyle=p.dark;ctx.fillRect(-6,1,11,17);
  ctx.fillStyle=p.wood;for(const x of [left+1,right-3])ctx.fillRect(x,top,2.5,18-top);
  ctx.fillRect(left,top+1,right-left,2);ctx.fillStyle=p.woodLight;ctx.fillRect(-6,1,1.5,17);
  for(const x of [left+6,right-8]){ctx.fillStyle=p.tileShade;ctx.fillRect(x,top+7,4,5);line(ctx,p.gold,.7,[[x+2,top+7],[x+2,top+12]]);}
  face(ctx,p.step,[[-10,18],[7,18],[11,21],[-13,21]]);line(ctx,'#C6C6AD',.8,[[-12,22],[11,22]]);
}
function target(ctx:CanvasRenderingContext2D,x:number,y:number):void{
  line(ctx,P.wood,1.5,[[x-4,y+10],[x,y+2],[x+4,y+10]]);
  for(const [rx,ry,color]of [[4.6,6.1,P.gold],[3.2,4.6,P.wall],[1.5,2.2,'#B97155']]as const){
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
  }
}
function shield(ctx:CanvasRenderingContext2D,x:number,y:number,color:string):void{
  face(ctx,P.gold,[[x-4,y-5],[x+4,y-5],[x+4,y+2],[x,y+6],[x-4,y+2]]);
  face(ctx,color,[[x-3,y-4],[x+3,y-4],[x+3,y+1],[x,y+4.5],[x-3,y+1]]);
  line(ctx,P.wall,.8,[[x,y-2],[x,y+3]]);
}

/** Original Canvas architecture. Coordinates stay inside the existing 64 × 60 body box; flags remain caller-owned. */
export function drawSchemeABuilding(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,type:CampType,tier:number,owner:FactionId|null,aim?:number,drawAim=true):void{
  if(![x,y,size].every(Number.isFinite)||size<=0||!['barracks','archery','relay','fort'].includes(type))return;
  const level=Number.isFinite(tier)?Math.max(1,Math.min(3,Math.floor(tier))):1;
  const p=owner===null?NEUTRAL:P;
  const color=owner==='P'?'#568C78':owner==='E'||owner==='E1'?'#B96A55':owner==='E2'?'#BC9C50':owner==='E3'?'#837798':'#7D858D';
  ctx.save();ctx.translate(x,y);ctx.scale(size/28,size/28);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.fillStyle='#50675420';ctx.beginPath();ctx.ellipse(1,20,29,5,0,0,Math.PI*2);ctx.fill();
  face(ctx,p.stone,[[-29,17],[-20,9],[22,9],[30,17],[23,23],[-24,23]]);
  face(ctx,p.step,[[-29,17],[-20,9],[22,9],[30,17],[21,20],[-23,20]]);
  if(level>=2){
    face(ctx,p.side,[[-27,0],[-22,-4],[-22,17],[-27,20]]);face(ctx,p.wall,[[22,-4],[28,0],[28,20],[22,17]]);
    line(ctx,p.tileLight,2,[[-27,0],[-22,-4]]);line(ctx,p.tileLight,2,[[22,-4],[28,0]]);
  }
  if(level===3){
    ctx.fillStyle=p.wall;ctx.fillRect(-11,-23,20,12);ctx.fillStyle=p.wood;
    for(const px of [-10,-1,7])ctx.fillRect(px,-22,2,10);
    roof(ctx,-1,-23,30,7,color,p);
  }
  if(type==='fort'){
    const top=-10-level*2;
    face(ctx,p.side,[[8,top],[16,top+4],[20,17],[9,20]]);
    face(ctx,p.wall,[[-15,top+1],[8,top],[9,20],[-20,17]]);
    for(const row of [-2,5,12])line(ctx,'#CDD2BF',.8,[[-17,row],[8,row]]);
    ctx.fillStyle=p.dark;ctx.fillRect(-5,1,5,10);ctx.fillStyle=p.wood;ctx.fillRect(-16,top,31,3);
    if(level>=2){ctx.fillStyle=p.wood;ctx.fillRect(-12,top-6,2,7);ctx.fillRect(9,top-6,2,7);roof(ctx,0,top-6,38,6,color,p);}
    roof(ctx,0,top-1,46,8,color,p);
    ctx.fillStyle=color;ctx.fillRect(10,2,4,9);ctx.fillStyle=p.gold;ctx.fillRect(11,3,1,6);
    if(drawAim){
    const validAim=aim!==undefined&&Number.isFinite(aim),length=Math.hypot(24,5);
    const end:Vertex=validAim?[Math.cos(aim!)*length,Math.sin(aim!)*length]:[24,-5];
    ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(end[0],end[1]);
    ctx.strokeStyle=p.wall;ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle=p.tileShade;ctx.lineWidth=1.8;ctx.stroke();
    }
  }else{
    const top=-7-level;
    hall(ctx,top,type==='relay'?44:40,p);
    roof(ctx,-1,top-1,type==='relay'?55:type==='archery'?52:50,9,color,p);
    if(type==='barracks'){
      line(ctx,p.wood,1.8,[[-24,7],[-24,17]]);line(ctx,p.wood,1.8,[[23,7],[23,17]]);
      shield(ctx,-23,11,color);shield(ctx,23,11,color);
      ctx.fillStyle=color;ctx.fillRect(-7,top+4,12,3);ctx.fillStyle=p.gold;ctx.fillRect(-2,top+4,2,3);
    }else if(type==='archery'){
      target(ctx,-18,9);target(ctx,17,9);
      line(ctx,p.wood,1.3,[[-4,13],[-2,1],[1,13]]);line(ctx,p.gold,.7,[[-3,5],[1,5]]);
    }else{
      // A single horse profile and an open rail distinguish the stable even without colour.
      face(ctx,'#B69167',[[-4,10],[-5,3],[7,2],[10,-5],[13,-7],[17,-3],[16,0],[13,-1],[11,12],[8,16],[6,16],[7,9],[1,9],[0,16],[-3,16],[-2,9]]);
      face(ctx,p.wood,[[8,1],[10,-6],[12,-8],[14,-7],[12,-2],[10,3]]);
      ctx.fillStyle=color;ctx.fillRect(-1,3,7,4);line(ctx,p.gold,1,[[0,4],[5,4]]);
      line(ctx,p.wood,1.5,[[-25,17],[24,17]]);
      for(const px of [-24,-13,23])line(ctx,p.wood,1.5,[[px,12],[px,21]]);
    }
  }
  if(level>=2){
    for(const [left,right]of [[-28,-17],[17,28]]as const){
      ctx.fillStyle=p.wall;ctx.fillRect(left,16,right-left,6);ctx.fillStyle=p.side;ctx.fillRect(left,21,right-left,2);
      ctx.fillStyle=p.tileLight;ctx.fillRect(left-1,15,right-left+2,2);
      if(level===3){ctx.fillStyle=p.wall;for(let px=left;px<right;px+=5)ctx.fillRect(px,12,3,4);}
    }
  }
  ctx.restore();
}
