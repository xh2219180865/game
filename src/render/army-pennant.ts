import type { FactionId, Point } from '../core/types.ts';
import { factionColor } from './art.ts';

/** A quiet troop banner; the caller owns collision placement and the actual remaining count. */
export function drawArmyPennant(ctx:CanvasRenderingContext2D,rect:{x:number;y:number;w:number;h:number},anchor:Point,faction:FactionId,count:number,hit:number,wave=0):void {
  const {x,y,w,h}=rect;
  if(![x,y,w,h,x+w,y+h,anchor.x,anchor.y].every(Number.isFinite)||w<28||h<16||
    !Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(hit)||hit<0||!['P','E','E1','E2','E3'].includes(faction))return;
  ctx.save();
  ctx.setLineDash([]);ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.lineCap='round';ctx.lineJoin='round';
  // A short staff joins the nearby banner to the leader's shoulder, not the ground below their feet.
  const shoulder={x:anchor.x,y:anchor.y-20};
  const edge={x:Math.max(x,Math.min(x+w,shoulder.x)),y:Math.max(y+3,Math.min(y+h-3,shoulder.y))};
  const dx=shoulder.x-edge.x,dy=shoulder.y-edge.y,distance=Math.hypot(dx,dy);
  if(distance>3&&distance<=24){
    const length=Math.min(18,distance-3);
    ctx.strokeStyle='#728373';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(edge.x,edge.y);
    ctx.lineTo(edge.x+dx/distance*length,edge.y+dy/distance*length);ctx.stroke();
  }
  const top=y+3,bottom=y+h-3,mid=y+h/2;
  const fold=Number.isFinite(wave)?Math.max(-1.5,Math.min(1.5,wave)):0;
  ctx.fillStyle=hit>0?'#733F32':'#314D45';ctx.strokeStyle=hit>0?'#C78B62':'#A7AF95';ctx.lineWidth=.7;
  ctx.beginPath();ctx.moveTo(x+2,top);ctx.lineTo(x+w*.65,top+fold*.5);ctx.lineTo(x+w-1,top+fold);ctx.lineTo(x+w-3,mid);ctx.lineTo(x+w-1,bottom+fold);ctx.lineTo(x+w*.65,bottom+fold*.5);ctx.lineTo(x+2,bottom);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#C9C3A5';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x+4,top);ctx.lineTo(x+4,bottom);ctx.stroke();
  ctx.fillStyle=factionColor(faction);ctx.beginPath();ctx.rect(x+6,top+2,10,bottom-top-4);ctx.fill();
  // The same simple stitching as the camp standard; no nested tiny flag or rank-like numeral.
  ctx.strokeStyle='#FFF0D2';ctx.lineWidth=1;ctx.beginPath();
  const stroke=(ax:number,ay:number,bx:number,by:number)=>{ctx.moveTo(x+ax,mid+ay);ctx.lineTo(x+bx,mid+by);};
  if(faction==='P')stroke(11,-3,11,3);
  else if(faction==='E'||faction==='E1'){stroke(9,-3,9,3);stroke(13,-3,13,3);}
  else if(faction==='E2')stroke(8,0,14,0);
  else {stroke(8,-3,14,3);stroke(8,3,14,-3);}
  ctx.stroke();
  ctx.font=`600 ${Math.min(14,h-10)}px monospace`;ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#FFF3D5';
  ctx.fillText(String(count),x+w-4,mid+.5,w-21);
  ctx.restore();
}
