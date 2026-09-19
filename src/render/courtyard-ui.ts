type PanelKind='panel'|'tile';

function validRect(x:number,y:number,w:number,h:number):boolean{
  return [x,y,w,h,x+w,y+h].every(Number.isFinite)&&w>0&&h>0;
}

function begin(ctx:CanvasRenderingContext2D,x:number,y:number):void{
  ctx.save();ctx.translate(x,y);ctx.setLineDash([]);
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.lineJoin='miter';ctx.lineCap='butt';
}

function line(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color:string,width:number):void{
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}

/** Quiet timber framing and woven silk; the caller owns content and hit regions. */
export function drawCourtyardPanel(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,kind:PanelKind='panel',muted=false):void{
  if(!validRect(x,y,w,h)||!['panel','tile'].includes(kind))return;
  begin(ctx,x,y);
  const unit=Math.min(1,w/40,h/40),frame=(kind==='panel'?5:2)*unit;
  const wood=muted?'#696B65':'#514B3E',edge=muted?'#92928A':'#9E8762',bronze=muted?'#A7A79C':'#B6A079';
  ctx.fillStyle=wood;ctx.fillRect(0,0,w,h);
  const silk=ctx.createLinearGradient(0,frame,0,h-frame);
  silk.addColorStop(0,muted?'#DADAD1':'#E8E0CB');silk.addColorStop(.3,muted?'#E5E5DC':'#F0EAD9');silk.addColorStop(1,muted?'#D6D6CD':'#DED3BA');
  ctx.fillStyle=silk;ctx.fillRect(frame,frame,w-frame*2,h-frame*2);
  // Sparse fixed threads remain subtle and never scale drawing work with area.
  for(let i=1;i<=9;i++){
    const yy=frame+(h-frame*2)*i/10;
    line(ctx,frame+unit,yy,w-frame-unit,yy,muted?'#777A7209':'#79674C0B',.5*unit);
  }
  for(let i=1;i<=5;i++){
    const xx=frame+(w-frame*2)*i/6;
    line(ctx,xx,frame+unit,xx,h-frame-unit,muted?'#FFFFFF15':'#FFFAE918',.5*unit);
  }
  if(kind==='panel'){
    for(const yy of [2*unit,h-2*unit]){
      line(ctx,7*unit,yy,w-7*unit,yy,edge,.6*unit);
      line(ctx,w*.17,yy+.9*unit,w*.39,yy+.9*unit,'#272C273D',.45*unit);
      line(ctx,w*.57,yy-.7*unit,w*.81,yy-.7*unit,'#D7BD8E24',.45*unit);
    }
    // Folded bronze corner straps sit wholly inside the frame.
    const strap=10*unit,thickness=1.5*unit;
    ctx.fillStyle=bronze;
    for(const xx of [unit,w-unit-strap])for(const yy of [unit,h-unit-strap]){
      const right=xx>unit,bottom=yy>unit;
      ctx.fillRect(xx,bottom?yy+strap-thickness:yy,strap,thickness);
      ctx.fillRect(right?xx+strap-thickness:xx,yy,thickness,strap);
      ctx.fillStyle=wood;ctx.fillRect(right?xx+strap-2.5*unit:xx+1.5*unit,bottom?yy+strap-2.5*unit:yy+1.5*unit,unit,unit);ctx.fillStyle=bronze;
    }
    line(ctx,frame,frame,w-frame,frame,muted?'#A5A69C':'#B1A17E',unit);
    line(ctx,frame,h-frame,w-frame,h-frame,'#625B493B',unit);
  }else{
    line(ctx,frame,frame,w-frame,frame,edge,.7*unit);
    line(ctx,frame,h-frame,w-frame,h-frame,muted?'#777970':'#817053',.7*unit);
  }
  ctx.restore();
}

/** Small dark wooden plaque intended for caller-drawn ivory headings. */
export function drawCourtyardHeading(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  if(!validRect(x,y,w,h))return;
  begin(ctx,x,y);
  const unit=Math.min(1,w/40,h/20);
  ctx.fillStyle='#393C33';ctx.fillRect(0,0,w,h);
  const wood=ctx.createLinearGradient(0,0,0,h);
  wood.addColorStop(0,'#655C48');wood.addColorStop(.4,'#514B3D');wood.addColorStop(1,'#45473A');
  ctx.fillStyle=wood;ctx.fillRect(unit,unit,w-2*unit,h-2*unit);
  line(ctx,4*unit,2*unit,w-4*unit,2*unit,'#B59C70',unit);
  line(ctx,4*unit,h-2*unit,w-4*unit,h-2*unit,'#837454',unit);
  for(const yy of [h*.22,h*.78])line(ctx,w*.12,yy,w*.88,yy,'#D6C09212',.6*unit);
  ctx.fillStyle='#B69D72';
  for(const xx of [3*unit,w-5*unit])ctx.fillRect(xx,h/2-unit,2*unit,2*unit);
  ctx.restore();
}

/** A copper slider on a wooden rail; labels and the 44 px touch area are external. */
export function drawCourtyardSwitch(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,enabled:boolean):void{
  if(!validRect(x,y,w,h))return;
  begin(ctx,x,y);
  const unit=Math.min(1,w/36,h/20),inset=2*unit,knob=Math.min(h-4*unit,w*.45),kx=enabled?w-inset-knob:inset,ky=(h-knob)/2;
  ctx.fillStyle='#504B3D';ctx.fillRect(0,h*.22,w,h*.56);
  ctx.fillStyle=enabled?'#60755D':'#787769';ctx.fillRect(unit,h*.22+unit,w-2*unit,h*.56-2*unit);
  line(ctx,3*unit,h*.24,w-3*unit,h*.24,'#A18B63',.8*unit);
  line(ctx,3*unit,h*.74,w-3*unit,h*.74,'#353C33',unit);
  ctx.fillStyle='#4D4A3C';ctx.fillRect(kx,ky,knob,knob);
  const bronze=ctx.createLinearGradient(kx,ky,kx,ky+knob);
  bronze.addColorStop(0,enabled?'#D7BE8C':'#B9AE92');bronze.addColorStop(1,enabled?'#9E8054':'#8E826A');
  ctx.fillStyle=bronze;ctx.fillRect(kx+unit,ky+unit,knob-2*unit,knob-2*unit);
  ctx.fillStyle=enabled?'#425E48':'#5E6056';
  ctx.fillRect(kx+knob*.35,ky+knob*.35,knob*.3,knob*.3);
  ctx.restore();
}
