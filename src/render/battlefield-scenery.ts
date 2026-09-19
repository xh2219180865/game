export type SceneryPoint=Readonly<{x:number;y:number}>;
export type SceneryRoute=Readonly<{from:SceneryPoint;to:SceneryPoint}>;
export type SceneryItem=Readonly<{kind:'pine'|'rock'|'water';x:number;y:number;width:number;height:number}>;

const finite=(p:SceneryPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
const PALETTES={
  plains:{leaf:'#52675E',light:'#8F9D83',trunk:'#726A59',stone:'#909890',face:'#C5C7B9',water:'#839E9A',ripple:'#DCE3D9',bank:'#B5B5A1'},
  snow:{leaf:'#657974',light:'#CDD5CD',trunk:'#74796F',stone:'#98A6A2',face:'#D1D9D2',water:'#91ABAF',ripple:'#E4EBE6',bank:'#BCC8BF'},
  desert:{leaf:'#707D68',light:'#9EA58B',trunk:'#7B7160',stone:'#A59E8C',face:'#CEC4AC',water:'#92A49C',ripple:'#DBDED0',bank:'#BDAF96'},
} as const;

/** Reject the entire decoration when its envelope enters a travel corridor. */
function crosses(item:SceneryItem,route:SceneryRoute,padding:number):boolean{
  const minX=item.x-padding,maxX=item.x+item.width+padding,minY=item.y-padding,maxY=item.y+item.height+padding;
  let low=0,high=1;
  for(const [origin,delta,min,max]of [[route.from.x,route.to.x-route.from.x,minX,maxX],[route.from.y,route.to.y-route.from.y,minY,maxY]] as const){
    if(delta===0){if(origin<min||origin>max)return false;continue;}
    const a=(min-origin)/delta,b=(max-origin)/delta;
    low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return false;
  }
  return true;
}

/** Small perimeter vignettes, not traversability or collision geometry. No random state. */
export function planBattlefieldScenery(width:number,height:number,camps:readonly SceneryPoint[],routes:readonly SceneryRoute[]=[]):SceneryItem[]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<120||height<160)return [];
  // Unknown route coordinates cannot safely certify clear ground.
  if(routes.some(r=>!finite(r.from)||!finite(r.to)))return [];
  const scale=Math.min(1,width/375,height/400),result:SceneryItem[]=[];
  const add=(kind:SceneryItem['kind'],u:number,v:number,w:number,h:number)=>{
    const item={kind,x:kind==='water'?(u<.5?0:width-w*scale):Math.max(3,Math.min(width-w*scale-3,width*u-w*scale/2)),y:Math.max(3,Math.min(height-h*scale-3,height*v-h*scale/2)),width:w*scale,height:h*scale};
    if(camps.some(p=>finite(p)&&Math.hypot(Math.max(item.x-p.x,0,p.x-item.x-item.width),Math.max(item.y-p.y,0,p.y-item.y-item.height))<46*scale))return;
    if(routes.some(r=>crosses(item,r,18*scale)))return;
    if(result.some(p=>item.x<p.x+p.width+5&&item.x+item.width+5>p.x&&item.y<p.y+p.height+5&&item.y+item.height+5>p.y))return;
    result.push(item);
  };
  // River bends continue out of frame; the whole bank still ends before any road.
  add('water',0,.47,30,104);add('water',1,.78,29,88);
  for(const [u,v]of [[.055,.08],[.93,.14],[.055,.25],[.95,.36],[.055,.67],[.935,.57],[.06,.87],[.93,.95]]as const)add('pine',u,v,32,40);
  for(const [u,v]of [[.14,.05],[.91,.27],[.055,.58],[.95,.9]]as const)add('rock',u,v,25,18);
  return result;
}

export function drawBattlefieldScenery(ctx:CanvasRenderingContext2D,width:number,height:number,camps:readonly SceneryPoint[],mapId:string,routes:readonly SceneryRoute[]=[]):void{
  const items=planBattlefieldScenery(width,height,camps,routes);if(!items.length)return;
  const p=mapId==='A02'||mapId==='L02'?PALETTES.snow:mapId==='A03'||mapId==='L03'?PALETTES.desert:PALETTES.plains;
  ctx.save();
  for(const item of items){
    ctx.save();ctx.translate(item.x,item.y);ctx.scale(item.width/32,item.height/40);
    // Every painted stroke is contained inside the planner's conservative envelope.
    ctx.beginPath();ctx.rect(0,0,32,40);ctx.clip();
    if(item.kind==='pine'){
      // Tapered crooked wood, fine forks and broken needle clusters, without a solid oval shadow.
      ctx.fillStyle=p.trunk+'B0';ctx.beginPath();ctx.moveTo(14,37);ctx.lineTo(18,36);ctx.bezierCurveTo(14,29,21,23,15,7);ctx.bezierCurveTo(18,22,13,29,14,37);ctx.fill();
      ctx.strokeStyle=p.trunk+'BB';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(16,33);ctx.lineTo(19,36);ctx.moveTo(15,34);ctx.lineTo(11,37);ctx.moveTo(17,27);ctx.lineTo(8,22);ctx.lineTo(5,18);ctx.moveTo(11,23);ctx.lineTo(12,17);ctx.moveTo(18,22);ctx.lineTo(26,16);ctx.moveTo(21,19);ctx.lineTo(21,13);ctx.moveTo(16,16);ctx.lineTo(10,10);ctx.stroke();
      for(const [x,y,r]of [[7,21,5],[12,19,5],[24,15,5],[20,12,4],[10,10,5],[16,8,4],[16,4,3]]as const){
        ctx.fillStyle=p.leaf+'B8';ctx.strokeStyle=p.leaf+'80';ctx.lineWidth=.45;
        ctx.beginPath();ctx.moveTo(x-r,y+1);ctx.lineTo(x-r*.65,y-1);ctx.lineTo(x-r*.75,y-2);ctx.lineTo(x-r*.25,y-2);ctx.lineTo(x,y-4);ctx.lineTo(x+r*.2,y-2.4);ctx.lineTo(x+r*.55,y-3);ctx.lineTo(x+r*.65,y-1);ctx.lineTo(x+r,y);ctx.lineTo(x+r*.5,y+1);ctx.lineTo(x+r*.6,y+2);ctx.lineTo(x-r*.3,y+1.5);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.strokeStyle=p.light+'D0';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(x-r*.55,y-.3);ctx.lineTo(x-r*.1,y-1.5);ctx.moveTo(x+.5,y-.5);ctx.lineTo(x+r*.45,y-1.2);ctx.stroke();
      }
    }else if(item.kind==='rock'){
      ctx.fillStyle=p.bank;ctx.beginPath();ctx.ellipse(16,32,14,5,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=p.stone;ctx.beginPath();ctx.moveTo(3,31);ctx.lineTo(8,12);ctx.lineTo(20,5);ctx.lineTo(29,25);ctx.lineTo(25,34);ctx.closePath();ctx.fill();
      ctx.fillStyle=p.face;ctx.beginPath();ctx.moveTo(3,31);ctx.lineTo(8,12);ctx.lineTo(20,5);ctx.lineTo(16,21);ctx.closePath();ctx.fill();
      ctx.strokeStyle=p.trunk;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(20,8);ctx.lineTo(18,22);ctx.lineTo(23,27);ctx.stroke();
    }else{
      if(item.x>width/2){ctx.translate(32,0);ctx.scale(-1,1);}
      // Both fills meet the outer screen edge. Only the winding inland shore is outlined.
      ctx.fillStyle=p.bank+'99';ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(9,3,23,4,18,10);ctx.bezierCurveTo(14,15,31,17,28,23);ctx.bezierCurveTo(23,27,16,27,19,32);ctx.bezierCurveTo(20,36,8,38,0,40);ctx.closePath();ctx.fill();
      ctx.fillStyle=p.water+'BB';ctx.beginPath();ctx.moveTo(0,1);ctx.bezierCurveTo(6,4,20,5,15,10);ctx.bezierCurveTo(11,15,28,17,24,22);ctx.bezierCurveTo(19,26,12,28,15,32);ctx.bezierCurveTo(17,35,6,38,0,39);ctx.closePath();ctx.fill();
      ctx.strokeStyle=p.stone+'90';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(4,3);ctx.bezierCurveTo(11,5,20,5,15,10);ctx.moveTo(14,14);ctx.bezierCurveTo(19,17,28,17,24,22);ctx.moveTo(18,27);ctx.quadraticCurveTo(12,29,15,32);ctx.stroke();
      ctx.strokeStyle=p.ripple+'C0';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(0,9);ctx.quadraticCurveTo(5,10,10,9);ctx.moveTo(6,19);ctx.quadraticCurveTo(12,20,18,19);ctx.moveTo(0,29);ctx.quadraticCurveTo(5,30,10,29);ctx.moveTo(3,33);ctx.lineTo(9,33);ctx.stroke();
      for(const [x,y,r]of [[18,8,1.4],[27,20,1.9],[21,25,1.2],[16,33,1.6]]as const){
        ctx.fillStyle=p.stone+'B0';ctx.beginPath();ctx.moveTo(x-r,y+.5);ctx.lineTo(x-r*.5,y-.7);ctx.lineTo(x+r*.4,y-1);ctx.lineTo(x+r,y+.4);ctx.closePath();ctx.fill();
        ctx.strokeStyle=p.face;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(x-r*.4,y-.5);ctx.lineTo(x+r*.4,y-.6);ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
