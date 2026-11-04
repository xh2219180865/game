import type {Battle,Point} from '../core/types.ts';

const COURTS={
  A01:{edge:'#433C3014',earth:'#8C785F26',center:'#AD9E8187',yard:'#BFA57930',stone:'#B8AE96CC',joint:'#655E4F80',slab:'#C6B58F99',slabEdge:'#75684E80',seam:'#645F4166'},
  A02:{edge:'#778D8A20',earth:'#AAB7B038',center:'#BAC5C087',yard:'#C5D0C74D',stone:'#CCD7D29C',joint:'#82989060',slab:'#D0DAD370',slabEdge:'#96A79F60',seam:'#E4EBE499'},
  A03:{edge:'#8F826E20',earth:'#BAAC9338',center:'#C6BDA687',yard:'#D0C1A74D',stone:'#CDBFA29C',joint:'#94897360',slab:'#D3C8B170',slabEdge:'#A2988160',seam:'#9C927B55'},
} as const;

/** Settled earth and flush stone courts. These marks do not add terrain or rules. */
export function drawSampleGround(ctx:CanvasRenderingContext2D,b:Battle,point:(p:Point)=>Point,scale:number):void{
  if(!(b.mapId in COURTS)||!Number.isFinite(scale)||scale<=0)return;
  const palette=COURTS[b.mapId as keyof typeof COURTS];
  const centers=b.camps.map(c=>({camp:c,p:point(c)}));
  if(centers.some(({p})=>![p.x,p.y].every(Number.isFinite)))return;
  ctx.save();ctx.lineWidth=1;ctx.setLineDash([]);
  for(const {camp,p}of centers){
    const central=camp.id===`${b.mapId}-N5`,home=['P1','E1','E2','E3'].some(id=>camp.id===`${b.mapId}-${id}`);
    ctx.save();ctx.translate(p.x,p.y+8*scale);ctx.scale(scale,scale);
    const rx=central?54:home?44:37,ry=central?32:home?27:23;
    // Uneven, softened earth edges anchor each settlement without a circular token base.
    const court=(inset:number,color:string)=>{
      const w=rx-inset,h=ry-inset*.55;
      ctx.fillStyle=color;ctx.beginPath();
      if(!central){
        // Trampled gate approaches have broken, flattened edges rather than round board-game bases.
        ctx.moveTo(-w*.9,-h*.2);ctx.quadraticCurveTo(-w*.52,-h*.54,-w*.05,-h*.65);
        ctx.quadraticCurveTo(w*.45,-h*.63,w*.8,-h*.12);ctx.quadraticCurveTo(w*.98,h*.15,w*.75,h*.48);
        ctx.quadraticCurveTo(w*.3,h*.85,-w*.14,h*.74);ctx.quadraticCurveTo(-w*.65,h*.62,-w*.9,h*.22);
        ctx.quadraticCurveTo(-w,h*.02,-w*.9,-h*.2);ctx.closePath();ctx.fill();return;
      }
      ctx.moveTo(-w*.84,-h*.42);
      ctx.quadraticCurveTo(-w*.53,-h*1.03,-w*.04,-h*.88);
      ctx.quadraticCurveTo(w*.48,-h*1.03,w*.83,-h*.42);
      ctx.quadraticCurveTo(w*1.12,-h*.04,w*.88,h*.45);
      ctx.quadraticCurveTo(w*.65,h*.96,w*.14,h*.91);
      ctx.quadraticCurveTo(-w*.35,h*1.09,-w*.84,h*.53);
      ctx.quadraticCurveTo(-w*1.12,h*.04,-w*.84,-h*.42);ctx.closePath();ctx.fill();
    };
    court(0,palette.edge);court(3,palette.earth);court(7,central?palette.center:palette.yard);
    // A shared upper-left light grounds the roof above the flat yard, without a token-shaped base.
    ctx.fillStyle='#29271F25';ctx.beginPath();ctx.moveTo(-21,1);ctx.lineTo(18,-3);
    ctx.lineTo(34,13);ctx.lineTo(16,20);ctx.lineTo(-12,16);ctx.closePath();ctx.fill();
    if(central){
      // A chamfered stone square defines the central objective; paths can meet every side.
      ctx.save();ctx.beginPath();ctx.moveTo(-35,-19);ctx.lineTo(32,-19);ctx.lineTo(43,-10);
      ctx.lineTo(43,13);ctx.lineTo(30,24);ctx.lineTo(-31,24);ctx.lineTo(-43,14);ctx.lineTo(-43,-9);ctx.closePath();
      ctx.fillStyle=palette.stone;ctx.fill();ctx.clip();
      ctx.strokeStyle=palette.joint;ctx.lineWidth=.65;
      for(let row=-2;row<=2;row++){
        const y=row*9;ctx.beginPath();ctx.moveTo(-44,y);ctx.lineTo(44,y);ctx.stroke();
        for(let col=-3;col<=3;col++){const x=col*15+(row%2)*7.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+9);ctx.stroke();}
      }
      ctx.restore();
    }else{
      // A few broad worn slabs sit at the gate. The open centre stays free of decoration.
      ctx.fillStyle=palette.slab;ctx.strokeStyle=palette.slabEdge;ctx.lineWidth=.6;
      for(const [x,y,w]of [[-23,13,14],[-7,15,16],[11,12,12]] as const){
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y-1);ctx.lineTo(x+w+1,y+5);ctx.lineTo(x+1,y+6);ctx.closePath();ctx.fill();ctx.stroke();
      }
    }
    // Flat grass, wind-scoured snow or sandstone seams stay inside each court.
    ctx.strokeStyle=palette.seam;ctx.lineWidth=.8;ctx.lineCap='round';
    for(const [x,y]of [[-rx*.72,-ry*.35],[rx*.74,ry*.32],[-rx*.52,ry*.72]] as const){
      ctx.beginPath();
      if(b.mapId==='A02'){
        ctx.moveTo(x-4,y);ctx.quadraticCurveTo(x,y-2,x+5,y-1);
        ctx.moveTo(x-2,y+2);ctx.lineTo(x+2,y+1);
      }else if(b.mapId==='A03'){
        ctx.moveTo(x-4,y-1);ctx.lineTo(x,y);ctx.lineTo(x+4,y-2);
        ctx.moveTo(x,y);ctx.lineTo(x+1,y+2);
      }else{
        ctx.moveTo(x-2,y+1);ctx.lineTo(x-3,y-2);ctx.moveTo(x,y+1);ctx.lineTo(x+1,y-3);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
