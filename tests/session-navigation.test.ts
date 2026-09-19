import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { CARD_IDS } from '../src/core/progress.ts';
import { fraction } from '../src/core/fraction.ts';
import { advanceBattle } from '../src/core/battle.ts';
import { SLOT_KEYS } from '../src/app/storage.ts';

const NOW=Date.parse('2026-09-11T12:00:00+08:00');
function harness(){
  const data=new Map<string,string>(),events:string[]=[];let hold:'read'|'write'|null=null,entered:()=>void=()=>{},release:(fail?:boolean)=>void=()=>{};
  const wait=async(kind:'read'|'write')=>{if(hold===kind){hold=null;entered();await new Promise<void>((resolve,reject)=>{release=fail=>fail?reject(new Error('quota')):resolve();});}};
  const s=new GameSession({storage:{async read(k){await wait('read');return data.get(k)??null;},async write(k,v){await wait('write');data.set(k,v);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>.2,notify:()=>{},events:es=>events.push(...es.map(e=>e.type))});
  return {s,data,events,gate:(kind:'read'|'write'='write')=>{hold=kind;return new Promise<void>(resolve=>{entered=resolve;});},release:(fail=false)=>release(fail)};
}
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}
async function formal(s:GameSession){await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];await s.start('A01');}
test('S17: pausing during the first slow formal save cannot be undone by its start callback',async()=>{
  const h=harness(),s=h.s;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.page='prepare';
  const writing=h.gate(),starting=s.start('A01');await writing;const pausing=s.pause();h.release();assert.equal(await starting,true);await pausing;await idle(s);
  assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(s.match!.battle.gameMs,0);s.tick(250);assert.equal(s.match!.battle.gameMs,0);await s.load();assert.equal(s.page,'pause');assert.equal(s.match!.battle.gameMs,0);
});
for(const failure of [false,true])test(`S17: suspension during a slow ${failure?'failed':'successful'} start preserves the correct recovery or pause state`,async()=>{
  const h=harness(),s=h.s;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.page='prepare';
  const writing=h.gate(),starting=s.start('A01');await writing;const hidden=s.suspend();h.release(failure);assert.equal(await starting,!failure);await hidden;await idle(s);
  assert.equal(s.page,failure?'recovery':'pause');assert.equal(s.match?.battle.gameMs??null,failure?null:0);if(!failure){assert.equal(s.match!.battle.status,'paused');s.tick(250);assert.equal(s.match!.battle.gameMs,0);await s.resume();s.tick(250);assert.equal(s.match!.battle.gameMs,250);}
  else{assert.notEqual(s.error,'');await s.load();assert.equal(s.page,'home');assert.equal(s.match,null);}
});
test('S17: suspension outside a battle leaves loading, menus and pending rewards untouched',async()=>{
  const h=harness(),s=h.s;await s.suspend();assert.equal(s.page,'loading');await s.load();
  for(const page of ['home','prepare','settings','choice','result'] as const){s.page=page;const bytes=[...h.data];await s.suspend();assert.equal(s.page,page);assert.deepEqual([...h.data],bytes);}
});
test('S17: suspension during a slow resume prevents automatic battle entry after returning',async()=>{
  const h=harness(),s=h.s;await formal(s);await s.pause();const writing=h.gate(),resuming=s.resume();await writing;const hidden=s.suspend();h.release();await Promise.all([resuming,hidden]);await idle(s);
  assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');s.tick(250);assert.equal(s.match!.battle.gameMs,0);await s.resume();s.tick(250);assert.equal(s.match!.battle.gameMs,250);
});
for(const first of ['periodic','consumption'] as const)test(`S08: ${first} saving first cannot let a periodic snapshot undo the committed card`,async()=>{
  const h=harness(),s=h.s;await formal(s);s.profile!.activeInventory.supply=2;s.match!.battle.factions.find(f=>f.id==='P')!.inventory.supply=2;for(const f of s.match!.battle.factions)f.nextAiAtMs=240001;await s.pause();await s.resume();
  // Preset the instant before the real periodic checkpoint; no old cloned state is injected into the session.
  s.match!.battle.gameMs=4999;const writing=h.gate();let consuming:Promise<boolean>;
  if(first==='periodic'){s.tick(1);await writing;consuming=s.action({kind:'card',cardId:'supply',targetId:'A01-P1'});}
  else{consuming=s.action({kind:'card',cardId:'supply',targetId:'A01-P1'});await writing;s.tick(1);assert.equal(s.match!.battle.gameMs,4999);}
  h.release();assert.equal(await consuming,true);await idle(s);if(first==='consumption'){s.tick(1);await idle(s);}
  assert.equal(s.match!.battle.gameMs,5000);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,26);assert.equal(s.profile!.activeInventory.supply,1);assert.equal(h.events.filter(e=>e==='card').length,1);
  const saved=structuredClone(s.match!);saved.battle.status='paused';await s.load();assert.deepEqual(s.match,saved);assert.equal(s.profile!.activeInventory.supply,1);assert.equal(s.error,'');
});
function nearEnd(s:GameSession){const b=s.match!.battle;b.hasPlayerDispatch=true;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;for(const c of b.camps){c.garrison=c.owner==='P'?50:0;c.credit=fraction(0);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}return b.id;
}

test('R34 H15: a delayed dispatch commits to its original save but cannot replay into a newer practice',async()=>{
  const h=harness(),s=h.s;await s.load();await s.start('L01');const original=s.match!.battle.id;
  const writing=h.gate(),action=s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});await writing;
  await s.start('L01',true);const current=JSON.stringify(s.temporary);h.events.length=0;h.release();assert.equal(await action,true);
  assert.equal(s.profile!.activeMatch!.battle.id,original);assert.equal(s.profile!.activeMatch!.battle.armies.length,1);assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');assert.deepEqual(h.events,[]);
});
test('R34 H14: a delayed formal result saves its reward without opening a newer practice result page',async()=>{
  const h=harness(),s=h.s;await formal(s);const original=nearEnd(s);
  const writing=h.gate();s.tick(1);await writing;await s.start('L01',true);const current=JSON.stringify(s.temporary);h.events.length=0;h.release();await idle(s);
  assert.equal(s.profile!.latestResult!.matchId,original);assert.equal(s.profile!.rankPoints,30);assert.equal(s.profile!.choice!.state,'pending');assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');assert.deepEqual(h.events,[]);
});
for(const operation of ['pause','resume','forfeit','acknowledge'] as const)test(`R34 U18: delayed ${operation} cannot navigate a newer practice`,async()=>{
  const h=harness(),s=h.s;await formal(s);if(operation==='resume')await s.pause();
  const writing=h.gate(),pending=operation==='pause'?s.pause('home'):s[operation]();await writing;await s.start('L01',true);await s.pause();const current=JSON.stringify(s.temporary);
  h.release();await pending;assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'pause');
});
test('R34: a delayed normal start cannot discard a newer practice or its input sequence',async()=>{
  const h=harness(),s=h.s;await s.load();const writing=h.gate(),pending=s.start('L01');await writing;await s.start('L01',true);
  await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});const current=JSON.stringify(s.temporary);h.release();await pending;
  assert.equal(JSON.stringify(s.temporary),current);assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);assert.equal(s.temporary!.battle.armies.length,2);
});
test('R34 N34: a delayed failure protects the original save while the newer no-reward practice remains playable',async()=>{
  const h=harness(),s=h.s;await s.load();await s.start('L01');const writing=h.gate(),pending=s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});await writing;
  await s.start('L01',true);const current=JSON.stringify(s.temporary);h.release(true);assert.equal(await pending,false);
  assert.notEqual(s.error,'');assert.equal(s.profile!.activeMatch!.battle.camps[0]!.garrison,24);assert.equal(s.profile!.activeMatch!.battle.status,'paused');assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');
  assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);assert.equal(s.temporary!.battle.armies.length,1);assert.equal(s.profile!.activeMatch!.battle.armies.length,0);
});
test('R34: initial storage loading cannot navigate away from an already opened practice',async()=>{
  const h=harness(),s=h.s,writing=h.gate(),pending=s.load();await writing;await s.start('L01',true);const current=JSON.stringify(s.temporary);h.release();await pending;
  assert.ok(s.profile);assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');
});
test('R34: an old pause cannot navigate even when the intervening practice has already ended',async()=>{
  const h=harness(),s=h.s;await formal(s);const writing=h.gate(),pending=s.pause('home');await writing;await s.start('L01',true);await s.forfeit();assert.equal(s.page,'lessons');
  h.release();await pending;assert.equal(s.temporary,null);assert.equal(s.page,'lessons');assert.equal(s.profile!.activeMatch!.battle.status,'paused');
});
for(const operation of ['claim','abandon'] as const)test(`R34 G13: delayed ${operation} preserves its committed choice without changing the current practice page`,async()=>{
  const h=harness(),s=h.s;await formal(s);nearEnd(s);s.tick(1);await idle(s);await s.acknowledge('choice');const card=s.profile!.choice!.candidateIds[0]!;
  const writing=h.gate(),pending=operation==='claim'?s.claim(card):s.abandonChoice();await writing;await s.start('L01',true);await s.pause();const current=JSON.stringify(s.temporary);
  h.release();await pending;assert.equal(s.profile!.choice!.state,operation==='claim'?'claimed':'abandoned');assert.equal(s.profile!.rankPoints,30);assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'pause');
});
test('temporary simulation failures still stop the failing practice instead of masking the error',async()=>{
  const h=harness(),s=h.s;await s.load();await s.start('L01',true);s.temporary!.battle.gameMs=.5;s.tick(1);assert.notEqual(s.error,'');assert.equal(s.temporary!.battle.status,'paused');assert.equal(s.page,'recovery');
});
for(const original of ['choice','recovery','snapshot'] as const)test(`N34 G12: winning temporary practice preserves the original ${original} and every saved byte`,async()=>{
  const h=harness(),s=h.s;await formal(s);s.profile!.activeInventory.supply=2;s.match!.battle.factions.find(f=>f.id==='P')!.inventory.supply=2;await s.pause();await s.resume();
  if(original==='choice'){nearEnd(s);s.tick(1);await idle(s);await s.acknowledge('choice');assert.equal(await s.start('A01'),false);assert.equal(s.page,'choice');}
  else if(original==='recovery'){const writing=h.gate(),pending=s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'});await writing;h.release(true);await pending;assert.notEqual(s.error,'');}
  else await s.pause('home');
  const profile=JSON.stringify(s.profile),saved=[...h.data.entries()];await s.start('L01',true);const b=s.temporary!.battle,source=b.camps.find(c=>c.id==='L01-N1')!,enemy=b.camps.find(c=>c.owner==='E')!;source.owner='P';b.awaitingFirstDispatch=false;
  assert.ok(b.factions.every(f=>Object.values(f.inventory).every(n=>n===0)));assert.equal(await s.action({kind:'card',cardId:'supply',targetId:source.id}),false);assert.equal(s.profile!.activeInventory.supply,2);
  source.garrison=4;enemy.garrison=0;for(const c of b.camps)if(c.owner)c.feintUntil=1000000;
  assert.equal(await s.action({kind:'dispatch',sourceId:source.id,targetId:enemy.id}),true);
  for(let frame=0;frame<100&&s.page==='battle';frame++){s.tick(250);await idle(s);}
  assert.equal(s.page,'result');assert.equal(s.temporary!.battle.result!.independentWinner,'P');assert.equal(JSON.stringify(s.profile),profile);assert.deepEqual([...h.data.entries()],saved);
  await s.acknowledge();assert.equal(s.temporary,null);assert.equal(JSON.stringify(s.profile),profile);assert.deepEqual([...h.data.entries()],saved);
});
test('R34: restoring an older match cannot reset the newer practice input sequence',async()=>{
  const h=harness(),s=h.s;await s.load();await s.start('L01');const reading=h.gate('read'),pending=s.load();await reading;await s.start('L01',true);
  assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);const current=JSON.stringify(s.temporary);h.release();await pending;
  assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);assert.equal(s.temporary!.battle.armies.length,2);
});
test('R34 N34: loading a saved terminal battle settles that battle while preserving the current practice',async()=>{
  const h=harness(),s=h.s;await formal(s);const original=nearEnd(s);advanceBattle(s.match!.battle,240000);await s.pause();
  const reading=h.gate('read'),pending=s.load();await reading;await s.start('L01',true);const current=JSON.stringify(s.temporary);h.release();await pending;
  assert.equal(s.profile!.activeMatch,null);assert.equal(s.profile!.latestResult!.matchId,original);assert.equal(s.profile!.rankPoints,30);assert.equal(JSON.stringify(s.temporary),current);assert.equal(s.page,'battle');
});
test('S20: a setting submitted during reset cannot write pre-reset progress back into the new generation',async()=>{
  const h=harness(),s=h.s;await formal(s);s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;await s.pause();const old=s.profile!.generation;h.data.set('another-game:save','untouched');
  const writing=h.gate(),reset=s.reset();await writing;const setting=s.setting('vibration');h.release();await reset;await setting;
  assert.notEqual(s.profile!.generation,old);assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.highestRankPoints,0);assert.equal(s.profile!.activeMatch,null);assert.deepEqual(s.profile!.tutorialFirstWins,[]);assert.equal(s.profile!.settings.vibration,false);assert.equal(h.data.get('another-game:save'),'untouched');
  await s.load();assert.equal(s.error,'');assert.equal(s.profile!.rankPoints,0);assert.equal(s.page,'home');
});
for(const operation of ['load','recover'] as const)test(`S20: reset waits for an already running ${operation} before installing the new generation`,async()=>{
  const h=harness(),s=h.s;await formal(s);s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;await s.pause();await s.pause();const old=s.profile!.generation;
  if(operation==='recover'){const slots=SLOT_KEYS.map(k=>({key:k,revision:JSON.parse(h.data.get(k)!).revision as number}));h.data.set(slots.sort((a,b)=>b.revision-a.revision)[0]!.key,'{broken');await s.load();assert.ok(s.backup);}
  const entering=h.gate(operation==='load'?'read':'write'),pending=s[operation]();await entering;const reset=s.reset();await new Promise(r=>setImmediate(r));h.release();await Promise.all([pending,reset]);
  assert.notEqual(s.profile!.generation,old);assert.equal(s.profile!.rankPoints,0);assert.equal(s.error,'');assert.equal(s.page,'home');await s.load();assert.equal(s.profile!.rankPoints,0);assert.equal(s.error,'');
});
test('S20: a failed reset releases its guard so explicit reload and a new lesson remain available',async()=>{
  const h=harness(),s=h.s;await formal(s);h.data.set('another-game:save','untouched');const entering=h.gate(),pending=s.reset();await entering;h.release(true);await pending;
  assert.equal(s.page,'recovery');assert.match(s.error,/部分本地记录可能已清除/);assert.equal(h.data.get('another-game:save'),'untouched');await s.load();assert.equal(s.error,'');assert.equal(s.page,'home');assert.equal(s.profile!.rankPoints,0);assert.equal(await s.start('L01'),true);
});
