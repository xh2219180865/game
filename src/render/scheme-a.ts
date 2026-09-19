const PAPER='#EAE5D8',INK='#39433E',JADE='#718078',VERDANT='#BBC3BB',GOLD='#AC9169';
type Vertex=readonly [number,number];

function face(ctx:CanvasRenderingContext2D,color:string,vertices:readonly Vertex[]):void{
  ctx.fillStyle=color;ctx.beginPath();vertices.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}
function line(ctx:CanvasRenderingContext2D,color:string,width:number,vertices:readonly Vertex[]):void{
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();vertices.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
}
function gate(ctx:CanvasRenderingContext2D):void{
  face(ctx,GOLD,[[0,-.19],[.19,0],[0,.19],[-.19,0]]);
  face(ctx,JADE,[[0,-.16],[.16,0],[0,.16],[-.16,0]]);
  face(ctx,GOLD,[[-.106,.05],[-.106,-.042],[-.064,-.042],[-.064,-.008],[-.022,-.008],[-.022,-.066],[.022,-.066],[.022,-.008],[.064,-.008],[.064,-.042],[.106,-.042],[.106,.05]]);
  line(ctx,GOLD,.009,[[-.09,.068],[-.03,.068],[0,.09],[.03,.068],[.09,.068]]);
}
function frame(ctx:CanvasRenderingContext2D,x:number,y:number,size:number):void{
  ctx.translate(x,y);ctx.scale(size,size);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.setLineDash([]);
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
}

/** Centered standard; the shared emblem does not invent rank thresholds from merit. */
export function drawRankStandard(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,points:number):void{
  if(![x,y,size,points,x-size/2,x+size/2,y-size/2,y+size/2].every(Number.isFinite)||size<=0||points<0)return;
  ctx.save();frame(ctx,x,y,size);
  face(ctx,INK,[[-.037,-.47],[.037,-.47],[.029,.43],[-.029,.43]]);
  face(ctx,GOLD,[[-.026,-.47],[0,-.49],[.026,-.47],[0,-.44]]);
  face(ctx,'#D9D8C5',[[-.16,.43],[.14,.43],[.18,.47],[-.18,.47]]);
  face(ctx,'#B7BDAB',[[-.18,.47],[.18,.47],[.17,.49],[-.17,.49]]);
  face(ctx,INK,[[-.30,-.353],[.30,-.353],[.30,-.318],[-.30,-.318]]);
  face(ctx,GOLD,[[-.305,-.36],[-.282,-.36],[-.282,-.312],[-.305,-.312]]);
  face(ctx,GOLD,[[.282,-.36],[.305,-.36],[.305,-.312],[.282,-.312]]);
  face(ctx,INK,[[-.24,-.338],[.24,-.338],[.24,.282],[0,.403],[-.24,.282]]);
  face(ctx,JADE,[[-.222,-.322],[.222,-.322],[.222,.271],[0,.379],[-.222,.271]]);
  face(ctx,'#81917D',[[-.213,-.32],[-.08,-.32],[-.105,.314],[-.213,.266]]);
  face(ctx,'#53685D',[[.09,-.32],[.215,-.32],[.215,.268],[.115,.318]]);
  line(ctx,GOLD,.006,[[-.20,-.299],[.20,-.299],[.20,.258],[0,.354],[-.20,.258],[-.20,-.299]]);
  for(const side of [-1,1]){
    line(ctx,GOLD,.011,[[side*.26,-.326],[side*.266,.236]]);
    face(ctx,JADE,[[side*.252,.206],[side*.280,.206],[side*.289,.29],[side*.251,.29]]);
    line(ctx,GOLD,.009,[[side*.25,.207],[side*.28,.207]]);
    line(ctx,GOLD,.006,[[side*.183,-.267],[side*.164,-.284],[side*.15,-.267]]);
    line(ctx,GOLD,.006,[[side*.183,.215],[side*.17,.236],[side*.148,.239]]);
  }
  ctx.save();ctx.translate(0,.015);gate(ctx);ctx.restore();ctx.restore();
}

/** Pale decoration is confined to the bottom fifth, leaving the reading area quiet. */
export function drawIvoryLandscape(ctx:CanvasRenderingContext2D,w:number,h:number):void{
  if(![w,h].every(Number.isFinite)||w<=0||h<=0)return;
  ctx.save();ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.fillStyle=PAPER;ctx.fillRect(0,0,w,h);ctx.globalAlpha*=.28;
  for(const [color,peaks] of [
    [VERDANT,[[0,.94],[.09,.85],[.15,.9],[.23,.81],[.31,.92],[.42,.97],[.58,.96],[.72,.85],[.78,.89],[.86,.80],[.93,.90],[1,.85]]] ,
    [JADE,[[0,.98],[.10,.95],[.17,.98],[.24,.94],[.32,.99],[.61,.995],[.72,.965],[.83,.99],[.94,.94],[1,.97]]],
  ] as const){
    face(ctx,color,[...peaks.map(([px,py])=>[px*w,py*h] as const),[w,h],[0,h]]);
  }
  ctx.restore();
}

/** Decorative card backs only; count is visually clamped to one through three. */
export function drawRewardFan(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,count:number):void{
  if(![x,y,size,count,x-size/2,x+size/2,y-size/2,y+size/2].every(Number.isFinite)||size<=0)return;
  const cards=Math.max(1,Math.min(3,Math.floor(count)));
  ctx.save();frame(ctx,x,y,size);
  const poses=cards===1?[[0,0,0]]:cards===2?[[-.145,.015,-.15],[.145,.015,.15]]:[[-.24,.035,-.22],[.24,.035,.22],[0,-.015,0]];
  for(const [dx,dy,angle] of poses){
    ctx.save();ctx.translate(dx!,dy!);ctx.rotate(angle!);
    face(ctx,GOLD,[[-.167,-.273],[.155,-.273],[.174,-.254],[.174,.256],[.155,.273],[-.155,.273],[-.174,.255],[-.174,-.255]]);
    face(ctx,INK,[[-.161,-.248],[-.147,-.26],[.147,-.26],[.161,-.248],[.161,.248],[.147,.26],[-.147,.26],[-.161,.248]]);
    face(ctx,JADE,[[-.151,-.242],[.151,-.242],[.151,.242],[-.151,.242]]);
    line(ctx,GOLD,.004,[[-.136,-.226],[.136,-.226],[.136,.226],[-.136,.226],[-.136,-.226]]);
    ctx.save();ctx.scale(.68,.68);gate(ctx);ctx.restore();
    for(const side of [-1,1])line(ctx,GOLD,.006,[[side*.10,-.209],[side*.119,-.209],[side*.119,-.19]]);
    ctx.restore();
  }
  ctx.restore();
}

/** Centered square gate seal, suitable for a title or reward crest. */
export function drawGateSeal(ctx:CanvasRenderingContext2D,x:number,y:number,size:number):void{
  if(![x,y,size,x-size/2,x+size/2,y-size/2,y+size/2].every(Number.isFinite)||size<=0)return;
  ctx.save();frame(ctx,x,y,size);
  face(ctx,INK,[[-.40,-.48],[.40,-.48],[.48,-.40],[.48,.40],[.40,.48],[-.40,.48],[-.48,.40],[-.48,-.40]]);
  face(ctx,JADE,[[-.39,-.445],[.39,-.445],[.445,-.39],[.445,.39],[.39,.445],[-.39,.445],[-.445,.39],[-.445,-.39]]);
  line(ctx,GOLD,.014,[[-.35,-.403],[.35,-.403],[.403,-.35],[.403,.35],[.35,.403],[-.35,.403],[-.403,.35],[-.403,-.35],[-.35,-.403]]);
  ctx.scale(1.8,1.8);gate(ctx);ctx.restore();
}
