import type { ActiveCardId } from '../core/types.ts';
import { rounded } from './art.ts';
import { drawStrategyIllustration } from './strategy-illustration.ts';

/** Thin bronze-edged field orders carry the same silk-ground vignettes as the card album.
 * The caller owns text, inventory and input; the bottom 20 px and top-right corner are kept for them.
 */
export function drawOrderCard(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:ActiveCardId,selected:boolean,pressed:boolean,available:boolean):void{
  if(![x,y,w,h,x+w,y+h+2].every(Number.isFinite)||w<40||h<40||!['mobilize','march','supply','feint'].includes(id))return;
  const top=y+(pressed?2:0),titleY=top+h-20;
  ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  rounded(ctx,x+.75,top+.75,w-1.5,h-1.5,2);ctx.clip();
  ctx.fillStyle=pressed?'#D0C5AC':'#E4DDCA';ctx.fillRect(x,top,w,h);
  ctx.fillStyle='#4B3928';ctx.fillRect(x,top,w,3);ctx.fillRect(x,top+h-3,w,3);
  ctx.save();ctx.globalAlpha*=available?1:.52;
  drawStrategyIllustration(ctx,x+2,top+2,w-4,h-20,id);
  ctx.restore();
  // The caller's name remains on an uncluttered silk strip, separate from the picture.
  ctx.fillStyle=pressed?'#D0C5AC':'#E4DDCA';ctx.fillRect(x,titleY,w,20);
  ctx.strokeStyle='#B5A489';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(x+5,titleY);ctx.lineTo(x+w-5,titleY);ctx.stroke();
  ctx.strokeStyle='#A48C65';ctx.lineWidth=.6;ctx.setLineDash([2,3]);ctx.beginPath();
  ctx.moveTo(x+4,top+6);ctx.lineTo(x+4,top+h-5);ctx.moveTo(x+w-4,top+6);ctx.lineTo(x+w-4,top+h-5);ctx.stroke();
  ctx.restore();
  ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  rounded(ctx,x+1,top+1,w-2,h-2,2);ctx.strokeStyle=selected?'#964734':available?'#907C5D':'#AAA28E';ctx.lineWidth=selected?1.5:1;ctx.stroke();
  if(selected){
    // A small cinnabar check seal reads in greyscale too and leaves the inventory corner free.
    ctx.fillStyle='#964734';ctx.fillRect(x+5,top+5,10,10);
    ctx.strokeStyle='#F3E7C9';ctx.lineWidth=1.1;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(x+7,top+10);ctx.lineTo(x+9,top+12);ctx.lineTo(x+13,top+8);ctx.stroke();
  }
  ctx.restore();
}
