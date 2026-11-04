import type { ActiveCardId, CampType, FactionId, CardId, TroopType, PassiveCardId, Point } from '../core/types.ts';
import { drawCampArchitecture } from './camp-architecture.ts';
import { drawArt } from './assets.ts';

export const COLORS={paper:'#E9E3D5',ink:'#303832',player:'#286C5C',enemy1:'#B13D36',enemy2:'#C99A32',enemy3:'#5F579C',neutral:'#D8D0C2',surface:'#F4EFE3',muted:'#5F6055'};
export function factionColor(id:FactionId|null):string{return id==='P'?COLORS.player:id==='E2'?COLORS.enemy2:id==='E3'?COLORS.enemy3:id?COLORS.enemy1:COLORS.neutral;}
export function factionName(id:FactionId|null):string{return id==='P'?'青旗军 · 你':id==='E2'?'金旗军 · 电脑乙':id==='E3'?'紫旗军 · 电脑丙':id?'赤旗军 · 电脑甲':'中立营地';}
export function rounded(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r=12):void{
  const k=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+w-k,y);ctx.quadraticCurveTo(x+w,y,x+w,y+k);ctx.lineTo(x+w,y+h-k);ctx.quadraticCurveTo(x+w,y+h,x+w-k,y+h);ctx.lineTo(x+k,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-k);ctx.lineTo(x,y+k);ctx.quadraticCurveTo(x,y,x+k,y);ctx.closePath();
}
export function flag(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,id:FactionId|null):void{
  if(![x,y,size].every(Number.isFinite)||size<=0)return;
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.setLineDash([]);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.fillStyle=factionColor(id);ctx.strokeStyle='#665C43';ctx.lineWidth=.12;
  // The same woven standard for every army; the border and simple stitched devices survive greyscale.
  ctx.beginPath();ctx.moveTo(-.82,-.85);ctx.quadraticCurveTo(-.15,-1.02,.96,-.66);
  ctx.lineTo(.7,-.04);ctx.lineTo(.96,.53);ctx.quadraticCurveTo(.08,.27,-.82,.44);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle=id?'#F4E5B9':'#958F7B';ctx.lineWidth=.14;
  ctx.beginPath();ctx.moveTo(-.62,-.64);ctx.quadraticCurveTo(.06,-.72,.69,-.53);
  ctx.moveTo(-.62,.22);ctx.quadraticCurveTo(.03,.11,.66,.3);ctx.stroke();
  ctx.lineWidth=.19;ctx.beginPath();
  if(id==='P'){ctx.moveTo(-.05,-.5);ctx.lineTo(-.05,.08);}
  else if(id==='E2'){ctx.moveTo(-.34,-.18);ctx.lineTo(.42,-.12);}
  else if(id==='E3'){ctx.moveTo(-.29,-.5);ctx.lineTo(.32,.1);ctx.moveTo(.32,-.46);ctx.lineTo(-.29,.1);}
  else if(id){for(const dx of [-.22,.21]){ctx.moveTo(dx,-.47);ctx.lineTo(dx,.08);}}
  else{ctx.moveTo(-.13,-.29);ctx.lineTo(.13,-.27);}
  ctx.stroke();ctx.strokeStyle='#655B44';ctx.lineWidth=.15;
  ctx.beginPath();ctx.moveTo(-.85,-1);ctx.lineTo(-.85,1);ctx.stroke();ctx.restore();
}
export function departureAccent(ctx:CanvasRenderingContext2D,x:number,y:number,_target:Point,_id:FactionId,age:number):void{
  const progress=Math.max(0,Math.min(1,age/160));
  ctx.save();ctx.fillStyle=COLORS.muted;ctx.globalAlpha=.35*(1-progress);
  for(const i of [0,1]){ctx.beginPath();ctx.arc(x-33-i*4-progress*3,y-2+i*6,1.2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function artFace(ctx:CanvasRenderingContext2D,color:string,points:readonly (readonly [number,number])[]):void{
  ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}
function roof(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  // Broad lit tiles, a narrow shaded hip, and a deep fascia share one light source.
  ctx.fillStyle='#536C70';ctx.strokeStyle='#32464A';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x-w/2,y-1);ctx.quadraticCurveTo(x-w*.32,y+1,x-w*.18,y-h);ctx.lineTo(x+w*.18,y-h);ctx.quadraticCurveTo(x+w*.32,y+1,x+w/2,y-1);ctx.lineTo(x+w/2,y+3);ctx.quadraticCurveTo(x,y+8,x-w/2,y+3);ctx.closePath();ctx.fill();ctx.stroke();
  artFace(ctx,'#7B9290',[[x-w*.18,y-h],[x+w*.18,y-h],[x+w*.28,y],[x-w*.43,y+1]]);
  artFace(ctx,'#40575C',[[x+w*.18,y-h],[x+w*.5,y-1],[x+w*.5,y+3],[x+w*.28,y+2]]);
  ctx.strokeStyle='#ADC0AE';ctx.lineWidth=.65;
  for(const t of [-.28,-.14,0,.14]){ctx.beginPath();ctx.moveTo(x+t*w*.58,y-h+2);ctx.lineTo(x+t*w*1.35,y+1);ctx.stroke();}
  ctx.strokeStyle='#3B5156';ctx.lineWidth=.65;
  for(const f of [.4,.75]){ctx.beginPath();ctx.moveTo(x-w*(.18+.21*f),y-h+h*f);ctx.lineTo(x+w*(.18+.12*f),y-h+h*f);ctx.stroke();}
  ctx.strokeStyle='#CAB789';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(x-w*.23,y-h-1);ctx.quadraticCurveTo(x-w*.18,y-h+1,x,y-h);ctx.quadraticCurveTo(x+w*.18,y-h+1,x+w*.23,y-h-1);ctx.stroke();
  ctx.strokeStyle='#263D43';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-w*.49,y+3);ctx.quadraticCurveTo(x,y+7,x+w*.49,y+3);ctx.stroke();
}
export function building(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,type:CampType,tier:number,id:FactionId|null,aim?:number):void{
  drawCampArchitecture(ctx,x,y,size,type,tier,id,aim);
}

export function cityPanorama(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  ctx.save();rounded(ctx,x,y,w,h,8);ctx.clip();ctx.fillStyle='#E5DBC5';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#CFD0BB';ctx.beginPath();ctx.moveTo(x,y+h*.68);
  for(const [px,py]of [[0,.65],[.17,.22],[.3,.52],[.47,.13],[.65,.43],[.8,.21],[1,.57],[1,1],[0,1]])ctx.lineTo(x+w*px!,y+h*py!);ctx.closePath();ctx.fill();
  const base=y+h*.87,gateX=x+w*.52,scale=Math.min(w/290,h/110);
  ctx.fillStyle='#B9AB8F';ctx.fillRect(x,base-h*.24,w,h*.28);ctx.strokeStyle='#9C8D73';ctx.lineWidth=1;
  for(let row=0;row<3;row++)for(let col=0;col<w/24;col++){const bx=x+col*24+(row%2)*12,by=base-h*.22+row*9;ctx.strokeRect(bx,by,24,9);}
  for(let col=0;col<w/22;col++){ctx.fillStyle='#B9AB8F';ctx.fillRect(x+col*22,base-h*.24-6,12,7);}
  ctx.save();ctx.translate(gateX,base);ctx.scale(scale,scale);
  ctx.fillStyle='#C4AD89';ctx.strokeStyle='#735E46';ctx.lineWidth=1.3;ctx.fillRect(-38,-45,76,45);ctx.strokeRect(-38,-45,76,45);
  ctx.fillStyle='#4E514B';ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-11,-18);ctx.quadraticCurveTo(0,-33,11,-18);ctx.lineTo(11,0);ctx.fill();
  ctx.fillStyle='#996545';ctx.fillRect(-28,-70,56,23);ctx.fillStyle='#D6BF92';for(const dx of [-21,-7,7,21])ctx.fillRect(dx-2,-67,4,17);
  roof(ctx,0,-71,91,21);roof(ctx,0,-45,98,10);
  ctx.fillStyle='#E6D4AD';ctx.fillRect(-15,-64,30,10);ctx.fillStyle='#795036';ctx.font='600 7px "Songti SC", serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('山 河 关',0,-59);
  ctx.restore();
  for(const side of [.13,.86]){const tx=x+w*side;ctx.fillStyle='#C4AD89';ctx.fillRect(tx-13*scale,base-36*scale,26*scale,37*scale);roof(ctx,tx,base-37*scale,43*scale,12*scale);}
  ctx.fillStyle='#B13D36';ctx.fillRect(x+14,y+12,18,26);ctx.fillStyle='#FFF1D5';ctx.font='600 10px "Songti SC", serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('军',x+23,y+20);ctx.fillText('阵',x+23,y+31);
  ctx.restore();
}

export function pageOrnament(ctx:CanvasRenderingContext2D,w:number,h:number,architecture=false):void{
  ctx.save();ctx.strokeStyle='#D7C8AA';ctx.lineWidth=1;
  for(const x of [8,w-8]){const direction=x<w/2?1:-1;ctx.beginPath();ctx.moveTo(x,18);ctx.lineTo(x,8);ctx.lineTo(x+direction*22,8);ctx.moveTo(x,h-18);ctx.lineTo(x,h-8);ctx.lineTo(x+direction*22,h-8);ctx.stroke();}
  if(architecture){
    const center=w/2;ctx.strokeStyle='#BBC3B6';
    ctx.beginPath();ctx.moveTo(center-44,14);ctx.quadraticCurveTo(center-26,12,center-13,5);ctx.lineTo(center+13,5);ctx.quadraticCurveTo(center+26,12,center+44,14);ctx.quadraticCurveTo(center,17,center-44,14);ctx.stroke();
    ctx.beginPath();for(const dx of [-24,-12,0,12,24]){ctx.moveTo(center+dx*.5,7);ctx.lineTo(center+dx,14);}ctx.stroke();
    ctx.strokeStyle='#D2C4A9';ctx.strokeRect(36,h-16,w-72,10);ctx.beginPath();ctx.moveTo(36,h-11);ctx.lineTo(w-36,h-11);
    for(let x=48;x<w-36;x+=24){ctx.moveTo(x,h-16);ctx.lineTo(x,h-11);if(x+12<w-36){ctx.moveTo(x+12,h-11);ctx.lineTo(x+12,h-6);}}ctx.stroke();
  }
  ctx.restore();
}

function grainSack(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number):void{
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle='#D7BE83';
  ctx.beginPath();ctx.moveTo(-3,-6);ctx.lineTo(-5,-10);ctx.lineTo(5,-10);ctx.lineTo(3,-6);
  ctx.bezierCurveTo(11,0,11,10,5,11);ctx.lineTo(-5,11);ctx.bezierCurveTo(-11,10,-11,0,-3,-6);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(4,-5);ctx.stroke();ctx.restore();
}

export function cardSymbol(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,id:CardId,spread=1):void{
  ctx.save();ctx.translate(x,y);ctx.scale(size/16,size/16);ctx.strokeStyle='#564B36';ctx.fillStyle='#D7BE83';ctx.lineWidth=1.25;ctx.lineCap='round';ctx.lineJoin='round';
  if(id==='mobilize'){
    artFace(ctx,'#815638',[[-10,3],[-7,3],[-12,15],[-15,15]]);artFace(ctx,'#AF7743',[[7,3],[10,3],[15,15],[12,15]]);
    ctx.fillStyle='#A75F3F';ctx.fillRect(-11,-5,22,12);ctx.beginPath();ctx.ellipse(0,7,11,4,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#75402D';ctx.fillRect(6,-4,5,11);
    ctx.strokeStyle='#E0B875';ctx.lineWidth=1;for(const dx of [-8,-3,2,7]){ctx.beginPath();ctx.moveTo(dx,-2);ctx.lineTo(dx+2,8);ctx.stroke();}
    ctx.fillStyle='#F2D59A';ctx.strokeStyle='#89603E';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-5,12,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#FFF0BF';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(-1,-6,9,3,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#A87843';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-12,-15);ctx.lineTo(-3,-8);ctx.moveTo(12,-15);ctx.lineTo(3,-8);ctx.stroke();ctx.fillStyle='#E6CB8E';for(const dx of [-3,3]){ctx.beginPath();ctx.arc(dx,-8,2,0,Math.PI*2);ctx.fill();}
  }else if(id==='march'){
    ctx.strokeStyle='#8E643B';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-10,15);ctx.lineTo(-10,-16);ctx.stroke();ctx.fillStyle='#E6C37C';ctx.beginPath();ctx.arc(-10,-16,2,0,Math.PI*2);ctx.fill();
    artFace(ctx,COLORS.player,[[-9,-14],[0,-13],[5,-10],[14,-11],[10,-5],[14,-1],[5,0],[0,-3],[-9,-4]]);artFace(ctx,'#74A89A',[[-9,-14],[0,-13],[5,-10],[14,-11],[5,-7],[-1,-10],[-9,-10]]);
    ctx.strokeStyle='#E4C17B';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,-7);ctx.lineTo(1,-6);ctx.lineTo(4,-3);ctx.stroke();ctx.strokeStyle='#B38845';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-3,5);ctx.lineTo(2,10);ctx.lineTo(-3,15);ctx.moveTo(6,5);ctx.lineTo(11,10);ctx.lineTo(6,15);ctx.stroke();
  }else if(id==='supply'){
    for(const [px,py]of [[-9,-6],[9,-6],[0,-10]] as const){artFace(ctx,COLORS.player,[[px-4,py+13],[px-3,py+5],[px+3,py+5],[px+4,py+13]]);artFace(ctx,'#91A697',[[px-3,py+5],[px,py+4],[px,py+12],[px-4,py+13]]);ctx.fillStyle='#E1BD8F';ctx.beginPath();ctx.arc(px,py+1,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3F5758';ctx.fillRect(px-3,py-2,6,2);ctx.fillRect(px-1,py-4,2,2);}
    artFace(ctx,'#85603A',[[-13,9],[13,9],[13,15],[-13,15]]);ctx.fillStyle='#D9B97A';ctx.fillRect(-13,9,26,2);ctx.fillStyle='#F5DCA6';ctx.fillRect(-1,11,2,4);ctx.fillRect(-3,12,6,2);
  }else if(id==='feint'){
    grainSack(ctx,-3,3,.9);
    artFace(ctx,'#B99458',[[0,-1],[4,3],[4,10],[0,12],[-2,11],[0,7]]);ctx.strokeStyle='#F4DBA0';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(-7,1);ctx.quadraticCurveTo(-10,5,-7,9);ctx.stroke();
    ctx.fillStyle='#BA5338';ctx.beginPath();ctx.moveTo(8,-15);ctx.bezierCurveTo(12,-10,9,-8,13,-4);ctx.bezierCurveTo(18,3,5,6,5,-2);ctx.bezierCurveTo(3,-7,7,-10,8,-15);ctx.fill();ctx.fillStyle='#ECB258';ctx.beginPath();ctx.moveTo(10,-9);ctx.quadraticCurveTo(9,-4,12,-2);ctx.quadraticCurveTo(10,3,8,0);ctx.quadraticCurveTo(6,-3,10,-9);ctx.fill();
    ctx.strokeStyle='#344340';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,6);ctx.lineTo(1,6);ctx.stroke();
  }else if(id==='farming'){
    ctx.strokeStyle='#8D8042';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-5,15);ctx.lineTo(-5,-14);ctx.stroke();for(let i=0;i<3;i++){const py=-8+i*6;ctx.fillStyle='#D1A448';ctx.beginPath();ctx.ellipse(-10,py,4.5,2.8,.55,0,Math.PI*2);ctx.fill();ctx.fillStyle='#F0D27B';ctx.beginPath();ctx.ellipse(0,py,4.5,2.8,-.55,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#80613A';grainSack(ctx,8,6,.8);ctx.strokeStyle='#EED097';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(4,5);ctx.quadraticCurveTo(2,9,5,12);ctx.stroke();
  }else if(id==='logistics'){
    ctx.strokeStyle='#677973';ctx.lineWidth=6;ctx.beginPath();ctx.arc(-2,1,10,-.1,Math.PI+ .1);ctx.moveTo(-12,0);ctx.lineTo(-12,-8);ctx.moveTo(8,0);ctx.lineTo(8,-8);ctx.stroke();ctx.strokeStyle='#C6CBB0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-3,0,9,0,Math.PI);ctx.moveTo(-12,0);ctx.lineTo(-12,-8);ctx.moveTo(6,0);ctx.lineTo(6,-8);ctx.stroke();
    ctx.fillStyle='#42544E';for(const [px,py]of [[-12,-4],[-9,6],[3,6],[8,-4]]){ctx.beginPath();ctx.arc(px!,py!,1,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#BD9654';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,-15);ctx.lineTo(15,-15);ctx.lineTo(11,-19);ctx.moveTo(15,-15);ctx.lineTo(11,-11);ctx.stroke();
  }else{
    artFace(ctx,'#8F8870',[[-16,12],[16,12],[18,16],[-18,16]]);ctx.strokeStyle='#634D34';ctx.lineWidth=1;
    for(const base of [-10,0,10]){const px=base*spread;ctx.fillStyle='#C6A16A';ctx.beginPath();ctx.moveTo(px-3,12);ctx.lineTo(px-3,-6);ctx.lineTo(px,-12);ctx.lineTo(px+3,-6);ctx.lineTo(px+3,12);ctx.closePath();ctx.fill();ctx.stroke();artFace(ctx,'#8B653E',[[px,-11],[px+3,-6],[px+3,12],[px,12]]);}
    ctx.strokeStyle='#9D7547';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,1);ctx.lineTo(15,1);ctx.moveTo(-15,8);ctx.lineTo(15,8);ctx.stroke();ctx.strokeStyle='#E4C58B';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(15,0);ctx.stroke();
  }
  ctx.restore();
}

export function passiveRewardSymbol(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,id:PassiveCardId,progress:number,reduced:boolean):void{
  const p=reduced?1:Math.max(0,Math.min(1,progress));
  cardSymbol(ctx,x+(id==='logistics'?(p-1)*4:0),y,size,id,id==='fortification'?.85+.15*p:1);
  if(id==='farming'){ctx.save();ctx.fillStyle=COLORS.player;ctx.beginPath();ctx.arc(x+size*.65,y-size*.8,1+p,0,Math.PI*2);ctx.fill();ctx.restore();}
}

export function rankBadge(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,points:number):void{
  const level=Math.floor(points/30),tier=level===0?0:level>=36?8:Math.floor((level-1)/5)+1;
  ctx.save();ctx.translate(x,y);ctx.scale(size/16,size/16);ctx.fillStyle=COLORS.player;ctx.strokeStyle=COLORS.ink;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-12,-15);ctx.lineTo(12,-15);ctx.lineTo(12,10);ctx.lineTo(0,16);ctx.lineTo(-12,10);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ECD8A1';ctx.fillStyle='#D7BE83';
  if(tier===1||tier===2){
    for(const px of tier===1?[0]:[-5,5]){ctx.beginPath();ctx.arc(px,-4,2.8,0,Math.PI*2);ctx.fill();}
  }
  if(tier===3||tier===4)ctx.strokeRect(-8,-11,16,21);
  if(tier>=5){ctx.fillStyle='#D7BE83';ctx.fillRect(-7,-9,14,14);ctx.strokeStyle=COLORS.ink;ctx.strokeRect(-7,-9,14,14);
    if(tier===5){ctx.strokeRect(-3,-5,6,6);}
    if(tier===6){ctx.beginPath();ctx.arc(0,-2,5,0,Math.PI*2);ctx.moveTo(-5,-2);ctx.lineTo(5,-2);ctx.moveTo(0,-7);ctx.lineTo(0,3);ctx.stroke();}
    if(tier===7){ctx.beginPath();ctx.moveTo(-4,3);ctx.lineTo(-3,-3);ctx.lineTo(1,-6);ctx.lineTo(2,-8);ctx.lineTo(5,-3);ctx.lineTo(3,-1);ctx.lineTo(1,-2);ctx.lineTo(0,3);ctx.closePath();ctx.fillStyle=COLORS.ink;ctx.fill();}
    if(tier===8){ctx.beginPath();ctx.moveTo(-4,-5);ctx.lineTo(4,-5);ctx.moveTo(0,-5);ctx.lineTo(0,2);ctx.moveTo(-4,2);ctx.lineTo(4,2);ctx.stroke();}
  }
  if(tier===4||tier===8){ctx.strokeStyle='#D7BE83';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-13,1);ctx.lineTo(-16,13);if(tier===8){ctx.moveTo(13,1);ctx.lineTo(16,13);}ctx.stroke();}
  ctx.restore();
}

/** Decorative arrivals consume already settled state; they never create soldiers. */
export function arrivalAccent(ctx:CanvasRenderingContext2D,x:number,y:number,from:TroopType,to:TroopType,faction:FactionId,ageMs:number):void{
  const progress=Math.max(0,Math.min(1,ageMs/160));
  ctx.save();ctx.globalAlpha*=1-progress*.45;
  soldier(ctx,x-42+22*progress,y-6,progress<.5?from:to,faction,.7-.2*progress,0);ctx.restore();
}

/** Short local card feedback; the caller controls lifetime with the game clock. */
export function cardAccent(ctx:CanvasRenderingContext2D,x:number,y:number,id:ActiveCardId,troop:TroopType,faction:FactionId,amount:number,ageMs:number,reduced:boolean,duration=220):void{
  if(reduced){cardSymbol(ctx,x,y,10,id);return;}
  const progress=Math.max(0,Math.min(1,ageMs/duration));
  ctx.save();
  ctx.globalAlpha*=Math.min(1,(1-progress)*3);
  if(id==='supply'){
    const gather=1-(1-progress)**3;
    for(let i=0;i<Math.min(3,amount);i++)soldier(ctx,x-12+gather*14+i*6,y+16,troop,faction,.55,Math.sin(progress*Math.PI*3+i));
    // A short muster baseline follows the men; it is not another troop counter.
    if(amount>0){ctx.globalAlpha*=1-progress;ctx.strokeStyle='#B79151';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-16+progress*8,y+22);ctx.lineTo(x+12,y+22);ctx.stroke();}
  }else if(id==='mobilize'){
    const strike=Math.sin(Math.PI*Math.min(1,progress/.38));cardSymbol(ctx,x,y+strike*2,14*(1+.03*strike),id);ctx.globalAlpha*=1-progress;ctx.strokeStyle='#BD9455';ctx.lineWidth=1.5;
    const radius=12+progress*8;for(const direction of [-1,1]){const angle=direction<0?Math.PI:0;ctx.beginPath();ctx.arc(x,y,radius,angle-.45,angle+.45);ctx.stroke();}
    ctx.strokeStyle='#F0D99B';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-3,y-8);ctx.lineTo(x-6,y-11-strike*3);ctx.moveTo(x+3,y-8);ctx.lineTo(x+6,y-11-strike*3);ctx.stroke();
  }else if(id==='feint'){
    cardSymbol(ctx,x,y,14*(1+.03*Math.sin(Math.PI*progress)),id);ctx.globalAlpha*=1-progress;ctx.fillStyle='#6D6A60';ctx.beginPath();ctx.ellipse(x-3+progress*3,y-14-progress*5,4+progress,3,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#CB7051';for(const dx of [-7,7]){ctx.beginPath();ctx.arc(x+dx+(dx<0?-2:2)*progress,y-9-progress*7,1.2,0,Math.PI*2);ctx.fill();}
  }else{
    cardSymbol(ctx,x+progress*2,y,10,id);ctx.globalAlpha*=1-progress;ctx.strokeStyle='#D3B574';ctx.lineWidth=1.5;
    for(const dy of [-5,0]){ctx.beginPath();ctx.moveTo(x-9-progress*3,y+dy);ctx.quadraticCurveTo(x-15-progress*4,y+dy-2,x-20-progress*2,y+dy);ctx.stroke();}
  }
  ctx.restore();
}

/** Compact plaque beneath the gate; the building and plaque share their faction colour. */
export function campPennant(ctx:CanvasRenderingContext2D,x:number,y:number,value:number,id:FactionId|null,selected=false,tier?:number):void{
  if(![x,y,value].every(Number.isFinite)||!Number.isSafeInteger(value)||value<0)return;
  ctx.save();ctx.font='600 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  const text=String(value),width=Math.max(34,Math.ceil(ctx.measureText(text).width)+14),left=x-width/2;
  ctx.lineJoin='round';ctx.lineWidth=selected?1.8:1;ctx.fillStyle=id===null?'#74797D':id==='P'?'#286451':id==='E2'?'#947324':id==='E3'?'#675682':'#9A4439';ctx.strokeStyle=selected?'#F1D493':'#DED1AE';
  rounded(ctx,left,y-11,width,22,2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#FFF7E1';ctx.fillText(text,x,y+.5);
  if(tier===1||tier===2||tier===3){
    // Fixed companion plate: the authoritative troop count never moves or shrinks.
    ctx.fillStyle=['#494238','#53412A','#624418'][tier-1]!;
    ctx.strokeStyle=['#A89A7A','#C7AB75','#F0D28C'][tier-1]!;
    ctx.lineWidth=tier===3?1.5:1;
    rounded(ctx,left-26,y-10,25,20,2);ctx.fill();ctx.stroke();
    ctx.font='600 11px sans-serif';ctx.fillStyle='#FFF0CA';
    ctx.fillText(['一级','二级','三级'][tier-1]!,left-13.5,y+.5);
  }
  ctx.restore();
}

/** Original broad silhouettes remain legible at small scales and without raster assets. */
/** World troops are smaller than the city gate; static card/album illustrations use soldier directly. */
export function marchingSoldier(ctx:CanvasRenderingContext2D,x:number,y:number,type:TroopType,id:FactionId,scale=1,step=0,bowLift=0,facing=1,walkFrame=0):void {
  soldier(ctx,x,y,type,id,scale*.72,step,bowLift,facing,walkFrame);
}

export function soldier(ctx:CanvasRenderingContext2D,x:number,y:number,type:TroopType,id:FactionId,scale=1,step=0,bowLift=0,facing=1,walkFrame=0):void {
  if(![x,y,scale].every(Number.isFinite)||scale<=0)return;
  const stride=Number.isFinite(step)?Math.max(-1,Math.min(1,step)):0,lift=Number.isFinite(bowLift)?Math.max(0,Math.min(2,bowLift)):0;
  ctx.save();ctx.translate(x,y);ctx.scale(scale*(Number.isFinite(facing)&&facing<0?-1:1),scale);
  const frame=(Number.isFinite(walkFrame)?Math.max(0,Math.min(5,Math.floor(walkFrame))):0) as 0|1|2|3|4|5;
  if(type==='infantry'){
    if(drawArt(ctx,`sample-infantry-${frame}`,-12,-27,24,36,'bottom')){
      ctx.fillStyle=factionColor(id);ctx.fillRect(-1,-8,2,7);ctx.restore();return;
    }
  }else{
    const width=type==='cavalry'?38:30,height=type==='cavalry'?39:36;
    if(drawArt(ctx,`motion-${type}-${frame}`,-width/2,9-height,width,height,'bottom')){
      ctx.fillStyle=factionColor(id);ctx.strokeStyle='#FAE5AF';ctx.lineWidth=.6;
      ctx.fillRect(type==='cavalry'?-5:0,type==='cavalry'?-15:-8,3,6);ctx.strokeRect(type==='cavalry'?-5:0,type==='cavalry'?-15:-8,3,6);
      if(type==='archer'&&lift>0){ctx.beginPath();ctx.arc(7,-6-lift,9,-Math.PI/2,Math.PI/2);ctx.strokeStyle='#F2D184';ctx.lineWidth=1.1;ctx.stroke();}
      ctx.restore();return;
    }
  }
  const spriteWidth=type==='cavalry'?38:30,spriteHeight=type==='cavalry'?39:36;
  const bob=Math.abs(stride)*.8;
  ctx.save();ctx.rotate(stride*.035);
  const painted=drawArt(ctx,`unit-${type}`,-spriteWidth/2,9-spriteHeight-bob,spriteWidth,spriteHeight,'bottom');
  if(painted){
    // A small runtime sash keeps allegiance current after conversion; the actual army anchor never shifts.
    ctx.fillStyle=factionColor(id);ctx.strokeStyle='#FAE5AF';ctx.lineWidth=.6;
    ctx.fillRect(type==='cavalry'?-5:0,type==='cavalry'?-15-bob:-8-bob,3,6);ctx.strokeRect(type==='cavalry'?-5:0,type==='cavalry'?-15-bob:-8-bob,3,6);
    if(type==='infantry'){
      ctx.strokeStyle='#765A39';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-11,-25-bob);ctx.lineTo(-11,-30-bob);ctx.stroke();
      artFace(ctx,'#C5CBC1',[[-11,-34-bob],[-13,-29-bob],[-9,-29-bob]]);
    }
    if(type==='archer'&&lift>0){
      ctx.beginPath();ctx.arc(7,-6-lift,9,-Math.PI/2,Math.PI/2);ctx.strokeStyle='#F2D184';ctx.lineWidth=1.1;ctx.stroke();
    }
    ctx.restore();ctx.restore();return;
  }
  ctx.restore();
  ctx.strokeStyle='#263C3D';ctx.lineWidth=1.3;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.fillStyle='#263C3D25';ctx.beginPath();ctx.ellipse(0,9,type==='cavalry'?14:8,2.4,0,0,Math.PI*2);ctx.fill();
  if(type==='cavalry'){
    // Four separated hooves and a high neck read as a mount, even in monochrome.
    ctx.strokeStyle='#574331';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-8,2);ctx.lineTo(-10+stride*2,8);ctx.moveTo(-4,2);ctx.lineTo(-2-stride*2,8);ctx.moveTo(5,2);ctx.lineTo(3+stride*2,8);ctx.moveTo(9,1);ctx.lineTo(12-stride*2,8);ctx.stroke();
    ctx.fillStyle='#AE8055';ctx.beginPath();ctx.moveTo(-12,1);ctx.lineTo(-10,-6);ctx.lineTo(3,-6);ctx.lineTo(7,-16);ctx.lineTo(10,-18);ctx.lineTo(14,-13);ctx.lineTo(15,-9);ctx.lineTo(11,-7);ctx.lineTo(8,-8);ctx.lineTo(8,2);ctx.lineTo(-7,4);ctx.closePath();ctx.fill();ctx.stroke();
    artFace(ctx,'#DCB481',[[-10,-5],[2,-5],[1,0],[-10,1]]);artFace(ctx,'#3D3C32',[[3,-6],[7,-16],[10,-18],[11,-16],[8,-12],[6,-4]]);
    ctx.strokeStyle='#493C30';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-11,-4);ctx.quadraticCurveTo(-17,-3,-15,3);ctx.stroke();
    ctx.fillStyle=factionColor(id);ctx.fillRect(-6,-7,10,7);ctx.fillStyle='#E6C58D';ctx.fillRect(-6,-1,10,1.5);
    ctx.fillStyle='#1E302F';ctx.beginPath();ctx.arc(11,-12,.8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#D8C09C';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(10,-9);ctx.lineTo(14,-10);ctx.stroke();
  }else{
    ctx.strokeStyle='#31423F';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-3,1);ctx.lineTo(-4+stride*1.8,8);ctx.moveTo(3,1);ctx.lineTo(4-stride*1.8,8);ctx.stroke();
    ctx.fillStyle='#273632';ctx.fillRect(-6+stride*1.8,7,4,2);ctx.fillRect(2-stride*1.8,7,4,2);
  }
  const rider=type==='cavalry'?-7:0;
  ctx.save();ctx.translate(type==='cavalry'?-2:0,rider);
  // Wide short lamellar coat, bright sash and a large helmet create a readable figure.
  ctx.fillStyle=factionColor(id);ctx.beginPath();ctx.moveTo(-5,-9);ctx.lineTo(4,-9);ctx.lineTo(7,3);ctx.lineTo(-7,3);ctx.closePath();ctx.fill();ctx.stroke();
  artFace(ctx,'#738F8B',[[-4,-9],[3,-9],[4,-2],[-4,-2]]);artFace(ctx,'#BAC5AA',[[-4,-9],[-1,-9],[-1,-2],[-4,-2]]);
  ctx.strokeStyle='#344C49';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-3,-6);ctx.lineTo(3,-6);ctx.moveTo(-3,-3);ctx.lineTo(3,-3);ctx.stroke();
  ctx.fillStyle='#E0B978';ctx.fillRect(-6,0,12,1.5);ctx.fillStyle=factionColor(id);ctx.fillRect(2,-9,2,11);
  ctx.fillStyle='#E7C49D';ctx.strokeStyle='#364841';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-13,4.1,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#344F50';ctx.beginPath();ctx.arc(0,-14,4.7,Math.PI,Math.PI*2);ctx.lineTo(5,-13);ctx.lineTo(-5,-13);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#ADC0AE';ctx.fillRect(-1,-19,2,5);ctx.fillStyle=factionColor(id);ctx.beginPath();ctx.moveTo(0,-19);ctx.quadraticCurveTo(-4,-24,-7,-20);ctx.lineTo(-3,-18);ctx.closePath();ctx.fill();
  ctx.fillStyle='#344039';ctx.fillRect(1,-12,1,1);
  ctx.restore();
  if(type==='archer'){
    // The lift moves only this bow and string; the body and actual army anchor stay fixed.
    ctx.strokeStyle='#A5773D';ctx.lineWidth=2;ctx.beginPath();ctx.arc(7,-6-lift,9,-Math.PI/2,Math.PI/2);ctx.stroke();
    ctx.strokeStyle='#E8D6AB';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(7,-15-lift);ctx.lineTo(7,3-lift);ctx.stroke();
    ctx.strokeStyle='#61472E';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-8,-13);ctx.stroke();
  }else if(type==='guard'){
    ctx.fillStyle='#D5BE85';ctx.strokeStyle='#4E5947';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(1,-10);ctx.lineTo(11,-10);ctx.lineTo(12,2);ctx.lineTo(6,7);ctx.lineTo(0,2);ctx.closePath();ctx.fill();ctx.stroke();
    artFace(ctx,'#90784E',[[7,-9],[10,-9],[11,2],[7,5]]);ctx.fillStyle=factionColor(id);ctx.fillRect(3,-7,3,9);ctx.strokeStyle='#F0DCAB';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,-8);ctx.lineTo(9,-8);ctx.stroke();
  }else{
    ctx.strokeStyle='#6F5436';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(type==='cavalry'?7:9,4);ctx.lineTo(type==='cavalry'?7:9,-17);ctx.stroke();
    if(type==='cavalry')artFace(ctx,'#D8DDC9',[[7,-23],[4,-16],[10,-16]]);
    else{
      artFace(ctx,'#D8DDC9',[[9,-21],[6,-16],[10,-14]]);
      ctx.fillStyle='#B5975D';ctx.strokeStyle='#374940';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(-5,-2,4.5,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=factionColor(id);ctx.beginPath();ctx.arc(-5,-2,2,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}

/** One representative casualty from an already confirmed army loss, never a moving army head. */
export function soldierHit(ctx:CanvasRenderingContext2D,x:number,y:number,type:TroopType,id:FactionId,ageMs:number,reduced:boolean):void{
  if(![x,y,ageMs].every(Number.isFinite)||ageMs<0||ageMs>=300)return;
  const progress=ageMs/300;
  ctx.save();ctx.lineCap='round';ctx.strokeStyle='#F5DC9F';ctx.lineWidth=1.6;
  if(!reduced){
    ctx.globalAlpha*=.65*(1-progress);
    ctx.save();ctx.translate(x-5-progress*7,y+progress*5);ctx.rotate(-progress*.55);soldier(ctx,0,0,type,id,.7);ctx.restore();
    ctx.globalAlpha/=.65; // The short strike remains slightly stronger than the retreating figure.
  }
  ctx.beginPath();ctx.moveTo(x-8,y-10);ctx.lineTo(x-3,y-5);ctx.moveTo(x+1,y-11);ctx.lineTo(x-1,y-7);ctx.stroke();ctx.restore();
}

export function arrow(ctx:CanvasRenderingContext2D,from:{x:number;y:number},to:{x:number;y:number},color:string,width=2):void {
  const angle=Math.atan2(to.y-from.y,to.x-from.x);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(to.x,to.y);ctx.lineTo(to.x-8*Math.cos(angle-.5),to.y-8*Math.sin(angle-.5));ctx.lineTo(to.x-8*Math.cos(angle+.5),to.y-8*Math.sin(angle+.5));ctx.closePath();ctx.fill();
}
