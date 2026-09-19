import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, factionOf } from '../src/core/battle.ts';
import { CAMP_CONFIG, troopSpeed } from '../src/core/config.ts';
import { fraction } from '../src/core/fraction.ts';
import { travelTime } from '../src/core/geometry.ts';
import { MAPS } from '../src/core/maps.ts';
import { validateBattle } from '../src/app/validation.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { createMixedPressure } from './mixed-pressure-fixture.ts';

test('P04 H16: nine valid camps accept 256 mixed departures, two upgrades and forty repeated cards without a rule cap',()=>{
  const {battle:b,events}=createMixedPressure();validateBattle(b);
  assert.equal(b.gameMs,0);assert.equal(b.armies.length,256);assert.equal(b.camps.length,9);
  assert.deepEqual(b.camps.map(c=>[c.id,c.x,c.y,c.type]),MAPS.A01.camps.map(c=>[c.id,c.x,c.y,c.type]));
  assert.equal(new Set(b.armies.map(a=>a.id)).size,256);
  for(const f of b.factions)assert.equal(b.armies.filter(a=>a.faction===f.id).length,64);
  assert.equal(b.armies.filter(a=>a.troopType==='archer'&&a.initialCount===10&&a.volleyState==='pending').length,64);
  const marching=b.armies.filter(a=>a.faction==='E2');
  for(const a of marching){const source=b.camps.find(c=>c.id===a.sourceId)!,target=b.camps.find(c=>c.id===a.targetId)!,f=factionOf(b,a.faction)!;
    assert.equal(a.speed,troopSpeed(source,f,true));assert.ok(a.arrivalAtMs<travelTime(source,target,troopSpeed(source,f)));}
  assert.equal(events.filter(e=>e.type==='dispatch').length,256);assert.equal(events.filter(e=>e.type==='dispatch'&&e.reason==='march').length,64);
  const upgrades=events.filter(e=>e.type==='upgrade');assert.deepEqual(upgrades.map(e=>[e.targetId,e.amount]),[['A01-P1',10],['A01-N5',10]]);
  for(const id of ['A01-P1','A01-N5']){const c=b.camps.find(c=>c.id===id)!;assert.equal(c.tier,2);assert.equal(c.garrison,42,'40 initial minus ten upgrade plus two actual six-soldier supplies');}
  assert.equal(events.filter(e=>e.type==='card').length,40);
  for(const f of b.factions)for(const id of ['mobilize','supply','feint','march'] as const){
    const used=events.filter(e=>e.faction===f.id&&(id==='march'?e.type==='dispatch'&&e.reason==='march':e.type==='card'&&e.reason===id)).length;
    assert.equal(f.inventory[id],128-used,`${f.id} ${id} debits every accepted operation`);
  }
  for(const c of b.camps){assert.equal(c.mobilizeUntil,12000);assert.deepEqual(c.bonusBudget,fraction(16));}
  assert.equal(b.camps.filter(c=>c.feintUntil===8000).length,2);
  assert.equal(b.camps.find(c=>c.id==='A01-N5')!.feintUntil,0);assert.equal(b.camps.find(c=>c.id==='A01-N5')!.nextShotAtMs,2000);
  const restored=JSON.parse(JSON.stringify(b));validateBattle(restored);assert.deepEqual(restored,b);
});

function run(fps:30|60){
  const {battle,events}=createMixedPressure('mixed-frame');
  const initial=new Map(battle.armies.map(a=>[a.id,structuredClone(a)])),resolved=new Map<string,'arrival'|'tower-loss'|'eliminated'>();
  const ending=Math.max(...battle.armies.map(a=>a.arrivalAtMs))+1,all=[...events];
  const remove=(id:string,why:'arrival'|'tower-loss'|'eliminated')=>{assert.ok(initial.has(id));assert.ok(!resolved.has(id),`duplicate resolution of ${id}`);resolved.set(id,why);};
  for(let frame=1;battle.gameMs<ending;frame++){
    const before=new Map(battle.armies.map(a=>[a.id,structuredClone(a)]));
    const batch=advanceBattle(battle,Math.min(ending,Math.round(frame*1000/fps)));all.push(...batch);validateBattle(battle);
    const live=new Set(battle.armies.map(a=>a.id));
    // Arrival events expose route/faction, not army IDs; consume each due ID from its unmodified pre-step record.
    const arrivalIds=new Set<string>();
    for(const event of batch.filter(e=>e.type==='arrival')){
      const army=[...before.values()].find(a=>!arrivalIds.has(a.id)&&a.arrivalAtMs===event.atMs&&a.sourceId===event.sourceId&&a.targetId===event.targetId&&a.faction===event.faction);
      assert.ok(army,'every arrival maps to one original due army');arrivalIds.add(army.id);
      const losses=batch.filter(e=>e.type==='army-loss'&&e.targetId===army.id&&e.atMs<=event.atMs).reduce((n,e)=>n+(e.amount??0),0);
      assert.equal(event.amount,army.remainingCount-losses);remove(army.id,'arrival');
    }
    for(const [id,army]of before)if(!live.has(id)&&!arrivalIds.has(id)){
      const losses=batch.filter(e=>e.type==='army-loss'&&e.targetId===id).reduce((n,e)=>n+(e.amount??0),0);
      if(losses===army.remainingCount)remove(id,'tower-loss');
      else{assert.ok(batch.some(e=>e.type==='eliminated'&&e.faction===army.faction),'removed ID requires an authoritative cause');remove(id,'eliminated');}
    }
    for(const a of battle.armies){assert.ok(initial.has(a.id));assert.ok(!resolved.has(a.id));}
    assert.equal(resolved.size+battle.armies.length,256);
  }
  assert.equal(battle.armies.length,0);assert.equal(resolved.size,256);
  return {battle,events:all,initial,resolved};
}

test('P04 H16: mixed pressure resolves every original ID through real volleys, tower damage, conversion and simultaneous arrivals',t=>{
  const {battle,events,initial,resolved}=run(60);
  const count=(type:BattleEvent['type'])=>events.filter(e=>e.type===type).length;
  assert.ok(count('tower-shot')>0);assert.ok(count('army-loss')>0);assert.ok(count('volley')>0);assert.ok(count('capture')>0);
  assert.ok(events.some(e=>e.type==='garrison-loss'&&e.reason==='volley'&&(e.amount??0)>0));
  assert.ok([...resolved.values()].includes('tower-loss'),'the conservation audit includes an actual killed army');
  const converted=events.filter(e=>e.type==='arrival'&&e.reason==='friendly'&&e.sourceId==='A01-E3'&&e.targetId==='A01-N3');
  assert.equal(converted.length,64);assert.equal(converted.reduce((n,e)=>n+e.amount!,0),64);
  assert.equal(battle.camps.find(c=>c.id==='A01-N3')!.owner,'E3');assert.equal(battle.camps.find(c=>c.id==='A01-N3')!.type,'archery');
  assert.equal(CAMP_CONFIG[battle.camps.find(c=>c.id==='A01-N3')!.type].troop,'archer');
  assert.ok([...initial.values()].filter(a=>a.sourceId==='A01-E3').every(a=>a.troopType==='infantry'));
  assert.ok(events.some(e=>e.type==='garrison-change'&&e.targetId==='A01-N3'&&e.reason==='arrival'));
  assert.ok(events.some(e=>e.type==='overflow'&&e.targetId==='A01-N3'));
  const arrivalsByTime=new Map<number,number>();for(const e of events.filter(e=>e.type==='arrival'))arrivalsByTime.set(e.atMs,(arrivalsByTime.get(e.atMs)??0)+1);
  assert.ok([...arrivalsByTime.values()].some(n=>n>=64));
  assert.equal(count('arrival')+[...resolved.values()].filter(reason=>reason!=='arrival').length,256);
  t.diagnostic(JSON.stringify({events:Object.fromEntries([...new Set(events.map(e=>e.type))].map(type=>[type,count(type)])),resolved:Object.fromEntries(['arrival','tower-loss','eliminated'].map(reason=>[reason,[...resolved.values()].filter(r=>r===reason).length])),arrivalsByTime:Object.fromEntries(arrivalsByTime),endingMs:battle.gameMs}));
});

test('P05 H16: identical mixed pressure inputs produce complete equal states and events at 30 and 60 fps',()=>{
  const thirty=run(30),sixty=run(60);
  assert.deepEqual(thirty.battle,sixty.battle);assert.deepEqual(thirty.events,sixty.events);assert.deepEqual(thirty.resolved,sixty.resolved);
  const restored=JSON.parse(JSON.stringify(sixty.battle));validateBattle(restored);assert.deepEqual(restored,sixty.battle);
});

test('H16 F10: infantry admitted to the allied archer camp departs as one real archer army after mixed pressure',()=>{
  const {battle,events}=run(60),source=battle.camps.find(c=>c.id==='A01-N3')!,target=battle.camps.find(c=>c.id==='A01-E3')!;
  assert.equal(events.filter(e=>e.type==='arrival'&&e.reason==='friendly'&&e.sourceId==='A01-E3'&&e.targetId===source.id).length,64);
  assert.equal(source.owner,'E3');assert.equal(source.garrison,50);assert.equal(target.owner,'P');
  const f=factionOf(battle,'E3')!,inventory=structuredClone(f.inventory),before=source.garrison;
  const result=applyBattleAction(battle,{kind:'dispatch',faction:'E3',sequence:f.lastActionSequence+1,sourceId:source.id,targetId:target.id});
  assert.equal(result.ok,true);assert.equal(battle.armies.length,1);
  const army=battle.armies[0]!;assert.equal(army.troopType,'archer');assert.equal(army.initialCount,Math.floor(before/2));assert.equal(army.remainingCount,25);
  assert.equal(source.garrison,Math.ceil(before/2));assert.equal(army.volleyState,'pending');assert.ok(army.volleyCheckAtMs!>=battle.gameMs+500);
  assert.deepEqual(f.inventory,inventory);assert.deepEqual(result.events.map(e=>[e.type,e.sourceId,e.targetId,e.amount]),[['dispatch',source.id,target.id,25]]);validateBattle(battle);
});

test('H16: mixed-pressure captures clear only captured effects while surviving suppression expires on its exact deadline',()=>{
  const {battle,events}=run(60);
  for(const id of ['A01-E2','A01-E3']){
    assert.ok(events.some(e=>e.type==='capture'&&e.targetId===id));const camp=battle.camps.find(c=>c.id===id)!;
    assert.equal(camp.mobilizeUntil,0);assert.deepEqual(camp.bonusBudget,fraction(0));assert.equal(camp.feintUntil,0);
  }
  for(const id of ['A01-N2','A01-E1']){
    const camp=battle.camps.find(c=>c.id===id)!;assert.equal(camp.mobilizeUntil,12000);assert.equal(camp.feintUntil,8000);assert.deepEqual(camp.bonusBudget,fraction(16));
  }
  advanceBattle(battle,7999);validateBattle(battle);
  for(const id of ['A01-N2','A01-E1'])assert.equal(battle.camps.find(c=>c.id===id)!.feintUntil,8000);
  advanceBattle(battle,8000);validateBattle(battle);
  for(const id of ['A01-N2','A01-E1']){
    const camp=battle.camps.find(c=>c.id===id)!;assert.equal(camp.feintUntil,0);assert.equal(camp.mobilizeUntil,12000);assert.deepEqual(camp.bonusBudget,fraction(16));
  }
});
