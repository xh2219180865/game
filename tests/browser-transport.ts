import { TransportTrial } from './transport-trial.ts';
const root=document.createElement('main');document.body.append(root);
root.innerHTML=`<h1>调兵方式对照 · 独立试验</h1><p>仅运输模型，不模拟生产、交战、真实旅时、奖励或存档。每段固定 4 秒、容量 50。此页不进入发布包。</p>
<div><label>出兵比例 <select id="ratio"><option value="50">50%</option><option value="80">80%（试验）</option></select></label>
<label>中转 <select id="auto"><option value="manual">到达后手动</option><option value="auto">预排半数／比例订单（试验）</option></select></label>
<label>中转原驻军 <select id="middle"><option>0</option><option>20</option><option>45</option></select></label><button id="reset">重置</button></div>
<p>手动：步营拖到骑营，到达后再从骑营拖到弓营。预排：从步营滑过骑营，再到弓营松手。按钮可执行同样订单。</p>
<canvas width="360" height="420" aria-label="运输试验画布"></canvas>
<div><button id="first">步营 → 骑营</button><button id="second">骑营 → 弓营</button><button id="step">推进 1 秒</button><button id="lost">切换中转归属</button></div>
<pre id="report" aria-live="polite"></pre>`;
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=root.querySelector('canvas')!,ctx=canvas.getContext('2d')!;
const points=[{x:70,y:340},{x:180,y:210},{x:290,y:80}],names=['步营','骑营','弓营'];
let trial=new TransportTrial(),gesture:{id:number;source:number;via:boolean;point:{x:number;y:number}}|null=null;
const hit=(p:{x:number;y:number})=>points.findIndex(q=>Math.hypot(q.x-p.x,q.y-p.y)<38);
function draw(){
  ctx.fillStyle='#e8ddc6';ctx.fillRect(0,0,360,420);ctx.strokeStyle='#8a7454';ctx.lineWidth=3;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  points.forEach((p,i)=>{ctx.fillStyle=i===1&&!trial.middleOwned?'#913d32':'#276f68';ctx.beginPath();ctx.arc(p.x,p.y,30,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.textAlign='center';ctx.font='18px system-ui';ctx.fillText(String(trial.counts[i]),p.x,p.y+6);ctx.fillStyle='#302c26';ctx.font='15px system-ui';ctx.fillText(names[i]!,p.x,p.y+50);});
  const a=trial.pending;if(a){const from=points[a.source]!,to=points[a.target]!,t=Math.min(1,(trial.clock-a.at+4)/4);ctx.fillStyle='#b77726';ctx.beginPath();ctx.arc(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,9,0,Math.PI*2);ctx.fill();}
  if(gesture){ctx.strokeStyle='#bc7030';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(points[gesture.source]!.x,points[gesture.source]!.y);if(gesture.via)ctx.lineTo(180,210);ctx.lineTo(gesture.point.x,gesture.point.y);ctx.stroke();ctx.setLineDash([]);}
  get('report').textContent=`${trial.ratio}% · ${trial.automatic?'预排':'手动'} · 时钟${trial.clock}秒 · 已确认${trial.commands}次操作 · 溢出${trial.overflow}兵\n${trial.log.join('\n')}`;
}
function reset(){trial=new TransportTrial(Number(get<HTMLSelectElement>('ratio').value) as 50|80,get<HTMLSelectElement>('auto').value==='auto',Number(get<HTMLSelectElement>('middle').value));gesture=null;draw();}
for(const id of ['ratio','auto','middle'])get(id).onchange=reset;
get('reset').onclick=reset;get('first').onclick=()=>{trial.order(0,1);draw();};get('second').onclick=()=>{trial.order(1,2);draw();};get('step').onclick=()=>{trial.step();draw();};get('lost').onclick=()=>{trial.middleOwned=!trial.middleOwned;draw();};
const point=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*360/r.width,y:(e.clientY-r.top)*420/r.height};};
canvas.onpointerdown=e=>{if(gesture)return;const p=point(e),source=hit(p);if(source<0||source>1)return;canvas.setPointerCapture(e.pointerId);gesture={id:e.pointerId,source,via:false,point:p};draw();};
canvas.onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;gesture.point=point(e);if(hit(gesture.point)===1)gesture.via=true;draw();};
canvas.onpointerup=e=>{if(!gesture||gesture.id!==e.pointerId)return;const target=hit(point(e));if(trial.automatic&&gesture.source===0){if(gesture.via&&target===2)trial.order(0,1);}else trial.order(gesture.source,target);gesture=null;draw();};
canvas.onpointercancel=()=>{gesture=null;draw();};
draw();
