import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, createBattle } from '../src/core/battle.ts';
import { armyPosition } from '../src/core/geometry.ts';

// Distinguish the displayed moving column from its source's ongoing production.
test('a marching column cannot gain soldiers from continued source production',()=>{
  const b=createBattle('A01',{id:'march-count-production'}),source=b.camps.find(c=>c.id==='A01-P1')!;
  const sent=Math.floor(source.garrison/2);
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:'A01-N2'}).ok);
  const a=b.armies[0]!,leave=source.garrison,start=armyPosition(a,0),arrival=a.arrivalAtMs;
  for(let t=100;t<arrival;t+=100){
    const events=advanceBattle(b,t);
    assert.equal(a.remainingCount,sent);assert.equal(a.initialCount,sent);
    assert.equal(events.some(e=>e.type==='army-loss'&&e.targetId===a.id),false);
  }
  assert.ok(source.garrison>leave);assert.notDeepEqual(armyPosition(a,b.gameMs),start);
});

test('each marching count decrease equals an actual tower-hit event, never a volley cost',()=>{
  const b=createBattle('A01',{id:'march-count-damage'}),source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=40;tower.owner='E1';tower.garrison=30;tower.nextShotAtMs=2000;
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}).ok);
  const a=b.armies[0]!,arrival=a.arrivalAtMs;let before=a.remainingCount,hits=0,volleys=0;
  for(let t=50;t<arrival;t+=50){
    const events=advanceBattle(b,t),losses=events.filter(e=>e.type==='army-loss'&&e.targetId===a.id);
    assert.equal(a.remainingCount,before-losses.reduce((n,e)=>n+(e.amount??0),0));
    for(const hit of losses){assert.equal(hit.reason,'tower-shot');assert.ok(hit.position);hits++;}
    if(events.some(e=>e.type==='volley'&&e.sourceId===a.id)){volleys++;if(!losses.length)assert.equal(a.remainingCount,before);}
    before=a.remainingCount;
  }
  assert.ok(hits>0);assert.equal(volleys,1);assert.ok(a.remainingCount<a.initialCount);
});
