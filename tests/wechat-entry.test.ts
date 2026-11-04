import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { buildSync } from 'esbuild';
import type { GameSession } from '../src/app/session.ts';
import type { GameView } from '../src/render/game.ts';
import type { GameAudio } from '../src/platform/audio.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { ART_SOURCES } from '../src/render/assets.ts';

const ART_PATHS=Object.values(ART_SOURCES),ART_COUNT=ART_PATHS.length;

// The complete production entry and dependencies run in a VM without DOM globals.
// Test-only exports expose state; storage, rendering and native audio are contract doubles.
const source=readFileSync(new URL('../src/platform/wechat.ts',import.meta.url),'utf8');
const bundle=buildSync({stdin:{contents:source+'\nexport {session,view,audio,getArtStatus};',resolveDir:fileURLToPath(new URL('../src/platform/',import.meta.url)),loader:'ts'},bundle:true,format:'iife',globalName:'WechatEntryProbe',target:'es2022',write:false}).outputFiles[0]!.text;
type AudioMode='available'|'missing'|'create-failure'|'start-failure'|'suspend-rejection';
type WindowProbe={width:number;height:number;safeTop:number;safeBottom:number;menu:'missing'|(()=>unknown)};
async function idle(s:GameSession){for(let i=0;i<100;i++){await new Promise(resolve=>setImmediate(resolve));if(!s.busy)return;}assert.equal(s.busy,0);}

async function harness(mode:AudioMode='available',artMode:'success'|'failure'|'pending'='success',windowOptions:Partial<WindowProbe>={}){
  const geometry:WindowProbe={width:375,height:812,safeTop:44,safeBottom:778,menu:()=>({bottom:60}),...windowOptions};
  let now=Date.parse('2026-09-12T12:00:00+08:00'),writes=0,failWrites=false,creates=0,resumes=0,suspends=0,holdWrite=false,vibrations=0,pendingWrite:(()=>void)|null=null;
  const frames:(()=>void)[]=[],listeners:Record<string,(e?:unknown)=>void>={},data=new Map<string,string>(),texts:string[]=[],oscillators:{disconnected:boolean;started:boolean;onended:(()=>void)|null}[]=[];
  const context=new Proxy({measureText:(text:string)=>({width:[...text].length*8}),fillText:(text:string)=>texts.push(String(text)),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>{}});
  const canvas={width:0,height:0,getContext:(kind:string)=>{assert.equal(kind,'2d');return context;}};
  const params=()=>({setValueAtTime(){},exponentialRampToValueAtTime(){}});
  const sound={state:'running',currentTime:0,destination:{connect(){},disconnect(){}},
    async resume(){resumes++;sound.state='running';},
    async suspend(){suspends++;if(mode==='suspend-rejection')throw new Error('native suspension failed');sound.state='suspended';},
    createGain:()=>({gain:params(),connect(){},disconnect(){}}),
    createOscillator(){const osc={type:'sine',frequency:params(),disconnected:false,started:false,onended:null as (()=>void)|null,
      start(){if(mode==='start-failure')throw new Error('native start failed');osc.started=true;},stop(){},connect(){},disconnect(){osc.disconnected=true;}};oscillators.push(osc);return osc;},
  };
  const imagePaths:string[]=[],pendingImages:{onload:(()=>void)|null;onerror:(()=>void)|null}[]=[];
  const wx={createCanvas:()=>canvas,createImage(){
    const image={width:800,height:600,onload:null as (()=>void)|null,onerror:null as (()=>void)|null,
      set src(path:string){imagePaths.push(path);if(artMode==='pending')pendingImages.push(image);else if(artMode==='failure')image.onerror?.();else image.onload?.();},
    };return image;
  },getWindowInfo:()=>({windowWidth:geometry.width,windowHeight:geometry.height,pixelRatio:2,safeArea:{top:geometry.safeTop,bottom:geometry.safeBottom}}),getMenuButtonBoundingClientRect:geometry.menu==='missing'?undefined:()=>geometry.menu==='missing'?undefined:geometry.menu(),
    getStorageSync:(key:string)=>data.get(key)??'',
    setStorage({key,data:value,success,fail}:{key:string;data:string;success:()=>void;fail:(e:Error)=>void}){writes++;if(failWrites)fail(new Error('storage full'));else if(holdWrite){holdWrite=false;pendingWrite=()=>{data.set(key,value);success();};}else{data.set(key,value);success();}},
    removeStorage({key,success}:{key:string;success:()=>void}){data.delete(key);success();},
    onTouchStart:(fn:(e?:unknown)=>void)=>{listeners.start=fn;},onTouchMove:(fn:(e?:unknown)=>void)=>{listeners.move=fn;},onTouchEnd:(fn:(e?:unknown)=>void)=>{listeners.end=fn;},onTouchCancel:(fn:(e?:unknown)=>void)=>{listeners.cancel=fn;},
    onHide:(fn:()=>void)=>{listeners.hide=fn;},onShow:(fn:()=>void)=>{listeners.show=fn;},onWindowResize:(fn:()=>void)=>{listeners.resize=fn;},vibrateShort(){vibrations++;},
    ...(mode==='missing'?{}:{createWebAudioContext(){creates++;if(mode==='create-failure')throw new Error('audio unavailable');return sound;}}),
  };
  class Clock extends Date{static override now(){return now;}}
  const vm=createContext({wx,Date:Clock,setTimeout,clearTimeout,requestAnimationFrame:(fn:()=>void)=>{frames.push(fn);}});
  runInContext(bundle,vm);const {session:s,view:v,audio}=vm.WechatEntryProbe as {session:GameSession;view:GameView;audio:GameAudio};await idle(s);
  const frame=(delta=16)=>{now+=delta;sound.currentTime+=delta/1000;const fn=frames.shift();assert.ok(fn,'entry schedules next animation frame');fn();};
  const touch=(kind:'start'|'move'|'end'|'cancel',x:number,y:number)=>listeners[kind]!({changedTouches:[{identifier:1,clientX:x,clientY:y}]});
  const tap=async(id:string)=>{frame();const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id}`);touch('start',r.x+r.w/2,r.y+r.h/2);touch('end',r.x+r.w/2,r.y+r.h/2);await idle(s);};
  const start=async()=>{frame();assert.equal(s.page,'home');const primary=v.regions.find(r=>r.id==='primary');assert.ok(primary);await tap(primary.id);assert.equal(s.page,'battle');frame();};
  const dispatch=async(move=true)=>{
    frame();const b=s.match!.battle,from=b.camps.find(c=>c.owner==='P')!,to=b.camps.find(c=>c.owner===null)!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
    assert.ok(to,'tutorial has a neutral destination');const x=board.x+from.x*board.k,y=board.y+from.y*board.k,tx=board.x+to.x*board.k,ty=board.y+to.y*board.k;
    touch('start',x,y);if(move)touch('move',tx,ty);touch('end',tx,ty);await idle(s);assert.equal(s.match!.battle.armies.length,1,'native touch dispatch reaches real rules');
  };
  return {s,v,audio,vm,data,canvas,texts,sound,oscillators,listeners,frame,tap,touch,start,dispatch,imagePaths,
    setWindow:(next:Partial<WindowProbe>)=>{Object.assign(geometry,next);wx.getMenuButtonBoundingClientRect=geometry.menu==='missing'?undefined:()=>geometry.menu==='missing'?undefined:geometry.menu();},
    artStatus:()=>vm.WechatEntryProbe.getArtStatus() as {ready:number;loading:number;failed:number;total:number},
    finishImages:()=>{artMode='success';pendingImages.forEach(image=>image.onload?.());},
    stats:()=>({writes,creates,resumes,suspends,vibrations}),failWrites:()=>{failWrites=true;},holdNextWrite:()=>{holdWrite=true;},hasPendingWrite:()=>pendingWrite!==null,releaseWrite:()=>{assert.ok(pendingWrite);const release=pendingWrite;pendingWrite=null;release();}};
}

for(const hidden of [false,true])test(`WeChat entry: delayed audio resume preserves dispatch sound and cancels it on hide=${hidden}`,async()=>{
  const h=await harness();await h.start();h.frame(120);h.audio.stop();const baseline=h.oscillators.length;
  const observed:BattleEvent[]=[],present=h.v.events.bind(h.v);h.v.events=events=>{observed.push(...events);present(events);};
  h.sound.state='suspended';let complete!:()=>void;
  h.sound.resume=()=>new Promise<void>(resolve=>{complete=()=>{h.sound.state='running';resolve();};});
  await h.dispatch();assert.equal(h.oscillators.length,baseline,'no native node starts before resume');
  const events=observed.filter(e=>e.type==='dispatch');assert.ok(events.length>0);
  if(hidden){h.listeners.hide!();await idle(h.s);}
  complete();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.oscillators.length,baseline+(hidden?0:2),'touch and committed dispatch each produce one sound unless hidden');
  const played=h.oscillators.length;h.audio.play(events,!hidden,h.s.match!.battle.id,h.s.restorationVersion);assert.equal(h.oscillators.length,played,'committed dispatch does not replay');
});

for(const [name,menu]of [
  ['missing','missing'],['empty',()=>({})],['nan',()=>({bottom:NaN})],['infinity',()=>({bottom:Infinity})],
  ['below-safe-top',()=>({bottom:20})],['equal-safe-top',()=>({bottom:47})],['beyond-window',()=>({bottom:845})],['throwing',()=>{throw new Error('native menu unavailable');}],
] as const)test(`WeChat viewport: ${name} menu coordinates reserve the menu row and keep home and battle controls below it`,async()=>{
  const h=await harness('available','success',{width:390,height:844,safeTop:47,safeBottom:810,menu});h.frame();
  assert.equal(h.v.viewport.top,91);assert.equal(h.v.viewport.bottom,34);assert.equal(h.canvas.width,780);assert.equal(h.canvas.height,1688);
  const settings=h.v.regions.find(r=>r.id==='settings')!;assert.ok(settings);assert.ok(settings.y>=91,'home settings stay below the fallback menu row');
  const bytes=[...h.data],writes=h.stats().writes;h.frame();h.frame();assert.deepEqual([...h.data],bytes);assert.equal(h.stats().writes,writes);
  await h.start();const pause=h.v.regions.find(r=>r.id==='pause')!;assert.ok(pause);assert.ok(pause.y>=91,'battle pause also stays below the menu row');
});

test('WeChat viewport: valid finite menu bottoms retain the measured bottom plus six pixels, including the window edge',async()=>{
  for(const bottom of [48,60,120,844]){
    const h=await harness('available','success',{width:390,height:844,safeTop:47,safeBottom:810,menu:()=>({bottom})});
    assert.equal(h.v.viewport.top,bottom+6);assert.equal(h.v.viewport.bottom,34);
  }
});

for(const event of ['resize','show'] as const)test(`WeChat viewport: ${event} recalculates menu fallback and cancels old home and troop touches without storage effects`,async()=>{
  const h=await harness();h.frame();assert.equal(h.v.viewport.top,66);
  const settings=h.v.regions.find(r=>r.id==='settings')!,sx=settings.x+settings.w/2,sy=settings.y+settings.h/2;
  h.touch('start',sx,sy);const bytes=[...h.data],writes=h.stats().writes;
  h.setWindow({width:390,height:844,safeTop:47,safeBottom:810,menu:()=>({})});h.listeners[event]!();h.frame();h.touch('end',sx,sy);await idle(h.s);
  assert.equal(h.v.viewport.top,91);assert.equal(h.s.page,'home');assert.deepEqual([...h.data],bytes);assert.equal(h.stats().writes,writes);
  await h.start();const b=h.s.match!.battle,from=b.camps.find(c=>c.owner==='P')!,to=b.camps.find(c=>c.owner===null)!;
  const point=(c:{x:number;y:number})=>{const board=(h.v as unknown as {board:{x:number;y:number;k:number}}).board;return {x:board.x+c.x*board.k,y:board.y+c.y*board.k};};
  const a=point(from),z=point(to);h.touch('start',a.x,a.y);h.touch('move',z.x,z.y);
  const battleBefore=JSON.stringify(b),saved=[...h.data],battleWrites=h.stats().writes;
  h.setWindow({safeTop:60,menu:()=>({bottom:110})});h.listeners[event]!();h.frame();const target=point(to);h.touch('end',target.x,target.y);await idle(h.s);
  assert.equal(h.v.viewport.top,116);assert.equal(h.s.match!.battle.armies.length,0);assert.equal(JSON.stringify(h.s.match!.battle),battleBefore);assert.deepEqual([...h.data],saved);assert.equal(h.stats().writes,battleWrites);
});

test('WeChat art: native image factory loads the complete registered package without DOM or remote URLs',async()=>{
  const h=await harness();assert.equal(h.artStatus().ready,ART_COUNT);
  assert.deepEqual(h.imagePaths,ART_PATHS);assert.ok(h.imagePaths.every(path=>/^assets\/art\/[a-z-]+\.(png|jpg)$/.test(path)));
  assert.equal(new Set(h.imagePaths).size,ART_COUNT);assert.equal('Image' in h.vm,false);
  h.listeners.show!();await idle(h.s);assert.deepEqual(h.imagePaths,ART_PATHS,'foreground retains decoded images');
});

test('WeChat art: delayed images do not block storage or touch and failed images retry on foreground',async()=>{
  const pending=await harness('available','pending');assert.equal(pending.artStatus().loading,ART_COUNT);assert.deepEqual(pending.imagePaths,ART_PATHS);
  await pending.start();await pending.dispatch();assert.ok(pending.stats().writes>0);
  pending.finishImages();await idle(pending.s);assert.equal(pending.artStatus().ready,ART_COUNT);
  const failed=await harness('available','failure');assert.equal(failed.artStatus().failed,ART_COUNT);assert.deepEqual(failed.imagePaths,ART_PATHS);
  await failed.start();await failed.dispatch();assert.ok(failed.stats().writes>0);
  failed.finishImages();failed.listeners.show!();await idle(failed.s);assert.equal(failed.artStatus().ready,ART_COUNT);
  assert.deepEqual(failed.imagePaths,[...ART_PATHS,...ART_PATHS]);
});

for(const mode of ['available','missing','create-failure','start-failure'] as const)test(`WeChat entry: ${mode} audio preserves DOM-free startup, native touch dispatch and atomic storage`,async()=>{
  const h=await harness(mode);assert.equal(h.s.page,'home');for(const name of ['window','document','localStorage','AudioContext','navigator'])assert.equal(name in h.vm,false,name);
  assert.equal(h.canvas.width,750);assert.equal(h.canvas.height,1624);assert.equal(h.v.viewport.top,66);assert.equal(h.v.viewport.bottom,34);
  await h.start();await h.dispatch();assert.ok(h.data.size>0);assert.ok(h.stats().writes>0);assert.equal(h.s.error,'');
  if(mode==='available')assert.ok(h.oscillators.some(o=>o.started));
  if(mode==='missing'||mode==='create-failure')assert.equal(h.oscillators.length,0);
  if(mode==='start-failure')assert.ok(h.oscillators.length>0&&h.oscillators.every(o=>o.disconnected));
});

for(const mode of ['available','suspend-rejection'] as const)test(`WeChat entry: ${mode} stops voices synchronously on hide, freezes rules and resumes only by touch`,async()=>{
  const h=await harness(mode);await h.start();await h.dispatch();h.frame(100);await idle(h.s);const before=JSON.stringify(h.s.match!.battle),sounded=h.oscillators.length;
  h.listeners.hide!();assert.ok(h.oscillators.every(o=>o.disconnected),'hide cleanup does not require a frame or successful native suspend');assert.equal(h.stats().suspends,1);await idle(h.s);
  const paused=JSON.stringify(h.s.match!.battle);assert.equal(JSON.parse(paused).gameMs,JSON.parse(before).gameMs);assert.equal(h.s.page,'pause');
  h.frame(5000);await idle(h.s);assert.equal(JSON.stringify(h.s.match!.battle),paused);h.touch('start',10,10);assert.equal(h.oscillators.length,sounded);
  await h.s.load();assert.equal(JSON.stringify(h.s.match!.battle),paused);h.listeners.show!();h.frame(16);await idle(h.s);
  assert.equal(h.s.page,'pause');assert.equal(h.oscillators.length,sounded);assert.equal(h.stats().resumes,0);assert.equal(JSON.stringify(h.s.match!.battle),paused);
  await h.tap('resume');assert.equal(h.s.page,'battle');assert.equal(h.s.match!.battle.gameMs,JSON.parse(paused).gameMs);if(mode==='available')assert.equal(h.stats().resumes,1);
  h.frame(100);await idle(h.s);assert.ok(h.s.match!.battle.gameMs>JSON.parse(paused).gameMs);
});

test('WeChat entry: action committed after hide stays silent even if native suspend rejects',async()=>{
  const h=await harness('suspend-rejection');await h.start();await h.dispatch();h.frame(120);await idle(h.s);h.holdNextWrite();
  const b=h.s.match!.battle,action=h.s.action({kind:'dispatch',sourceId:b.camps.find(c=>c.owner==='P')!.id,targetId:b.camps.find(c=>c.owner===null)!.id});
  for(let i=0;i<30&&!h.hasPendingWrite();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(h.hasPendingWrite());
  h.listeners.hide!();const sounded=h.oscillators.length;assert.ok(h.oscillators.every(o=>o.disconnected));h.releaseWrite();assert.equal(await action,true);await idle(h.s);
  assert.equal(h.s.page,'pause');assert.equal(h.s.match!.battle.armies.length,2);assert.equal(h.oscillators.length,sounded,'late committed dispatch cannot emit while hidden');
  h.listeners.show!();h.frame();assert.equal(h.oscillators.length,sounded);assert.equal(h.s.page,'pause');
});

test('WeChat entry: normal pause suspends audio on the next frame and real victory retains its result sound',async()=>{
  const paused=await harness();await paused.start();await paused.dispatch();await paused.s.pause();assert.equal(paused.s.page,'pause');paused.frame();assert.ok(paused.oscillators.every(o=>o.disconnected));assert.equal(paused.stats().suspends,1);
  const win=await harness();await win.start();await win.dispatch();
  for(let i=0;i<30&&win.s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner!=='P';i++){win.frame(250);await idle(win.s);}
  const b=win.s.match!.battle,from=b.camps.find(c=>c.id==='L01-N1')!,target=b.camps.find(c=>c.owner!==null&&c.owner!=='P')!;assert.equal(from.owner,'P');
  from.garrison=40;target.garrison=0;for(const faction of b.factions)faction.nextAiAtMs=100000;
  await win.s.pause();await win.s.resume();assert.equal(await win.s.action({kind:'dispatch',sourceId:from.id,targetId:target.id}),true);
  for(let i=0;i<60&&win.s.page==='battle';i++){win.frame(250);await idle(win.s);}
  assert.equal(win.s.page,'result');assert.equal(win.s.profile!.latestResult!.result!.playerRank,1);assert.equal(win.stats().suspends,0);
  const sounded=win.oscillators.length;assert.ok(win.oscillators.some(o=>o.started&&!o.disconnected));win.frame(16);assert.equal(win.oscillators.length,sounded);assert.equal(win.stats().suspends,0,'battle to result preserves the committed result sound');
});

for(const moves of [true,false])test(`WeChat entry: native swipes ${moves?'with moves':'end-only'} scroll an expanded settled war report across live frames without writing or pressing the fixed action`,async()=>{
  const h=await harness();
  // Memory-only setup opens a formal game; its deadline uses the normal settlement transaction.
  h.s.profile!.tutorialFirstWins=['L01'];h.s.profile!.unlockedCardIds=['mobilize','supply','farming'];h.s.profile!.firstDragCompleted=true;
  assert.equal(await h.s.start('A01'),true);
  const battle=h.s.match!.battle;battle.gameMs=239999;
  for(const faction of battle.factions)faction.nextAiAtMs=300000;
  h.frame(1);await idle(h.s);h.frame();assert.equal(h.s.page,'result');
  await h.tap('result-details');h.frame();
  const state=h.v as unknown as {scroll:number;maxScroll:number};assert.ok(state.maxScroll>0,'full four-faction report overflows the safe content area');
  const before=JSON.stringify(h.s.profile),writes=h.stats().writes,action=h.v.regions.find(r=>r.id==='again')!;
  assert.ok(action);const actionY=action.y;
  h.touch('start',190,640);
  if(moves)for(const y of [615,570,520,470]){h.touch('move',190,y);h.frame();}
  h.touch('end',190,470);h.frame();
  assert.ok(state.scroll>0,'native touch move scrolls the report');assert.ok(state.scroll<=state.maxScroll);
  const scrolled=state.scroll;for(let i=0;i<5;i++)h.frame();assert.equal(state.scroll,scrolled,'subsequent frames preserve the scroll');
  assert.equal(h.v.regions.find(r=>r.id==='again')!.y,actionY,'primary action stays fixed');
  h.touch('start',190,470);if(moves)for(const y of [520,570,615,640]){h.touch('move',190,y);h.frame();}h.touch('end',190,640);h.frame();
  assert.equal(state.scroll,0);assert.equal(h.s.page,'result');assert.equal(JSON.stringify(h.s.profile),before);assert.equal(h.stats().writes,writes);
});

test('WeChat entry: end-only drags dispatch troops and cannot masquerade as a button tap',async()=>{
  const h=await harness();h.frame();const r=h.v.regions.find(r=>r.id==='primary')!;
  h.touch('start',r.x+r.w/2-20,r.y+r.h/2);h.touch('end',r.x+r.w/2+20,r.y+r.h/2);await idle(h.s);h.frame();
  assert.equal(h.s.page,'home','a drag inside the same button is not a tap');
  await h.start();await h.dispatch(false);assert.equal(h.s.match!.battle.armies[0]!.remainingCount,12);
});

test('WeChat entry: settings silence active audio, and failed pause storage cannot postpone sound cleanup',async()=>{
  const h=await harness();await h.start();await h.dispatch();assert.ok(h.oscillators.some(o=>!o.disconnected));
  await h.s.setting('sound');h.frame();assert.equal(h.s.profile!.settings.sound,false);assert.ok(h.oscillators.every(o=>o.disconnected));
  const played=h.oscillators.length;await h.s.action({kind:'dispatch',sourceId:h.s.match!.battle.camps.find(c=>c.owner==='P')!.id,targetId:h.s.match!.battle.camps.find(c=>c.owner===null)!.id});assert.equal(h.oscillators.length,played);
  await h.s.setting('sound');h.touch('start',10,10);h.touch('cancel',10,10);h.frame(120);h.audio.click(true);assert.ok(h.oscillators.some(o=>!o.disconnected));
  h.failWrites();h.listeners.hide!();assert.ok(h.oscillators.every(o=>o.disconnected));await idle(h.s);assert.equal(h.s.page,'recovery');assert.ok(h.s.error);assert.ok(h.data.size>0,'previous committed slots remain available');
});


test('WeChat haptics: only player captures vibrate, hidden or disabled feedback stays silent',async()=>{
  const h=await harness();await h.start();await h.s.setting('vibration');
  const emit=(h.s as unknown as {options:{events:(events:BattleEvent[])=>void}}).options.events;
  const capture=(faction:'P'|'E1',id:number):BattleEvent=>({id,atMs:0,type:'capture',targetId:'L01-N1',faction});
  emit([capture('E1',10001)]);assert.equal(h.stats().vibrations,0);
  emit([capture('P',10002)]);assert.equal(h.stats().vibrations,1);
  emit([capture('P',10003)]);assert.equal(h.stats().vibrations,1,'rate limited');
  h.listeners.hide!();await idle(h.s);emit([capture('P',10004)]);assert.equal(h.stats().vibrations,1);
  h.listeners.show!();await h.s.setting('vibration');emit([capture('P',10005)]);assert.equal(h.stats().vibrations,1);
});
