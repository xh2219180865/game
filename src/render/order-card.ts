import type { ActiveCardId } from '../core/types.ts';
import { rounded } from './art.ts';
import { drawArt } from './assets.ts';
import { drawStrategyIllustration } from './strategy-illustration.ts';

/** An unlettered cloth order held between two worn battens; content and input stay caller-owned. */
export function drawOrderMount(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,muted=false):void{
  if(![x,y,w,h,x+w,y+h].every(Number.isFinite)||w<24||h<24)return;
  ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.fillStyle='#100D0A70';ctx.fillRect(x+3,y+3,w-3,h-3);
  ctx.beginPath();ctx.moveTo(x+4,y+3);ctx.lineTo(x+w-4,y+3);ctx.lineTo(x+w-5,y+h-5);
  ctx.lineTo(x+w*.73,y+h-7);ctx.lineTo(x+w*.45,y+h-5);ctx.lineTo(x+5,y+h-7);ctx.closePath();
  ctx.fillStyle=muted?'#C7C6B9':'#D7C09A';ctx.fill();
  ctx.save();ctx.clip();
  if(!muted)drawArt(ctx,'silk-texture',x+4,y+3,w-8,h-8,'cover');
  ctx.fillStyle=muted?'#74746C18':'#70502C17';ctx.fillRect(x+4,y+3,w-8,h-8);ctx.restore();
  for(const yy of [y+1,y+h-6]){
    ctx.fillStyle=muted?'#514D44':'#3C2A1D';ctx.fillRect(x,yy,w,5);
    ctx.fillStyle=muted?'#898174':'#A18154';ctx.fillRect(x+1,yy+.5,w-2,.7);
    ctx.fillStyle='#130E0B80';ctx.fillRect(x+2,yy+3,w-4,1);
    for(const xx of [x+7,x+w-9]){ctx.fillStyle=muted?'#79776E':'#8F422F';ctx.fillRect(xx,yy-1,2,8);}
  }
  ctx.restore();
}

/** Thin bronze-edged field orders carry the same silk-ground vignettes as the card album.
 * The caller owns text, inventory and input; the upper silk strip and lower-right corner are kept for them.
 */
export function drawOrderCard(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,id:ActiveCardId,selected:boolean,pressed:boolean,available:boolean):void{
  if(![x,y,w,h,x+w,y+h+2].every(Number.isFinite)||w<40||h<40||!['mobilize','march','supply','feint'].includes(id))return;
  const top=y+(pressed?2:0),titleHeight=22;
  ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  drawOrderMount(ctx,x,top,w,h);
  if(pressed){ctx.fillStyle='#39291C18';ctx.fillRect(x+4,top+4,w-8,h-10);}
  ctx.save();ctx.globalAlpha*=available?1:.52;
  drawStrategyIllustration(ctx,x+6,top+titleHeight,w-12,h-titleHeight-13,id);
  ctx.restore();
  // The caller's name remains on an uncluttered silk strip, separate from the picture.
  // Calm the cloth behind the live name, leaving its irregular edge and battens exposed.
  ctx.fillStyle=pressed?'#C6B18C90':'#E1CBA570';ctx.fillRect(x+5,top+5,w-10,titleHeight-6);
  ctx.restore();
  ctx.save();ctx.setLineDash([]);ctx.lineJoin='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  if(selected){
    rounded(ctx,x+2,top+2,w-4,h-4,1);ctx.strokeStyle='#964734';ctx.lineWidth=1.5;ctx.stroke();
    // A small cinnabar check seal reads in greyscale too and leaves the inventory corner free.
    ctx.fillStyle='#964734';ctx.fillRect(x+5,top+5,10,10);
    ctx.strokeStyle='#F3E7C9';ctx.lineWidth=1.1;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(x+7,top+10);ctx.lineTo(x+9,top+12);ctx.lineTo(x+13,top+8);ctx.stroke();
  }
  ctx.restore();
}
