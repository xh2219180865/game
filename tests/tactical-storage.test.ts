import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, applyBattleAction } from '../src/core/battle.ts';
import { advanceSimulation } from '../src/core/ai.ts';
import { validateBattle } from '../src/app/validation.ts';
import { SaveStore } from '../src/app/storage.ts';
import { freshProfile } from '../src/core/progress.ts';
import { dispatchPreview } from '../src/render/battle-presentation.ts';

const NOW=Date.parse('2026-09-12T19:00:00+08:00');
for(const revision of ['1.5','1.6'] as const)test(`roads storage ${revision}: active travel round-trips without changing assets, ETA or event sequence`,async()=>{
  const data=new Map<string,string>(),port={async read(k:string){return data.get(k)??null;},async write(k:string,v:string){data.set(k,v);},async remove(k:string){data.delete(k);}};
  const store=new SaveStore(port),p=freshProfile(NOW,`roads-save-${revision}`);
  p.firstDragCompleted=true;p.rankPoints=90;p.highestRankPoints=120;
  const b=createBattle('A01',{id:`roads-${revision}`,ruleRevision:revision}),source=b.camps[0]!,target=b.camps.find(c=>c.id===(revision==='1.5'?'A01-E3':'A01-N2'))!;
  const preview=dispatchPreview(b,source,target,false);assert.ok(preview.valid);
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id}).ok);
  advanceSimulation(b,500);p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
  await store.load();await store.save(p,NOW);const bytes=[...data];
  const restored=await new SaveStore(port).load();assert.equal(restored.kind,'ready');assert.deepEqual([...data],bytes);
  if(restored.kind!=='ready')throw new Error('Expected valid active save');
  assert.deepEqual(restored.envelope.data,p);const resumed=restored.envelope.data.activeMatch!.battle;
  assert.equal(resumed.ruleRevision,revision);assert.equal(resumed.armies[0]!.arrivalAtMs,preview.travelMs);
  assert.deepEqual(advanceSimulation(resumed,7000),advanceSimulation(b,7000));assert.deepEqual(resumed,b);
});

test('roads storage: v1.6 rejects a legacy cross-map army and wrong speed without silently accepting it',()=>{
  const legacy=createBattle('A01',{id:'legacy-route',ruleRevision:'1.5'});
  assert.ok(applyBattleAction(legacy,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-E3'}).ok);
  assert.doesNotThrow(()=>validateBattle(legacy));const bad=structuredClone(legacy);bad.ruleRevision='1.6';assert.throws(()=>validateBattle(bad),/道路/);
  const next=createBattle('A01',{id:'new-route'});assert.equal(next.ruleRevision,'1.6');
  assert.ok(applyBattleAction(next,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'}).ok);
  assert.doesNotThrow(()=>validateBattle(next));next.armies[0]!.speed=80;assert.throws(()=>validateBattle(next),/速度/);
});

test('roads preview: illegal target gives a road explanation and action has no cost; a valid ETA exactly matches dispatch',()=>{
  const b=createBattle('A01',{id:'preview-roads',inventory:{mobilize:0,march:1,supply:0,feint:0}}),source=b.camps[0]!,far=b.camps.find(c=>c.id==='A01-E3')!;
  const before=structuredClone(b),invalid=dispatchPreview(b,source,far,true);assert.equal(invalid.valid,false);assert.match(invalid.reason,/道路/);assert.deepEqual(invalid.towerIds,[]);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:far.id,march:true}).ok,false);assert.deepEqual(b,before);
  const target=b.camps.find(c=>c.id==='A01-N2')!,valid=dispatchPreview(b,source,target,true);assert.ok(valid.valid);assert.ok(valid.travelMs<valid.normalMs);
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id,march:true}).ok);assert.equal(b.armies[0]!.arrivalAtMs,valid.travelMs);
});
