import { drawMobileIcon, type MobileIcon } from './mobile-icons.ts';

/** A slim bronze rim around a dark patinated face; the caller owns the touch target. */
export function drawGameControl(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,icon:MobileIcon,pressed=false):void{
  if(![x,y,size,x+size,y+size].every(Number.isFinite)||size<=0)return;
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  ctx.setLineDash([]);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const dy=pressed?.025:0;
  const circle=(cy:number,r:number,color:string):void=>{
    ctx.beginPath();ctx.arc(.5,cy,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  };
  circle(.525,.45,'#51483A');
  circle(.49+dy,.449,'#AA8C60');
  circle(.49+dy,.415,'#5A5040');
  const face=ctx.createLinearGradient(0,.08,0,.90);
  face.addColorStop(0,pressed?'#514D40':'#756C55');face.addColorStop(1,pressed?'#48463B':'#504C40');
  ctx.beginPath();ctx.arc(.5,.49+dy,.386,0,Math.PI*2);ctx.fillStyle=face;ctx.fill();
  ctx.beginPath();ctx.arc(.5,.49+dy,.425,Math.PI*1.12,Math.PI*1.87);
  ctx.strokeStyle=pressed?'#9E875F':'#D9BF8C';ctx.lineWidth=.018;ctx.stroke();
  ctx.beginPath();ctx.arc(.5,.49+dy,.383,Math.PI*.08,Math.PI*.87);
  ctx.strokeStyle='#383C34';ctx.lineWidth=.016;ctx.stroke();
  drawMobileIcon(ctx,.5,.49+dy,.52,icon,pressed?'#E1DFC4':'#FFF4D7');
  ctx.restore();
}

export type HomeEntryKind='lessons'|'cards'|'leaderboard'|'map'|'rank';
type Point=readonly [number,number];

/** Centered equipment vignette; the caller owns its label and touch target. */
export function drawHomeEntryIcon(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,kind:HomeEntryKind,pressed=false):void{
  if(![x,y,size,x-size/2,x+size/2,y-size/2,y+size/2].every(Number.isFinite)||size<=0||!['lessons','cards','leaderboard','map','rank'].includes(kind))return;
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);
  ctx.setLineDash([]);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const wood='#65503B',bronze=pressed?'#9E8057':'#BC9B68',ivory='#E7D6AC',ink='#444C47',jade='#607764',red='#A55440';
  const path=(points:readonly Point[],color:string,filled=false,width=.025):void=>{
    ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));
    if(filled){ctx.closePath();ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  };
  const circle=(cx:number,cy:number,r:number,color:string,filled=true,width=.025):void=>{
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=width;if(filled)ctx.fill();else ctx.stroke();
  };
  if(pressed){ctx.translate(0,.02);ctx.scale(.96,.96);}
  switch(kind){
    case 'lessons':
      path([[-.23,.20],[-.32,.42],[-.24,.42],[-.14,.19]],wood,true);
      path([[.02,.20],[.09,.42],[.17,.42],[.11,.16]],wood,true);
      circle(-.09,-.03,.30,wood);circle(-.09,-.03,.265,bronze);circle(-.09,-.03,.225,ivory);
      circle(-.09,-.03,.16,red);circle(-.09,-.03,.105,ivory);circle(-.09,-.03,.045,red);
      for(const [px,py] of [[-.09,-.30],[-.36,-.03],[-.09,.24],[.18,-.03]])circle(px!,py!,.018,ink);
      path([[.06,.41],[.31,-.28]],wood,false,.05);
      path([[.26,-.27],[.38,-.43],[.35,-.22]],ink,true);
      path([[.28,-.27],[.38,-.43],[.32,-.23]],'#A7B2AB',true);break;
    case 'cards':
      path([[-.31,-.12],[.30,-.27],[.40,.15],[-.23,.32]],wood,true);
      for(let i=0;i<6;i++){
        const px=-.28+i*.105;
        path([[px,-.105-i*.025],[px+.073,-.124-i*.025],[px+.16,.17-i*.025],[px+.08,.193-i*.025]],i%2?bronze:'#C4A373',true);
      }
      circle(-.25,.13,.165,wood);circle(-.25,.13,.124,bronze);
      circle(-.25,.13,.078,wood,false,.022);circle(-.25,.13,.032,wood,false,.018);
      path([[.075,-.23],[.18,.21]],jade,false,.045);
      circle(.17,.13,.075,ink);circle(.17,.13,.053,jade);circle(.17,.13,.016,ivory);
      path([[.175,.20],[.20,.39],[.15,.37],[.155,.24]],jade,false,.025);break;
    case 'leaderboard':
      path([[-.29,.33],[-.29,-.30],[.28,-.30],[.28,.33]],wood,true);
      path([[-.22,.28],[-.22,-.22],[.21,-.22],[.21,.28]],bronze,true);
      path([[-.185,.245],[-.185,-.185],[.175,-.185],[.175,.245]],'#655540',true);
      for(const py of [-.31,.33]){
        path([[-.34,py-.037],[.33,py-.037],[.35,py+.036],[-.36,py+.036]],wood,true);
        path([[-.31,py-.022],[.30,py-.022]],bronze,false,.025);
      }
      path([[-.13,.085],[0,-.095],[.13,.085],[0,.20],[-.13,.085]],bronze,false,.035);
      path([[-.08,.045],[0,-.025],[.075,.045]],ivory,false,.025);
      circle(0,.11,.028,bronze);break;
    case 'map':
      path([[-.43,-.27],[-.15,-.34],[.14,-.26],[.42,-.33],[.42,.28],[.15,.35],[-.14,.27],[-.43,.35]],wood,true);
      path([[-.405,-.245],[-.15,-.307],[.135,-.237],[.395,-.297],[.395,.255],[.15,.315],[-.14,.237],[-.405,.313]],ivory,true);
      path([[-.15,-.30],[-.14,.23],[.15,.315],[.135,-.237]],'#CDBB93',true);
      path([[-.35,.06],[-.23,-.13],[-.08,.09],[.035,-.05],[.18,.09]],jade,false,.047);
      path([[-.36,.22],[-.17,.06],[.0,.21],[.28,.02],[.35,.11]],'#A18E68',false,.027);
      circle(.21,-.05,.036,red);path([[.21,-.05],[.21,-.37]],wood,false,.025);
      path([[.21,-.37],[.37,-.32],[.21,-.27]],red,true);break;
    case 'rank':
      path([[-.06,.22],[.0,.43],[.08,.22]],jade,true);
      circle(0,-.055,.31,wood);circle(0,-.055,.28,bronze);circle(0,-.055,.235,jade);
      path([[0,-.25],[.17,-.055],[0,.15],[-.17,-.055]],bronze,true);
      path([[-.13,.025],[-.13,-.075],[-.08,-.075],[-.08,-.025],[-.035,-.025],[-.035,-.125],[.035,-.125],[.035,-.025],[.08,-.025],[.08,-.075],[.13,-.075],[.13,.025]],wood,true);
      path([[-.04,.27],[0,.34],[.04,.27]],bronze,false,.022);break;
  }
  ctx.restore();
}
