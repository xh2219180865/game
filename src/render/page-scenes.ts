import {drawArt} from './assets.ts';

export function yardAtmosphere(c:CanvasRenderingContext2D,w:number,h:number,time:number,reduced:boolean):void{
  if(reduced)return;
  c.save();const alpha=c.globalAlpha;
  for(let i=0;i<3;i++){
    const t=((Math.max(0,time)/8000+i*.31)%1);
    c.globalAlpha=alpha*.035*Math.sin(Math.PI*t);c.fillStyle='#E6C38B';
    c.beginPath();c.ellipse(w*(.2+.22*i+.12*t),h*(.5+i*.09),w*.18,5+i,0,0,Math.PI*2);c.fill();
  }
  c.restore();
}

/** Quiet, unframed writing surfaces. All labels remain live Canvas text. */
export function fieldPaper(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  c.save();c.fillStyle='#160E0959';c.fillRect(x+3,y+5,w,h);
  const paper=c.createLinearGradient(x,y,x+w,y+h);
  paper.addColorStop(0,'#CCB18A');paper.addColorStop(.35,'#E9D7B5');paper.addColorStop(1,'#D4BC95');
  c.fillStyle=paper;c.beginPath();c.moveTo(x+2,y);c.lineTo(x+w,y+2);c.lineTo(x+w-2,y+h);c.lineTo(x,y+h-2);c.closePath();c.fill();c.clip();
  drawArt(c,'silk-texture',x,y,w,h,'cover');
  c.fillStyle='#FFE9BA1A';c.fillRect(x,y,w,h);
  c.restore();
}

export function drawDeskScene(c:CanvasRenderingContext2D,w:number,h:number,top:number,bottom:number,kind:'map'|'orders'|'records'):void{
  c.fillStyle='#2D2118';c.fillRect(0,0,w,h);drawArt(c,'war-table',0,0,w,h,'stretch');
  if(kind==='orders'){
    c.fillStyle='#20140DCE';c.fillRect(0,0,w,h);
    // The orders sit on an uncovered timber desk; no full-page paper panel.
    c.strokeStyle='#A47C4320';c.lineWidth=1;
    for(let i=1;i<6;i++){c.beginPath();c.moveTo(w*i/6,0);c.lineTo(w*i/6-8,h);c.stroke();}
  }else{
    c.fillStyle='#20140D45';c.fillRect(0,0,w,h);
    fieldPaper(c,14,top+62,w-28,h-top-bottom-(kind==='map'?146:80));
    if(kind==='records'){
      c.fillStyle='#784735';c.fillRect(w-54,top+62,19,10);
      c.fillStyle='#553522';c.fillRect(w-52,top+64,15,1);
    }
  }
}

export function drawNoticeScene(c:CanvasRenderingContext2D,w:number,h:number,top:number,bottom:number):void{
  c.fillStyle='#292017';c.fillRect(0,0,w,h);drawArt(c,'order-archive',0,0,w,h,'stretch');
  c.fillStyle='#18120C6B';c.fillRect(0,0,w,h);
  fieldPaper(c,15,top+66,w-30,h-top-bottom-88);
  for(const x of [25,w-25]){c.fillStyle='#58412B';c.beginPath();c.arc(x,top+74,3,0,Math.PI*2);c.fill();}
}

export function meritRuler(c:CanvasRenderingContext2D,x:number,y:number,w:number,progress:number):void{
  c.save();c.fillStyle='#5C4430';c.fillRect(x,y,w,11);c.fillStyle='#B29A6A';c.fillRect(x+1,y+1,w-2,8);
  c.strokeStyle='#4E3B28';c.lineWidth=1;
  for(let i=0;i<=30;i++){const xx=x+2+(w-4)*i/30;c.beginPath();c.moveTo(xx,y+1);c.lineTo(xx,y+(i%5===0?9:5));c.stroke();}
  const px=x+2+(w-4)*Math.max(0,Math.min(1,progress));
  c.fillStyle='#9B3527';c.beginPath();c.moveTo(px-4,y-6);c.lineTo(px+4,y-6);c.lineTo(px,y);c.closePath();c.fill();c.restore();
}
