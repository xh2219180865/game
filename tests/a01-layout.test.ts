import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBattleAction, createBattle } from '../src/core/battle.ts';
import { advanceSimulation } from '../src/core/ai.ts';
import { CAMP_RADIUS, TOWER_RANGE } from '../src/core/config.ts';
import { armyPosition, distance, travelTime } from '../src/core/geometry.ts';
import { LEGACY_A01_CAMPS, MAPS, neighbors } from '../src/core/maps.ts';
import { freshProfile } from '../src/core/progress.ts';
import type { Army, Point } from '../src/core/types.ts';
import { validateBattle } from '../src/app/validation.ts';
import { SaveStore } from '../src/app/storage.ts';

const NOW=Date.parse('2026-09-13T09:00:00+08:00');
const map=MAPS.A01;
const oldCamp=(id:string)=>LEGACY_A01_CAMPS.find(c=>c.id===id)!;
const newCamp=(id:string)=>map.camps.find(c=>c.id===id)!;

test('A01 layout: new battle opens diagonal fronts without changing node identities, camp rules or road travel',()=>{
  const b=createBattle('A01',{id:'diagonal-fronts'});
  assert.deepEqual(b.camps.map(({id,x,y})=>({id,x,y})),map.camps.map(({id,x,y})=>({id,x,y})));
  assert.notEqual(newCamp('A01-P1').y,newCamp('A01-E1').y);
  assert.notEqual(newCamp('A01-N2').y,newCamp('A01-N3').y);
  for(const camp of map.camps){
    const original=oldCamp(camp.id);
    const {x:oldX,y:oldY,...oldRules}=original,{x,y,...rules}=camp;
    assert.deepEqual(rules,oldRules);
    assert.ok(x>=45&&x<=315&&y>=90&&y<=450,'building footprints stay within the board');
    assert.ok(Number.isFinite(oldX)&&Number.isFinite(oldY));
  }
  assert.equal(map.roads.length,12);
  for(const [a,z] of map.roads){
    assert.ok(Math.abs(distance(oldCamp(a),oldCamp(z))-distance(newCamp(a),newCamp(z)))<1e-10);
    for(const speed of [24,33.6,48,80,112,160]){
      assert.equal(travelTime(newCamp(a),newCamp(z),speed),travelTime(oldCamp(a),oldCamp(z),speed),`${a} → ${z}, ${speed}`);
    }
  }
  for(const start of b.camps.filter(c=>c.owner)){
    const exits=neighbors(b,start.id);
    assert.equal(exits.length,2);
    assert.deepEqual(exits.map(id=>travelTime(start,newCamp(id),24)).sort((a,z)=>a-z),[2895,5167]);
  }
});

function segmentDistance(point:Point,from:Point,to:Point):number{
  const dx=to.x-from.x,dy=to.y-from.y;
  const t=Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.y-from.y)*dy)/(dx*dx+dy*dy)));
  return distance(point,{x:from.x+dx*t,y:from.y+dy*t});
}

test('A01 layout: central tower retains camp coverage and the complete march corridor geometry',()=>{
  const oldTower=oldCamp('A01-N5'),tower=newCamp('A01-N5');
  const covered=map.camps.filter(c=>c.id!==tower.id&&distance(tower,c)<=TOWER_RANGE).map(c=>c.id);
  assert.deepEqual(covered,['A01-N2','A01-N3']);
  for(const camp of map.camps)assert.equal(distance(tower,camp)<=TOWER_RANGE,distance(oldTower,oldCamp(camp.id))<=TOWER_RANGE);
  for(const [a,z] of map.roads){
    const oldFrom=oldCamp(a),oldTo=oldCamp(z),from=newCamp(a),to=newCamp(z);
    // The same rigid geometry keeps every continuous route's closest approach, not just its endpoint, unchanged.
    assert.ok(Math.abs(segmentDistance(oldTower,oldFrom,oldTo)-segmentDistance(tower,from,to))<1e-10);
    const army=(from:Point,to:Point)=>({from,to,departedAtMs:0,arrivalAtMs:1000}) as Army;
    for(let at=0;at<=1000;at+=10){
      const before=distance(oldTower,armyPosition(army(oldFrom,oldTo),at));
      const after=distance(tower,armyPosition(army(from,to),at));
      assert.ok(Math.abs(before-after)<1e-10);
      assert.equal(before<=TOWER_RANGE,after<=TOWER_RANGE);
    }
    assert.ok(distance(from,to)>2*CAMP_RADIUS);
  }
});

for(const revision of ['1.5','1.6'] as const)for(const layout of ['legacy','diagonal'] as const){
  test(`A01 layout: ${revision} ${layout} active army restores exact coordinates, ETA and continuation`,async()=>{
    const data=new Map<string,string>();
    const port={async read(k:string){return data.get(k)??null;},async write(k:string,v:string){data.set(k,v);},async remove(k:string){data.delete(k);}};
    const profile=freshProfile(NOW,`a01-${revision}-${layout}`);
    profile.firstDragCompleted=true;
    const b=createBattle('A01',{id:`a01-${revision}-${layout}`,ruleRevision:revision});
    if(layout==='legacy')for(const camp of b.camps){const old=oldCamp(camp.id);camp.x=old.x;camp.y=old.y;}
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'}).ok);
    advanceSimulation(b,500);
    assert.equal(b.armies.length,1);
    assert.doesNotThrow(()=>validateBattle(b));
    profile.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:profile.weekId};
    const store=new SaveStore(port);await store.load();await store.save(profile,NOW);
    const bytes=[...data];
    const loaded=await new SaveStore(port).load();assert.equal(loaded.kind,'ready');
    if(loaded.kind!=='ready')throw new Error('Expected restorable A01 battle');
    assert.deepEqual([...data],bytes);
    assert.deepEqual(loaded.envelope.data,profile);
    const restored=loaded.envelope.data.activeMatch!.battle;
    assert.deepEqual(advanceSimulation(restored,7000),advanceSimulation(b,7000));
    assert.deepEqual(restored,b);
  });
}

test('A01 layout: validation accepts only one complete layout and rejects mixed, shifted or invented coordinates',()=>{
  const fresh=createBattle('A01',{id:'strict-layout'});
  const mixed=structuredClone(fresh),old=oldCamp(mixed.camps[0]!.id);
  Object.assign(mixed.camps[0]!,{x:old.x,y:old.y});
  assert.throws(()=>validateBattle(mixed),/营地配置/);
  const shifted=structuredClone(fresh);for(const c of shifted.camps)c.x+=1;
  assert.throws(()=>validateBattle(shifted),/营地配置/);
  const arbitrary=structuredClone(fresh);arbitrary.camps[0]!.x=Number.NaN;
  assert.throws(()=>validateBattle(arbitrary),/营地配置/);
  const other=createBattle('A02',{id:'other-map'});other.camps[0]!.x=newCamp('A01-P1').x;
  assert.throws(()=>validateBattle(other),/营地配置/);
});
