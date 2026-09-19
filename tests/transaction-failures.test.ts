import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { advanceBattle } from '../src/core/battle.ts';
import { CARD_IDS } from '../src/core/progress.ts';
import { fraction } from '../src/core/fraction.ts';
import type { StoragePort } from '../src/app/storage.ts';

const NOW=Date.parse('2026-09-11T12:00:00+08:00');
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}
function harness(random=.2){
  const data=new Map<string,string>(),events:string[]=[],presentations:unknown[]=[];let fault:'before'|'after'|'unknown'|null=null,unreadable=false,now=NOW,writeTime:number|null=null;
  const storage:StoragePort={async read(k){if(unreadable)throw new Error('readback unavailable');return data.get(k)??null;},async write(k,v){const kind=fault;fault=null;if(kind==='before')throw new Error('quota');data.set(k,v);if(writeTime!==null){now=writeTime;writeTime=null;}if(kind==='unknown')unreadable=true;if(kind==='after'||kind==='unknown')throw new Error('callback lost');},async remove(k){data.delete(k);}};
  const make=()=>new GameSession({storage,now:()=>now,random:()=>random,notify:()=>{},events:es=>events.push(...es.map(e=>e.type)),present:event=>presentations.push(event)});
  return {s:make(),make,data,events,presentations,setTime:(time:number)=>{now=time;},setWriteTime:(time:number)=>{writeTime=time;},allowReads:()=>{unreadable=false;},arm:(kind:'before'|'after'|'unknown')=>{fault=kind;}};
}
for(const [id,random]of [['farming',.2],['logistics',.5],['fortification',.9]] as const)test(`G4.2: ${id} claim committed across Monday clears old-week layers without publishing a stale reward`,async()=>{
  const h=harness(random),s=h.s,monday=Date.parse('2026-09-14T00:00:00+08:00');h.setTime(monday-1);await s.load();const p=s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.passiveLevels[id]=3;
  await s.start('A01');await nearFormalEnd(s);await finish(s);await s.acknowledge('choice');h.presentations.length=0;h.setWriteTime(monday);await s.claim(id);
  assert.equal(s.profile!.choice!.state,'claimed');assert.equal(s.profile!.weekId,'2026-09-14');assert.equal(s.profile!.passiveLevels[id],0);assert.deepEqual(h.presentations,[]);
  const restored=h.make();await restored.load();assert.equal(restored.profile!.passiveLevels[id],0);assert.equal(restored.profile!.rankPoints,30);assert.equal(restored.profile!.qualifiedArenaWins,0);assert.deepEqual(h.presentations,[]);
});
for(const [id,random]of [['farming',.2],['logistics',.5],['fortification',.9]] as const)for(const failure of [null,'before','after','unknown'] as const)test(`G4.2: ${id} claim ${failure??'successful'} publishes feedback only after confirmed storage and never on repeat or reload`,async()=>{
  const h=harness(random),s=h.s;await s.load();const p=s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.passiveLevels[id]=3;
  await s.start('A01');await nearFormalEnd(s);await finish(s);await s.acknowledge('choice');assert.ok(s.profile!.choice!.candidateIds.includes(id));const choiceId=s.profile!.choice!.choiceId;
  h.presentations.length=0;if(failure)h.arm(failure);await s.claim(id);
  if(failure==='before'||failure==='unknown')assert.deepEqual(h.presentations,[]);
  else assert.deepEqual(h.presentations,[{kind:'passive-claim',choiceId,cardId:id,before:3,after:4}]);
  h.allowReads();const restored=h.make();await restored.load();assert.equal(restored.profile!.passiveLevels[id],failure==='before'?3:4);
  h.presentations.length=0;if(failure!=='before')await restored.claim(id);await restored.load();assert.deepEqual(h.presentations,[]);
});
for(const failure of [null,'before','unknown'] as const)test(`G4.2: ${failure??'successful'} start feedback is separate from resume and restored matches`,async()=>{
  const h=harness(),s=h.s;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.passiveLevels.farming=4;
  await s.setting('vibration');if(failure)h.arm(failure);await s.start('A01');
  if(failure)assert.deepEqual(h.presentations,[]);else assert.deepEqual(h.presentations,[{kind:'passive-start',matchId:s.match!.battle.id}]);
  h.allowReads();h.presentations.length=0;await s.load();if(s.match){await s.resume();await s.pause();await s.resume();}assert.deepEqual(h.presentations,[]);
});
for(const operation of ['start','claim'] as const)test(`G4.2: suspension during pending ${operation} suppresses late presentation without cancelling the committed record`,async()=>{
  const h=harness(),s=h.s;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.passiveLevels.farming=3;
  if(operation==='claim'){await s.start('A01');await nearFormalEnd(s);await finish(s);await s.acknowledge('choice');}
  h.presentations.length=0;const committing=operation==='start'?s.start('A01'):s.claim('farming');await s.suspend();await committing;await idle(s);assert.deepEqual(h.presentations,[]);
  if(operation==='claim'){assert.equal(s.profile!.passiveLevels.farming,4);assert.equal(s.profile!.choice!.state,'claimed');}
  else{assert.ok(s.match);assert.equal(s.match.battle.status,'paused');assert.equal(s.page,'pause');}
});
for(const failure of ['before','after','unknown'] as const)test(`W03: rejected-card rollover ${failure}-write failure never applies the card or partially clears assets`,async()=>{
  const h=harness(),s=h.s,monday=Date.parse('2026-09-14T00:00:00+08:00');h.setTime(monday-1);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.mobilize=2;s.profile!.passiveLevels.farming=2;await s.start('A01');const id=s.match!.battle.id,bytes=[...h.data];
  h.setTime(monday);h.arm(failure);h.events.length=0;assert.equal(await s.action({kind:'card',cardId:'mobilize',targetId:'A01-P1'}),false);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.mobilizeUntil,0);assert.equal(h.events.filter(e=>e==='card').length,0);
  if(failure==='after'){assert.equal(s.error,'');assert.equal(s.profile!.weekId,'2026-09-14');assert.equal(s.profile!.activeInventory.mobilize,0);assert.equal(s.profile!.passiveLevels.farming,0);}
  else{assert.equal(s.page,'recovery');assert.equal(s.profile!.weekId,'2026-09-07');assert.equal(s.profile!.activeInventory.mobilize,2);assert.equal(s.profile!.passiveLevels.farming,2);const frozen=JSON.stringify(s.profile);s.tick(250);assert.equal(JSON.stringify(s.profile),frozen);if(failure==='before')assert.deepEqual([...h.data],bytes);}
  h.allowReads();const restored=h.make();await restored.load();assert.equal(restored.error,'');assert.equal(restored.profile!.weekId,'2026-09-14');assert.equal(restored.profile!.activeInventory.mobilize,0);assert.equal(restored.profile!.passiveLevels.farming,0);assert.equal(restored.match!.battle.id,id);assert.equal(restored.match!.battle.status,'paused');assert.equal(restored.match!.battle.factions.find(f=>f.id==='P')!.passives.farming,2);assert.equal(restored.match!.battle.camps.find(c=>c.id==='A01-P1')!.mobilizeUntil,0);
});
async function finish(s:GameSession){s.tick(1);await idle(s);}
async function nearFormalEnd(s:GameSession){
  const b=s.match!.battle;b.gameMs=239999;b.hasPlayerDispatch=true;for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){c.garrison=c.owner==='P'?50:0;c.credit=fraction(0);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  await s.pause();await s.resume();
}
const actions=['start','upgrade','mobilize','supply','feint','march','settlement','claim','abandon-choice','forfeit','setting','lesson-first-win'] as const;
const caseIds={start:'S01 Q10',upgrade:'N09 N16',mobilize:'S03 S04 S05',supply:'S03 S04 S05',feint:'S03 S04 S05',march:'S03 S04 S05',settlement:'S07 S19',claim:'S06 G11','abandon-choice':'G13',forfeit:'S14 Q12',setting:'settings atomicity','lesson-first-win':'T05 S07'};
for(const kind of actions)for(const failure of ['before','after','unknown'] as const)test(`${caseIds[kind]}: ${kind} ${failure}-write failure is atomic and recoverable`,async()=>{
  const h=harness(),s=h.s;await s.load();
  if(kind==='lesson-first-win'){
    await s.start('L01');await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});
    const b=s.match!.battle;for(const f of b.factions)f.nextAiAtMs=1000000;advanceBattle(b,b.armies[0]!.arrivalAtMs);const source=b.camps.find(c=>c.id==='L01-N1')!,enemy=b.camps.find(c=>c.owner==='E')!;source.garrison=50;
    await s.action({kind:'dispatch',sourceId:source.id,targetId:enemy.id});
    const arrival=s.match!.battle.armies.find(a=>a.targetId===enemy.id)!.arrivalAtMs;advanceBattle(s.match!.battle,arrival-1);await s.pause();await s.resume();
  }else{
    s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];
    s.profile!.activeInventory={mobilize:2,march:2,supply:2,feint:2};s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;
    if(kind==='start'){await s.setting('vibration');s.page='prepare';}
    else{await s.start('A01');s.match!.battle.camps.find(c=>c.owner==='P')!.garrison=30;await s.pause();await s.resume();}
    if(['settlement','claim','abandon-choice'].includes(kind))await nearFormalEnd(s);
    if(kind==='claim'||kind==='abandon-choice'){await finish(s);await s.acknowledge('choice');}
  }
  const perform=async(target:GameSession)=>{
    const own=target.match?.battle.camps.find(c=>c.owner==='P'),enemy=target.match?.battle.camps.find(c=>c.owner&&c.owner!=='P');
    if(kind==='start')await target.start('A01');
    else if(kind==='upgrade')await target.action({kind:'upgrade',targetId:own!.id});
    else if(kind==='march')await target.action({kind:'dispatch',sourceId:own!.id,targetId:target.match!.battle.camps.find(c=>c.id==='A01-N4')!.id,march:true});
    else if(kind==='mobilize'||kind==='supply'||kind==='feint')await target.action({kind:'card',cardId:kind,targetId:(kind==='feint'?enemy:own)!.id});
    else if(kind==='settlement'||kind==='lesson-first-win')await finish(target);
    else if(kind==='claim')await target.claim(target.profile!.choice!.candidateIds[0]!);
    else if(kind==='abandon-choice')await target.abandonChoice();
    else if(kind==='forfeit')await target.forfeit();
    else await target.setting('vibration');
  };
  const before=JSON.parse(JSON.stringify(s.profile));h.events.length=0;h.arm(failure);await perform(s);
  if(failure==='before'){
    assert.equal(s.page,'recovery');assert.equal(h.events.filter(e=>['card','upgrade','dispatch','result'].includes(e)).length,0,'failed commit cannot publish success feedback');
    if(['mobilize','supply','feint','march'].includes(kind)){const current=structuredClone(s.profile);current!.activeMatch!.battle.status=before.activeMatch.battle.status;assert.deepEqual(current,before,'failed consumption must preserve the complete in-memory economy and battle');}
    if(kind==='start'){assert.equal(s.match,null);s.tick(250);assert.equal(s.match,null);assert.equal(s.profile!.rankPoints,60);assert.equal(s.profile!.latestResult,null);}
    const restored=h.make();await restored.load();if(before.activeMatch)before.activeMatch.battle.status='paused';assert.deepEqual(restored.profile,before);
    if(restored.match)await restored.resume();await perform(restored);assert.equal(restored.error,'');
    if(kind==='claim')assert.equal(restored.profile!.choice!.state,'claimed');
    if(kind==='lesson-first-win')assert.deepEqual(restored.profile!.tutorialFirstWins,['L01']);
  }else if(failure==='unknown'){
    assert.equal(s.page,'recovery');assert.notEqual(s.error,'');assert.equal(h.events.filter(e=>['card','upgrade','dispatch','result'].includes(e)).length,0);
    const frozen=JSON.stringify(s.profile);s.tick(250);assert.equal(JSON.stringify(s.profile),frozen);if(s.match)assert.equal(s.match.battle.status,s.match.battle.result?'finished':'paused');
    if(kind==='start'){assert.equal(s.match,null);assert.equal(await s.start('A02'),false);assert.equal(JSON.stringify(s.profile),frozen);}
    h.allowReads();const restored=h.make();await restored.load();assert.equal(restored.error,'');
    if(restored.match){assert.equal(restored.match.battle.status,'paused');for(const card of ['mobilize','supply','feint','march'] as const)assert.equal(restored.profile!.activeInventory[card],kind===card?1:2);}
    if(kind==='start'){
      const id=restored.match!.battle.id;assert.equal(restored.match!.battle.gameMs,0);assert.equal(restored.match!.rankedCommitment,true);assert.equal(restored.profile!.rankPoints,60);assert.equal(restored.profile!.latestResult,null);
      assert.equal(await restored.start('A02'),false);assert.equal(restored.match!.battle.id,id);await restored.resume();assert.equal(restored.page,'battle');restored.tick(250);assert.equal(restored.match!.battle.gameMs,250);await restored.pause();
    }
    if(kind==='upgrade'){const camp=restored.match!.battle.camps.find(c=>c.owner==='P')!;assert.equal(camp.tier,2);assert.equal(camp.garrison,20);}
    if(kind==='supply')assert.equal(restored.match!.battle.camps.find(c=>c.owner==='P')!.garrison,36);
    if(kind==='mobilize'){const camp=restored.match!.battle.camps.find(c=>c.owner==='P')!;assert.equal(camp.mobilizeUntil,6000);assert.deepEqual(camp.bonusBudget,fraction(8));}
    if(kind==='feint')assert.equal(restored.match!.battle.camps.find(c=>c.owner&&c.owner!=='P')!.feintUntil,4000);
    if(kind==='march'){assert.equal(restored.match!.battle.armies.length,1);assert.equal(restored.match!.battle.armies[0]!.remainingCount,15);}
    if(['mobilize','supply','feint','march'].includes(kind))assert.equal(restored.profile!.activeInventory[kind as 'supply'],1);
    if(kind==='claim')assert.equal(restored.profile!.choice!.state,'claimed');
    if(kind==='abandon-choice')assert.equal(restored.profile!.choice!.state,'abandoned');
    if(kind==='settlement'||kind==='forfeit')assert.equal(restored.profile!.activeMatch,null);
    if(kind==='lesson-first-win')assert.deepEqual(restored.profile!.tutorialFirstWins,['L01']);
    if(kind==='setting')assert.equal(restored.profile!.settings.vibration,true);
    const committed=JSON.stringify(restored.profile);const again=h.make();await again.load();assert.equal(JSON.stringify(again.profile),committed);assert.equal(h.events.filter(e=>e==='result').length,0);
  }else{
    assert.equal(s.error,'');const restored=h.make();await restored.load();const committed=JSON.parse(JSON.stringify(s.profile));if(committed.activeMatch)committed.activeMatch.battle.status='paused';assert.deepEqual(restored.profile,committed);
    if(kind==='settlement'||kind==='lesson-first-win'){
      s.tick(1);await idle(s);assert.equal(h.events.filter(e=>e==='result').length,1,'committed result is published once and never replayed on reload');
    }
  }
});
for(const failure of ['after','unknown'] as const)for(const card of ['supply','farming'] as const)test(`S06: ${card} claiming with a ${failure}-write lost callback restores exactly one grant and rejects repeated claims`,async()=>{
  const h=harness(),s=h.s;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=2;s.profile!.passiveLevels.farming=2;await s.start('A01');await nearFormalEnd(s);await finish(s);await s.acknowledge('choice');const id=s.profile!.choice!.choiceId;
  h.arm(failure);await s.claim(card);if(failure==='unknown'){assert.equal(s.page,'recovery');assert.equal(s.profile!.choice!.state,'pending');assert.equal(s.profile!.activeInventory.supply,2);assert.equal(s.profile!.passiveLevels.farming,2);}else assert.equal(s.error,'');
  h.allowReads();const restored=h.make();await restored.load();assert.equal(restored.profile!.choice!.state,'claimed');assert.equal(restored.profile!.choice!.choiceId,id);assert.equal(restored.profile!.choice!.selected,card);assert.equal(restored.profile!.activeInventory.supply,card==='supply'?3:2);assert.equal(restored.profile!.passiveLevels.farming,card==='farming'?3:2);assert.equal(restored.profile!.rankPoints,30);assert.equal(restored.profile!.qualifiedArenaWins,1);
  const before=JSON.stringify(restored.profile),bytes=[...h.data];await Promise.all([restored.claim(card),restored.claim(card)]);assert.equal(JSON.stringify(restored.profile),before);assert.deepEqual([...h.data],bytes);await restored.load();assert.equal(JSON.stringify(restored.profile),before);assert.equal(restored.page,'home');
});
