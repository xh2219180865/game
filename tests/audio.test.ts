import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventSound, GameAudio, type AudioContextPort } from '../src/platform/audio.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { advanceBattle, applyBattleAction, createBattle } from '../src/core/battle.ts';
import { transformSync } from 'esbuild';

function harness(){
  let now=1000;const oscillators:{frequency:{setValueAtTime:(n:number)=>void;exponentialRampToValueAtTime:()=>void};type:string;onended:(()=>void)|null;start:()=>void;stop:(at?:number)=>void;connect:()=>void;disconnect:()=>void;disconnected:boolean;stopped:boolean;hz:number}[]=[];
  const ctx={state:'running',currentTime:0,destination:{},async resume(){this.state='running';},async suspend(){this.state='suspended';},
    createOscillator(){const osc={frequency:{setValueAtTime(n:number){osc.hz=n;},exponentialRampToValueAtTime(){}},type:'',onended:null as (()=>void)|null,start(){},stop(at?:number){if(at===undefined)osc.stopped=true;},connect(){},disconnect(){osc.disconnected=true;},disconnected:false,stopped:false,hz:0};oscillators.push(osc);return osc;},
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}};
  const audio=new GameAudio(()=>ctx as unknown as AudioContextPort,()=>now);audio.unlock();
  const event=(id:number,type:BattleEvent['type'],reason?:string):BattleEvent=>({id,type,atMs:0,reason});
  return {audio,ctx,oscillators,event,time:(ms:number)=>{now=ms;}};
}
test('U16: categories coalesce within 100 ms but a result is not suppressed by a recent dispatch',()=>{
  const {audio,oscillators,event}=harness();audio.play([event(1,'dispatch')],true,'game');audio.play([event(2,'dispatch')],true,'game');assert.equal(oscillators.length,1);
  audio.play([{...event(3,'result'),faction:'P'}],true,'game');assert.equal(oscillators.length,2);assert.equal(oscillators[1]!.hz,523);
});
test('U16: category coalescing excludes 99 ms and admits 100 ms, with tower shots and volleys sharing one arrow category',()=>{
  const {audio,oscillators,event,time}=harness();audio.play([event(1,'dispatch')],true,'boundary');
  time(1099);audio.play([event(2,'dispatch')],true,'boundary');assert.equal(oscillators.length,1);
  time(1100);audio.play([event(3,'dispatch')],true,'boundary');assert.equal(oscillators.length,2);
  time(1200);audio.play([event(4,'tower-shot')],true,'boundary');assert.equal(oscillators.length,3);
  time(1299);audio.play([event(5,'volley')],true,'boundary');assert.equal(oscillators.length,3);
  time(1300);audio.play([event(6,'volley')],true,'boundary');assert.deepEqual(oscillators.map(o=>o.hz),[220,220,650,830]);
});
test('U16: four-voice ceiling preempts a less important voice and releases audio nodes',()=>{
  const {audio,oscillators,event}=harness();for(const [i,type]of (['dispatch','arrival','card','tower-shot'] as const).entries())audio.play([event(i+1,type)],true,'game');
  assert.equal(oscillators.filter(o=>!o.disconnected).length,4);audio.play([event(5,'capture')],true,'game');assert.equal(oscillators.filter(o=>!o.disconnected).length,4);assert.equal(oscillators.filter(o=>o.stopped).length,1);
  audio.suspend();assert.equal(oscillators.filter(o=>!o.disconnected).length,0);
});
for(const platform of ['browser','wechat'])test(`U16: ${platform} vibration requests share the 500 ms boundary and disabled requests are never queued`,()=>{
  const source=readFileSync(new URL(`../src/platform/${platform}.ts`,import.meta.url),'utf8'),start=source.indexOf('function vibrate('),end=source.indexOf('\nconst session=',start);assert.ok(start>=0&&end>start);
  const code=transformSync(source.slice(start,end),{loader:'ts',target:'es2022'}).code;
  let now=1000;const calls:{at:number;payload:unknown}[]=[],session={profile:{settings:{vibration:true}}};
  const send=(payload:unknown)=>calls.push({at:now,payload});
  const vibrate=new Function('session','Date','navigator','wx',`let lastVibration=0;${code};return vibrate;`)(session,{now:()=>now},{vibrate:send},{vibrateShort:send}) as ()=>void;
  vibrate();vibrate();now=1499;vibrate();assert.equal(calls.length,1);
  now=1500;vibrate();assert.equal(calls.length,2);session.profile.settings.vibration=false;now=2500;vibrate();now=3000;vibrate();assert.equal(calls.length,2);
  session.profile.settings.vibration=true;assert.equal(calls.length,2);vibrate();now=3499;vibrate();assert.equal(calls.length,3);now=3500;vibrate();
  assert.deepEqual(calls.map(c=>c.at),[1000,1500,3000,3500]);assert.ok(calls.slice(1).every((c,i)=>c.at-calls[i]!.at>=500));
  assert.ok(calls.every(c=>platform==='browser'?c.payload===15:JSON.stringify(c.payload)==='{"type":"light"}'));
});
test('U15: muted or replayed committed events never play later on resume',()=>{
  const {audio,oscillators,event,time}=harness();audio.play([event(1,'capture')],false,'game');time(2000);audio.play([event(1,'capture')],true,'game');assert.equal(oscillators.length,0);
  audio.play([event(2,'capture')],true,'game');audio.play([event(2,'capture')],true,'game');assert.equal(oscillators.length,1);time(3000);audio.play([event(1,'capture')],true,'new-game');assert.equal(oscillators.length,2);
});
for(const platform of ['browser','wechat'])test(`H15: ${platform} event routing resets sound deduplication after same-match restoration`,()=>{
  const {audio,oscillators,event,time}=harness(),source=readFileSync(new URL(`../src/platform/${platform}.ts`,import.meta.url),'utf8');
  const start=source.indexOf('events:events=>{')+'events:events=>{'.length,end=source.indexOf('\n}});',start);assert.ok(start>0&&end>start);
  const session={restorationVersion:1,profile:{settings:{sound:true}},match:{battle:{id:'same-match'}}};
  const route=new Function('view','audio','session','vibrate',`const hidden=false;return events=>{${source.slice(start,end)}};`)({events(){}},audio,session,()=>{}) as (events:BattleEvent[])=>void;
  route([event(9,'card','supply')]);assert.equal(oscillators.length,1);audio.suspend();audio.unlock();time(2000);route([event(9,'card','supply')]);assert.equal(oscillators.length,1);
  session.restorationVersion++;route([]);assert.equal(oscillators.length,1,'restoration itself emits no sound');
  route([event(2,'card','supply')]);assert.equal(oscillators.length,2);route([event(2,'card','supply')]);assert.equal(oscillators.length,2);
});

test('U15: optional audio creation and rejected lifecycle promises never escape into input or pause',async()=>{
  const absent=new GameAudio(()=>{throw new Error('unsupported');});assert.doesNotThrow(()=>{absent.unlock();absent.click(true);absent.suspend();});
  const {audio,ctx,oscillators,event}=harness();ctx.state='suspended';ctx.resume=async()=>{throw new Error('resume rejected');};audio.unlock();await new Promise(resolve=>setImmediate(resolve));assert.equal(oscillators.length,0);
  ctx.state='running';audio.play([event(1,'capture')],true);ctx.suspend=async()=>{throw new Error('suspend rejected');};assert.doesNotThrow(()=>audio.suspend());await new Promise(resolve=>setImmediate(resolve));assert.ok(oscillators.every(o=>o.disconnected&&o.stopped));
  ctx.suspend=()=>{throw new Error('sync suspend failed');};assert.doesNotThrow(()=>audio.suspend());
});

for(const failure of ['gain','parameter','connect','start','stop'] as const)test(`U16: ${failure} audio failure cleans partial native nodes without replay or leaked voice slots`,()=>{
  const {audio,ctx,oscillators,event,time}=harness(),createOscillator=ctx.createOscillator.bind(ctx),createGain=ctx.createGain.bind(ctx);let gainDisconnects=0;
  ctx.createGain=()=>{if(failure==='gain')throw new Error(failure);const gain=createGain();gain.disconnect=()=>{gainDisconnects++;};return gain;};
  ctx.createOscillator=()=>{const osc=createOscillator();const fail=()=>{throw new Error(failure);};
    if(failure==='parameter')osc.frequency.setValueAtTime=fail;
    if(failure==='connect')osc.connect=fail;
    if(failure==='start')osc.start=fail;
    if(failure==='stop')osc.stop=fail;
    return osc;
  };
  assert.doesNotThrow(()=>audio.play([event(1,'capture')],true,'failure'));assert.equal(oscillators.length,1);assert.equal(oscillators[0]!.disconnected,true);assert.equal(gainDisconnects,failure==='gain'?0:1);
  assert.equal((audio as unknown as {voices:unknown[]}).voices.length,0);time(2000);audio.play([event(1,'capture')],true,'failure');assert.equal(oscillators.length,1,'failed event cannot replay');
  ctx.createOscillator=createOscillator;ctx.createGain=createGain;audio.play([event(2,'capture')],true,'failure');assert.equal(oscillators.length,2);audio.stop();assert.ok(oscillators.every(o=>o.disconnected));
});

test('U16: native stop and disconnect exceptions do not prevent remaining voice cleanup',()=>{
  const {audio,oscillators,event}=harness();audio.play([event(1,'dispatch')],true);audio.play([event(2,'capture')],true);
  const first=oscillators[0]!;let attemptedDisconnect=false;first.stop=()=>{throw new Error('already ended');};first.disconnect=()=>{attemptedDisconnect=true;throw new Error('already disconnected');};
  assert.doesNotThrow(()=>audio.stop());assert.equal(attemptedDisconnect,true);assert.equal(oscillators[1]!.disconnected,true);assert.equal((audio as unknown as {voices:unknown[]}).voices.length,0);
});

test('U16: expired native voices are disconnected even if onended was not delivered',()=>{
  const {audio,ctx,oscillators,event,time}=harness();audio.play([event(1,'dispatch')],true);ctx.currentTime=1;time(2000);audio.play([event(2,'capture')],true);
  assert.equal(oscillators[0]!.disconnected,true);assert.equal(oscillators[0]!.onended,null);assert.equal(oscillators[1]!.disconnected,false);
});
test('H03 H04 H05: troop arrival, commands and win/loss have distinct sound variants',()=>{
  const {event}=harness();assert.notEqual(eventSound(event(1,'card','mobilize'))!.frequency,eventSound(event(2,'card','supply'))!.frequency);
  assert.notEqual(eventSound(event(3,'card','supply'))!.frequency,eventSound(event(4,'card','feint'))!.frequency);
  assert.notEqual(eventSound(event(5,'arrival','friendly'))!.frequency,eventSound(event(6,'arrival','enemy'))!.frequency);
  assert.ok(eventSound({...event(7,'result'),faction:'P'})!.end>eventSound(event(8,'result'))!.end);assert.equal(eventSound(event(9,'volley-skipped')),null);
});
test('H11: settled overflow and equal opposing arrivals produce one arrival sound without a capture command',()=>{
  for(const initial of [48,50,'clash'] as const){
    const {audio,oscillators}=harness(),b=createBattle('A01',{id:`arrival-${initial}`,ruleRevision:'1.5'});
    const left=b.camps.find(c=>c.id==='A01-N2')!,right=b.camps.find(c=>c.id==='A01-N3')!,target=b.camps.find(c=>c.id==='A01-N5')!;
    left.owner='P';left.garrison=20;target.owner=initial==='clash'?'E1':'P';target.garrison=initial==='clash'?0:initial;target.nextShotAtMs=2000;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sourceId:left.id,targetId:target.id,sequence:1}).ok);
    if(initial==='clash'){
      right.owner='E2';right.garrison=20;
      assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'E2',sourceId:right.id,targetId:target.id,sequence:1}).ok);
    }
    advanceBattle(b,999);const events=advanceBattle(b,1000);
    assert.equal(b.armies.length,0);assert.equal(target.garrison,initial==='clash'?0:50);assert.equal(target.owner,initial==='clash'?'E1':'P');
    assert.equal(events.filter(e=>e.type==='arrival').length,initial==='clash'?2:1);assert.ok(!events.some(e=>e.type==='capture'));
    if(initial!=='clash')assert.deepEqual(events.filter(e=>e.type==='overflow').map(e=>e.amount),[initial===48?8:10]);
    audio.play(events,true,b.id);audio.play(events,true,b.id);
    assert.deepEqual(oscillators.map(o=>o.hz),[initial==='clash'?180:330]);
  }
});

test('Audio unlock: the first tap waits for an asynchronous native resume instead of disappearing',async()=>{
  const h=harness();h.ctx.state='suspended';let complete!:()=>void;
  h.ctx.resume=()=>new Promise<void>(resolve=>{complete=()=>{h.ctx.state='running';resolve();};});
  h.audio.unlock();h.audio.click(true);assert.equal(h.oscillators.length,0);complete();
  for(let i=0;i<5;i++)await Promise.resolve();assert.equal(h.oscillators.length,1);
});

test('Audio unlock: hide or mute cancels a click waiting for native resume',async()=>{
  const h=harness();h.ctx.state='suspended';let complete!:()=>void;
  h.ctx.resume=()=>new Promise<void>(resolve=>{complete=()=>{h.ctx.state='running';resolve();};});
  h.audio.unlock();h.audio.click(true);h.audio.stop();complete();
  for(let i=0;i<5;i++)await Promise.resolve();assert.equal(h.oscillators.length,0);
});

test('Audio failure: unavailable creation reports once, can retry, and successful playback resets the warning',()=>{
  const h=harness();let fail=true,reports=0;
  const audio=new GameAudio(()=>{if(fail)throw new Error('native unavailable');return h.ctx as unknown as AudioContextPort;},()=>1000,()=>{reports++;});
  audio.unlock();audio.unlock();assert.equal(reports,1);fail=false;audio.unlock();audio.click(true);assert.equal(h.oscillators.length,1);
  h.ctx.state='closed';fail=true;audio.unlock();assert.equal(reports,2);
});

test('Audio resume: rejected native resume is reported once and a later tap retries without replaying an old click',async()=>{
  const h=harness();h.ctx.state='suspended';let fail=true,reports=0;
  h.ctx.resume=async()=>{if(fail)throw new Error('resume failed');h.ctx.state='running';};
  const audio=new GameAudio(()=>h.ctx as unknown as AudioContextPort,()=>1000,()=>{reports++;});
  audio.unlock();audio.click(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reports,1);assert.equal(h.oscillators.length,0);fail=false;audio.unlock();audio.click(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.oscillators.length,1);
});

test('Audio preview: a 240 ms audition is distinct from the touch click and repeated previews coalesce',()=>{
  const h=harness();h.audio.click(true);h.audio.preview();
  assert.equal(h.oscillators.length,2);assert.deepEqual(h.oscillators.map(o=>o.hz),[420,523]);
  const voices=(h.audio as unknown as {voices:{end:number}[]}).voices;
  assert.ok(Math.abs(voices[1]!.end-h.ctx.currentTime-.25)<.0001);
  h.audio.preview();assert.equal(h.oscillators.length,2);h.audio.stop();assert.ok(h.oscillators.every(o=>o.disconnected));
});
for(const cancel of [false,true])test(`Audio preview: asynchronous resume respects cancellation ${cancel}`,async()=>{
  const h=harness();h.ctx.state='suspended';let complete!:()=>void;
  h.ctx.resume=()=>new Promise<void>(resolve=>{complete=()=>{h.ctx.state='running';resolve();};});
  h.audio.preview();assert.equal(h.oscillators.length,0);if(cancel)h.audio.suspend();complete();
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.oscillators.length,cancel?0:1);
});
test('Audio resume: a resolved promise without running state reports failure and can retry',async()=>{
  const h=harness();h.ctx.state='suspended';h.ctx.resume=async()=>{};let reports=0;
  const audio=new GameAudio(()=>h.ctx as unknown as AudioContextPort,()=>1000,()=>{reports++;});
  audio.unlock();audio.click(true);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(reports,1);assert.equal(h.oscillators.length,0);
  h.ctx.resume=async()=>{h.ctx.state='running';};audio.unlock();audio.click(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.oscillators.length,1);
});

test('Battle audio resume: committed dispatch waits for native resume and cannot replay',async()=>{
  const h=harness();h.ctx.state='suspended';let complete!:()=>void;
  h.ctx.resume=()=>new Promise<void>(resolve=>{complete=()=>{h.ctx.state='running';resolve();};});
  const b=createBattle('L01',123,1000),from=b.camps.find(c=>c.owner==='P')!,to=b.camps.find(c=>c.owner===null)!;
  const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sourceId:from.id,targetId:to.id,sequence:1});assert.ok(result.ok);
  const dispatched=result.events.filter(e=>e.type==='dispatch');assert.equal(dispatched.length,1);
  h.audio.unlock();h.audio.play(dispatched,true,b.id);h.audio.play(dispatched,true,b.id);assert.equal(h.oscillators.length,0);
  complete();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.oscillators.map(o=>o.hz),[220]);
  h.time(2000);h.audio.play(dispatched,true,b.id);assert.equal(h.oscillators.length,1);
});

for(const cancellation of ['stop','suspend','mute','match','restore','failure'] as const)test(`Battle audio resume: ${cancellation} discards pending events and later audio can play`,async()=>{
  const h=harness();h.ctx.state='suspended';let complete!:(failed?:boolean)=>void;
  h.ctx.resume=()=>new Promise<void>((resolve,reject)=>{complete=failed=>{if(failed)reject(new Error('native resume failed'));else{h.ctx.state='running';resolve();}};});
  h.audio.unlock();h.audio.play([h.event(1,'capture')],true,'old',1);
  if(cancellation==='stop')h.audio.stop();else if(cancellation==='suspend')h.audio.suspend();else if(cancellation==='mute')h.audio.play([],false,'old',1);
  else if(cancellation==='match')h.audio.play([],true,'new',1);else if(cancellation==='restore')h.audio.play([],true,'old',2);
  complete(cancellation==='failure');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.oscillators.length,0);
  h.ctx.state='running';h.time(2000);h.audio.play([h.event(2,'dispatch')],true,cancellation==='match'?'new':'old',cancellation==='restore'?2:1);
  assert.deepEqual(h.oscillators.map(o=>o.hz),[220]);
});
