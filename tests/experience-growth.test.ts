import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { validateProfile } from '../src/app/validation.ts';
import { decodeEnvelope, envelopeFor } from '../src/app/storage.ts';
import { freshProfile, observeTime } from '../src/core/progress.ts';
import { fraction } from '../src/core/fraction.ts';

const NOW=Date.parse('2026-11-04T12:00:00+08:00');
async function ready(){
  let now=NOW,fail=false;const data=new Map<string,string>();
  const storage={async read(k:string){return data.get(k)??null;},async write(k:string,v:string){if(fail)throw new Error('injected');data.set(k,v);},async remove(k:string){data.delete(k);}};
  const make=()=>new GameSession({storage,now:()=>now,random:()=>0,notify:()=>{},events:()=>{}}),s=make();await s.load();
  Object.assign(s.profile!,{firstDragCompleted:true,tutorialFirstWins:['L01'],unlockedCardIds:['mobilize','supply','farming'],rankPoints:60,highestRankPoints:90});
  return {s,make,data,setTime:(n:number)=>{now=n;},fail:(v:boolean)=>{fail=v;}};
}
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);assert.equal(s.error,'');}
for(const rank of [1,2,3,4])for(const dispatched of [true,false])test(`growth scoring: rank ${rank}, dispatch ${dispatched}, survives reload without loss or participation farming`,async()=>{
  const {s,make}=await ready();await s.start('A01');assert.equal(s.match!.meritPolicy,'growth-v1');
  const b=s.match!.battle;b.hasPlayerDispatch=dispatched;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  const own=50-rank*10,counts=[own,...[40,30,20,10].filter(n=>n!==own)];
  for(const c of b.camps){if(c.owner)c.garrison=counts[['P','E1','E2','E3'].indexOf(c.owner)]!;c.credit=fraction(0);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  s.tick(1);await idle(s);const p=s.profile!,reward=rank===1&&dispatched;
  assert.equal(p.latestResult!.result!.playerRank,rank);assert.equal(p.rankPoints,reward?90:60);assert.equal(p.highestRankPoints,90);
  assert.equal(p.qualifiedArenaWins,reward?1:0);assert.equal(p.choice?.grantQuantity??0,reward?1:0);assert.equal(p.latestResult!.meritPolicy,'growth-v1');
  const expected=structuredClone(p),restored=make();await restored.load();assert.deepEqual(restored.profile,expected);await restored.forfeit();assert.deepEqual(restored.profile,expected);
});
test('weekly memorial commits once, retains only known results, and never creates cards or combat inheritance',async()=>{
  const {s,setTime,make}=await ready();s.profile!.qualifiedArenaWins=5;s.profile!.activeInventory.supply=3;s.profile!.passiveLevels.farming=8;
  await s.setting('vibration');setTime(Date.parse('2026-11-09T00:00:00+08:00'));await s.load();
  assert.deepEqual(s.profile!.weeklyRecord,{archivedWeeks:1,totalWins:5,bestWins:5,lastWeekId:'2026-11-02',lastWeekWins:5});
  assert.equal(s.profile!.rankPoints,60);assert.equal(s.profile!.activeInventory.supply,0);assert.equal(s.profile!.passiveLevels.farming,0);
  const expected=structuredClone(s.profile),restored=make();await restored.load();assert.deepEqual(restored.profile,expected);
  // Skipped weeks are not invented as completed weeks. An observed zero-win week is valid.
  setTime(Date.parse('2026-11-30T00:00:00+08:00'));await restored.load();assert.equal(restored.profile!.weeklyRecord!.archivedWeeks,2);
  assert.equal(restored.profile!.weeklyRecord!.totalWins,5);assert.equal(restored.profile!.weeklyRecord!.lastWeekWins,0);validateProfile(restored.profile);
});
test('failed weekly archive leaves the committed old record intact and a retry cannot double-count',async()=>{
  const h=await ready();h.s.profile!.qualifiedArenaWins=4;await h.s.setting('vibration');const bytes=[...h.data];
  h.setTime(Date.parse('2026-11-09T00:00:00+08:00'));h.fail(true);await h.s.load();assert.ok(h.s.error);assert.deepEqual([...h.data],bytes);
  h.fail(false);await h.s.load();assert.equal(h.s.error,'');assert.equal(h.s.profile!.weeklyRecord!.totalWins,4);
  await h.s.load();assert.equal(h.s.profile!.weeklyRecord!.totalWins,4);
});
test('old envelopes remain readable; unknown policies and malformed memorials are rejected',()=>{
  const p=freshProfile(NOW,'old');assert.equal(p.weeklyRecord,undefined);
  assert.deepEqual(decodeEnvelope(JSON.stringify(envelopeFor(p,1,NOW))).data,p);
  observeTime(p,Date.parse('2026-11-09T00:00:00+08:00'));validateProfile(p);
  p.weeklyRecord!.totalWins=-1;assert.throws(()=>validateProfile(p),/周战绩/);
});

test('unknown match merit policy is blocked before it can be resumed or saved',async()=>{
  const {s}=await ready();await s.start('A01');Object.assign(s.match!,{meritPolicy:'future-policy'});
  assert.throws(()=>validateProfile(s.profile),/单局军功规则不兼容/);
});
