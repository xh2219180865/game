import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, battleStats, createBattle, factionOf } from '../src/core/battle.ts';
import { fraction } from '../src/core/fraction.ts';
import { campCapacity } from '../src/core/config.ts';
import { armyPosition } from '../src/core/geometry.ts';
import type { Army, Battle, Camp, FactionId } from '../src/core/types.ts';

// The explicit legacy crossing fixture preserves its exact 80-unit/s trajectory.
function fixture(ruleRevision:Battle['ruleRevision']='1.6'){const b=createBattle('A01',{id:'acceptance',ruleRevision});for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}return b;}
const camp=(b:Battle,id:string)=>b.camps.find(c=>c.id===`A01-${id}`)!;
function send(b:Battle,source:Camp,target:Camp,sequence=1){assert.equal(applyBattleAction(b,{kind:'dispatch',faction:source.owner!,sequence,sourceId:source.id,targetId:target.id}).ok,true);return b.armies.at(-1)!;}
function arriving(b:Battle,target:Camp,faction:FactionId,count:number,at=1000):Army{
  const source=b.camps.find(c=>c.owner===faction)!;
  const army:Army={id:`fixture-${b.nextEntityId++}`,sourceId:source.id,targetId:target.id,faction,initialCount:count,remainingCount:count,troopType:'infantry',from:source,to:target,departedAtMs:0,arrivalAtMs:at,speed:80,volleyCheckAtMs:null,volleyState:null,volleySkipReason:null};
  b.armies.push(army);return army;
}
test('R01 R02: consecutive half dispatches and the 0/1/2 soldier boundary',()=>{
  const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');s.garrison=21;
  assert.equal(send(b,s,t).initialCount,10);assert.equal(s.garrison,11);assert.equal(send(b,s,t,2).initialCount,5);assert.equal(s.garrison,6);
  for(const n of [0,1,2]){const f=fixture(),c=camp(f,'P1');c.garrison=n;const result=applyBattleAction(f,{kind:'dispatch',faction:'P',sequence:1,sourceId:c.id,targetId:'A01-N4'});
    assert.equal(result.ok,n===2);assert.equal(c.garrison,n===2?1:n);assert.equal(f.armies.length,n===2?1:0);
  }
});
test('R07 R09 R25: empty owned camps survive and produce while neutral camps stay empty',()=>{
  const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');s.garrison=0;s.feintUntil=0;t.garrison=0;t.feintUntil=0;
  advanceBattle(b,1112);assert.equal(s.garrison,1);assert.equal(t.garrison,0);assert.equal(factionOf(b,'P')!.eliminated,false);
  const r=fixture(),horse=camp(r,'P1');horse.type='relay';horse.garrison=0;horse.feintUntil=0;
  advanceBattle(r,5000);assert.equal(horse.garrison,3);assert.deepEqual(horse.credit,fraction(0));
});
test('R11 N03: arrival compares original troops before any occupation or conversion',()=>{
  for(const [defenders,owner,left]of [[6,'P',4],[10,'E1',0],[12,'E1',2]] as const){const b=fixture(),t=camp(b,'E1');t.type='relay';t.garrison=defenders;
    arriving(b,t,'P',10);advanceBattle(b,1000);assert.equal(t.owner,owner);assert.equal(t.garrison,left);
    if(owner==='P')assert.equal(send(b,t,camp(b,'N4')).troopType,'cavalry');
  }
});
test('R14 R16 R17: simultaneous arrivals combine each faction and do not ally computer factions',()=>{
  for(const [forces,owner,left]of [
    [[['P',12],['E1',5]],'P',3],
    [[['P',10],['E1',7],['E2',4]],null,4],
    [[['P',7],['P',5],['E1',3],['E1',2]],'P',3],
  ] as const){const b=fixture(),t=camp(b,'N4');t.garrison=4;for(const [f,n]of forces)arriving(b,t,f,n);
    const reversed=structuredClone(b);reversed.armies.reverse();advanceBattle(b,1000);advanceBattle(reversed,1000);
    assert.equal(t.owner,owner);assert.equal(t.garrison,left);assert.deepEqual(reversed.camps,b.camps);
  }
});
test('R15 R18: all six arrival orderings keep neutral equality and the same final competition ranks',()=>{
  const b=fixture(),t=camp(b,'N4');t.garrison=4;for(const [id,count]of [['P1',20],['E1',17],['E2',9],['E3',5]] as const)camp(b,id).garrison=count;
  arriving(b,t,'P',12,5000);arriving(b,t,'E1',5,5000);arriving(b,t,'E2',3,5000);let expected:string|undefined;
  for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
    const current=structuredClone(b);current.armies=order.map(i=>current.armies[i]!);advanceBattle(current,240000);const target=camp(current,'N4');assert.equal(target.owner,null);assert.equal(target.garrison,0);assert.deepEqual(current.result!.ranks,{P:1,E1:2,E2:3,E3:4});
    const snapshot=JSON.stringify(current);if(expected)assert.equal(snapshot,expected);else expected=snapshot;
  }
});
test('R19: edge-to-edge route of 200 uses 8334 ms infantry and 5953 ms cavalry',()=>{
  for(const [type,speed,eta]of [['barracks',24,8334],['relay',33.6,5953]] as const){const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');s.type=type;t.x=s.x+236;t.y=s.y;
    const army=send(b,s,t);assert.ok(Math.abs(army.speed-speed)<1e-10);assert.equal(army.arrivalAtMs,eta);
  }
});
test('R21 N05: source upgrade and capture do not rewrite an existing cavalry journey',()=>{
  const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');s.type='relay';camp(b,'N2').owner='P';const army=send(b,s,t),before=structuredClone(army);
  s.garrison=30;assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:2,targetId:s.id}).ok,true);
  arriving(b,s,'E1',40,500);advanceBattle(b,500);assert.equal(s.owner,'E1');assert.equal(s.tier,2);
  assert.equal(factionOf(b,'P')!.eliminated,false);assert.deepEqual(b.armies.find(a=>a.id===army.id),before);
});
test('R22: arrival rechecks a destination that changed sides during travel',()=>{
  for(const friendly of [true,false]){const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');t.owner=friendly?'E1':'P';t.garrison=4;
    const a=send(b,s,t);t.owner=friendly?'P':'E1';advanceBattle(b,a.arrivalAtMs);
    assert.equal(t.owner,'P');assert.equal(t.garrison,friendly?14:6);
  }
});
test('R23 N04 N06: passing a camp and crossing an army cause no conversion or melee',()=>{
  const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4'),passing=camp(b,'N2');s.type='fort';t.type='archery';const a=send(b,s,t),mid=armyPosition(a,500);
  passing.x=mid.x;passing.y=mid.y;passing.type='relay';passing.owner='E1';passing.garrison=20;
  const other=arriving(b,s,'E1',10,2000);other.from={x:mid.x-50,y:mid.y};other.to={x:mid.x+150,y:mid.y};
  advanceBattle(b,500);assert.equal(a.troopType,'guard');assert.equal(a.remainingCount,10);assert.equal(other.remainingCount,10);assert.equal(passing.garrison,20);
  assert.equal(a.volleyState,null);assert.equal(a.volleyCheckAtMs,null);
  advanceBattle(b,a.arrivalAtMs);assert.equal(t.owner,'P');assert.equal(send(b,t,s,2).troopType,'archer');
});
test('R23: crossing armies retain their troops while a passing tower uses the exact range and relay conversion waits for capture',()=>{
  for(const y of [120,120.001]){
    const b=fixture('1.5');for(const [i,c]of b.camps.entries()){c.x=2000+i*300;c.y=2000;}
    const source=camp(b,'P1'),target=camp(b,'N4'),passing=camp(b,'N2'),tower=camp(b,'E1'),enemy=camp(b,'E2'),friendly=camp(b,'N3');
    source.x=0;source.y=0;target.x=436;target.y=0;target.type='relay';target.garrison=2;
    passing.x=98;passing.y=0;passing.type='relay';passing.garrison=20;tower.x=98;tower.y=y;tower.type='fort';tower.feintUntil=0;tower.nextShotAtMs=1000;
    enemy.x=98;enemy.y=-98;friendly.x=98;friendly.y=338;friendly.owner='E2';const a=send(b,source,target),other=send(b,enemy,friendly);
    assert.equal(a.arrivalAtMs,5000);assert.deepEqual(armyPosition(a,1000),{x:98,y:0});assert.deepEqual(armyPosition(other,1000),{x:98,y:0});
    const events=advanceBattle(b,1000),shots=events.filter(e=>e.type==='tower-shot');assert.equal(shots.length,y===120?1:0);if(shots.length)assert.equal(shots[0]!.targetId,a.id);
    assert.equal(a.remainingCount,y===120?9:10);assert.equal(other.remainingCount,10);assert.equal(a.troopType,'infantry');assert.equal(a.speed,80);assert.equal(a.targetId,target.id);assert.equal(passing.garrison,20);assert.equal(passing.owner,null);assert.equal(target.owner,null);
    advanceBattle(b,a.arrivalAtMs);assert.equal(target.owner,'P');assert.equal(target.garrison,y===120?7:8);assert.equal(passing.garrison,20);assert.equal(send(b,target,source,2).troopType,'cavalry');
  }
});
test('R24 N02 N12: occupation preserves tier and clears old effects without filling new capacity',()=>{
  const b=fixture(),t=camp(b,'N4');t.owner='E1';t.type='relay';t.tier=3;t.garrison=2;t.credit=fraction(1,2);t.mobilizeUntil=6000;t.bonusBudget=fraction(8);
  factionOf(b,'P')!.passives.fortification=3;arriving(b,t,'P',10);advanceBattle(b,1000);
  assert.equal(t.owner,'P');assert.equal(t.type,'relay');assert.equal(t.tier,3);assert.equal(t.garrison,8);assert.equal(t.feintUntil,0);assert.equal(t.mobilizeUntil,0);
  assert.equal(campCapacity(t,factionOf(b,'P')!),152);
  assert.deepEqual(t.bonusBudget,fraction(0));assert.deepEqual(t.credit,fraction(0));assert.equal(send(b,t,camp(b,'P1')).troopType,'cavalry');
});
test('N01 N07 R12: cavalry reinforcements become archers, with only real capacity overflow',()=>{
  for(const fortified of [false,true]){const b=fixture(),t=camp(b,'P1');t.type='archery';t.garrison=fortified?50:20;
    if(fortified)factionOf(b,'P')!.passives.fortification=3;const a=arriving(b,t,'P',10);a.troopType='cavalry';
    const events=advanceBattle(b,1000);assert.equal(t.garrison,fortified?54:30);assert.equal(t.owner,'P');
    assert.equal(events.find(e=>e.type==='overflow')?.amount,fortified?6:undefined);assert.equal(send(b,t,camp(b,'N4')).troopType,'archer');
  }
});
test('R28 R32: one or two eliminated computers cannot prematurely award a player win',()=>{
  for(const ids of [['E1'],['E1','E2']] as const){const b=fixture();for(const id of ids){const t=camp(b,id);t.garrison=0;arriving(b,t,'P',1);}
    advanceBattle(b,1000);for(const id of ids)assert.equal(factionOf(b,id)!.rank,ids.length===1?4:3);assert.equal(b.status,'running');assert.equal(b.result,null);
  }
});
test('R30: moving troops between friendly camps keeps total troops unchanged',()=>{
  const b=fixture(),s=camp(b,'P1'),t=camp(b,'N4');t.owner='P';t.garrison=20;const troops=()=>battleStats(b).find(f=>f.faction==='P')!.troops;
  assert.equal(troops(),40);const a=send(b,s,t);assert.equal(troops(),40);advanceBattle(b,a.arrivalAtMs);assert.equal(troops(),40);
});
test('R31: deadline competition ranking uses camps before soldiers and retains tied first',()=>{
  const b=fixture();for(const c of b.camps){c.owner=null;c.garrison=0;}
  for(const [id,owner,n]of [['P1','P',15],['N4','P',15],['E1','E1',15],['N2','E1',15],['E2','E2',100]] as const){const c=camp(b,id);c.owner=owner;c.garrison=n;c.tier=3;}
  factionOf(b,'E3')!.eliminated=true;factionOf(b,'E3')!.rank=4;advanceBattle(b,240000);
  assert.equal(b.result!.ranks.P,1);assert.equal(b.result!.ranks.E1,1);assert.equal(b.result!.ranks.E2,3);assert.equal(b.result!.independentWinner,null);
});
test('R33: first player elimination settles fourth with remaining computer ranks unresolved',()=>{
  const b=fixture(),s=camp(b,'P1');const a=send(b,s,camp(b,'N4'));s.garrison=0;arriving(b,s,'E1',1,500);
  advanceBattle(b,500);assert.equal(b.result!.playerRank,4);assert.equal(b.armies.some(x=>x.id===a.id),false);
  for(const id of ['E1','E2','E3'] as const){assert.equal(id in b.result!.ranks,false);assert.equal(b.result!.stats.find(s=>s.faction===id)!.rank,null);}
});
