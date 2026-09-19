import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStore, SLOT_KEYS, checksum, decodeEnvelope, envelopeFor } from '../src/app/storage.ts';
import type { StoragePort } from '../src/app/storage.ts';
import { validateBattle, validateProfile } from '../src/app/validation.ts';
import { CARD_IDS, freshProfile } from '../src/core/progress.ts';
import { advanceSimulation } from '../src/core/ai.ts';
import { advanceBattle, createBattle, applyBattleAction } from '../src/core/battle.ts';
import { runtimeStorage } from './browser-runtime.ts';
import { GameSession } from '../src/app/session.ts';
import { fraction } from '../src/core/fraction.ts';

const NOW=Date.parse('2026-09-10T12:00:00+08:00');
test('S01: lifecycle audit storage cannot read, overwrite or remove an existing unprefixed save',()=>{
  const data=new Map<string,string>(SLOT_KEYS.map(k=>[k,`existing-${k}`])),before=[...data];
  const scoped=runtimeStorage({getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);}});
  for(const key of SLOT_KEYS){assert.equal(scoped.getItem(key),null);scoped.setItem(key,'test-value');assert.equal(scoped.getItem(key),'test-value');scoped.removeItem(key);assert.equal(scoped.getItem(key),null);}
  assert.deepEqual([...data],before);
});
class Memory implements StoragePort {
  values=new Map<string,string>();fail:'none'|'before'|'after'|'read'='none';
  async read(k:string){if(this.fail==='read')throw new Error('read failed');return this.values.get(k)??null;}
  async write(k:string,v:string){if(this.fail==='before')throw new Error('disk full');this.values.set(k,v);if(this.fail==='after')throw new Error('callback lost');}
  async remove(k:string){this.values.delete(k);}
}
for(const kind of ['memory','scoped'] as const)for(const win of [false,true])test(`A12: ${kind} test cards and weakened AI settle ${win?'wins':'losses'} without changing the original player record`,async()=>{
  const original=new Memory(),store=new SaveStore(original),player=freshProfile(NOW,'original-player');
  player.rankPoints=90;player.highestRankPoints=120;player.qualifiedArenaWins=2;player.tutorialFirstWins=['L01','L02','L03'];player.unlockedCardIds=[...CARD_IDS];player.firstDragCompleted=true;player.activeInventory.supply=8;
  await store.load();await store.save(player,NOW);const bytes=[...original.values],separate=new Memory();
  const scoped=runtimeStorage({getItem:k=>original.values.get(k)??null,setItem:(k,v)=>{original.values.set(k,v);},removeItem:k=>{original.values.delete(k);}});
  const storage:StoragePort=kind==='memory'?separate:{async read(k){return scoped.getItem(k);},async write(k,v){scoped.setItem(k,v);},async remove(k){scoped.removeItem(k);}};
  const make=()=>new GameSession({storage,now:()=>NOW,random:()=>0,notify:()=>{},events:()=>{}}),s=make();await s.load();
  s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;
  await s.start('A01');assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);
  assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);
  const b=s.match!.battle;advanceBattle(b,b.armies[0]!.arrivalAtMs);const captured=b.camps.find(c=>c.id==='A01-N4')!;captured.owner=null;captured.garrison=8;captured.credit=fraction(0);b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){c.credit=fraction(0);if(c.owner)c.garrison=c.owner==='P'?(win?40:1):(win?10:40);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  await s.pause();await s.resume();s.tick(1);for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);assert.equal(s.error,'');assert.equal(s.page,'result');
  assert.equal(s.profile!.rankPoints,win?90:50);assert.equal(s.profile!.qualifiedArenaWins,win?1:0);assert.equal(s.profile!.activeInventory.supply,2);
  if(win){await s.acknowledge('choice');const id=s.profile!.choice!.candidateIds[0]!;await s.claim(id);const claimed=structuredClone(s.profile);await s.claim(id);assert.deepEqual(s.profile,claimed);}else await s.acknowledge();
  const expected=structuredClone(s.profile),restored=make();await restored.load();assert.deepEqual(restored.profile,expected);validateProfile(restored.profile);
  assert.deepEqual(bytes.map(([k])=>[k,original.values.get(k)]),bytes,'every original slot remains byte-for-byte unchanged');
  const real=await new SaveStore(original).load();assert.equal(real.kind,'ready');if(real.kind==='ready')assert.deepEqual(real.envelope.data,player);
  if(kind==='memory')assert.deepEqual([...original.values],bytes);else assert.ok([...original.values.keys()].filter(k=>!SLOT_KEYS.includes(k)).every(k=>k.startsWith('runtime-audit:v1:')));
});
test('S12: malformed JSON produces one actionable Chinese message while retaining raw slots',async()=>{
  const mem=new Memory();mem.values.set(SLOT_KEYS[0],'{broken');mem.values.set(SLOT_KEYS[1],'{also broken');const bytes=[...mem.values];
  const result=await new SaveStore(mem).load();assert.equal(result.kind,'recovery');if(result.kind==='recovery')assert.equal(result.reason,'本地记录格式损坏，请重新读取或恢复可用副本。');
  assert.deepEqual([...mem.values],bytes);assert.throws(()=>decodeEnvelope('{broken'),(e:unknown)=>e instanceof Error&&e.cause instanceof SyntaxError&&e.message==='本地记录格式损坏，请重新读取或恢复可用副本。');
});
test('S09: unreadable writeback reports an unknown outcome without exposing platform errors',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'unknown-message');await store.load();await store.save(p,NOW);
  const write=mem.write.bind(mem);mem.write=async(k,v)=>{await write(k,v);mem.fail='read';};p.rankPoints=30;p.highestRankPoints=30;
  await assert.rejects(store.save(p,NOW+1),(e:unknown)=>e instanceof Error&&e.message==='本次保存结果暂无法确认，请重新读取后继续。'&&e.cause instanceof Error);
  mem.fail='none';const result=await new SaveStore(mem).load();assert.equal(result.kind,'ready');if(result.kind==='ready')assert.equal(result.envelope.data.rankPoints,30);
});
test('S12: backup write failure uses a recovery message and preserves the available copy',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'recover-message');await store.load();const backup=await store.save(p,NOW),bytes=[...mem.values];mem.fail='before';
  await assert.rejects(store.recoverBackup(backup,NOW+1),(e:unknown)=>e instanceof Error&&e.message==='副本恢复结果暂无法确认，请重新读取后再操作。'&&e.cause instanceof Error);
  assert.deepEqual([...mem.values],bytes);
});
test('alternating full snapshots restore only the latest validated revision',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'g');assert.deepEqual(await store.load(),{kind:'empty'});
  await store.save(p,NOW);p.rankPoints=30;p.highestRankPoints=30;await store.save(p,NOW+1);
  assert.equal(mem.values.size,2);const loaded=await new SaveStore(mem).load();assert.equal(loaded.kind,'ready');if(loaded.kind==='ready'){assert.equal(loaded.envelope.revision,2);assert.equal(loaded.envelope.data.rankPoints,30);}
});
test('write rejected before mutation preserves the complete previous state',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'g');await store.load();await store.save(p,NOW);
  mem.fail='before';p.rankPoints=30;p.highestRankPoints=30;await assert.rejects(store.save(p,NOW+1));mem.fail='none';
  const loaded=await new SaveStore(mem).load();assert.equal(loaded.kind,'ready');if(loaded.kind==='ready')assert.equal(loaded.envelope.data.rankPoints,0);
});
test('write committed with a lost callback is recognized by exact readback',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'g');await store.load();mem.fail='after';
  const result=await store.save(p,NOW);assert.equal(result.revision,1);assert.equal(decodeEnvelope(mem.values.get(SLOT_KEYS[1])!).revision,1);
});
for(const card of ['mobilize','supply','feint','march'] as const)test(`S05: lost ${card} write callback preserves one cost and rejects the same action sequence after reload`,async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'card-save');p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:2,supply:2,feint:2,march:2};
  const b=createBattle('A01',{id:'card-save-match',inventory:p.activeInventory});b.camps[0]!.garrison=30;p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};await store.load();await store.save(p,NOW);
  const action=card==='march'?{kind:'dispatch' as const,faction:'P' as const,sequence:1,sourceId:'A01-P1',targetId:'A01-N4',march:true}:{kind:'card' as const,cardId:card,faction:'P' as const,sequence:1,targetId:card==='feint'?'A01-E1':'A01-P1'};
  assert.equal(applyBattleAction(b,action).ok,true);p.activeInventory={...b.factions[0]!.inventory};mem.fail='after';const committed=await store.save(p,NOW);assert.equal(committed.revision,2);const restored=new SaveStore(mem),loaded=await restored.load();assert.equal(loaded.kind,'ready');if(loaded.kind!=='ready')throw new Error('expected committed save');
  const current=loaded.envelope.data,state=current.activeMatch!.battle;assert.equal(current.activeInventory[card],1);assert.equal(state.factions[0]!.inventory[card],1);assert.equal(state.factions[0]!.lastActionSequence,1);
  if(card==='supply')assert.equal(state.camps[0]!.garrison,36);if(card==='mobilize'){assert.equal(state.camps[0]!.mobilizeUntil,6000);assert.deepEqual(state.camps[0]!.bonusBudget,{numerator:'8',denominator:'1'});}if(card==='feint')assert.equal(state.camps.find(c=>c.id==='A01-E1')!.feintUntil,4000);if(card==='march'){assert.equal(state.camps[0]!.garrison,15);assert.equal(state.armies.length,1);assert.equal(state.armies[0]!.remainingCount,15);assert.ok(Math.abs(state.armies[0]!.speed-33.6)<1e-8);}
  const before=JSON.stringify(current),bytes=[...mem.values];const duplicate=applyBattleAction(state,action);assert.equal(duplicate.ok,false);assert.deepEqual(duplicate.events,[]);assert.equal(JSON.stringify(current),before);assert.deepEqual([...mem.values],bytes);
});
test('corrupt newest slot requires explicit backup recovery rather than silent rollback',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'g');await store.load();await store.save(p,NOW);await store.save(p,NOW+1);
  mem.values.set(SLOT_KEYS[0],'{broken');const reload=new SaveStore(mem),loaded=await reload.load();
  assert.equal(loaded.kind,'recovery');await assert.rejects(reload.save(p,NOW+2));
  if(loaded.kind==='recovery'){assert.equal(loaded.backup!.revision,1);await reload.recoverBackup(loaded.backup!,NOW+3);assert.equal((await reload.load()).kind,'ready');}
});
test('unknown schema and unreadable storage never initialize empty progress',async()=>{
  const mem=new Memory();mem.values.set(SLOT_KEYS[0],JSON.stringify({schemaVersion:9}));assert.equal((await new SaveStore(mem).load()).kind,'recovery');
  mem.fail='read';assert.equal((await new SaveStore(mem).load()).kind,'recovery');
});
for(const invalid of ['negative-passive','fractional-passive','unknown-card','unlock-mismatch'] as const)test(`N38: a checksummed ${invalid} save requires recovery without silently repairing or replacing its data`,async()=>{
  const mem=new Memory(),p=freshProfile(NOW,'invalid-assets');p.firstDragCompleted=true;p.tutorialFirstWins=['L01'];p.unlockedCardIds=['mobilize','supply','farming'];const envelope=JSON.parse(JSON.stringify(envelopeFor(p,1,NOW)));
  if(invalid==='negative-passive')envelope.data.passiveLevels.farming=-1;
  if(invalid==='fractional-passive')envelope.data.passiveLevels.farming=1.5;
  if(invalid==='unknown-card')envelope.data.activeInventory.unknown=1;
  if(invalid==='unlock-mismatch')envelope.data.unlockedCardIds.push('march');
  const {checksum:old,...body}=envelope,raw=JSON.stringify({...body,checksum:checksum(JSON.stringify(body))});mem.values.set(SLOT_KEYS[1],raw);const before=[...mem.values],store=new SaveStore(mem),loaded=await store.load();
  assert.equal(loaded.kind,'recovery');if(loaded.kind==='recovery'){assert.equal(loaded.backup,null);assert.ok(loaded.reason.length>0);}await assert.rejects(store.save(freshProfile(NOW,'replacement'),NOW+1));assert.deepEqual([...mem.values],before);
});
for(const invalid of ['schema','ruleset','content','checksum','battle-rule'] as const)test(`S11 S22: ${invalid} incompatibility preserves all original bytes and refuses an ordinary write`,async()=>{
  const mem=new Memory(),p=freshProfile(NOW,'incompatible');p.firstDragCompleted=true;p.tutorialFirstWins=['L01'];p.unlockedCardIds=['mobilize','supply','farming'];
  p.activeMatch={battle:createBattle('A01',{id:'incompatible-match'}),modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
  const envelope=JSON.parse(JSON.stringify(envelopeFor(p,1,NOW)));
  if(invalid==='schema')envelope.schemaVersion=99;
  if(invalid==='ruleset')envelope.rulesetId='future-rules';
  if(invalid==='content')envelope.contentVersion='99.0.0';
  if(invalid==='battle-rule')envelope.data.activeMatch.battle.ruleRevision='99';
  const {checksum:old,...body}=envelope;const raw=JSON.stringify({...body,checksum:invalid==='checksum'?'bad':checksum(JSON.stringify(body))});
  mem.values.set(SLOT_KEYS[1],raw);mem.values.set('another-game:save','unrelated');const before=[...mem.values];const store=new SaveStore(mem),loaded=await store.load();
  assert.equal(loaded.kind,'recovery');if(loaded.kind==='recovery'){assert.equal(loaded.backup,null);assert.notEqual(loaded.reason,'');}
  await assert.rejects(store.save(freshProfile(NOW,'replacement'),NOW+1));assert.deepEqual([...mem.values],before);
});
for(const failure of ['before','after','read'] as const)test(`S12: backup recovery ${failure}-write failure preserves the valid fallback until an explicit reload`,async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'backup');await store.load();await store.save(p,NOW);
  p.rankPoints=30;p.highestRankPoints=30;await store.save(p,NOW+1);mem.values.set(SLOT_KEYS[0],'{broken');const original=mem.values.get(SLOT_KEYS[1]);
  const loaded=await store.load();assert.equal(loaded.kind,'recovery');if(loaded.kind!=='recovery')return;
  assert.equal(loaded.backup!.writtenAt,NOW);assert.equal(loaded.backup!.data.rankPoints,0);mem.fail=failure;
  await assert.rejects(store.recoverBackup(loaded.backup!,NOW+2));assert.equal(mem.values.get(SLOT_KEYS[1]),original);
  mem.fail='none';const reloaded=await new SaveStore(mem).load();assert.equal(reloaded.kind,failure==='before'?'recovery':'ready');
  if(reloaded.kind==='ready'){assert.equal(reloaded.envelope.data.rankPoints,0);assert.equal(reloaded.envelope.revision,2);}
  else if(reloaded.kind==='recovery')assert.equal(reloaded.backup!.revision,1);
});
test('stale writer cannot overwrite a more recent revision',async()=>{
  const mem=new Memory(),a=new SaveStore(mem),z=new SaveStore(mem),p=freshProfile(NOW,'g');await a.load();await z.load();await a.save(p,NOW);
  await assert.rejects(z.save(p,NOW+1),/已变化/);assert.equal(mem.values.size,1);
});
test('profile validation rejects invalid assets and mismatched permanent unlocks',()=>{
  const p=freshProfile(NOW,'g');validateProfile(p);
  p.activeInventory.supply=1;assert.throws(()=>validateProfile(p));p.activeInventory.supply=0;p.passiveLevels.farming=-1;assert.throws(()=>validateProfile(p));
  p.passiveLevels.farming=0;p.highestRankPoints=0;p.rankPoints=30;assert.throws(()=>validateProfile(p));
});
test('battle validation accepts complete event batches and rejects stale volley states',()=>{
  const b=createBattle('L03',{id:'validate',firstDragCompleted:true});validateBattle(b);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'L03-P2',targetId:'L03-N2'}).ok,true);
  validateBattle(b);advanceSimulation(b,b.armies[0]!.volleyCheckAtMs!);validateBattle(b);
  b.armies[0]!.volleyState='pending';assert.throws(()=>validateBattle(b),/齐射阶段/);
});
test('checksum covers the full envelope but is not a substitute for schema validation',()=>{
  const p=freshProfile(NOW,'g'),e=envelopeFor(p,1,NOW);e.data.rankPoints=30;assert.throws(()=>decodeEnvelope(JSON.stringify(e)),/校验失败/);
});
test('N32: a complete tower batch survives validated save/load without damage or event replay',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'tower-save'),b=createBattle('A03',{id:'tower-save-match',ruleRevision:'1.5'});
  p.firstDragCompleted=true;p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A03-E1',targetId:'A03-P1'}).ok,true);
  const events=advanceSimulation(b,1700);assert.equal(events.filter(e=>e.type==='tower-shot').length,1);assert.equal(b.armies[0]!.remainingCount,14);
  await store.load();await store.save(p,NOW);const loaded=await new SaveStore(mem).load();assert.equal(loaded.kind,'ready');if(loaded.kind!=='ready')return;
  const restored=loaded.envelope.data.activeMatch!.battle;assert.deepEqual(restored,b);
  const snapshot=JSON.stringify(restored);assert.deepEqual(advanceBattle(restored,1700),[]);assert.equal(JSON.stringify(restored),snapshot);assert.equal(restored.camps[0]!.nextShotAtMs,3400);
});
test('N09: duplicate upgrade sequence is inert before and after validated storage recovery',async()=>{
  const mem=new Memory(),store=new SaveStore(mem),p=freshProfile(NOW,'upgrade-save'),b=createBattle('A01',{id:'upgrade-save-match'});
  p.firstDragCompleted=true;p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};b.camps[0]!.garrison=30;
  const action={kind:'upgrade' as const,faction:'P' as const,sequence:1,targetId:'A01-P1'};
  assert.equal(applyBattleAction(b,action).ok,true);const snapshot=JSON.stringify(b);
  assert.deepEqual(applyBattleAction(b,action).events,[]);assert.equal(JSON.stringify(b),snapshot);
  await store.load();await store.save(p,NOW);const loaded=await new SaveStore(mem).load();assert.equal(loaded.kind,'ready');if(loaded.kind!=='ready')return;
  const restored=loaded.envelope.data.activeMatch!.battle;assert.equal(restored.camps[0]!.garrison,20);assert.equal(restored.camps[0]!.tier,2);
  assert.equal(applyBattleAction(restored,action).ok,false);assert.equal(JSON.stringify(restored),snapshot);
});
function volleyProfile(friendly=false){
  const p=freshProfile(NOW,'volley-save'),b=createBattle('A01',{id:'volley-save-match'});p.firstDragCompleted=true;p.tutorialFirstWins=['L01'];p.unlockedCardIds=['mobilize','supply','farming'];
  p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
  const source=b.camps.find(c=>c.id==='A01-N2')!,target=b.camps.find(c=>c.id==='A01-N5')!;source.owner='P';source.garrison=20;target.garrison=12;if(friendly){target.owner='P';target.nextShotAtMs=2000;}
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id});
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:'A01-P1',targetId:source.id});
  return p;
}
for(const state of ['pending','fired','skipped'] as const)test(`N60: validated ${state} volley snapshot resumes exactly once`,async()=>{
  const p=volleyProfile(state==='skipped'),b=p.activeMatch!.battle,army=b.armies.find(a=>a.troopType==='archer')!;
  advanceSimulation(b,army.volleyCheckAtMs!-(state==='pending'?1:0));assert.equal(army.volleyState,state);
  const mem=new Memory(),store=new SaveStore(mem);await store.load();await store.save(p,NOW);const loaded=await new SaveStore(mem).load();assert.equal(loaded.kind,'ready');if(loaded.kind!=='ready')return;
  const restored=loaded.envelope.data.activeMatch!.battle;assert.deepEqual(restored,b);assert.deepEqual(advanceSimulation(restored,b.gameMs),[]);
  const control=advanceSimulation(b,army.arrivalAtMs),events=advanceSimulation(restored,army.arrivalAtMs);assert.deepEqual(restored,b);assert.deepEqual(events,control);
  assert.equal(events.filter(e=>e.type==='volley').length,state==='pending'?1:0);assert.equal(restored.armies.some(a=>a.id===army.id),false);
});
for(const corruption of ['missing-fields','non-archer-fields','stale-pending','invalid-state'] as const)test(`N70: ${corruption} enters recovery and preserves the original bytes`,async()=>{
  const p=volleyProfile(),b=p.activeMatch!.battle;advanceSimulation(b,b.armies[0]!.volleyCheckAtMs!);
  const mem=new Memory(),store=new SaveStore(mem);await store.load();await store.save(p,NOW);const key=SLOT_KEYS[1],envelope=JSON.parse(mem.values.get(key)!);
  const armies=envelope.data.activeMatch.battle.armies,archer=armies.find((a:{troopType:string})=>a.troopType==='archer');
  if(corruption==='missing-fields'){delete archer.volleyCheckAtMs;delete archer.volleyState;delete archer.volleySkipReason;}
  if(corruption==='non-archer-fields'){const infantry=armies.find((a:{troopType:string})=>a.troopType==='infantry');infantry.volleyCheckAtMs=b.gameMs+1;infantry.volleyState='pending';}
  if(corruption==='stale-pending')archer.volleyState='pending';
  if(corruption==='invalid-state')archer.volleyState='again';
  const {checksum:old,...body}=envelope;const raw=JSON.stringify({...body,checksum:checksum(JSON.stringify(body))});mem.values.set(key,raw);
  const restored=new SaveStore(mem),loaded=await restored.load();assert.equal(loaded.kind,'recovery');await assert.rejects(restored.save(p,NOW));assert.equal(mem.values.get(key),raw);assert.equal(mem.values.size,1);
});
