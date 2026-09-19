import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { advanceSimulation, chooseAiAction } from '../src/core/ai.ts';
import { advanceBattle, applyBattleAction } from '../src/core/battle.ts';
import { validateProfile } from '../src/app/validation.ts';
import { CARD_IDS } from '../src/core/progress.ts';
import type { StoragePort } from '../src/app/storage.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { armyPosition } from '../src/core/geometry.ts';

const NOW=Date.parse('2026-09-10T12:00:00+08:00');
function harness(){
  const data=new Map<string,string>();let now=NOW,fail=false,afterWrite:(()=>void)|null=null;
  const storage:StoragePort={async read(k){return data.get(k)??null;},async write(k,v){if(fail)throw new Error('full');data.set(k,v);const callback=afterWrite;afterWrite=null;callback?.();},async remove(k){data.delete(k);}};
  const notifications:string[]=[];const s=new GameSession({storage,now:()=>now,random:()=>.25,notify:m=>notifications.push(m),events:()=>{}});
  return {s,storage,data,notifications,setTime:(t:number)=>{now=t;},onNextWrite:(callback:()=>void)=>{afterWrite=callback;},fail:()=>{fail=true;}};
}
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(s.busy,0);}

test('U17: a live weekly transition notifies once, expires inventory and retains the current battle passives and permanent records',async()=>{
  const {s,setTime,notifications,storage}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday-1000);await s.load();
  const p=s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:3,march:3,supply:3,feint:3};p.passiveLevels={farming:2,logistics:2,fortification:2};p.rankPoints=60;p.highestRankPoints=90;
  await s.start('A01');const before=structuredClone(s.match!.battle);setTime(monday);s.tick(1);await idle(s);
  assert.deepEqual(notifications,['新周已开始，旧锦囊到期，本局兵法保留']);assert.equal(s.weekNotice,true);assert.equal(s.page,'battle');
  assert.equal(s.match!.battle.gameMs,before.gameMs);assert.deepEqual(s.match!.battle.camps,before.camps);assert.deepEqual(s.match!.battle.factions.find(f=>f.id==='P')!.passives,before.factions.find(f=>f.id==='P')!.passives);
  assert.deepEqual(s.profile!.activeInventory,{mobilize:0,march:0,supply:0,feint:0});assert.deepEqual(s.profile!.passiveLevels,{farming:0,logistics:0,fortification:0});
  assert.equal(s.profile!.rankPoints,60);assert.equal(s.profile!.highestRankPoints,90);assert.deepEqual(s.profile!.tutorialFirstWins,p.tutorialFirstWins);assert.deepEqual(s.profile!.unlockedCardIds,p.unlockedCardIds);
  assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);assert.equal(s.match!.battle.armies.length,1);s.tick(100);await idle(s);assert.equal(notifications.length,1);
  await s.pause('home');s.weekNotice=false;const saved=structuredClone(s.profile);await s.load();assert.equal(s.weekNotice,false);assert.equal(notifications.length,1);assert.deepEqual(s.profile,saved);
  const restored=new GameSession({storage,now:()=>monday,random:()=>.3,notify:m=>notifications.push(m),events:()=>{}});await restored.load();assert.equal(restored.weekNotice,false);assert.deepEqual(restored.profile,saved);assert.equal(notifications.length,1);
});

test('N28 N61 H15: pause and suspension restore exact attack deadlines and positions in a fresh session without offline attacks or repeated damage',async()=>{
  for(const phase of ['volley','tower-shot'] as const)for(const lead of [100,1])for(const suspend of [false,true]){
    const {storage}=harness();let now=NOW;const emitted:BattleEvent[]=[];
    const makeSession=()=>new GameSession({storage,now:()=>now,random:()=>.3,notify:()=>{},events:es=>emitted.push(...es)});
    const s=makeSession();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};await s.start('A01');
    const initial=s.match!.battle,archery=initial.camps.find(c=>c.id==='A01-N2')!,tower=initial.camps.find(c=>c.id==='A01-N5')!;
    archery.owner='P';archery.garrison=20;tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;
    for(const f of initial.factions)f.nextAiAtMs=10000;
    await s.pause();await s.resume();
    assert.equal(await s.action({kind:'card',cardId:'mobilize',targetId:'A01-P1'}),true);
    assert.equal(await s.action({kind:'card',cardId:'feint',targetId:'A01-E2'}),true);
    assert.equal(await s.action({kind:'dispatch',sourceId:archery.id,targetId:tower.id}),true);
    const boundary=phase==='volley'?s.match!.battle.armies[0]!.volleyCheckAtMs!:2000,pauseAt=boundary-lead;
    while(s.match!.battle.gameMs<pauseAt){s.tick(Math.min(250,pauseAt-s.match!.battle.gameMs));await idle(s);}
    const before=structuredClone(s.match!.battle),expected=structuredClone(before),expectedEvents=advanceSimulation(expected,2500);
    const positions=before.armies.map(a=>armyPosition(a,pauseAt));
    if(suspend)await s.suspend();else await s.pause();
    const frozen=structuredClone(s.match),inventory=structuredClone(s.profile!.activeInventory);emitted.length=0;now+=3600000;
    for(let i=0;i<20;i++)s.tick(250);assert.deepEqual(s.match,frozen);assert.deepEqual(emitted,[]);
    const restored=makeSession();await restored.load();assert.equal(restored.error,'');assert.equal(restored.page,'pause');assert.deepEqual(restored.match,frozen);assert.deepEqual(restored.profile!.activeInventory,inventory);
    restored.tick(250);assert.deepEqual(restored.match,frozen);assert.deepEqual(emitted,[]);
    await restored.resume();assert.equal(restored.match!.battle.gameMs,pauseAt);assert.deepEqual(restored.match!.battle.armies.map(a=>armyPosition(a,pauseAt)),positions);assert.deepEqual(emitted,[]);
    if(boundary-pauseAt>1){restored.tick(boundary-pauseAt-1);await idle(restored);assert.equal(emitted.some(e=>e.type===phase),false);}
    restored.tick(1);await idle(restored);const attackType=phase;assert.equal(emitted.filter(e=>e.type===attackType).length,1);
    const committed=structuredClone(restored.match!.battle);await restored.pause();await restored.load();await restored.resume();assert.deepEqual(restored.match!.battle,committed,'reloading after the attack preserves its consumed deadline and exact damage');
    while(restored.match!.battle.gameMs<2500){restored.tick(Math.min(250,2500-restored.match!.battle.gameMs));await idle(restored);}
    assert.deepEqual(restored.match!.battle,expected);assert.deepEqual(emitted,expectedEvents);assert.deepEqual(restored.profile!.activeInventory,inventory);
  }
});

test('U12: the final-thirty-second notice crosses once without changing simulation and does not replay after pause or reload',async()=>{
  for(const map of ['A01','A02','A03'] as const){
    const {s,notifications}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];await s.start(map);
    const b=s.match!.battle;b.gameMs=209998;
    for(const f of b.factions)f.nextAiAtMs=240001;
    for(const c of b.camps)if(c.nextShotAtMs!==null)c.nextShotAtMs=212000;
    await s.pause();await s.resume();s.tick(1);await idle(s);assert.equal(notifications.length,0);
    const expected=structuredClone(s.match!.battle);advanceSimulation(expected,210000);s.tick(1);await idle(s);
    assert.deepEqual(notifications,['还剩 30 秒：到时城多者胜，同城数比兵力']);assert.deepEqual(s.match!.battle,expected);
    s.tick(250);await idle(s);await s.pause();const paused=JSON.stringify(s.match);s.tick(250);assert.equal(JSON.stringify(s.match),paused);
    await s.load();await s.resume();s.tick(250);await idle(s);assert.equal(notifications.length,1);assert.equal(s.match!.battle.gameMs,210500);
  }
});

for(const boundary of [false,true])test(`S01 W01: advancing real clock during start preserves a valid atomic match (week boundary ${boundary})`,async()=>{
  const data=new Map<string,string>();let now=NOW;
  const storage:StoragePort={async read(k){return data.get(k)??null;},async write(k,v){data.set(k,v);},async remove(k){data.delete(k);}};
  const s=new GameSession({storage,now:()=>now++,random:()=>.3,notify:()=>{},events:()=>{}});
  await s.load();s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.firstDragCompleted=true;
  now=boundary?Date.parse('2026-09-14T00:00:00+08:00')-1:NOW+1000;
  assert.equal(await s.start('A03'),true,s.error);assert.equal(s.page,'battle');validateProfile(s.profile!);
  const match=structuredClone(s.match!);assert.ok(match.realStartedAt<=s.profile!.maxObservedTime);assert.equal(match.battle.gameMs,0);
  await s.load();assert.equal(s.page,'pause');assert.equal(s.error,'');assert.equal(s.match!.battle.id,match.battle.id);assert.equal(s.match!.realStartedAt,match.realStartedAt);assert.equal(s.match!.battle.gameMs,0);
});

test('first drag, pause, reload and continue preserve the same complete match',async()=>{
  const {s,storage}=harness();await s.load();await s.start('L01');assert.equal(s.page,'battle');
  await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});assert.equal(s.profile!.firstDragCompleted,true);
  for(let i=0;i<8;i++)s.tick(250);await idle(s);await s.pause();const snapshot=JSON.stringify(s.profile!.activeMatch);
  const restored=new GameSession({storage,now:()=>NOW+10000,random:()=>.5,notify:()=>{},events:()=>{}});await restored.load();
  assert.equal(restored.page,'pause');assert.equal(JSON.stringify(restored.match),snapshot);await restored.resume();assert.equal(restored.page,'battle');assert.equal(restored.match!.battle.gameMs,2000);
});
test('S02: reloading after a periodic checkpoint restores only five saved seconds without offline catch-up',async()=>{
  const {s,storage}=harness();await s.load();await s.start('L01');await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
  for(let i=0;i<20;i++){s.tick(250);await idle(s);}assert.equal(s.match!.battle.gameMs,5000);const saved=structuredClone(s.match!);saved.battle.status='paused';
  for(let i=0;i<4;i++){s.tick(250);await idle(s);}assert.equal(s.match!.battle.gameMs,6000);
  const events:string[]=[];const restored=new GameSession({storage,now:()=>NOW+10000,random:()=>.9,notify:()=>{},events:es=>events.push(...es.map(e=>e.type))});await restored.load();
  assert.equal(restored.page,'pause');assert.deepEqual(restored.match,saved);assert.deepEqual(events,[]);restored.tick(250);assert.deepEqual(restored.match,saved);
  await restored.resume();assert.equal(restored.match!.battle.gameMs,5000);restored.tick(250);assert.equal(restored.match!.battle.gameMs,5250);
});
test('two independent queued actions each commit once and hide cannot resume the clock',async()=>{
  const {s}=harness();await s.load();await s.start('L01');
  const first=s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
  const second=s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
  const hide=s.pause();await Promise.all([first,second,hide]);
  assert.equal(s.match!.battle.camps[0]!.garrison,6);assert.equal(s.match!.battle.armies.length,2);assert.equal(s.match!.battle.status,'paused');assert.equal(s.page,'pause');
});
test('failed save never publishes a dispatch, and recovery restores the original state',async()=>{
  const {s,storage,fail}=harness();await s.load();await s.start('L01');fail();await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
  assert.equal(s.page,'recovery');assert.equal(s.match!.battle.camps[0]!.garrison,24);assert.equal(s.match!.battle.armies.length,0);
  const restored=new GameSession({storage,now:()=>NOW,random:()=>0,notify:()=>{},events:()=>{}});await restored.load();assert.equal(restored.match!.battle.camps[0]!.garrison,24);
});
test('temporary practice preserves the original save and never grants permanent rewards',async()=>{
  const {s,data}=harness();await s.load();await s.start('L01');await s.pause('home');const before=[...data.entries()];const original=s.profile!.activeMatch!.battle.id;
  await s.start('L01');assert.ok(s.temporary);await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});await s.forfeit();
  assert.deepEqual([...data.entries()],before);assert.equal(s.profile!.activeMatch!.battle.id,original);assert.equal(s.profile!.tutorialFirstWins.length,0);
});
for(const outcome of ['win','loss','forfeit'] as const)test(`S10 G05: persistent write failures keep formal assets protected through a temporary ${outcome}`,async()=>{
  const data=new Map<string,string>();let failing=false,writes=0;
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;if(failing)throw new Error('persistent quota failure');data.set(k,v);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=2;s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;await s.start('A01');const id=s.match!.battle.id;
  failing=true;assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),false);assert.equal(s.page,'recovery');assert.equal(s.profile!.activeInventory.supply,2);assert.equal(s.match!.battle.status,'paused');const before=JSON.stringify(s.profile),bytes=[...data],attempts=writes;
  s.tick(250);assert.equal(JSON.stringify(s.profile),before);assert.equal(await s.start('A02'),false);assert.equal(JSON.stringify(s.profile),before);
  assert.equal(await s.start('L02',true),true);const b=s.temporary!.battle,own=b.camps.find(c=>c.owner==='P')!,enemy=b.camps.find(c=>c.id==='L02-N1')!;b.camps.find(c=>c.id==='L02-E1')!.owner=null;enemy.owner='E';assert.ok(b.factions.every(f=>Object.values(f.inventory).every(n=>n===0)));assert.equal(await s.action({kind:'card',cardId:'supply',targetId:own.id}),false);
  if(outcome==='forfeit')await s.forfeit();else{
    // Controlled terminal position; only the independent practice is modified.
    for(const c of b.camps)if(c.owner)c.feintUntil=1000000;own.garrison=outcome==='win'?50:0;enemy.garrison=outcome==='win'?0:50;
    if(outcome==='win')assert.equal(await s.action({kind:'dispatch',sourceId:own.id,targetId:enemy.id}),true);
    else assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:enemy.id,targetId:own.id}).ok,true);
    for(let i=0;i<40&&s.page==='battle';i++){s.tick(250);await idle(s);}assert.equal(s.page,'result');assert.equal(s.temporary!.battle.result!.playerRank,outcome==='win'?1:2);await s.acknowledge();
  }
  assert.equal(s.temporary,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(writes,attempts);s.primary();assert.equal(s.page,'recovery');
  failing=false;await s.load();assert.equal(s.error,'');assert.equal(s.page,'pause');assert.equal(s.match!.battle.id,id);assert.equal(s.profile!.activeInventory.supply,2);assert.deepEqual(s.profile!.tutorialFirstWins,['L01']);assert.equal(s.profile!.rankPoints,60);assert.equal(s.profile!.qualifiedArenaWins,0);
});
test('24-hour start time does not refresh on save and blocks resume without silently forfeiting',async()=>{
  const {s,setTime}=harness();await s.load();await s.start('L01');await s.pause();setTime(NOW+86400001);await s.resume();
  assert.equal(s.page,'pause');assert.equal(s.match!.realStartedAt,NOW);assert.equal(s.match!.battle.status,'paused');assert.equal(s.profile!.latestResult,null);
});
test('S15 Q14: resume rechecks the 24-hour limit when a queued operation finally reaches storage',async()=>{
  const {s,setTime,onNextWrite,notifications}=harness();await s.load();await s.start('L01');await s.pause();setTime(NOW+86400000-1);
  onNextWrite(()=>setTime(NOW+86400000+1));const saving=s.setting('vibration'),resuming=s.resume();await Promise.all([saving,resuming]);
  assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(s.match!.realStartedAt,NOW);assert.equal(s.profile!.latestResult,null);assert.ok(notifications.some(n=>n.includes('24 小时')));
});
for(const minutes of [1439,1440,1441])test(`S15 S16 Q14: a formal snapshot at ${minutes} minutes keeps its original expiry after saving and reloading`,async()=>{
  const {s,storage,setTime}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;
  await s.start('A01');const id=s.match!.battle.id;await s.pause();const at=NOW+minutes*60000;setTime(at);await s.setting('vibration');assert.equal(s.savedAt,at);
  const restored=new GameSession({storage,now:()=>at,random:()=>.5,notify:()=>{},events:()=>{}});await restored.load();assert.equal(restored.page,'pause');assert.equal(restored.match!.realStartedAt,NOW);
  await restored.resume();assert.equal(restored.page,minutes<=1440?'battle':'pause');assert.equal(restored.match!.battle.status,minutes<=1440?'running':'paused');assert.equal(restored.match!.battle.id,id);assert.equal(restored.match!.battle.gameMs,0);
  assert.equal(restored.profile!.rankPoints,100);assert.equal(restored.profile!.latestResult,null);assert.equal(restored.profile!.choice,null);validateProfile(restored.profile);
});
test('Q12: a queued resume cannot reopen the battle page after the same match is forfeited',async()=>{
  const {s}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=25;s.profile!.highestRankPoints=25;assert.equal(await s.start('A01'),true);await s.pause();
  const forfeiting=s.forfeit(),resuming=s.resume();await Promise.all([forfeiting,resuming]);assert.equal(s.profile!.rankPoints,15);assert.equal(s.profile!.activeMatch,null);assert.equal(s.page,'home');assert.equal(s.error,'');
});
test('all teaching maps can run through session transactions, validation and result unlocks',async()=>{
  const {s}=harness();await s.load();
  for(const id of ['L01','L02','L03'] as const){
    await s.start(id);assert.equal(s.page,'battle');
    if(id==='L01')await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
    let nextPlayer=0;
    for(let frames=0;frames<1200&&s.page==='battle';frames++){
      if(s.match!.battle.gameMs>=nextPlayer){
        const b=s.match!.battle,action=chooseAiAction(b,'P');
        if(action){const {faction,sequence,...input}=action;await s.action(input);}
        nextPlayer+=1000;
      }
      s.tick(250);await idle(s);
    }
    assert.equal(s.error,'',`${id}: ${s.error}`);assert.equal(s.page,'result',id);assert.equal(s.profile!.latestResult!.result!.independentWinner,'P',`${id} must be winnable without hidden bonuses`);
    assert.ok(s.profile!.tutorialFirstWins.includes(id));assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.formalCompleted,0);assert.equal(s.profile!.choice,null);assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));
    assert.deepEqual(s.profile!.unlockedCardIds,id==='L01'?['mobilize','supply','farming']:id==='L02'?['mobilize','supply','feint','farming','fortification']:[...CARD_IDS]);validateProfile(s.profile);await s.acknowledge();
  }
  assert.equal(s.profile!.unlockedCardIds.length,7);assert.equal(s.profile!.rankPoints,0);
});
test('T04: a lost first lesson keeps the completed drag and restores the original map with an eight-second computer delay',async()=>{
  const {s}=harness();await s.load();await s.start('L01');await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
  // Controlled losing position, followed by real arrival combat and session settlement.
  let b=s.match!.battle;const middle=b.camps.find(c=>c.id==='L01-N1')!;middle.owner='E';middle.garrison=50;advanceBattle(b,b.armies[0]!.arrivalAtMs);b.camps.find(c=>c.id==='L01-P1')!.garrison=0;
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:'L01-N1',targetId:'L01-P1'}).ok,true);
  for(let i=0;i<30&&s.page==='battle';i++){s.tick(250);await idle(s);}assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.result!.playerRank,2);assert.equal(s.profile!.firstDragCompleted,true);assert.equal(s.profile!.rankPoints,0);assert.deepEqual(s.profile!.tutorialFirstWins,[]);
  await s.acknowledge();await s.load();await s.start('L01');b=s.match!.battle;assert.deepEqual(b.camps.map(c=>c.garrison),[24,6,8]);assert.equal(b.awaitingFirstDispatch,false);assert.equal(b.factions.find(f=>f.id==='E')!.nextAiAtMs,8000);assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-E1'}),false);assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);
});
test('T06: unopened third lesson is rejected with its prerequisite and leaves the existing save untouched',async()=>{
  const {s,data,notifications}=harness();await s.load();const before=[...data];assert.equal(await s.start('L03'),false);assert.equal(s.match,null);assert.equal(s.page,'home');assert.ok(notifications.some(n=>n.includes('上一课')));assert.deepEqual([...data],before);
});
test('T09: third-lesson upgrades enforce seventy troops and losing one of two camps does not end the match',async()=>{
  const {s,data}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02'];s.profile!.unlockedCardIds=['mobilize','supply','feint','farming','fortification'];await s.start('L03');
  const initial=s.match!.battle.camps.find(c=>c.id==='L03-P1')!;assert.equal(initial.tier,2);assert.equal(initial.garrison,28);
  // Controlled pre-upgrade position; actions, travel, combat, saves and reload use the actual session.
  initial.garrison=69;await s.pause();await s.resume();const before=JSON.stringify(s.profile),bytes=[...data];assert.equal(await s.action({kind:'upgrade',targetId:'L03-P1'}),false);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  s.match!.battle.camps.find(c=>c.id==='L03-P1')!.garrison=70;assert.equal(await s.action({kind:'upgrade',targetId:'L03-P1'}),true);let c=s.match!.battle.camps.find(c=>c.id==='L03-P1')!;assert.equal(c.tier,3);assert.equal(c.garrison,45);
  assert.equal(await s.action({kind:'dispatch',sourceId:c.id,targetId:'L03-P2'}),true);c=s.match!.battle.camps.find(c=>c.id==='L03-P1')!;assert.equal(c.garrison,23);assert.equal(c.tier,3);
  const b=s.match!.battle;for(const f of b.factions)f.nextAiAtMs=1000000;for(const camp of b.camps)if(camp.owner)camp.feintUntil=1000000;
  Object.assign(b.camps.find(c=>c.id==='L03-N1')!,{owner:'E',garrison:80});assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:'L03-N1',targetId:'L03-P1'}).ok,true);
  const arrival=b.armies.find(a=>a.faction==='E')!.arrivalAtMs;while(s.match!.battle.gameMs<arrival){s.tick(Math.min(250,arrival-s.match!.battle.gameMs));await idle(s);}
  assert.equal(s.page,'battle');assert.equal(s.match!.battle.status,'running');assert.equal(s.match!.battle.camps.find(c=>c.id==='L03-P1')!.owner,'E');assert.equal(s.match!.battle.camps.find(c=>c.id==='L03-P1')!.tier,3);assert.equal(s.match!.battle.camps.find(c=>c.id==='L03-P2')!.owner,'P');assert.equal(s.match!.battle.factions.find(f=>f.id==='P')!.eliminated,false);assert.equal(s.profile!.latestResult,null);
  validateProfile(s.profile);await s.pause();assert.equal(s.error,'');const snapshot=structuredClone(s.match);await s.load();assert.deepEqual(s.match,snapshot);await s.resume();assert.equal(s.page,'battle');assert.equal(s.error,'');
});

test('formal matches complete the win, fixed choice, claim and next-match loop',async()=>{
  const {s}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];
  let champions=0;
  for(let game=0;game<6;game++){
    await s.start(s.nextMap);assert.equal(s.page,'battle');let next=0;
    for(let frame=0;frame<970&&s.page==='battle';frame++){
      const b=s.match!.battle;
      if(b.gameMs>=next){
        const action=chooseAiAction(b,'P');
        if(action){const {faction,sequence,...input}=action;await s.action(input);}
        next+=750;
      }
      s.tick(250);await idle(s);
    }
    assert.equal(s.error,'');assert.equal(s.page,'result');assert.equal(s.profile!.formalCompleted,game+1);validateProfile(s.profile);
    if(s.profile!.latestResult!.qualified){champions++;const id=s.profile!.choice!.candidateIds[0]!;await s.acknowledge('choice');await s.claim(id);assert.equal(s.profile!.choice!.state,'claimed');}
    else await s.acknowledge();
  }
  assert.ok(champions>0,'scripted legal play must reach the champion reward loop');assert.equal(s.profile!.qualifiedArenaWins,champions);validateProfile(s.profile);
});

test('W07 W08: crossing Monday during a write preserves accepted effects and rejects queued old cards',async()=>{
  const {s,setTime,onNextWrite}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday-100);
  await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.mobilize=2;
  await s.start('A01');const target=s.match!.battle.camps.find(c=>c.owner==='P')!;
  onNextWrite(()=>setTime(monday));
  const accepted=s.action({kind:'card',cardId:'mobilize',targetId:target.id});
  const queued=s.action({kind:'card',cardId:'mobilize',targetId:target.id});
  assert.deepEqual(await Promise.all([accepted,queued]),[true,false]);
  const camp=s.match!.battle.camps.find(c=>c.id===target.id)!;
  assert.equal(camp.mobilizeUntil,6000);assert.equal(s.profile!.weekId,'2026-09-14');assert.equal(s.profile!.activeInventory.mobilize,0);assert.equal(s.error,'');validateProfile(s.profile);
});
test('W03 W05: the first new-week card attempt clears expired stock even though the action is rejected',async()=>{
  const {s,setTime,storage}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday-1);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.mobilize=2;s.profile!.passiveLevels.farming=2;await s.start('A01');const id=s.match!.battle.id;
  setTime(monday);assert.equal(await s.action({kind:'card',cardId:'mobilize',targetId:'A01-P1'}),false);assert.equal(s.profile!.weekId,'2026-09-14');assert.equal(s.profile!.activeInventory.mobilize,0);assert.equal(s.profile!.passiveLevels.farming,0);
  const c=s.match!.battle.camps.find(c=>c.id==='A01-P1')!;assert.equal(c.garrison,20);assert.equal(c.mobilizeUntil,0);assert.equal(s.match!.battle.factions.find(f=>f.id==='P')!.passives.farming,2);assert.equal(s.error,'');assert.equal(s.weekNotice,true);
  const restored=new GameSession({storage,now:()=>monday,random:()=>0,notify:()=>{},events:()=>{}});await restored.load();assert.equal(restored.match!.battle.id,id);assert.equal(restored.profile!.activeInventory.mobilize,0);assert.equal(restored.profile!.weekId,'2026-09-14');
});
test('W11 W12: rolling back before the observed week blocks formal economy while temporary practice remains independent',async()=>{
  const {s,setTime,data}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=1;await s.start('A01');await s.pause();const bytes=[...data];
  setTime(monday-1);await s.resume();assert.equal(s.page,'recovery');assert.ok(s.error.includes('校准时间'));assert.equal(s.match!.battle.status,'paused');assert.equal(s.profile!.weekId,'2026-09-14');assert.deepEqual([...data],bytes);assert.equal(await s.start('A02'),false);
  const formal=JSON.stringify(s.profile);await s.start('L01',true);assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);s.tick(250);assert.equal(s.temporary!.battle.gameMs,250);assert.equal(JSON.stringify(s.profile),formal);assert.deepEqual([...data],bytes);await s.forfeit();
  setTime(monday+1);await s.load();assert.equal(s.error,'');assert.equal(s.page,'pause');assert.equal(s.profile!.activeInventory.supply,1);assert.equal(s.profile!.qualifiedArenaWins,0);await s.resume();assert.equal(s.page,'battle');
});
test('W12 S16: repeated saves after a same-week clock rollback cannot extend the observed 24-hour limit',async()=>{
  const {s,setTime,storage}=harness();await s.load();await s.start('L01');await s.pause();setTime(NOW+86400001);await s.setting('vibration');
  for(const elapsed of [3600000,7200000,1000]){setTime(NOW+elapsed);await s.setting('sound');await s.resume();assert.equal(s.page,'pause');assert.equal(s.match!.realStartedAt,NOW);assert.equal(s.profile!.maxObservedTime,NOW+86400001);}
  const restored=new GameSession({storage,now:()=>NOW+1000,random:()=>0,notify:()=>{},events:()=>{}});await restored.load();await restored.resume();assert.equal(restored.page,'pause');assert.equal(restored.profile!.latestResult,null);assert.equal(restored.profile!.maxObservedTime,NOW+86400001);
});
test('W09: a terminal result accepted before Monday keeps its settlement week after a slow write',async()=>{
  const {s,setTime,onNextWrite}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday-100);
  await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];await s.start('A01');
  const b=s.match!.battle;b.hasPlayerDispatch=true;
  // A deterministic near-deadline fixture enters the actual session settlement path.
  b.gameMs=239999;for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){if(c.owner==='P')c.garrison=50;else if(c.owner)c.garrison=0;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  onNextWrite(()=>setTime(monday));s.tick(1);await idle(s);
  assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.settledAt,monday-100);assert.equal(s.profile!.latestResult!.settlementWeek,'2026-09-07');
  assert.equal(s.profile!.rankPoints,30);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.choice!.state,'expired');assert.equal(s.profile!.weekId,'2026-09-14');validateProfile(s.profile);
});
