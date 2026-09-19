import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { fraction } from '../src/core/fraction.ts';
import { campCapacity, movementSpeed } from '../src/core/config.ts';
import type { ActiveCardId, Battle, Camp, FactionId } from '../src/core/types.ts';

// Only the explicitly selected legacy credit test keeps its original millisecond arithmetic.
function fixture(ruleRevision:Battle['ruleRevision']='1.6'){const b=createBattle('A01',{id:'card-boundary',ruleRevision,inventory:{mobilize:20,supply:5,feint:20,march:0}});const camp=b.camps.find(c=>c.owner==='P')!;camp.garrison=0;return {b,camp};}
function cast(b:Battle,id:Exclude<ActiveCardId,'march'>,target:Camp,faction:FactionId='P'){
  const result=applyBattleAction(b,{kind:'card',cardId:id,targetId:target.id,faction,sequence:factionOf(b,faction)!.lastActionSequence+1});assert.equal(result.ok,true);return result.events;
}
test('K28: zero inventory, pause and finished battles reject every active card with a reason and no success event or mutation',()=>{
  for(const state of ['empty','paused','finished'] as const)for(const card of ['mobilize','supply','feint','march'] as const){
    const {b,camp}=fixture(),actor=factionOf(b,'P')!;camp.garrison=20;actor.inventory={mobilize:2,supply:2,feint:2,march:2};
    if(state==='empty')actor.inventory[card]=0;else if(state==='paused')b.status='paused';else advanceBattle(b,240000);
    const before=JSON.stringify(b),action=card==='march'?{kind:'dispatch' as const,faction:'P' as const,sequence:1,sourceId:camp.id,targetId:'A01-N4',march:true}:{kind:'card' as const,cardId:card,faction:'P' as const,sequence:1,targetId:card==='feint'?'A01-E1':camp.id};
    const result=applyBattleAction(b,action);assert.equal(result.ok,false);if(!result.ok)assert.ok(result.reason.length>0);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(b),before);
  }
});
test('K01 K02: five independent supplies consume five cards, while duplicate and exhausted commands do nothing',()=>{
  const {b,camp}=fixture();
  for(let n=1;n<=5;n++){
    assert.deepEqual(cast(b,'supply',camp).map(e=>e.amount),[6]);assert.equal(camp.garrison,n*6);assert.equal(factionOf(b,'P')!.inventory.supply,5-n);
    const snapshot=JSON.stringify(b),duplicate=applyBattleAction(b,{kind:'card',cardId:'supply',targetId:camp.id,faction:'P',sequence:n});assert.equal(duplicate.ok,false);assert.deepEqual(duplicate.events,[]);assert.equal(JSON.stringify(b),snapshot);
  }
  const snapshot=JSON.stringify(b),empty=applyBattleAction(b,{kind:'card',cardId:'supply',targetId:camp.id,faction:'P',sequence:6});assert.equal(empty.ok,false);assert.deepEqual(empty.events,[]);assert.equal(JSON.stringify(b),snapshot);
});
test('K06: mobilization doubles production only until its eight-point budget is consumed and never grants soldiers immediately',()=>{
  const {b,camp}=fixture();camp.tier=3;const events=cast(b,'mobilize',camp);assert.equal(camp.garrison,0);assert.deepEqual(events.map(e=>e.amount),[0]);assert.equal(camp.mobilizeUntil,6000);assert.deepEqual(camp.bonusBudget,fraction(8));
  advanceBattle(b,1000);assert.equal(camp.garrison,2);assert.deepEqual(camp.credit,fraction(22,25));assert.deepEqual(camp.bonusBudget,fraction(164,25));
  advanceBattle(b,5000);assert.equal(camp.garrison,14);assert.deepEqual(camp.credit,fraction(2,5));assert.deepEqual(camp.bonusBudget,fraction(4,5));assert.equal(camp.mobilizeUntil,6000);
  advanceBattle(b,6000);assert.equal(camp.garrison,16);assert.deepEqual(camp.credit,fraction(16,25));assert.equal(camp.mobilizeUntil,0);assert.deepEqual(camp.bonusBudget,fraction(0));
});
test('K07: a five-second two-point remainder becomes eleven seconds and ten points, without multiplying strength',()=>{
  const {b,camp}=fixture();b.gameMs=1000;camp.mobilizeUntil=6000;camp.bonusBudget=fraction(2);
  cast(b,'mobilize',camp);assert.equal(camp.mobilizeUntil-b.gameMs,11000);assert.deepEqual(camp.bonusBudget,fraction(10));assert.equal(factionOf(b,'P')!.inventory.mobilize,19);
  advanceBattle(b,2000);assert.equal(camp.garrison,1);assert.deepEqual(camp.credit,fraction(4,5));assert.deepEqual(camp.bonusBudget,fraction(91,10));
});
test('K08 K23: exact expiry retains produced credit and a new order starts a fresh budget',()=>{
  const {b,camp}=fixture();cast(b,'mobilize',camp);advanceBattle(b,6000);assert.equal(camp.garrison,10);assert.deepEqual(camp.credit,fraction(4,5));assert.equal(camp.mobilizeUntil,0);assert.deepEqual(camp.bonusBudget,fraction(0));
  const noRenewal=structuredClone(b);advanceBattle(noRenewal,10000);const unchanged=noRenewal.camps.find(c=>c.id===camp.id)!;assert.equal(unchanged.garrison,14);assert.deepEqual(unchanged.credit,fraction(2,5));
  cast(b,'mobilize',camp);assert.equal(camp.mobilizeUntil,12000);assert.deepEqual(camp.bonusBudget,fraction(8));assert.equal(camp.garrison,10);assert.deepEqual(camp.credit,fraction(4,5));
  advanceBattle(b,12000);assert.equal(camp.garrison,21);assert.deepEqual(camp.credit,fraction(3,5));assert.deepEqual(camp.bonusBudget,fraction(0));
});
test('K09 K10: suppression freezes natural and bonus credit while both clocks run, with no catch-up or new order',()=>{
  const {b,camp}=fixture();factionOf(b,'E1')!.inventory.feint=1;cast(b,'mobilize',camp);advanceBattle(b,1000);cast(b,'feint',camp,'E1');
  const credit=structuredClone(camp.credit),budget=structuredClone(camp.bonusBudget),before=JSON.stringify(b);
  const rejected=applyBattleAction(b,{kind:'card',cardId:'mobilize',targetId:camp.id,faction:'P',sequence:2});assert.equal(rejected.ok,false);if(!rejected.ok)assert.match(rejected.reason,/停产/);assert.equal(JSON.stringify(b),before);
  advanceBattle(b,4999);assert.equal(camp.garrison,1);assert.deepEqual(camp.credit,credit);assert.deepEqual(camp.bonusBudget,budget);assert.equal(camp.mobilizeUntil,6000);assert.equal(camp.feintUntil,5000);
  advanceBattle(b,5000);assert.equal(camp.feintUntil,0);assert.equal(camp.garrison,1);advanceBattle(b,6000);assert.equal(camp.garrison,3);assert.deepEqual(camp.credit,fraction(3,5));assert.deepEqual(camp.bonusBudget,fraction(0));
  advanceBattle(b,10000);assert.equal(camp.garrison,7);assert.deepEqual(camp.credit,fraction(1,5));
});
test('K11: renewing tower suppression with two seconds left gives six seconds without damage or a cadence reset',()=>{
  const {b,camp}=fixture(),tower=b.camps.find(c=>c.owner==='E1')!;Object.assign(tower,{type:'fort',garrison:10,x:0,y:0,nextShotAtMs:2000});Object.assign(camp,{x:100,y:0,garrison:20});
  const first=cast(b,'feint',tower);assert.equal(tower.feintUntil,4000);assert.ok(first.every(e=>e.type==='card'&&e.amount===0));assert.equal(tower.garrison,10);
  assert.ok(!advanceBattle(b,2000).some(e=>e.type==='tower-shot'));assert.equal(tower.nextShotAtMs,4000);const counts=b.camps.map(c=>c.garrison);cast(b,'feint',tower);
  assert.equal(tower.feintUntil-b.gameMs,6000);assert.deepEqual(b.camps.map(c=>c.garrison),counts);assert.equal(tower.nextShotAtMs,4000);
  const silent=advanceBattle(b,7999);assert.ok(!silent.some(e=>e.type==='tower-shot'));assert.equal(tower.garrison,10);
  const resumed=advanceBattle(b,8000);assert.equal(tower.feintUntil,0);assert.equal(tower.nextShotAtMs,10000);assert.equal(resumed.filter(e=>e.type==='tower-shot'&&e.sourceId===tower.id).length,1);
});
test('K12: suppression rejects friendly and neutral camps but accepts an empty enemy camp',()=>{
  const {b,camp}=fixture(),neutral=b.camps.find(c=>c.owner===null)!,enemy=b.camps.find(c=>c.owner==='E1')!;
  for(const target of [camp,neutral]){const before=JSON.stringify(b),result=applyBattleAction(b,{kind:'card',cardId:'feint',targetId:target.id,faction:'P',sequence:1});assert.equal(result.ok,false);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(b),before);}
  enemy.garrison=0;cast(b,'feint',enemy);advanceBattle(b,4000);assert.equal(enemy.garrison,0);assert.equal(enemy.owner,'E1');assert.equal(enemy.feintUntil,0);advanceBattle(b,5112);assert.equal(enemy.garrison,1);
});
test('H05: a suppressed tower can send and receive friendly reinforcements without clearing suppression',()=>{
  for(const inbound of [false,true]){
    const {b}=fixture(),tower=b.camps.find(c=>c.id==='A01-N5')!,ally=b.camps.find(c=>c.id==='A01-N3')!;
    Object.assign(ally,{owner:'E1',type:'barracks',garrison:20});tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;cast(b,'feint',tower);
    const source=inbound?ally:tower,target=inbound?tower:ally;
    const sent=applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:source.id,targetId:target.id});
    assert.equal(sent.ok,true);assert.equal(source.garrison,10);assert.equal(b.armies[0]!.remainingCount,10);
    assert.equal(b.armies[0]!.troopType,inbound?'infantry':'guard');
    const at=b.armies[0]!.arrivalAtMs;assert.ok(at<4000);
    const events=advanceBattle(b,at);
    assert.equal(b.armies.length,0);assert.equal(tower.feintUntil,4000);assert.equal(tower.owner,'E1');
    assert.equal(tower.garrison,inbound?30:10);
    assert.equal(ally.garrison,(inbound?10:30)+Math.floor(.9*at/1000));
    assert.ok(events.some(e=>e.type==='arrival'&&e.reason==='friendly'&&e.targetId===target.id));
    assert.ok(events.some(e=>e.type==='garrison-change'&&e.targetId===target.id&&e.amount===10));
    assert.ok(!events.some(e=>e.type==='capture'||e.type==='tower-shot'));
  }
});
test('K29: twenty repeated orders accumulate duration and budget, including suppression from different factions',()=>{
  const {b,camp}=fixture();for(let i=1;i<=20;i++){cast(b,'mobilize',camp);assert.equal(camp.mobilizeUntil,i*6000);assert.deepEqual(camp.bonusBudget,fraction(i*8));assert.equal(camp.garrison,0);}
  const enemy=b.camps.find(c=>c.owner==='E1')!;factionOf(b,'E2')!.inventory.feint=20;factionOf(b,'E3')!.inventory.feint=20;
  for(let i=0;i<20;i++){cast(b,'feint',enemy,(['P','E2','E3'] as const)[i%3]!);assert.equal(enemy.feintUntil,(i+1)*4000);}
  assert.equal(factionOf(b,'P')!.inventory.feint,13);assert.equal(factionOf(b,'E2')!.inventory.feint,13);assert.equal(factionOf(b,'E3')!.inventory.feint,14);
  advanceBattle(b,80000);assert.equal(enemy.feintUntil,0);cast(b,'feint',enemy);assert.equal(enemy.feintUntil,84000);
});
test('K16: losing the last camp resolves before a supply command and cannot resurrect the faction',()=>{
  const {b,camp}=fixture(),enemy=b.camps.find(c=>c.id==='A01-N4')!;camp.feintUntil=1000000;Object.assign(enemy,{owner:'E1',x:camp.x+116,y:camp.y,garrison:20});
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:enemy.id,targetId:camp.id}).ok,true);advanceBattle(b,b.armies[0]!.arrivalAtMs);
  assert.equal(factionOf(b,'P')!.eliminated,true);assert.equal(b.status,'finished');const before=JSON.stringify(b),result=applyBattleAction(b,{kind:'card',cardId:'supply',faction:'P',sequence:1,targetId:camp.id});
  assert.equal(result.ok,false);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(b),before);assert.equal(factionOf(b,'P')!.inventory.supply,5);
});
test('K25: cavalry with three logistics layers and march caps at 48 and keeps that journey through upgrade and source capture',()=>{
  const {b,camp}=fixture(),actor=factionOf(b,'P')!,target=b.camps.find(c=>c.id==='A01-N4')!,enemy=b.camps.find(c=>c.id==='A01-N2')!;
  for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}Object.assign(camp,{type:'relay',tier:2,garrison:90});actor.passives.logistics=3;actor.inventory.march=1;
  b.camps.find(c=>c.id==='A01-N3')!.owner='P';target.x=camp.x+1000;target.y=camp.y;
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:camp.id,targetId:target.id,march:true}).ok,true);const army=b.armies[0]!;
  assert.equal(army.speed,48);assert.equal(army.troopType,'cavalry');assert.equal(army.arrivalAtMs,20084);assert.equal(actor.inventory.march,0);
  const journey={speed:army.speed,arrival:army.arrivalAtMs,troop:army.troopType};for(let i=0;i<5;i++)cast(b,'supply',camp);
  assert.equal(camp.garrison,75);assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:7,targetId:camp.id}).ok,true);assert.equal(camp.tier,3);assert.equal(camp.garrison,50);
  Object.assign(enemy,{owner:'E1',x:camp.x+60,y:camp.y,tier:3,garrison:140});applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:enemy.id,targetId:camp.id});advanceBattle(b,1000);
  assert.equal(camp.owner,'E1');assert.equal(factionOf(b,'P')!.eliminated,false);assert.ok(b.armies.includes(army));assert.deepEqual({speed:army.speed,arrival:army.arrivalAtMs,troop:army.troopType},journey);
});
test('K17: occupation removes actually cast mobilization and suppression without transferring their credit or budget',()=>{
  const {b,camp}=fixture(),enemy=b.camps.find(c=>c.id==='A01-N4')!;camp.garrison=14;enemy.owner='E1';enemy.garrison=2;enemy.credit=fraction(1,2);factionOf(b,'E1')!.inventory.mobilize=1;
  cast(b,'mobilize',enemy,'E1');cast(b,'feint',enemy);assert.equal(enemy.mobilizeUntil,6000);assert.equal(enemy.feintUntil,4000);assert.deepEqual(enemy.bonusBudget,fraction(8));
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:camp.id,targetId:enemy.id}).ok,true);advanceBattle(b,b.armies[0]!.arrivalAtMs);
  assert.equal(enemy.owner,'P');assert.equal(enemy.garrison,5);assert.equal(enemy.mobilizeUntil,0);assert.equal(enemy.feintUntil,0);assert.deepEqual(enemy.credit,fraction(0));assert.deepEqual(enemy.bonusBudget,fraction(0));
});
test('K24: a captured first-tier camp uses fifty-four capacity without free troops and clips only actual overflow',()=>{
  for(const sent of [6,60]){const {b,camp}=fixture(),enemy=b.camps.find(c=>c.id==='A01-N4')!,actor=factionOf(b,'P')!;actor.passives.fortification=3;enemy.owner='E1';camp.tier=3;camp.garrison=sent*2;enemy.garrison=4;enemy.feintUntil=1000000;
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:camp.id,targetId:enemy.id}).ok,true);const events=advanceBattle(b,b.armies[0]!.arrivalAtMs);assert.equal(enemy.owner,'P');assert.equal(enemy.tier,1);assert.equal(campCapacity(enemy,actor),54);assert.equal(enemy.garrison,sent===6?2:54);assert.equal(events.find(e=>e.type==='overflow'&&e.targetId===enemy.id)?.amount??0,sent===6?0:2);
  }
});
test('R10: production earned before upgrading or mobilizing keeps its exact credit without a duplicate soldier',()=>{
  const {b,camp}=fixture('1.5');camp.garrison=29;advanceBattle(b,834);assert.equal(camp.garrison,30);assert.deepEqual(camp.credit,fraction(1,1250));
  assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:camp.id}).ok,true);assert.equal(camp.garrison,20);assert.deepEqual(camp.credit,fraction(1,1250));
  advanceBattle(b,1474);assert.equal(camp.garrison,20);assert.deepEqual(camp.credit,fraction(1249,1250));advanceBattle(b,1475);assert.equal(camp.garrison,21);assert.deepEqual(camp.credit,fraction(19,25000));
  cast(b,'mobilize',camp);assert.equal(camp.garrison,21);assert.deepEqual(camp.credit,fraction(19,25000));advanceBattle(b,1795);assert.equal(camp.garrison,21);advanceBattle(b,1796);assert.equal(camp.garrison,22);assert.deepEqual(camp.credit,fraction(57,25000));
});
test('R20: high-logistics cavalry on a short route keeps the one-second floor and rejects a useless capped march',()=>{
  const {b,camp}=fixture(),actor=factionOf(b,'P')!,target=b.camps.find(c=>c.id==='A01-N4')!;camp.type='relay';camp.garrison=20;actor.passives.logistics=10000;actor.inventory.march=1;target.x=camp.x+60;target.y=camp.y;
  assert.equal(movementSpeed(b,camp,actor,true),48);const before=JSON.stringify(b),result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:camp.id,targetId:target.id,march:true});assert.equal(result.ok,false);assert.equal(JSON.stringify(b),before);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:camp.id,targetId:target.id}).ok,true);assert.equal(b.armies[0]!.arrivalAtMs,1000);assert.ok(b.armies[0]!.speed<=48);assert.equal(actor.inventory.march,1);
});
