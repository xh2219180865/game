import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

function browserResize(rect:{width:number;height:number;top:number;bottom:number},windowHeight:number,safeTop:string,safeBottom:string){
  const source=readFileSync(new URL('../src/platform/browser.ts',import.meta.url),'utf8'),start=source.indexOf('function resize('),end=source.indexOf('\nconst point=',start);assert.ok(start>=0&&end>start);
  const code=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'}).code;
  let cancels=0;const transforms:number[][]=[],canvas={width:0,height:0,getBoundingClientRect:()=>rect},view={viewport:{width:0,height:0,top:0,bottom:0},cancel(){cancels++;}},controls={style:{top:''}};
  const resize=new Function('canvas','ctx','window','view','getComputedStyle','controls',code+';return resize;')(canvas,{setTransform:(...values:number[])=>transforms.push(values)},{devicePixelRatio:4,innerHeight:windowHeight},view,()=>({getPropertyValue:(name:string)=>name==='--safe-area-top'?safeTop:name==='--safe-area-bottom'?safeBottom:''}),controls) as ()=>void;
  resize();return {canvas,view,controls,cancels,transforms};
}
test('U05: browser resize applies physical safe areas in CSS coordinates without multiplying them by pixel ratio',()=>{
  const h=browserResize({width:375,height:812,top:0,bottom:812},812,'44px','34px');
  assert.deepEqual(h.view.viewport,{width:375,height:812,top:44,bottom:34});assert.equal(h.canvas.width,1125);assert.equal(h.canvas.height,2436);assert.deepEqual(h.transforms,[[3,0,0,3,0,0]]);assert.equal(h.controls.style.top,'44px');assert.equal(h.cancels,1);
});
test('U05: a canvas already inset within the window does not add the physical safe area twice',()=>{
  const inset=browserResize({width:480,height:1000,top:100,bottom:1100},1200,'44px','34px');assert.deepEqual(inset.view.viewport,{width:480,height:1000,top:16,bottom:12});
  const overlap=browserResize({width:375,height:780,top:20,bottom:800},812,'44px','34px');assert.equal(overlap.view.viewport.top,24);assert.equal(overlap.view.viewport.bottom,22);
});
test('U05: unavailable browser safe-area values retain normal spacing and the HTML declares both environment insets',()=>{
  const h=browserResize({width:375,height:812,top:0,bottom:812},812,'','');assert.equal(h.view.viewport.top,16);assert.equal(h.view.viewport.bottom,12);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/--safe-area-top:env\(safe-area-inset-top,0px\)/);assert.match(html,/--safe-area-bottom:env\(safe-area-inset-bottom,0px\)/);
});

for(const platform of ['browser','wechat'])test(`U05: ${platform} frames stop before ticking an unusable viewport and do not repeat pending suspension`,()=>{
  const source=readFileSync(new URL(`../src/platform/${platform}.ts`,import.meta.url),'utf8'),start=source.indexOf('function frame('),end=source.lastIndexOf('\nresize();');assert.ok(start>=0&&end>start);
  const code=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'}).code;
  let clock=1000,suspensions=0,draws=0;const ticks:number[]=[];
  const view={viewportUsable:false,draw(){draws++;}},session={page:'battle',profile:{settings:{sound:false}},tick(delta:number){ticks.push(delta);},suspend(){suspensions++;session.page='pause';return Promise.resolve();}};
  const frame=new Function('document','view','session','audio','Date','accessibleControls','requestAnimationFrame',`let hidden=false,last=0,remainder=0,previousPage='battle';${code};return frame;`)({hidden:false},view,session,{stop(){},suspend(){}},{now:()=>clock},()=>{},()=>{}) as (now:number)=>void;
  for(let i=0;i<20;i++){clock=1000+i*100;frame(clock);}assert.deepEqual(ticks,[]);assert.equal(suspensions,1);assert.equal(draws,20);
  view.viewportUsable=true;clock+=16;frame(clock);assert.deepEqual(ticks,[16]);assert.equal(session.page,'pause','layout recovery never resumes the session');
});

test('P02 H15: pagehide stops active sound synchronously without another animation frame or visibility event',()=>{
  const source=readFileSync(new URL('../src/platform/browser.ts',import.meta.url),'utf8');
  const start=source.indexOf("window.addEventListener('pagehide'"),end=source.indexOf("window.addEventListener('storage'",start);
  assert.ok(start>=0&&end>start);
  const code=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'}).code;
  let handler:()=>void=()=>{throw new Error('pagehide listener missing');};const calls:string[]=[];
  new Function('window','view','audio','session',code)(
    {addEventListener(name:string,fn:()=>void){assert.equal(name,'pagehide');handler=fn;}},
    {cancel(){calls.push('cancel');}}, {suspend(){calls.push('audio-stop');}},
    {suspend(){calls.push('save-pause');return new Promise(()=>{});}},
  );
  handler();assert.deepEqual(calls,['cancel','audio-stop','save-pause']);
});
