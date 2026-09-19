import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, battleStats, createBattle, factionOf } from '../src/core/battle.ts';
import { campCapacity, productionRate } from '../src/core/config.ts';
import { asNumber, fraction } from '../src/core/fraction.ts';
import type { Battle, Camp } from '../src/core/types.ts';

const get=(b:Battle,suffix:string)=>b.camps.find(c=>c.id===`A01-${suffix}`)!;
// Explicit v1.5 cases retain the original synthetic unrestricted routes and precise ETAs.
function fixture(ruleRevision:Battle['ruleRevision']='1.6'){const b=createBattle('A01',{id:'tower-acceptance',ruleRevision});for(const [i,c]of b.camps.entries()){c.x=1000+i*300;c.y=1000;c.feintUntil=1000000;c.nextShotAtMs=null;}
  const tower=get(b,'P1');tower.type='fort';tower.tier=1;tower.x=0;tower.y=0;tower.garrison=10;tower.feintUntil=0;tower.nextShotAtMs=1000;return b;
}
function position(c:Camp,x:number,y=0){c.x=x;c.y=y;}
function send(b:Battle,s:Camp,t:Camp,sequence=1){assert.equal(applyBattleAction(b,{kind:'dispatch',faction:s.owner!,sequence,sourceId:s.id,targetId:t.id}).ok,true);return b.armies.at(-1)!;}
test('N08 N10 N11: upgrade thresholds, costs, production and permanent tiers',()=>{
  for(const [tier,threshold,cost,capacity,rate]of [[1,30,10,90,.39],[2,70,25,140,.48]] as const){const b=fixture(),c=get(b,'P1');c.tier=tier;c.garrison=threshold-1;
    assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:c.id}).ok,false);assert.equal(c.garrison,threshold-1);
    c.garrison=threshold;assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:2,targetId:c.id}).ok,true);
    assert.equal(c.garrison,threshold-cost);assert.equal(c.tier,tier+1);assert.equal(campCapacity(c,factionOf(b,'P')),capacity);assert.equal(asNumber(productionRate(b,c,factionOf(b,'P'),0)),rate);
    const newTier=c.tier;send(b,c,get(b,'N4'),3);assert.equal(c.tier,newTier);c.garrison=0;advanceBattle(b,1000);assert.equal(c.tier,newTier);
    if(newTier===3){c.garrison=140;assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:4,targetId:c.id}).ok,false);assert.equal(c.garrison,140);}
  }
});
test('N13 N15: upgrading preserves accrued production and never fills expanded capacity',()=>{
  const b=fixture('1.5'),c=get(b,'P1');c.type='barracks';c.nextShotAtMs=null;c.garrison=30;c.mobilizeUntil=6000;c.bonusBudget=fraction(8);
  advanceBattle(b,200);assert.deepEqual(c.credit,fraction(12,25));assert.deepEqual(c.bonusBudget,fraction(194,25));
  const before={credit:c.credit,budget:c.bonusBudget,end:c.mobilizeUntil};applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:c.id});
  assert.deepEqual({credit:c.credit,budget:c.bonusBudget,end:c.mobilizeUntil},before);assert.equal(c.garrison,20);
  const full=fixture('1.5'),f=get(full,'P1');f.type='barracks';f.nextShotAtMs=null;f.garrison=50;f.credit=fraction(1,2);advanceBattle(full,10000);assert.deepEqual(f.credit,fraction(0));
  applyBattleAction(full,{kind:'upgrade',faction:'P',sequence:1,targetId:f.id});assert.equal(f.garrison,40);advanceBattle(full,11000);assert.equal(f.garrison,41);assert.deepEqual(f.credit,fraction(14,25));
});
for(const kind of ['incoming','passing','other-camp','garrison'] as const)test(`N18: a tower can target ${kind}`,()=>{
  const b=fixture('1.5'),tower=get(b,'P1'),enemy=get(b,'E1'),other=get(b,'E2');position(enemy,180);position(other,-180);
  let id:string;
  if(kind==='garrison'){position(enemy,100);id=enemy.id;}
  else{const target=kind==='incoming'?tower:other;if(kind==='other-camp')other.owner='P';id=send(b,enemy,target).id;}
  const events=advanceBattle(b,1000);assert.equal(events.find(e=>e.type==='tower-shot')!.targetId,id);
});
test('N19: friendly armies, neutral camps and empty enemy camps are never shot',()=>{
  const b=fixture('1.5'),enemy=get(b,'E1'),neutral=get(b,'N1'),source=get(b,'N2'),target=get(b,'N3');position(enemy,100);enemy.garrison=0;position(neutral,90);neutral.garrison=20;
  source.owner='P';target.owner='P';position(source,180);position(target,-180);const army=send(b,source,target);
  const events=advanceBattle(b,1000);assert.equal(events.some(e=>e.type==='tower-shot'),false);assert.equal(army.remainingCount,4);assert.equal(neutral.garrison,20);assert.equal(enemy.garrison,0);
});
test('N20: incoming armies take priority over closer passing armies and then use earliest ETA',()=>{
  const b=fixture('1.5'),tower=get(b,'P1'),e1=get(b,'E1'),e2=get(b,'E2'),e3=get(b,'E3'),target=get(b,'N1');position(e1,180);position(e2,160);position(e3,100);position(target,-180);
  const later=send(b,e1,tower),earlier=send(b,e2,tower),passing=send(b,e3,target);const events=advanceBattle(b,1000);
  assert.equal(events.find(e=>e.type==='tower-shot')!.targetId,earlier.id);assert.equal(earlier.remainingCount,9);assert.equal(later.remainingCount,10);assert.equal(passing.remainingCount,10);
});
test('N20: passing armies outrank camps and use distance before ID; camps use distance too',()=>{
  const b=fixture('1.5'),far=get(b,'E1'),near=get(b,'E2'),target=get(b,'E3'),camp=get(b,'N1');position(far,210);position(near,150);position(target,-300);camp.owner='E3';camp.garrison=10;position(camp,20);
  const farther=send(b,far,target),nearer=send(b,near,target);assert.ok(farther.id.localeCompare(nearer.id)<0);
  assert.equal(advanceBattle(b,1000).find(e=>e.type==='tower-shot')!.targetId,nearer.id);
  const c=fixture('1.5'),earlierId=get(c,'E1'),laterId=get(c,'E2');position(earlierId,110);position(laterId,90);
  assert.equal(advanceBattle(c,1000).find(e=>e.type==='tower-shot')!.targetId,laterId.id);
});
for(const targetKind of ['incoming','passing','camp'] as const)test(`N20: ${targetKind} distance/ETA ties use stable ID order`,()=>{
  const b=fixture('1.5'),tower=get(b,'P1'),enemy=get(b,'E1'),target=get(b,'E2');position(enemy,180);position(target,-180);
  let id:string;
  if(targetKind==='camp'){position(enemy,100);position(target,0,100);id=[enemy.id,target.id].sort()[0]!;}
  else{const first=send(b,enemy,targetKind==='incoming'?tower:target),second=send(b,enemy,targetKind==='incoming'?tower:target,2);id=[first.id,second.id].sort()[0]!;b.armies.reverse();}
  const events=advanceBattle(b,1000);assert.equal(events.filter(e=>e.type==='tower-shot').length,1);assert.equal(events.find(e=>e.type==='tower-shot')!.targetId,id);
});
test('N22: an upgrade at 1000 preserves the 2000 shot and schedules 3700 next',()=>{
  const b=fixture(),tower=get(b,'P1'),enemy=get(b,'E1');tower.nextShotAtMs=2000;tower.garrison=30;position(enemy,100);advanceBattle(b,1000);
  applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:tower.id});assert.equal(tower.nextShotAtMs,2000);
  assert.equal(advanceBattle(b,1999).some(e=>e.type==='tower-shot'),false);assert.equal(advanceBattle(b,2000).filter(e=>e.type==='tower-shot').length,1);assert.equal(tower.nextShotAtMs,3700);
});
test('N24: shooting a camp empty retains its flag and production eligibility',()=>{
  const b=fixture(),enemy=get(b,'E1');position(enemy,100);enemy.type='fort';enemy.tier=1;enemy.garrison=1;enemy.feintUntil=0;
  advanceBattle(b,1000);assert.equal(enemy.garrison,0);assert.equal(enemy.owner,'E1');assert.equal(enemy.tier,1);assert.equal(factionOf(b,'E1')!.eliminated,false);
  advanceBattle(b,3334);assert.equal(enemy.garrison,1);assert.equal(battleStats(b).find(s=>s.faction==='E1')!.camps,1);
});
test('N25: killing the last marching soldier cancels arrival and removes its counted strength',()=>{
  const b=fixture('1.5'),tower=get(b,'P1'),enemy=get(b,'E1');position(enemy,180);enemy.garrison=2;const army=send(b,enemy,tower);
  advanceBattle(b,1000);assert.equal(b.armies.length,0);assert.equal(battleStats(b).find(s=>s.faction==='E1')!.troops,1);
  assert.equal(advanceBattle(b,army.arrivalAtMs).some(e=>e.type==='arrival'),false);assert.equal(tower.owner,'P');
});
test('N26 N29: capture on a shot tick cancels the old shot and starts a complete new interval',()=>{
  const b=fixture('1.5'),tower=get(b,'P1'),enemy=get(b,'E1');tower.tier=3;tower.garrison=0;get(b,'N1').owner='P';position(enemy,116);enemy.garrison=4;
  const army=send(b,enemy,tower);assert.equal(army.arrivalAtMs,1000);const events=advanceBattle(b,1000);
  assert.equal(tower.owner,'E1');assert.equal(tower.tier,3);assert.equal(tower.garrison,2);assert.equal(tower.nextShotAtMs,2500);assert.equal(events.some(e=>e.type==='tower-shot'),false);
  assert.equal(advanceBattle(b,2499).some(e=>e.type==='tower-shot'),false);
  tower.garrison=0;tower.credit=fraction(0);const target=get(b,'N1');position(target,100);target.garrison=10;
  assert.equal(advanceBattle(b,2500).some(e=>e.type==='tower-shot'),false);assert.equal(tower.nextShotAtMs,4000);assert.equal(target.garrison,10);
});
test('N11: combat that empties an upgraded camp preserves its tier and owner',()=>{
  const b=fixture('1.5'),camp=get(b,'P1'),enemy=get(b,'E1');camp.garrison=30;
  assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:camp.id}).ok,true);assert.equal(camp.garrison,20);
  camp.feintUntil=1000000;camp.nextShotAtMs=null;enemy.garrison=40;position(enemy,116);const army=send(b,enemy,camp);
  advanceBattle(b,army.arrivalAtMs);assert.equal(camp.garrison,0);assert.equal(camp.owner,'P');assert.equal(camp.tier,2);
});
test('N28 N32: pause and restoration preserve the exact tower rhythm without replay',()=>{
  const b=fixture(),tower=get(b,'P1');position(get(b,'E1'),100);b.status='paused';const before=JSON.stringify(b);advanceBattle(b,10000);assert.equal(JSON.stringify(b),before);
  const resumed=JSON.parse(before) as Battle;resumed.status='running';advanceBattle(resumed,1000);const after=JSON.stringify(resumed),next=resumed.nextEventId;
  const restored=JSON.parse(after) as Battle;assert.equal(advanceBattle(restored,1000).length,0);assert.equal(restored.nextEventId,next);assert.equal(get(restored,'P1').nextShotAtMs,3000);
  assert.equal(advanceBattle(restored,2999).some(e=>e.type==='tower-shot'),false);assert.equal(advanceBattle(restored,3000).filter(e=>e.type==='tower-shot').length,1);
  assert.equal(tower.nextShotAtMs,1000);
});
test('N30: suppression skips scheduled shots and does not grant one at expiration',()=>{
  const b=fixture(),tower=get(b,'P1'),enemy=get(b,'E1');position(enemy,100);tower.nextShotAtMs=2000;factionOf(b,'E1')!.inventory.feint=1;advanceBattle(b,1000);
  applyBattleAction(b,{kind:'card',cardId:'feint',faction:'E1',sequence:1,targetId:tower.id});assert.equal(tower.feintUntil,5000);
  assert.equal(advanceBattle(b,5000).some(e=>e.type==='tower-shot'),false);assert.equal(tower.nextShotAtMs,6000);
  assert.equal(advanceBattle(b,6000).filter(e=>e.type==='tower-shot').length,1);
});
test('N31: a nearby marching target does not transfer tower damage to its distant destination',()=>{
  const b=fixture('1.5'),source=get(b,'E1'),target=get(b,'E2');position(source,180);position(target,-180);const before=target.garrison;const army=send(b,source,target);
  advanceBattle(b,1000);assert.equal(army.remainingCount,9);assert.equal(target.garrison,before);
});
