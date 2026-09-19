export type MobileIcon='settings'|'lessons'|'cards'|'leaderboard'|'rank'|'close'|'back'|'info'|'upgrade'|'home'|'replay'|'play'|'pause'|'chevron';
type Point=readonly [number,number];

/** Centered glyph only: the caller owns its button background, label and hit area. */
export function drawMobileIcon(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,icon:MobileIcon,color='#286C5C'):void{
  if(![x,y,size,x-size/2,x+size/2,y-size/2,y+size/2].every(Number.isFinite)||size<=0)return;
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.085;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.setLineDash([]);ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const line=(points:readonly Point[],closed=false,filled=false):void=>{
    ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
    if(closed)ctx.closePath();if(filled)ctx.fill();else ctx.stroke();
  };
  const circle=(px:number,py:number,r:number,filled=false):void=>{
    ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);if(filled)ctx.fill();else ctx.stroke();
  };
  switch(icon){
    case 'settings':{
      const teeth:Point[]=[];
      for(let i=0;i<32;i++){
        const angle=(i-.5)*Math.PI/16,r=i%4<2?.385:.30;
        teeth.push([Math.cos(angle)*r,Math.sin(angle)*r]);
      }
      line(teeth,true);circle(0,0,.125);break;
    }
    case 'lessons':
      line([[-.29,.38],[-.29,-.37],[.32,-.28],[.23,-.05],[-.29,-.13]],false);
      line([[-.39,.38],[-.16,.38]]);line([[-.06,-.24],[.065,-.16],[.13,-.25]]);break;
    case 'cards':
      line([[-.22,.28],[-.35,.23],[-.25,-.38],[.15,-.31]]);
      line([[-.16,-.25],[.32,-.25],[.32,.38],[-.16,.38]],true);
      line([[.08,-.09],[.19,.065],[.08,.22],[-.03,.065]],true);break;
    case 'leaderboard':
      line([[-.38,.36],[-.38,.04],[-.13,.04],[-.13,.36]]);
      line([[-.13,.36],[-.13,-.24],[.13,-.24],[.13,.36]]);
      line([[.13,.36],[.13,.16],[.38,.16],[.38,.36]]);
      line([[-.38,.36],[.38,.36]]);circle(0,-.375,.045,true);break;
    case 'rank':
      line([[-.3,-.37],[.3,-.37],[.3,.16],[0,.39],[-.3,.16]],true);
      line([[-.15,-.06],[0,-.19],[.15,-.06]]);line([[-.15,.12],[0,-.01],[.15,.12]]);break;
    case 'close':
      line([[-.29,-.29],[.29,.29]]);line([[.29,-.29],[-.29,.29]]);break;
    case 'back':
      line([[-.36,0],[-.045,-.32],[.055,-.22],[-.11,-.075],[.35,-.075],[.35,.075],[-.11,.075],[.055,.22],[-.045,.32]],true,true);break;
    case 'info':
      circle(0,0,.37);circle(0,-.17,.045,true);line([[0,-.015],[0,.20]]);break;
    case 'upgrade':
      line([[-.26,-.03],[0,-.29],[.26,-.03]]);line([[0,-.27],[0,.26]]);
      line([[-.27,.21],[-.27,.37],[.27,.37],[.27,.21]]);break;
    case 'home':
      line([[-.38,-.10],[0,-.38],[.38,-.10]]);line([[-.28,-.10],[-.28,.35],[.28,.35],[.28,-.10]]);
      line([[-.09,.35],[-.09,.08],[.09,.08],[.09,.35]]);break;
    case 'replay':
      ctx.beginPath();ctx.arc(0,0,.31,-Math.PI*.76,Math.PI*.86);ctx.stroke();
      line([[-.25,-.37],[-.23,-.12],[-.01,-.23]]);break;
    case 'play':
      line([[-.22,-.35],[.36,0],[-.22,.35]],true,true);break;
    case 'pause':
      line([[-.25,-.33],[-.10,-.33],[-.10,.33],[-.25,.33]],true,true);
      line([[.10,-.33],[.25,-.33],[.25,.33],[.10,.33]],true,true);break;
    case 'chevron':
      line([[-.13,-.27],[.15,0],[-.13,.27]]);break;
  }
  ctx.restore();
}
