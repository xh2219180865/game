/** Scene-only motion: mountain mist, two braziers and three leaves, beneath all home controls. */
export function drawHomeAtmosphere(ctx:CanvasRenderingContext2D,w:number,h:number,time:number,reduced:boolean):void{
  if(![w,h,time].every(Number.isFinite)||w<=0||h<=0)return;
  const t=reduced?0:Math.max(0,time),scale=Math.max(w/853,h/1844),ox=(w-853*scale)/2,oy=(h-1844*scale)/2;
  const haze=(x:number,y:number,rx:number,ry:number,color:string,opacity:number)=>{
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    const light=ctx.createRadialGradient(0,0,.12,0,0,1);light.addColorStop(0,color);light.addColorStop(.45,color);light.addColorStop(1,'#FFFFFF00');
    ctx.globalAlpha*=opacity;ctx.fillStyle=light;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
  };
  ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  // Broad, soft banks move across the mountain line rather than over the title or ground controls.
  for(const [i,x,y,rx,ry]of [[0,.21,.22,.32,.022],[1,.68,.27,.37,.026],[2,.35,.32,.27,.018]] as const){
    const drift=Math.sin(t/(6500+i*1900)+i*1.8)*w*.10;
    haze(x*w+drift,y*h,rx*w,ry*h,'#FDFBF0',.12+i*.015);
  }
  const warmth=.32+.13*Math.sin(t/1150)+.04*Math.sin(t/370);
  for(const x of [301,554]){
    const px=ox+x*scale,py=oy+847*scale;
    haze(px,py,32*scale,44*scale,'#FFD58B',warmth);
    haze(px,py,10*scale,15*scale,'#FFF2B4',.60+.16*Math.sin(t/1150));
  }
  // A few olive leaves cross the left foreground. Their full lifecycle fades at both ends.
  for(let i=0;i<3;i++){
    const phase=((t/14000+i/3)%1),sway=Math.sin(phase*Math.PI*3+i)*w*.035;
    const x=w*(.08+phase*.26)+sway,y=h*(.39+phase*.40),leafScale=Math.min(w/375,h/812);
    ctx.save();ctx.translate(x,y);ctx.rotate(-.6+Math.sin(phase*Math.PI*4+i)*.7);ctx.scale(leafScale,leafScale);
    ctx.globalAlpha*=.82*Math.sin(Math.PI*phase);ctx.fillStyle=i===1?'#A09951':'#657B47';
    ctx.beginPath();ctx.moveTo(-7,0);ctx.quadraticCurveTo(-1,-5,8,0);ctx.quadraticCurveTo(0,5,-7,0);ctx.fill();
    ctx.strokeStyle='#C0BA76';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-5,0);ctx.quadraticCurveTo(0,-.4,6,0);ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
