function shape(ctx:CanvasRenderingContext2D,color:string,points:readonly(readonly[number,number])[]):void{
  ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
}
function ellipse(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string):void{
  ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
}
function roof(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,rise:number):void{
  ctx.fillStyle='#334F52';ctx.strokeStyle='#2D4749';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(x-w*.56,y-4);ctx.quadraticCurveTo(x-w*.4,y+1,x-w*.2,y-rise);ctx.lineTo(x+w*.2,y-rise);ctx.quadraticCurveTo(x+w*.4,y+1,x+w*.56,y-4);ctx.lineTo(x+w*.53,y+5);ctx.quadraticCurveTo(x,y+11,x-w*.53,y+5);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#527778';ctx.beginPath();ctx.moveTo(x-w*.52,y-3);ctx.quadraticCurveTo(x-w*.36,y-1,x-w*.2,y-rise);ctx.lineTo(x+w*.2,y-rise);ctx.quadraticCurveTo(x+w*.36,y-1,x+w*.52,y-3);ctx.quadraticCurveTo(x,y+4,x-w*.52,y-3);ctx.fill();
  ctx.strokeStyle='#72918A';ctx.lineWidth=.8;
  for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(x+i*w*.046,y-rise+2);ctx.quadraticCurveTo(x+i*w*.075,y-rise*.3,x+i*w*.112,y+1);ctx.stroke();}
  ctx.strokeStyle='#A2ADA0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-w*.21,y-rise);ctx.lineTo(x+w*.21,y-rise);ctx.stroke();
  ctx.fillStyle='#385457';ctx.fillRect(x-w*.21-2,y-rise-3,3,4);ctx.fillRect(x+w*.21-1,y-rise-3,3,4);
}
function canopy(ctx:CanvasRenderingContext2D,x:number,y:number,s:number):void{
  ellipse(ctx,x+3,y+s*.6,s,s*.3,'#93A367');
  shape(ctx,'#766D46',[[x-2,y+s*.5],[x-1,y-s*.5],[x+3,y+s*.5]]);
  ellipse(ctx,x,y-s*.2,s*.77,s*.9,'#477347');ellipse(ctx,x-s*.35,y-s*.39,s*.68,s*.6,'#668D4F');
  ellipse(ctx,x+s*.3,y-s*.52,s*.61,s*.59,'#71974E');ellipse(ctx,x-s*.15,y-s*.77,s*.47,s*.33,'#92AF63');
}
function house(ctx:CanvasRenderingContext2D,x:number,y:number,w:number):void{
  ellipse(ctx,x+3,y+3,w*.65,5,'#929D71');
  shape(ctx,'#A49575',[[x-w*.42,y],[x-w*.42,y-19],[x+w*.4,y-19],[x+w*.4,y]]);
  ctx.fillStyle='#DCCDA9';ctx.fillRect(x-w*.42,y-18,w*.67,17);ctx.fillStyle='#92724F';ctx.fillRect(x-3,y-10,8,10);
  ctx.fillStyle='#7D7861';ctx.fillRect(x-w*.27,y-12,5,5);roof(ctx,x,y-19,w,12);
}
function wall(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  shape(ctx,'#727F76',[[x+w,y-6],[x+w+8,y-11],[x+w+8,y+h-5],[x+w,y+h]]);
  shape(ctx,'#A6AC95',[[x,y-6],[x+8,y-11],[x+w+8,y-11],[x+w,y-6]]);
  ctx.fillStyle='#8D9987';ctx.fillRect(x,y-6,w,h+6);
  ctx.strokeStyle='#718375';ctx.lineWidth=.7;
  for(let row=0;row<3;row++){
    const ry=y+row*(h/3);ctx.beginPath();ctx.moveTo(x,ry);ctx.lineTo(x+w,ry);
    for(let col=12+(row%2)*10;col<w;col+=21){ctx.moveTo(x+col,ry);ctx.lineTo(x+col,Math.min(y+h,ry+h/3));}ctx.stroke();
  }
  for(let bx=x;bx<x+w-5;bx+=13){ctx.fillStyle='#ADB29B';ctx.fillRect(bx,y-12,8,8);ctx.fillStyle='#7F8F7F';ctx.fillRect(bx+6,y-12,2,8);}
  ctx.fillStyle='#C1C1A5';ctx.fillRect(x,y-5,w,2);
}

/** Decorative city panorama. It has no battle state, interaction regions, labels or flags. */
export function drawHomeScene(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void{
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);
  ctx.fillStyle='#CED5A5';ctx.fillRect(0,0,w,h);
  // A low distant town and warm open sky establish depth without stealing the main gate's silhouette.
  shape(ctx,'#BCC89C',[[0,h*.17],[w*.2,h*.1],[w*.42,h*.16],[w*.65,h*.08],[w,h*.15],[w,h],[0,h]]);
  shape(ctx,'#B0C185',[[0,h*.46],[w*.24,h*.38],[w*.52,h*.48],[w*.8,h*.3],[w,h*.38],[w,h],[0,h]]);
  shape(ctx,'#C1CA8C',[[0,h*.72],[w*.24,h*.62],[w*.64,h*.65],[w,h*.58],[w,h],[0,h]]);
  const s=Math.min(w/352,h/158),base=h*.86;
  // The common scene uses uniform scale: short viewports show smaller buildings, never squashed roofs.
  ctx.save();ctx.translate(w/2,base);ctx.scale(s,s);
  for(const [hx,hy,hw]of [[-131,-68,34],[-80,-79,38],[73,-79,34],[132,-71,40]]as const){
    ctx.fillStyle='#A3AE8E';ctx.fillRect(hx-hw*.4,hy-8,hw*.8,18);
    shape(ctx,'#91A289',[[hx-hw*.58,hy-8],[hx-hw*.23,hy-20],[hx+hw*.23,hy-20],[hx+hw*.58,hy-8]]);
  }
  ellipse(ctx,3,-9,155,39,'#A8B078');
  shape(ctx,'#C2BD8B',[[-144,-30],[-100,-65],[102,-65],[150,-25],[117,24],[-116,24]]);
  shape(ctx,'#D7CAA0',[[-115,-29],[-88,-53],[94,-53],[122,-22],[97,13],[-91,13]]);
  // Side gardens sit behind the stone curtain; the foreground remains an open court.
  canopy(ctx,-130,-48,18);canopy(ctx,138,-43,20);canopy(ctx,-103,-69,13);canopy(ctx,109,-70,13);
  house(ctx,-92,-30,47);house(ctx,95,-30,45);house(ctx,-141,-7,31);house(ctx,147,-6,29);
  wall(ctx,-128,-6,55,24);wall(ctx,73,-6,55,24);
  // Main gate: thick stone foundation, an inset arch, and two tiers of painted timber galleries.
  ellipse(ctx,5,11,84,18,'#89946E');
  wall(ctx,-74,-11,148,35);
  shape(ctx,'#BAC0A6',[[-62,-20],[-48,-28],[58,-28],[73,-20],[60,-14],[-60,-14]]);
  ctx.fillStyle='#657469';ctx.beginPath();ctx.moveTo(-19,24);ctx.lineTo(-19,3);ctx.quadraticCurveTo(0,-20,19,3);ctx.lineTo(19,24);ctx.closePath();ctx.fill();
  ctx.fillStyle='#293F3B';ctx.beginPath();ctx.moveTo(-14,24);ctx.lineTo(-14,5);ctx.quadraticCurveTo(0,-11,14,5);ctx.lineTo(14,24);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8E4F38';ctx.fillRect(-13,5,12,19);ctx.fillStyle='#703F30';ctx.fillRect(1,5,12,19);
  ctx.fillStyle='#C79A57';for(const gy of [10,16,21])for(const gx of [-9,-4,5,10])ctx.fillRect(gx,gy,1.3,1.3);
  ctx.fillStyle='#D4C5A1';ctx.fillRect(-21,24,42,3);ctx.fillStyle='#A9A98B';ctx.fillRect(-27,27,54,3);
  ctx.fillStyle='#754534';ctx.fillRect(-47,-65,94,44);ctx.fillStyle='#B16C49';ctx.fillRect(-47,-65,76,44);
  ctx.fillStyle='#E3C899';ctx.fillRect(-41,-60,79,27);
  for(const px of [-36,-18,0,18,36]){ctx.fillStyle='#5A5644';ctx.fillRect(px-5,-56,10,21);ctx.strokeStyle='#BBAE83';ctx.lineWidth=.7;ctx.strokeRect(px-5,-56,10,21);ctx.beginPath();ctx.moveTo(px,-56);ctx.lineTo(px,-35);ctx.moveTo(px-5,-47);ctx.lineTo(px+5,-47);ctx.stroke();}
  ctx.fillStyle='#A2583E';for(const px of [-44,-25,25,43])ctx.fillRect(px,-62,3,38);
  ctx.fillStyle='#D5B078';ctx.fillRect(-50,-31,100,3);ctx.fillStyle='#744D36';ctx.fillRect(-50,-27,100,4);
  // Balcony railing and brackets give the lower eave a readable architectural rhythm.
  ctx.strokeStyle='#B77850';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-51,-34);ctx.lineTo(51,-34);ctx.moveTo(-51,-24);ctx.lineTo(51,-24);for(let px=-49;px<=49;px+=14){ctx.moveTo(px,-36);ctx.lineTo(px,-24);}ctx.stroke();
  roof(ctx,0,-64,121,23);
  ctx.fillStyle='#804B36';ctx.fillRect(-31,-95,62,27);ctx.fillStyle='#C38A59';ctx.fillRect(-29,-93,48,23);
  ctx.fillStyle='#E3C79A';ctx.fillRect(-24,-92,48,18);ctx.fillStyle='#585847';for(const px of [-18,-3,12])ctx.fillRect(px,-88,9,12);
  ctx.fillStyle='#9F5B3C';for(const px of [-29,-11,9,26])ctx.fillRect(px,-94,3,25);
  ctx.fillStyle='#D3AD73';ctx.fillRect(-35,-72,70,3);roof(ctx,0,-97,86,21);
  // Stone court stones lead the eye to the gate, while garden clusters frame both bottom corners.
  shape(ctx,'#D6C9A1',[[-27,30],[27,30],[43,45],[-43,45]]);
  ctx.strokeStyle='#BFB893';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-32,35);ctx.lineTo(32,35);ctx.moveTo(-38,41);ctx.lineTo(38,41);ctx.moveTo(0,30);ctx.lineTo(0,45);ctx.stroke();
  canopy(ctx,-156,11,18);canopy(ctx,162,17,21);canopy(ctx,-127,29,12);canopy(ctx,133,34,11);
  ctx.restore();
  // Soft foreground turf anchors the scene against the page's surrounding frame.
  shape(ctx,'#A7BA78',[[0,h*.89],[w*.13,h*.85],[w*.27,h],[0,h]]);
  shape(ctx,'#9FB373',[[w,h*.84],[w*.86,h*.9],[w*.76,h],[w,h]]);
  ctx.restore();
}
