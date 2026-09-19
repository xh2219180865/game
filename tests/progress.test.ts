import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createBattle } from '../src/core/battle.ts';
import { CARD_IDS, claimChoice, freshProfile, mixedCandidates, observeTime, rankName, settleMatch, weekIdAt } from '../src/core/progress.ts';
import type { Profile } from '../src/core/progress.ts';
import type { MapId } from '../src/core/types.ts';

const NOW=Date.parse('2026-09-10T12:00:00+08:00');
function ended(p:Profile,id:MapId,rank=1,dispatched=true,independent=true):string {
  const matchId=`g:${p.nextMatchSequence++}`,b=createBattle(id,{id:matchId,firstDragCompleted:true});
  b.hasPlayerDispatch=dispatched;b.status='finished';
  b.result={reason:'deadline',playerRank:rank,independentWinner:independent?(rank===1?'P':'E1'):null,ranks:{P:rank},stats:[],atMs:0};
  p.activeMatch={battle:b,modeId:id.startsWith('A')?'arena-four':'tutorial',rankedCommitment:id.startsWith('A'),realStartedAt:NOW,startWeekId:p.weekId};
  return matchId;
}
function unlocked():Profile {const p=freshProfile(NOW,'g');p.firstDragCompleted=true;settleMatch(p,ended(p,'L01'),NOW,'natural',()=>0);return p;}

test('teaching first win unlocks eligibility without granting cards, and is idempotent',()=>{
  const p=freshProfile(NOW,'g'),id=ended(p,'L01');const r=settleMatch(p,id,NOW,'natural',()=>0);
  assert.deepEqual(p.unlockedCardIds,['mobilize','supply','farming']);assert.equal(p.rankPoints,0);assert.equal(p.qualifiedArenaWins,0);
  assert.equal(Object.values(p.activeInventory).reduce((a,n)=>a+n,0),0);assert.equal(p.choice,null);
  assert.equal(settleMatch(p,id,NOW+100,'forfeit',()=>.9),r);
});
test('champion gets exactly one fixed mixed choice, claimed once',()=>{
  const p=unlocked(),id=ended(p,'A01');settleMatch(p,id,NOW,'natural',()=>0);
  assert.equal(p.rankPoints,30);assert.equal(p.formalCompleted,1);assert.equal(p.qualifiedArenaWins,1);
  assert.deepEqual(p.choice!.candidateIds,['mobilize','supply','farming']);
  const restored=JSON.parse(JSON.stringify(p));assert.equal(claimChoice(restored,p.choice!.choiceId,'farming',NOW),true);
  assert.equal(restored.passiveLevels.farming,1);assert.equal(restored.activeInventory.mobilize,0);
  assert.equal(claimChoice(restored,p.choice!.choiceId,'mobilize',NOW),false);assert.equal(restored.rankPoints,30);
});
test('loss scoring floors at zero and cannot decrease historical maximum',()=>{
  const p=unlocked();p.rankPoints=3;p.highestRankPoints=480;
  const r=settleMatch(p,ended(p,'A01',4),NOW,'natural',()=>0);
  assert.equal(r.rankDeltaRequested,-10);assert.equal(r.rankDeltaApplied,-3);assert.equal(p.rankPoints,0);assert.equal(p.highestRankPoints,480);assert.equal(p.formalCompleted,1);
});
test('no dispatch removes positive rewards but not loss responsibility',()=>{
  for(const rank of [1,2,3,4]){
    const p=unlocked();p.rankPoints=100;p.highestRankPoints=100;
    settleMatch(p,ended(p,'A01',rank,false),NOW,'natural',()=>0);
    assert.equal(p.rankPoints,100+[0,0,-5,-8,-10][rank]!);assert.equal(p.formalCompleted,0);assert.equal(p.choice,null);
  }
});
test('tied first has no reward, and confirmed forfeit charges only once',()=>{
  const p=unlocked();p.rankPoints=60;p.highestRankPoints=60;
  settleMatch(p,ended(p,'A01',1,true,false),NOW,'natural',()=>0);assert.equal(p.rankPoints,60);assert.equal(p.choice,null);assert.equal(p.formalCompleted,1);
  const id=ended(p,'A01');p.activeMatch!.battle.result=null;p.activeMatch!.battle.status='paused';
  const r=settleMatch(p,id,NOW,'forfeit',()=>0);assert.equal(p.rankPoints,50);assert.equal(r.resultAcknowledged,true);assert.equal(p.formalCompleted,1);
  settleMatch(p,id,NOW,'forfeit',()=>0);assert.equal(p.rankPoints,50);
});
test('mixed candidate selection has no duplicate, locked card, or extra grant',()=>{
  for(let i=0;i<100;i++){
    let seed=i+1;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const c=mixedCandidates(CARD_IDS,rand);assert.equal(c.length,3);assert.equal(new Set(c).size,3);assert.equal(c.filter(id=>['farming','logistics','fortification'].includes(id)).length,1);
  }
  assert.deepEqual(mixedCandidates(['farming','logistics'],()=>0),['farming','logistics']);assert.throws(()=>mixedCandidates([],()=>0));
});
test('N35: an expanded unlock pool cannot redraw an already generated choice or its unlock snapshot',()=>{
  const p=unlocked();settleMatch(p,ended(p,'A01'),NOW,'natural',()=>0);const original=JSON.stringify(p.choice),id=p.choice!.choiceId;
  // Economy-only scenario: the normal UI runs lessons as no-reward practice while a choice is pending.
  settleMatch(p,ended(p,'L02'),NOW,'natural',()=>.9);assert.ok(p.unlockedCardIds.includes('feint'));assert.ok(p.unlockedCardIds.includes('fortification'));assert.equal(JSON.stringify(p.choice),original);
  assert.deepEqual(p.choice!.unlockSnapshot,['mobilize','supply','farming']);assert.equal(claimChoice(p,id,'feint',NOW),false);assert.equal(JSON.stringify(p.choice),original);assert.equal(claimChoice(p,id,'farming',NOW),true);assert.equal(p.passiveLevels.farming,1);assert.equal(p.rankPoints,30);assert.equal(p.qualifiedArenaWins,1);
});
test('Beijing Monday expires weekly assets and pending choice, preserving permanent progress',()=>{
  const p=unlocked();settleMatch(p,ended(p,'A01'),NOW,'natural',()=>0);p.activeInventory.supply=2;p.passiveLevels.farming=3;
  ended(p,'A01');p.activeMatch!.battle.result=null;p.activeMatch!.battle.status='paused';p.activeMatch!.battle.factions[0]!.passives.farming=3;
  const monday=Date.parse('2026-09-14T00:00:00+08:00');assert.equal(weekIdAt(monday-1),'2026-09-07');assert.equal(weekIdAt(monday),'2026-09-14');
  assert.equal(observeTime(p,monday),'changed');assert.equal(p.choice!.state,'expired');assert.equal(p.rankPoints,30);assert.equal(p.qualifiedArenaWins,0);assert.equal(p.activeInventory.supply,0);assert.equal(p.passiveLevels.farming,0);
  assert.equal(p.activeMatch!.battle.factions[0]!.passives.farming,3);assert.equal(p.activeMatch!.battle.factions[1]!.inventory.supply,0);
  assert.equal(observeTime(p,NOW),'backward');assert.equal(p.weekId,'2026-09-14');assert.equal(p.maxObservedTime,monday);
});
test('G15: rank thresholds and high-rank continuation follow points alone',()=>{
  for(const [points,name]of [[0,'新卒'],[30,'军司马 · 1 级'],[150,'军司马 · 5 级'],[180,'都尉 · 1 级'],[450,'校尉 · 5 级'],[480,'中郎将 · 1 级'],[1050,'骠骑将军 · 5 级'],[1080,'大将军 · 1 级'],[1230,'大将军 · 6 级']] as const)assert.equal(rankName(points),name);
  assert.equal(rankName(470),'校尉 · 5 级');
});
test('Q04: every rank boundary matches the documented title before, at and after the threshold',()=>{
  const titles=['军司马','都尉','校尉','中郎将','偏将军','车骑将军','骠骑将军'];
  for(const [index,title]of titles.entries())for(let level=1;level<=5;level++){
    const points=30+index*150+(level-1)*30;
    const previous=level>1?`${title} · ${level-1} 级`:index===0?'新卒':`${titles[index-1]} · 5 级`;
    assert.equal(rankName(points-1),previous);assert.equal(rankName(points),`${title} · ${level} 级`);assert.equal(rankName(points+1),`${title} · ${level} 级`);
  }
  for(const [points,title]of [[1079,'骠骑将军 · 5 级'],[1080,'大将军 · 1 级'],[1081,'大将军 · 1 级'],[1229,'大将军 · 5 级'],[1230,'大将军 · 6 级'],[1231,'大将军 · 6 级'],[31050,'大将军 · 1000 级']] as const)assert.equal(rankName(points),title);
});
test('W01 W02: Beijing Monday remains the same instant under UTC, Shanghai and Los Angeles display time zones',()=>{
  const moduleUrl=new URL('../src/core/progress.ts',import.meta.url).href;
  const script=`import {weekIdAt} from ${JSON.stringify(moduleUrl)}; const before=Date.parse('2026-09-13T15:59:59Z'),after=Date.parse('2026-09-13T16:00:00Z'); console.log(JSON.stringify({offset:new Date(before).getTimezoneOffset(),weeks:[weekIdAt(before),weekIdAt(after)]}));`;
  for(const [zone,offset]of [['UTC',0],['Asia/Shanghai',-480],['America/Los_Angeles',420]] as const){
    const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:zone},encoding:'utf8'}));assert.equal(result.offset,offset);assert.deepEqual(result.weeks,['2026-09-07','2026-09-14']);
  }
});
