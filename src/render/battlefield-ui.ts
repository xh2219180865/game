import { displayFont } from './typography.ts';
import { drawMobileIcon } from './mobile-icons.ts';

/** Keep the board and its input anchors fixed; tall screens lend unused lower ground to the orders. */
export function fieldOrderLift(height:number,top:number,bottom:number):number{
  return Math.max(0,Math.min(38,(height-top-bottom-540)*.2));
}

/** Ink, timber and cloth replace boxed dashboard controls. All text is live battle data. */
export function drawFieldHeader(c:CanvasRenderingContext2D,w:number,top:number,clock:string,standing:string,mapName:string,pressed:boolean):void{
  c.save();c.setLineDash([]);c.lineJoin='round';
  const shade=c.createLinearGradient(0,0,0,top+92);
  shade.addColorStop(0,'#181D1CD9');shade.addColorStop(.55,'#202721A0');shade.addColorStop(1,'#20272100');
  c.fillStyle=shade;c.fillRect(0,0,w,top+92);
  const y=top+8+(pressed?1:0);
  c.fillStyle='#251F18';c.beginPath();c.moveTo(18,y);c.lineTo(47,y-1);c.lineTo(50,y+30);c.lineTo(16,y+32);c.closePath();c.fill();
  c.strokeStyle='#A38A61';c.lineWidth=.8;c.stroke();
  drawMobileIcon(c,33,y+16,16,'pause','#E6D3AA');
  c.fillStyle='#EAE0C8';c.textAlign='center';c.textBaseline='middle';
  c.font='500 29px Georgia, "Songti SC", serif';c.fillText(clock,w/2,top+24);
  c.font=`400 11px ${displayFont()}`;c.fillStyle='#CCBFA2';c.fillText(mapName,w/2,top+48);
  c.textAlign='right';c.font=`400 12px ${displayFont()}`;c.fillText('战况',w-17,top+13);
  c.font='500 11px sans-serif';c.fillStyle='#F0E3C5';c.fillText(standing,w-17,top+32);
  c.restore();
}

/** A receding lower edge lets the suspended orders belong to the field, not an opaque toolbar. */
export function drawFieldOrderRack(c:CanvasRenderingContext2D,w:number,y:number,bottom:number):void{
  c.save();
  const shade=c.createLinearGradient(0,y-20,0,bottom);
  shade.addColorStop(0,'#171C1700');shade.addColorStop(.3,'#2223199C');shade.addColorStop(1,'#191B17F5');
  c.fillStyle=shade;c.fillRect(0,y-20,w,bottom-y+20);
  c.fillStyle='#33291B';c.fillRect(11,y+2,w-22,5);
  c.fillStyle='#A28B5D';c.fillRect(12,y+2,w-24,1);
  c.fillStyle='#13150F80';c.fillRect(14,y+7,w-28,2);
  c.restore();
}
