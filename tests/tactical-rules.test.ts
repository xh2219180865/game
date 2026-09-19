import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { advanceSimulation, chooseAiAction, cloneBattle } from '../src/core/ai.ts';
import { connected, MAPS, neighbors } from '../src/core/maps.ts';
import { movementSpeed, naturalRate, productionRate, troopSpeed } from '../src/core/config.ts';
import { asNumber } from '../src/core/fraction.ts';
import { travelTime } from '../src/core/geometry.ts';
import type { Battle, Point } from '../src/core/types.ts';
import { validateBattle } from '../src/app/validation.ts';

const camp=(b:Battle,id:string)=>b.camps.find(c=>c.id===`${b.mapId}-${id}`)!;
const orient=(a:Point,z:Point,p:Point)=>(z.x-a.x)*(p.y-a.y)-(z.y-a.y)*(p.x-a.x);

for(const map of Object.values(MAPS))test(`${map.id}: roads form a connected planar graph, without self edges or city crossings`,()=>{
  const b=createBattle(map.id,{id:'roads'}),seenEdges=new Set<string>();
  for(const [a,z] of map.roads){
    assert.notEqual(a,z);assert.ok(b.camps.some(c=>c.id===a));assert.ok(b.camps.some(c=>c.id===z));
    const key=[a,z].sort().join(':');assert.ok(!seenEdges.has(key));seenEdges.add(key);
    assert.equal(connected(b,a,z),true);assert.equal(connected(b,z,a),true);
    const from=b.camps.find(c=>c.id===a)!,to=b.camps.find(c=>c.id===z)!;
    for(const other of b.camps.filter(c=>c.id!==a&&c.id!==z)){
      const onSegment=orient(from,to,other)===0 && (other.x-from.x)*(other.x-to.x)+(other.y-from.y)*(other.y-to.y)<0;
      assert.equal(onSegment,false,`${a}-${z} passes through ${other.id}`);
    }
    for(const [c,d]of map.roads){
      if([a,z].includes(c)||[a,z].includes(d))continue;
      const p=b.camps.find(x=>x.id===c)!,q=b.camps.find(x=>x.id===d)!;
      assert.equal(orient(from,to,p)*orient(from,to,q)<0 && orient(p,q,from)*orient(p,q,to)<0,false,`${a}-${z} crosses ${c}-${d}`);
    }
  }
  const reached=new Set([b.camps[0]!.id]);
  for(const id of reached)for(const neighbor of neighbors(b,id))reached.add(neighbor);
  assert.equal(reached.size,b.camps.length);
  assert.deepEqual(neighbors(b,'unknown'),[]);assert.equal(connected(b,b.camps[0]!.id,b.camps[0]!.id),false);
});

for(const id of ['A01','A02','A03'] as const)test(`${id}: each home has two exits and the outer route survives loss of the center`,()=>{
  const b=createBattle(id,{id:'bypass'}),center=`${id}-N5`;
  for(const c of b.camps.filter(c=>c.owner!==null))assert.equal(neighbors(b,c.id).length,2);
  assert.equal(neighbors(b,center).length,4);
  const outer=new Set([b.camps[0]!.id]);
  for(const node of outer)for(const neighbor of neighbors(b,node))if(neighbor!==center)outer.add(neighbor);
  assert.equal(outer.size,8);
});

test('new matches reject shortcuts and remote friendly reinforcement without consuming cards or action sequence',()=>{
  for(const friendly of [false,true]){
    const b=createBattle('A01',{id:'no-shortcut',inventory:{mobilize:0,march:1,supply:0,feint:0}});
    if(friendly)camp(b,'N5').owner='P';
    const before=JSON.stringify(b);
    const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N5',march:true});
    assert.equal(result.ok,false);assert.match(result.reason!,/道路/);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(b),before);
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N4',march:true}).ok,true);
  }
});

test('new movement and production preserve the relative cavalry/card roles while allowing time to react',()=>{
  const b=createBattle('A01',{id:'pace'}),s=camp(b,'P1'),owner=factionOf(b,'P')!;
  assert.equal(b.ruleRevision,'1.6');assert.equal(movementSpeed(b,s,owner),24);
  assert.equal(travelTime(s,camp(b,'N4'),movementSpeed(b,s,owner)),2895);
  assert.equal(travelTime(s,camp(b,'N2'),movementSpeed(b,s,owner)),5167);
  assert.equal(asNumber(productionRate(b,s,owner,0)),.9);
  advanceBattle(b,10000);assert.equal(s.garrison,29);
  s.type='relay';assert.ok(Math.abs(movementSpeed(b,s,owner)-33.6)<1e-10);
  assert.ok(movementSpeed(b,s,owner,true)>movementSpeed(b,s,owner));
  owner.passives.logistics=100000;assert.equal(movementSpeed(b,s,owner,true),48);
  for(const [type,rate]of [['barracks',.9],['archery',.6],['relay',.6],['fort',.3]] as const){s.type=type;assert.equal(asNumber(productionRate(b,s,owner,b.gameMs)),rate);}
  s.feintUntil=11000;assert.equal(asNumber(productionRate(b,s,owner,10000)),0);
});

test('v1.5 snapshots retain direct routes, original movement, production and AI clocks',()=>{
  const b=createBattle('A01',{id:'legacy',ruleRevision:'1.5'}),s=camp(b,'P1'),owner=factionOf(b,'P')!;
  assert.equal(connected(b,s.id,'A01-E3'),true);assert.equal(neighbors(b,s.id).length,8);
  assert.equal(movementSpeed(b,s,owner),troopSpeed(s,owner));assert.equal(movementSpeed(b,s,owner),80);
  assert.deepEqual(productionRate(b,s,owner,0),naturalRate(s,owner,0));
  advanceBattle(b,10000);assert.equal(s.garrison,32);
  const fresh=createBattle('A01',{id:'legacy-clock',ruleRevision:'1.5'});
  assert.deepEqual(fresh.factions.filter(f=>f.id!=='P').map(f=>f.nextAiAtMs),[3000,3000,3000]);
  assert.equal(applyBattleAction(fresh,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-E3'}).ok,true);
  advanceSimulation(fresh,3000);assert.deepEqual(fresh.factions.filter(f=>f.id!=='P').map(f=>f.nextAiAtMs),[4500,4500,4500]);
});

test('new AI waits eight seconds and acts at staggered 3.5 second intervals',()=>{
  const b=createBattle('A01',{id:'ai-clock'}),actors=b.factions.filter(f=>f.id!=='P');
  assert.deepEqual(actors.map(f=>f.nextAiAtMs),[8000,8700,9400]);
  advanceSimulation(b,7999);assert.deepEqual(actors.map(f=>f.lastActionSequence),[0,0,0]);
  advanceSimulation(b,8000);assert.deepEqual(actors.map(f=>f.lastActionSequence),[1,0,0]);
  advanceSimulation(b,8700);assert.deepEqual(actors.map(f=>f.lastActionSequence),[1,1,0]);
  advanceSimulation(b,9400);assert.deepEqual(actors.map(f=>f.lastActionSequence),[1,1,1]);
  assert.deepEqual(actors.map(f=>f.nextAiAtMs),[11500,12200,12900]);
});

test('AI sees a five second threat and rescues over a real adjacent road',()=>{
  const b=createBattle('A01',{id:'road-rescue'});
  Object.assign(camp(b,'N3'),{owner:'E1',garrison:1,feintUntil:30000});
  camp(b,'E1').garrison=40;camp(b,'E3').garrison=40;
  factionOf(b,'E1')!.inventory.supply=0;
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E3',sequence:1,sourceId:'A01-E3',targetId:'A01-N3'}).ok,true);
  const arrival=b.armies[0]!.arrivalAtMs;assert.equal(arrival,5167);
  const lost=cloneBattle(b);advanceBattle(lost,arrival);assert.equal(camp(lost,'N3').owner,'E3');
  const before=JSON.stringify(b),action=chooseAiAction(b,'E1');assert.equal(JSON.stringify(b),before);
  assert.deepEqual(action,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-E1',targetId:'A01-N3',march:false});
  assert.equal(applyBattleAction(b,action!).ok,true);advanceBattle(b,arrival);assert.equal(camp(b,'N3').owner,'E1');
});

test('AI moves rear reserves one city closer to a road frontier instead of teleporting',()=>{
  const b=createBattle('A01',{id:'road-transfer'});
  for(const c of b.camps)Object.assign(c,{owner:'E1',tier:3,garrison:1,feintUntil:100000,nextShotAtMs:null});
  Object.assign(camp(b,'E3'),{owner:'P',garrison:140});camp(b,'P1').garrison=70;
  const action=chooseAiAction(b,'E1');
  assert.deepEqual(action,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-P1',targetId:'A01-N4',march:false});
  assert.equal(applyBattleAction(b,action!).ok,true);assert.equal(b.armies[0]!.remainingCount,35);
});

test('AI coordinates two connected sources across a real 3.5 second decision delay, and refuses the unsupported attack',()=>{
  const b=createBattle('L02',{id:'coordinated-attack',firstDragCompleted:true});
  camp(b,'P1').garrison=20;camp(b,'E1').garrison=1;
  for(const id of ['N1','N2','N3'])camp(b,id).owner='E';
  camp(b,'N1').garrison=24;camp(b,'N2').garrison=24;camp(b,'N2').nextShotAtMs=2000;camp(b,'N3').garrison=1;
  for(const c of b.camps)c.feintUntil=30000;
  const unsupported=cloneBattle(b);camp(unsupported,'N2').garrison=1;
  assert.equal(chooseAiAction(unsupported,'E'),null);
  const growing=cloneBattle(b);for(const c of growing.camps)c.feintUntil=0;
  assert.equal(chooseAiAction(growing,'E'),null,'defender growth during the real decision delay defeats this marginal combination');
  const first=chooseAiAction(b,'E');assert.ok(first?.kind==='dispatch');assert.equal(first.targetId,'L02-P1');
  const alone=cloneBattle(b);assert.equal(applyBattleAction(alone,first).ok,true);advanceBattle(alone,alone.armies[0]!.arrivalAtMs);assert.equal(camp(alone,'P1').owner,'P');
  assert.equal(applyBattleAction(b,first).ok,true);advanceBattle(b,3500);
  const second=chooseAiAction(b,'E');assert.ok(second?.kind==='dispatch');assert.notEqual(second.sourceId,first.sourceId);assert.equal(second.targetId,first.targetId);
  assert.equal(applyBattleAction(b,second).ok,true);advanceBattle(b,Math.max(...b.armies.map(a=>a.arrivalAtMs)));
  assert.equal(camp(b,'P1').owner,'E');assert.ok(camp(b,'P1').garrison>=MAPS.L02.aiMargin);
});

test('a supplied full frontier can apply efficient pressure, but an isolated column will not be thrown away',()=>{
  const b=createBattle('L03',{id:'supplied-frontier',firstDragCompleted:true});
  for(const c of b.camps)Object.assign(c,{owner:'P',tier:3,garrison:1,feintUntil:100000,nextShotAtMs:c.type==='fort'?2000:null});
  Object.assign(camp(b,'E2'),{owner:'E',garrison:140});camp(b,'N1').garrison=140;camp(b,'P1').garrison=70;
  const before=cloneBattle(b),action=chooseAiAction(b,'P');assert.ok(action?.kind==='dispatch');assert.equal(action.sourceId,'L03-N1');assert.equal(action.targetId,'L03-E2');
  assert.equal(applyBattleAction(b,action).ok,true);advanceBattle(b,b.armies[0]!.arrivalAtMs);assert.equal(camp(b,'E2').owner,'E');assert.equal(camp(b,'E2').garrison,70);
  camp(before,'P1').garrison=1;assert.equal(chooseAiAction(before,'P'),null);
});

for(const map of Object.values(MAPS))test(`${map.id}: road AI never dispatches off graph and simulation remains independent of time partition`,()=>{
  const b=createBattle(map.id,{id:`partition-${map.id}`,firstDragCompleted:true}),split=cloneBattle(b);
  const wholeEvents=advanceSimulation(b,30000),splitEvents=[];
  for(let t=250;t<=30000;t+=250)splitEvents.push(...advanceSimulation(split,t));
  assert.deepEqual(split,b);assert.deepEqual(splitEvents,wholeEvents);
  for(const event of wholeEvents.filter(e=>e.type==='dispatch'))assert.equal(connected(b,event.sourceId!,event.targetId!),true);
});

test('v1.6 legal roads support 256 mixed armies without runtime caps, invalid snapshots or partition drift',()=>{
  const b=createBattle('A03',{id:'road-pressure'});
  const routes=[['P1','N4'],['N1','E3'],['N2','E2'],['N5','N3']] as const;
  for(let i=0;i<256;i++){
    const [source,target]=routes[i%routes.length]!,s=camp(b,source);
    // Setup replenishes source reserves; dispatch and all following simulation use real rules.
    s.owner='P';s.garrison=50;
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:i+1,sourceId:s.id,targetId:camp(b,target).id}).ok,true);
  }
  assert.equal(b.armies.length,256);assert.equal(new Set(b.armies.map(a=>a.troopType)).size,4);validateBattle(b);
  const split=cloneBattle(b),wholeEvents=advanceSimulation(b,8000),splitEvents=[];
  for(let t=40;t<=8000;t+=40){splitEvents.push(...advanceSimulation(split,t));validateBattle(split);}
  validateBattle(b);assert.deepEqual(split,b);assert.deepEqual(splitEvents,wholeEvents);
  assert.ok(wholeEvents.some(e=>e.type==='volley'));assert.ok(wholeEvents.some(e=>e.type==='tower-shot'));assert.ok(wholeEvents.some(e=>e.type==='capture'));
});
