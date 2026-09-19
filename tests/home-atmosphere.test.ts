import test from 'node:test';
import assert from 'node:assert/strict';
import {drawHomeAtmosphere} from '../src/render/home-atmosphere.ts';
import {GameView} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';
import {freshProfile} from '../src/core/progress.ts';

function trace(){
  const initial:Record<string,unknown>={globalAlpha:.8,fillStyle:'#123',strokeStyle:'#456',lineWidth:2,shadowBlur:4,shadowOffsetX:2,shadowOffsetY:3};
  let state={...initial};const stack:Record<string,unknown>[]=[],calls:{op:string;args:unknown[]}[]=[],labels:string[]=[];
  const ctx=new Proxy({}, {get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
    calls.push({op:String(key),args});for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),'finite Canvas arguments');
    if(key==='save')stack.push({...state});else if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
    else if(key==='measureText')return {width:[...String(args[0])].length*8};
    else if(key==='fillText')labels.push(String(args[0]));
    else if(key==='createLinearGradient'||key==='createRadialGradient')return {addColorStop:(...stops:unknown[])=>calls.push({op:'colorStop',args:stops})};
  };},set(_target,key,value){state[String(key)]=value;calls.push({op:String(key),args:[typeof value==='object'&&value!==null?'gradient':value]});return true;}}) as CanvasRenderingContext2D;
  return {ctx,calls,labels,balanced:()=>{assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
function scene(w:number,h:number,time:number,reduced=false){const d=trace();drawHomeAtmosphere(d.ctx,w,h,time,reduced);d.balanced();return d.calls;}

for(const [w,h]of [[320,568],[375,812],[430,932]])test(`home atmosphere ${w}: visible cloud motion stays clipped to the viewport and restores Canvas state`,()=>{
  const first=scene(w!,h!,0),later=scene(w!,h!,4000);
  assert.notDeepEqual(first,later);const a=first.filter(c=>c.op==='translate'),b=later.filter(c=>c.op==='translate');
  assert.ok(Math.abs(Number(a[0]!.args[0])-Number(b[0]!.args[0]))>w!*.04,'the broad cloud bank visibly travels at least four percent of the viewport width');
  for(const calls of [first,later]){
    assert.deepEqual(calls.find(c=>c.op==='rect')!.args,[0,0,w,h]);assert.ok(calls.findIndex(c=>c.op==='clip')<calls.findIndex(c=>c.op==='fill'));
    assert.equal(calls.filter(c=>c.op==='quadraticCurveTo').length,9,'only three shaped foreground leaves');
    assert.equal(calls.filter(c=>c.op==='fillText'||c.op==='drawImage').length,0,'decoration cannot paint labels or replace artwork');
  }
});

test('home atmosphere: reduced motion is identical across time, with a stable lit scene instead of flicker',()=>{
  assert.deepEqual(scene(375,812,0,true),scene(375,812,98233,true));
  assert.ok(scene(375,812,0,true).filter(c=>c.op==='fill').length>=7);
});
test('home atmosphere: invalid dimensions and clocks perform no drawing',()=>{
  for(const [w,h,t]of [[0,812,0],[-1,812,0],[375,0,0],[NaN,812,0],[375,Infinity,0],[375,812,NaN]])assert.deepEqual(scene(w!,h!,t!),[]);
});

function home(){
  const d=trace();let writes=0,previews=0;const now=Date.parse('2026-09-13T12:00:00+08:00');
  const s=new GameSession({storage:{async read(){return null;},async write(){writes++;},async remove(){writes++;}},now:()=>now,random:()=>.3,notify:()=>{},events:()=>{}});
  s.profile=freshProfile(now,'home-atmosphere');s.page='home';const v=new GameView(d.ctx,s);v.soundPreview=()=>{previews++;};
  return {s,v,d,writes:()=>writes,previews:()=>previews};
}
test('animated home preserves every click region, authoritative profile and storage across frames',()=>{
  const h=home(),profile=JSON.stringify(h.s.profile);h.v.draw(0);h.v.draw(500);
  const regions=h.v.regions.map(({run,...region})=>region);h.v.draw(6000);
  assert.deepEqual(h.v.regions.map(({run,...region})=>region),regions);assert.equal(JSON.stringify(h.s.profile),profile);assert.equal(h.writes(),0);
});
for(const width of [320,375,430])test(`sound preview ${width}: one tap auditions without toggling or saving and is unavailable when sound is off`,()=>{
  const h=home();h.v.viewport={width,height:812,top:48,bottom:12};h.s.page='settings';h.s.profile!.settings.sound=true;h.v.draw(0);
  const r=h.v.regions.find(r=>r.id==='test-sound')!;assert.ok(r);assert.ok(r.w>=44&&r.h>=44);assert.ok(r.x+r.w<=width-82,'preview stays left of the sound switch');
  const before=JSON.stringify(h.s.profile);h.v.down(1,r.x+r.w/2,r.y+r.h/2);h.v.up(1,r.x+r.w/2,r.y+r.h/2);
  assert.equal(h.previews(),1);assert.equal(JSON.stringify(h.s.profile),before);assert.equal(h.writes(),0);
  h.s.profile!.settings.sound=false;h.v.draw(1);assert.ok(!h.v.regions.some(region=>region.id==='test-sound'));r.run();assert.equal(h.previews(),1,'a stale preview cannot play after sound is disabled');
  h.s.profile!.settings.sound=true;h.v.soundPreview=null;h.v.draw(2);assert.ok(!h.v.regions.some(region=>region.id==='test-sound'));
});
