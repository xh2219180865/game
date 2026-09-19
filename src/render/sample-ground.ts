import type {Battle,Point} from '../core/types.ts';

const COURTS={
  A01:{edge:'#747C7020',earth:'#ABA99638',center:'#B7BAAC87',yard:'#C3BEAA4D',stone:'#BDC3B89C',joint:'#78867B60',slab:'#CACBBB70',slabEdge:'#929D9060',seam:'#7D8B7766'},
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
      ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-w*.84,-h*.42);
      ctx.quadraticCurveTo(-w*.53,-h*1.03,-w*.04,-h*.88);
      ctx.quadraticCurveTo(w*.48,-h*1.03,w*.83,-h*.42);
      ctx.quadraticCurveTo(w*1.12,-h*.04,w*.88,h*.45);
      ctx.quadraticCurveTo(w*.65,h*.96,w*.14,h*.91);
      ctx.quadraticCurveTo(-w*.35,h*1.09,-w*.84,h*.53);
      ctx.quadraticCurveTo(-w*1.12,h*.04,-w*.84,-h*.42);ctx.closePath();ctx.fill();
    };
    court(0,palette.edge);court(3,palette.earth);court(7,central?palette.center:palette.yard);
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
