import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { validateProfile } from '../src/app/validation.ts';
import { CARD_IDS, CARDS, claimChoice, rankName, settleMatch } from '../src/core/progress.ts';
import { compare, fraction } from '../src/core/fraction.ts';
import { campCapacity, naturalRate, passiveBonus, troopSpeed } from '../src/core/config.ts';
import { advanceBattle, factionOf } from '../src/core/battle.ts';

const NOW=Date.parse('2026-09-11T12:00:00+08:00');
function harness(now:()=>number=()=>NOW,events:string[]=[],data=new Map<string,string>()){
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){data.set(k,v);},async remove(k){data.delete(k);}},now,random:()=>0,notify:()=>{},events:es=>events.push(...es.map(e=>e.type))});
  return s;
}
async function ready(events:string[]=[],data?:Map<string,string>){const s=harness(undefined,events,data);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];return s;}
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);assert.equal(s.error,'');}
async function finish(s:GameSession,win:boolean,inspect?:(s:GameSession)=>void){
  assert.equal(await s.start(s.nextMap),true);const b=s.match!.battle;
  inspect?.(s);
  // Controlled last-millisecond states exercise real ranking and persistence, not balance or winnability.
  b.hasPlayerDispatch=true;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){c.credit=fraction(0);c.garrison=c.owner==='P'?(win?50:0):c.owner?(win?0:1):c.garrison;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  s.tick(1);await idle(s);assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.result!.playerRank,win?1:4);validateProfile(s.profile);
}
async function deadlineFixture(s:GameSession,troops:number[],action:'dispatch'|'supply'|'none'='dispatch'){
  // Only the final distribution/time is preset; actions, deadline ranking, settlement and storage use production code.
  assert.equal(await s.start('A01'),true);
  if(action==='dispatch'){
    assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);
    advanceBattle(s.match!.battle,s.match!.battle.armies[0]!.arrivalAtMs);assert.equal(s.match!.battle.armies.length,0);const reset=s.match!.battle.camps.find(c=>c.id==='A01-N4')!;reset.owner=null;reset.garrison=8;reset.credit=fraction(0);
  }else if(action==='supply')assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);
  const b=s.match!.battle;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){if(c.owner)c.garrison=troops[['P','E1','E2','E3'].indexOf(c.owner)]!;c.credit=fraction(0);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  assert.equal(b.hasPlayerDispatch,action==='dispatch');validateProfile(s.profile);
}
for(const initial of [450,1200])test(`Q03 Q05 G16: ${initial} points rise on a win, fall on a loss and preserve the high after claiming, old callbacks and Monday`,async()=>{
  let now=NOW;const s=harness(()=>now);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=initial;s.profile!.highestRankPoints=initial;
  assert.equal(rankName(initial),initial===450?'校尉 · 5 级':'大将军 · 5 级');await deadlineFixture(s,[40,30,20,10]);s.tick(1);await idle(s);const winId=s.profile!.latestResult!.matchId;
  assert.equal(s.profile!.rankPoints,initial+30);assert.equal(rankName(s.profile!.rankPoints),initial===450?'中郎将 · 1 级':'大将军 · 6 级');await s.acknowledge('choice');await s.claim('supply');assert.equal(s.profile!.rankPoints,initial+30);assert.equal(s.profile!.highestRankPoints,initial+30);
  await deadlineFixture(s,[10,40,30,20]);s.tick(1);await idle(s);assert.equal(s.profile!.rankPoints,initial+20);assert.equal(rankName(s.profile!.rankPoints),initial===450?'校尉 · 5 级':'大将军 · 5 级');assert.equal(s.profile!.highestRankPoints,initial+30);
  const before=JSON.stringify(s.profile);assert.throws(()=>settleMatch(s.profile!,winId,now,'natural',()=>.9),/对局已变化/);assert.equal(JSON.stringify(s.profile),before);await s.claim('supply');assert.equal(JSON.stringify(s.profile),before);
  now=Date.parse('2026-09-14T00:00:00+08:00');await s.setting('sound');await s.load();assert.equal(s.profile!.rankPoints,initial+20);assert.equal(s.profile!.highestRankPoints,initial+30);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.activeInventory.supply,0);validateProfile(s.profile);
});
test('Q16: a saved one-card reward changes supply from two to three only once and one use returns it to two',async()=>{
  const data=new Map<string,string>(),s=await ready([],data);s.profile!.activeInventory.supply=2;await finish(s,true);const id=s.profile!.choice!.choiceId;assert.equal(s.profile!.choice!.grantQuantity,1);await s.acknowledge('choice');await Promise.all([s.claim('supply'),s.claim('supply')]);await s.load();assert.equal(s.profile!.activeInventory.supply,3);assert.equal(s.profile!.choice!.choiceId,id);
  const before=JSON.stringify(s.profile);await s.claim('supply');assert.equal(JSON.stringify(s.profile),before);await s.start('A01');await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'});assert.equal(s.profile!.activeInventory.supply,2);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,26);
  const restored=harness(undefined,[],data);await restored.load();assert.equal(restored.profile!.activeInventory.supply,2);assert.equal(restored.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,26);assert.equal(restored.profile!.rankPoints,30);assert.equal(restored.profile!.qualifiedArenaWins,1);
});
test('Q17: nine wins with passive picks and abandoned fourth and eighth choices never backfill or debit rewards on losses',async()=>{
  const s=await ready(),ids=new Set<string>();let layers=0,points=0;
  for(let win=1;win<=9;win++){
    await finish(s,true);points+=30;const c=s.profile!.choice!;assert.equal(c.grantQuantity,1);assert.equal(ids.has(c.choiceId),false);ids.add(c.choiceId);assert.equal(s.profile!.qualifiedArenaWins,win);await s.acknowledge('choice');
    if(win===4||win===8)await s.abandonChoice();else{await s.claim('farming');layers++;}
    assert.equal(s.profile!.passiveLevels.farming,layers);assert.equal(s.profile!.rankPoints,points);const before=JSON.stringify(s.profile);await s.claim('farming');assert.equal(JSON.stringify(s.profile),before);await s.load();assert.equal(JSON.stringify(s.profile),before);
    if(win===4||win===8){await finish(s,false);points-=10;assert.equal(s.profile!.passiveLevels.farming,layers);assert.equal(s.profile!.qualifiedArenaWins,win);assert.equal(s.profile!.choice!.state,'abandoned');await s.acknowledge();}
  }
  assert.equal(ids.size,9);assert.equal(s.profile!.passiveLevels.farming,7);assert.equal(s.profile!.rankPoints,250);assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));validateProfile(s.profile);
});
test('G09 S19: pending mixed candidates remain fixed across return and a new session without consulting randomness',async()=>{
  const data=new Map<string,string>(),s=await ready([],data);s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];await finish(s,true);const choice=structuredClone(s.profile!.choice!);
  assert.equal(new Set(choice.candidateIds).size,3);assert.equal(choice.candidateIds.filter(id=>CARDS[id].kind==='active').length,2);assert.equal(choice.candidateIds.filter(id=>CARDS[id].kind==='passive').length,1);assert.ok(choice.candidateIds.every(id=>choice.unlockSnapshot.includes(id)));
  await s.load();assert.equal(s.page,'result');assert.deepEqual(s.profile!.choice,choice);await s.acknowledge('choice');await s.acknowledge('home');
  const restored=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){data.set(k,v);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>{throw new Error('must not redraw persisted candidates');},notify:()=>{},events:()=>{}});await restored.load();assert.equal(restored.page,'home');assert.deepEqual(restored.profile!.choice,choice);assert.equal(restored.profile!.rankPoints,30);assert.equal(restored.profile!.qualifiedArenaWins,1);await restored.acknowledge('choice');await restored.claim(choice.candidateIds[0]!);assert.equal(restored.profile!.choice!.state,'claimed');assert.equal(restored.error,'');
});
test('G02: a deadline champion with a successful dispatch and no enemy capture still receives the normal reward',async()=>{
  const s=await ready();await deadlineFixture(s,[40,30,20,10]);assert.equal(s.match!.battle.camps.filter(c=>c.owner==='P').length,1);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-E1')!.owner,'E1');s.tick(1);await idle(s);
  assert.equal(s.profile!.latestResult!.qualified,true);assert.equal(s.profile!.rankPoints,30);assert.equal(s.profile!.qualifiedArenaWins,1);assert.equal(s.profile!.choice!.grantQuantity,1);
});
test('G03: a zero-rank standard match ending after one legal road journey receives a normal independent-win reward',async()=>{
  const s=await ready();await s.start('A01');const b=s.match!.battle;
  // Preset final opposition, then finish through a real dispatch and travel; not a speedrun or balance claim.
  for(const c of b.camps)if(c.owner==='E2'||c.owner==='E3')c.owner='P';for(const id of ['E2','E3'] as const){factionOf(b,id)!.eliminated=true;factionOf(b,id)!.rank=3;}
  b.camps.find(c=>c.id==='A01-P1')!.garrison=50;b.camps.find(c=>c.id==='A01-E1')!.owner='P';const last=b.camps.find(c=>c.id==='A01-N4')!;last.owner='E1';last.garrison=0;validateProfile(s.profile);assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);
  const arrival=s.match!.battle.armies[0]!.arrivalAtMs;while(s.page==='battle'&&s.match!.battle.gameMs<arrival+250){s.tick(250);await idle(s);}assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.result!.atMs,arrival);assert.equal(s.profile!.latestResult!.qualified,true);assert.equal(s.profile!.rankPoints,30);assert.equal(s.profile!.qualifiedArenaWins,1);assert.equal(s.profile!.choice!.grantQuantity,1);validateProfile(s.profile);
});
test('Q01: actual deadline ranks settle 100 points to 130, 95, 92 and 90 with champion-only rewards',async()=>{
  for(const [rank,points]of [[1,130],[2,95],[3,92],[4,90]]){
    const s=await ready();s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;const own=50-rank!*10;
    await deadlineFixture(s,[own,...[40,30,20,10].filter(n=>n!==own)]);s.tick(1);await idle(s);
    const p=s.profile!,r=p.latestResult!;assert.equal(r.result!.playerRank,rank);assert.equal(r.rankPointsBefore,100);assert.equal(r.rankDeltaApplied,points!-100);assert.equal(p.rankPoints,points);assert.equal(p.highestRankPoints,Math.max(100,points!));assert.equal(p.formalCompleted,1);
    assert.equal(p.qualifiedArenaWins,rank===1?1:0);assert.equal(r.qualified,rank===1);assert.equal(p.choice?.grantQuantity??0,rank===1?1:0);assert.equal(r.fixedChoices.length,rank===1?3:0);
    const saved=JSON.stringify(p);await s.load();assert.equal(JSON.stringify(s.profile),saved);assert.equal(s.page,'result');
  }
});
test('Q06 Q08: competition ties retain 1/2/2/4 or 1/1/3/4 and never invent a tie-breaking champion',async()=>{
  for(const [troops,ranks]of [ [[40,30,30,10],[1,2,2,4]],[[30,40,30,10],[2,1,2,4]],[[40,40,20,10],[1,1,3,4]],[[20,40,40,10],[3,1,1,4]] ])for(const reverse of [false,true]){
    const s=await ready();s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;await deadlineFixture(s,troops!);if(reverse)s.match!.battle.factions.reverse();s.tick(1);await idle(s);
    const p=s.profile!,r=p.latestResult!,expected=Object.fromEntries(['P','E1','E2','E3'].map((id,i)=>[id,ranks![i]]));assert.deepEqual(r.result!.ranks,expected);
    const tiedFirst=ranks!.filter(rank=>rank===1).length>1;assert.equal(r.result!.independentWinner,tiedFirst?null:['P','E1','E2','E3'][ranks!.indexOf(1)]);
    const qualified=!tiedFirst&&ranks![0]===1;assert.equal(p.rankPoints,100+(qualified?30:ranks![0]===2?-5:ranks![0]===3?-8:0));assert.equal(p.qualifiedArenaWins,qualified?1:0);assert.equal(p.choice!==null,qualified);
    const saved=JSON.stringify(p);await s.load();assert.equal(JSON.stringify(s.profile),saved);
  }
});
test('Q07 Q08: no dispatch or supply-only play retains loss penalties without granting wins, cards or map progress',async()=>{
  for(const action of ['none','supply'] as const)for(const rank of [1,2,3,4]){
    const s=await ready();s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;s.profile!.activeInventory.supply=1;const own=50-rank*10;
    await deadlineFixture(s,[own,...[40,30,20,10].filter(n=>n!==own)],action);s.tick(1);await idle(s);const p=s.profile!,r=p.latestResult!;
    assert.equal(r.result!.playerRank,rank);assert.equal(r.result!.independentWinner,rank===1?'P':'E1');assert.equal(p.rankPoints,100+[0,0,-5,-8,-10][rank]!);
    assert.equal(p.formalCompleted,0);assert.equal(p.choice,null);assert.equal(p.qualifiedArenaWins,0);assert.equal(r.qualified,false);assert.equal(p.activeInventory.supply,action==='none'?1:0);
    const saved=JSON.stringify(p);await s.load();assert.equal(JSON.stringify(s.profile),saved);
  }
});
test('Q12: a committed 25-point forfeit survives duplicate input and reload without rank, card or map refunds',async()=>{
  const data=new Map<string,string>(),s=await ready([],data);s.profile!.rankPoints=25;s.profile!.highestRankPoints=25;s.profile!.activeInventory.supply=1;await s.start('A01');const id=s.match!.battle.id;
  await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'});await Promise.all([s.forfeit(),s.forfeit()]);await s.load();
  const p=s.profile!,r=p.latestResult!;assert.equal(p.rankPoints,15);assert.equal(p.activeInventory.supply,0);assert.equal(p.highestRankPoints,25);assert.equal(p.formalCompleted,0);assert.equal(p.choice,null);assert.equal(p.qualifiedArenaWins,0);assert.equal(r.result,null);assert.equal(r.settlementKind,'forfeit');
  const saved=JSON.stringify(p);settleMatch(p,id,NOW,'forfeit',()=>0);await s.forfeit();await s.load();assert.equal(JSON.stringify(s.profile),saved);
  const restored=harness(undefined,[],data);await restored.load();await restored.forfeit();assert.equal(JSON.stringify(restored.profile),saved);assert.equal(restored.page,'home');validateProfile(restored.profile);
});
test('Q13: an already determined natural result wins a concurrent forfeit and remains on the result page',async()=>{
  for(const win of [true,false]){const events:string[]=[],s=await ready(events);s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;await deadlineFixture(s,win?[40,30,20,10]:[30,40,20,10]);s.tick(1);const forfeiting=s.forfeit();await forfeiting;await idle(s);
    assert.equal(s.profile!.rankPoints,win?130:95);assert.equal(s.profile!.latestResult!.settlementKind,'natural');assert.equal(s.profile!.qualifiedArenaWins,win?1:0);assert.equal(s.profile!.formalCompleted,1);assert.equal(s.profile!.choice?.state??null,win?'pending':null);assert.equal(s.page,'result');assert.equal(events.filter(e=>e==='result').length,1);
    const saved=JSON.stringify(s.profile);await s.forfeit();await s.load();assert.equal(JSON.stringify(s.profile),saved);assert.equal(s.page,'result');assert.equal(events.filter(e=>e==='result').length,1);
  }
});
test('G06 G07 G08 G10 G18 K21: thirteen persisted wins grant one strategy each and allow the tenth farming layer',async()=>{
  const s=await ready(),choices=new Set<string>();let points=0,completed=0;
  for(let win=1;win<=13;win++){
    if(win===5||win===10){await finish(s,false);completed++;points-=10;assert.equal(s.profile!.qualifiedArenaWins,win-1);assert.equal(s.profile!.rankPoints,points);assert.equal(s.profile!.choice!.state,'claimed');await s.acknowledge();}
    await finish(s,true);completed++;points+=30;const p=s.profile!,choice=p.choice!;
    assert.equal(choice.kind,'mixed');assert.equal(choice.grantQuantity,1);assert.equal(choice.state,'pending');assert.equal(p.qualifiedArenaWins,win);assert.equal(p.rankPoints,points);assert.equal(p.formalCompleted,completed);
    assert.equal(choices.has(choice.choiceId),false);choices.add(choice.choiceId);assert.equal(choice.candidateIds.filter(id=>CARDS[id].kind==='active').length,2);assert.equal(choice.candidateIds.filter(id=>CARDS[id].kind==='passive').length,1);
    const unitsBefore=Object.values(p.activeInventory).reduce((a,n)=>a+n,0)+Object.values(p.passiveLevels).reduce((a,n)=>a+n,0);assert.equal(unitsBefore,win-1);
    await s.acknowledge('choice');await s.claim(win<=3?'supply':'farming');assert.equal(s.page,'home');
    assert.equal(s.profile!.activeInventory.supply,Math.min(win,3));assert.equal(s.profile!.passiveLevels.farming,Math.max(win-3,0));assert.equal(s.profile!.rankPoints,points);
    if(win>=4)assert.ok(compare(passiveBonus(20,win-3),passiveBonus(20,win-4))>0);
    if(win===7)assert.deepEqual(passiveBonus(20,s.profile!.passiveLevels.farming),fraction(1,10));
    if(win===13)assert.deepEqual(passiveBonus(20,s.profile!.passiveLevels.farming),fraction(1,7));
    const saved=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),saved);assert.equal(s.page,'home');
    await s.claim('supply');assert.equal(JSON.stringify(s.profile),saved);assert.equal(s.profile!.qualifiedArenaWins,win);validateProfile(s.profile);
    if(win===8){assert.equal(choices.size,8);assert.equal(s.profile!.activeInventory.supply,3);assert.equal(s.profile!.passiveLevels.farming,5);}
  }
  assert.equal(choices.size,13);assert.equal(s.profile!.activeInventory.supply+s.profile!.passiveLevels.farming,13);
});
test('N36: one hundred independent saved choices grant exactly one passive layer each without a milestone or level cap',async()=>{
  const data=new Map<string,string>(),s=await ready([],data),ids=new Set<string>();
  for(let n=1;n<=100;n++){
    await finish(s,true);const c=s.profile!.choice!;assert.equal(c.grantQuantity,1);assert.equal(ids.has(c.choiceId),false);ids.add(c.choiceId);await s.claim('farming');assert.equal(s.profile!.passiveLevels.farming,n);assert.equal(s.profile!.qualifiedArenaWins,n);assert.equal(s.profile!.rankPoints,n*30);
    const before=JSON.stringify(s.profile);await s.claim('farming');assert.equal(JSON.stringify(s.profile),before);
    if([4,10,100].includes(n)){const restored=harness(undefined,[],data);await restored.load();assert.equal(restored.profile!.passiveLevels.farming,n);assert.equal(restored.profile!.choice!.choiceId,c.choiceId);assert.equal(restored.profile!.choice!.state,'claimed');assert.equal(restored.page,'home');validateProfile(restored.profile);}
  }
  assert.equal(ids.size,100);assert.equal(s.profile!.formalCompleted,100);assert.equal(s.profile!.highestRankPoints,3000);assert.deepEqual(s.profile!.passiveLevels,{farming:100,logistics:0,fortification:0});assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));
});
test('N33: a real first-lesson win unlocks three permanent choices once and replay across Monday grants no assets',async()=>{
  let now=NOW;const s=harness(()=>now);await s.load();
  for(let round=0;round<3;round++){
    if(round===2)now=Date.parse('2026-09-14T00:00:00+08:00');await s.start('L01');const b=s.match!.battle; b.camps.find(c=>c.id==='L01-P1')!.garrison=50;const enemy=b.camps.find(c=>c.id==='L01-E1')!;enemy.garrison=0;enemy.feintUntil=1000000;
    // Vulnerable opponent fixture; dispatch, capture, settlement, unlock and storage use the real session.
    assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);for(let i=0;i<30&&s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner!=='P';i++){s.tick(250);await idle(s);}assert.equal(s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner,'P');assert.equal(await s.action({kind:'dispatch',sourceId:'L01-N1',targetId:'L01-E1'}),true);
    for(let i=0;i<80&&s.page==='battle';i++){s.tick(250);await idle(s);}assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.result!.independentWinner,'P');assert.deepEqual(s.profile!.tutorialFirstWins,['L01']);assert.deepEqual(s.profile!.unlockedCardIds,['mobilize','supply','farming']);assert.equal(s.profile!.choice,null);assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.formalCompleted,0);assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));await s.acknowledge();await s.load();assert.equal(s.error,'');
  }
  assert.equal(s.profile!.weekId,'2026-09-14');assert.deepEqual(s.profile!.unlockedCardIds,['mobilize','supply','farming']);validateProfile(s.profile);
});
test('K19 K26: two farming layers survive three persisted losses and apply afresh without per-match consumption',async()=>{
  const s=await ready();s.profile!.passiveLevels.farming=2;s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;
  for(let game=0;game<3;game++){
    await finish(s,false,current=>{const b=current.match!.battle,actor=factionOf(b,'P')!,camp=b.camps.find(c=>c.owner==='P')!;
      assert.deepEqual(actor.passives,{farming:2,logistics:0,fortification:0});assert.deepEqual(naturalRate(camp,actor,0),fraction(32,25));assert.equal(current.profile!.passiveLevels.farming,2);
    });
    assert.equal(s.profile!.rankPoints,90-game*10);assert.equal(s.profile!.passiveLevels.farming,2);await s.acknowledge();const saved=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),saved);
  }
});
test('K20 K22: all three passive effects coexist, ranks add no combat attributes, and temporary lessons receive no strategies',async()=>{
  const battles:string[]=[];
  for(const rank of [0,480,1080]){
    const s=await ready();s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.rankPoints=rank;s.profile!.highestRankPoints=rank;
    s.profile!.passiveLevels={farming:1,logistics:1,fortification:1};s.profile!.activeInventory.supply=5;await s.start('A01');const b=s.match!.battle,actor=factionOf(b,'P')!,camp=b.camps.find(c=>c.owner==='P')!;
    assert.deepEqual(actor.passives,{farming:1,logistics:1,fortification:1});assert.deepEqual(naturalRate(camp,actor,0),fraction(156,125));assert.equal(troopSpeed(camp,actor),82.4);assert.equal(campCapacity(camp,actor),52);
    battles.push(JSON.stringify({...b,id:'same-rules'}));const saved=JSON.stringify(s.profile);await s.start('L03',true);
    for(const f of s.temporary!.battle.factions){assert.deepEqual(f.passives,{farming:0,logistics:0,fortification:0});assert.ok(Object.values(f.inventory).every(n=>n===0));}assert.equal(JSON.stringify(s.profile),saved);
  }
  assert.ok(battles.every(b=>b===battles[0]));
});
test('K26: a Monday rollover preserves the running passive snapshot while the next saved match starts with zero layers',async()=>{
  let now=NOW;const s=harness(()=>now);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.passiveLevels.farming=2;
  await s.start('A01');const id=s.match!.battle.id;now=Date.parse('2026-09-14T00:00:00+08:00');await s.pause();assert.equal(s.profile!.weekId,'2026-09-14');assert.equal(s.profile!.passiveLevels.farming,0);
  await s.load();assert.equal(s.match!.battle.id,id);assert.equal(factionOf(s.match!.battle,'P')!.passives.farming,2);validateProfile(s.profile);
  await s.forfeit();await s.start('A01');assert.notEqual(s.match!.battle.id,id);const b=s.match!.battle,actor=factionOf(b,'P')!;assert.deepEqual(actor.passives,{farming:0,logistics:0,fortification:0});assert.deepEqual(naturalRate(b.camps.find(c=>c.owner==='P')!,actor,0),fraction(6,5));validateProfile(s.profile);
});
test('G13: abandoning a fixed reward survives reload and cannot reissue strategy or undo rank points',async()=>{
  const s=await ready();await finish(s,true);const choiceId=s.profile!.choice!.choiceId,matchId=s.profile!.latestResult!.matchId;
  await s.acknowledge('choice');await s.abandonChoice();const saved=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),saved);
  assert.equal(s.profile!.choice!.state,'abandoned');assert.equal(s.profile!.rankPoints,30);assert.equal(s.profile!.qualifiedArenaWins,1);
  assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));
  assert.equal(claimChoice(s.profile!,choiceId,'supply',NOW),false);settleMatch(s.profile!,matchId,NOW,'natural',()=>.9);assert.equal(JSON.stringify(s.profile),saved);
  await s.claim('supply');await s.abandonChoice();assert.equal(JSON.stringify(s.profile),saved);assert.equal(await s.start(s.nextMap),true);validateProfile(s.profile);
});
test('W03 W10: a rejected old reward claim still persists the current week and expires stale assets',async()=>{
  for(const weeks of [1,4]){
    let now=Date.parse('2026-09-13T23:59:59+08:00');const data=new Map<string,string>(),s=harness(()=>now,[],data);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=2;s.profile!.passiveLevels.farming=1;
    await finish(s,true);await s.acknowledge('choice');const p=s.profile!,permanent={points:p.rankPoints,highest:p.highestRankPoints,lessons:p.tutorialFirstWins,unlocked:p.unlockedCardIds,completed:p.formalCompleted,settings:p.settings},choiceId=p.choice!.choiceId;
    now=Date.parse('2026-09-14T00:00:00+08:00')+(weeks-1)*7*86400000;await s.claim('supply');assert.equal(s.profile!.weekId,weeks===1?'2026-09-14':'2026-10-05');assert.equal(s.profile!.choice!.state,'expired');assert.equal(s.profile!.choice!.choiceId,choiceId);assert.equal(s.profile!.qualifiedArenaWins,0);
    assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));const current=s.profile!;assert.deepEqual({points:current.rankPoints,highest:current.highestRankPoints,lessons:current.tutorialFirstWins,unlocked:current.unlockedCardIds,completed:current.formalCompleted,settings:current.settings},permanent);
    const restored=harness(()=>now,[],data);await restored.load();assert.equal(restored.profile!.choice!.state,'expired');assert.equal(restored.profile!.rankPoints,30);assert.equal(restored.profile!.qualifiedArenaWins,0);assert.equal(restored.error,'');assert.equal(await restored.start('A01'),true);
  }
});
test('W04 W05: weekly clearing preserves all running passive attributes and full garrisons but the next match starts clean',async()=>{
  let now=Date.parse('2026-09-13T23:59:59+08:00');const s=harness(()=>now);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.passiveLevels={farming:1,logistics:1,fortification:1};s.profile!.activeInventory.march=1;await s.start('A01');
  const b=s.match!.battle,id=b.id,c=b.camps.find(c=>c.owner==='P')!,f=factionOf(b,'P')!;c.garrison=52;const attributes={production:naturalRate(c,f,0),speed:troopSpeed(c,f),capacity:campCapacity(c,f)};await s.pause();now=Date.parse('2026-09-14T00:00:00+08:00');await s.load();await s.resume();
  const current=s.match!.battle,actor=factionOf(current,'P')!,camp=current.camps.find(c=>c.owner==='P')!;assert.equal(current.id,id);assert.equal(camp.garrison,52);assert.deepEqual({production:naturalRate(camp,actor,0),speed:troopSpeed(camp,actor),capacity:campCapacity(camp,actor)},attributes);assert.equal(s.profile!.activeInventory.march,0);assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));
  await s.forfeit();await s.start('A01');const next=s.match!.battle,nextActor=factionOf(next,'P')!,nextCamp=next.camps.find(c=>c.owner==='P')!;assert.notEqual(next.id,id);assert.deepEqual(nextActor.passives,{farming:0,logistics:0,fortification:0});assert.equal(troopSpeed(nextCamp,nextActor),80);assert.equal(campCapacity(nextCamp,nextActor),50);assert.deepEqual(naturalRate(nextCamp,nextActor,0),fraction(6,5));assert.equal(nextActor.inventory.march,0);validateProfile(s.profile);
});
test('W09: a Sunday match ending Monday records that week once and Tuesday claiming cannot move its settlement',async()=>{
  const monday=Date.parse('2026-09-14T00:00:00+08:00');let now=monday-1;const data=new Map<string,string>(),s=harness(()=>now,[],data);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];await deadlineFixture(s,[40,30,20,10]);
  now=monday;s.tick(1);await idle(s);s.tick(1);await idle(s);const r=s.profile!.latestResult!,choice=structuredClone(s.profile!.choice!);assert.equal(r.settledAt,monday);assert.equal(r.settlementWeek,'2026-09-14');assert.equal(choice.weekId,'2026-09-14');assert.equal(s.profile!.qualifiedArenaWins,1);assert.equal(s.profile!.rankPoints,30);
  now=monday+86400000;const restored=harness(()=>now,[],data);await restored.load();assert.deepEqual(restored.profile!.choice,choice);await restored.claim('supply');assert.equal(restored.profile!.activeInventory.supply,1);assert.equal(restored.profile!.qualifiedArenaWins,1);assert.equal(restored.profile!.latestResult!.settledAt,monday);assert.equal(restored.profile!.latestResult!.settlementWeek,'2026-09-14');assert.equal(restored.profile!.rankPoints,30);
});
