import test from 'node:test';
import assert from 'node:assert/strict';
import { RetreatPresentation } from '../src/render/retreat.ts';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { armyPosition } from '../src/core/geometry.ts';
import type { Battle, BattleAction, BattleEvent } from '../src/core/types.ts';

function act(b:Battle,action:Omit<Extract<BattleAction,{kind:'dispatch'}>,'sequence'>|Omit<Extract<BattleAction,{kind:'card'}>,'sequence'>){
  const result=applyBattleAction(b,{...action,sequence:factionOf(b,action.faction)!.lastActionSequence+1});assert.equal(result.ok,true);return result.events;
}
// Historical arbitrary-crossing snapshots keep the legacy rules while exercising retreat lifecycle.
function setup(sameArrival=false,shot=false,departingCount=1){
  const b=createBattle('A01',{id:'retreat',ruleRevision:'1.5'});for(const f of b.factions)f.nextAiAtMs=10000;
  const p=b.camps.find(c=>c.id==='A01-P1')!,e=b.camps.find(c=>c.id==='A01-E1')!;p.garrison=40;e.garrison=sameArrival?4:departingCount*2;
  if(shot){const tower=b.camps.find(c=>c.id==='A01-N4')!;tower.type='fort';tower.owner='P';tower.garrison=10;tower.nextShotAtMs=100;}
  if(sameArrival)act(b,{kind:'dispatch',faction:'E1',sourceId:e.id,targetId:p.id});
  act(b,{kind:'dispatch',faction:'E1',sourceId:e.id,targetId:'A01-E2'});
  const departing=structuredClone(b.armies.at(-1)!);
  act(b,{kind:'dispatch',faction:'P',sourceId:p.id,targetId:e.id});
  return {b,departing,at:b.armies.at(-1)!.arrivalAtMs};
}
function eliminate(b:Battle,at:number){const events=advanceBattle(b,at);assert.ok(events.some(e=>e.type==='eliminated'&&e.faction==='E1'));assert.equal(b.status,'running');assert.equal(b.factions.filter(f=>!f.eliminated).length,3);return events;}

test('F07: actual capture removes logical armies immediately and fades only displayed retreat heads for 160 game ms',()=>{
  const {b,departing,at}=setup(),view=new RetreatPresentation();view.observe(b,true);const events=eliminate(b,at),before=structuredClone({b,events});
  view.consume(b,events,true);assert.ok(!b.armies.some(a=>a.faction==='E1'));
  const first=view.frames(at);assert.equal(first.length,1);assert.deepEqual(first[0]!.position,armyPosition(departing,at));assert.equal(first[0]!.id,departing.id);assert.equal(first[0]!.faction,'E1');assert.equal(first[0]!.troopType,'infantry');assert.ok(first[0]!.alpha>0&&first[0]!.alpha<=.5);
  assert.deepEqual(Object.keys(first[0]!).sort(),['alpha','faction','id','position','troopType']);
  for(const elapsed of [80,159]){const frame=view.frames(at+elapsed)[0]!;assert.deepEqual(frame.position,first[0]!.position);assert.ok(Math.abs(frame.alpha-first[0]!.alpha*(1-elapsed/160))<1e-10);}
  assert.deepEqual(view.frames(at+160),[]);assert.deepEqual(view.frames(at+10000),[]);assert.deepEqual({b,events},before);
});

test('F07: snapshots and returned positions are independent, paused frames freeze, duplicate events and restored resets do not replay',()=>{
  const {b,departing,at}=setup(),view=new RetreatPresentation();view.observe(b,true);
  const cached=b.armies.find(a=>a.id===departing.id)!;cached.from.x+=100;cached.to.y+=50;
  const events=eliminate(b,at);view.consume(b,events,true);const first=view.frames(at)[0]!;assert.deepEqual(first.position,armyPosition(departing,at));
  first.position.x=-999;assert.deepEqual(view.frames(at)[0]!.position,armyPosition(departing,at));
  b.status='paused';b.gameMs=at+80;const paused=view.frames(b.gameMs);view.observe(b,true);view.consume(b,events,true);assert.deepEqual(view.frames(b.gameMs),paused);assert.deepEqual(view.frames(b.gameMs),paused);
  view.reset();view.observe(b,true);view.consume(b,events,true);assert.deepEqual(view.frames(b.gameMs),[]);
  const fresh=setup();view.reset();view.observe(fresh.b,true);view.consume(fresh.b,eliminate(fresh.b,fresh.at),true);assert.equal(view.frames(fresh.at).length,1,'reset permits reused sequence IDs in a newly observed match');
});

test('F07: same-tick arrivals and actual prior tower kills never become retreat ghosts',()=>{
  const same=setup(true),view=new RetreatPresentation();view.observe(same.b,true);const events=eliminate(same.b,same.at);assert.ok(events.some(e=>e.type==='arrival'&&e.faction==='E1'));view.consume(same.b,events,true);assert.deepEqual(view.frames(same.at).map(f=>f.id),[same.departing.id]);
  for(const separate of [false,true]){
    const shot=setup(false,true),retreat=new RetreatPresentation();retreat.observe(shot.b,true);const killed=advanceBattle(shot.b,100);assert.ok(killed.some(e=>e.type==='army-loss'&&e.targetId===shot.departing.id&&e.amount===1));
    if(separate){retreat.consume(shot.b,killed,true);assert.deepEqual(retreat.frames(100),[]);}
    const ending=eliminate(shot.b,shot.at),batch=separate?ending:[...killed,...ending];retreat.consume(shot.b,batch,true);assert.deepEqual(retreat.frames(shot.at),[]);
  }
});

test('F07: nonlethal tower losses and duplicate damage batches preserve the surviving displayed head',()=>{
  const {b,departing,at}=setup(false,true,4),view=new RetreatPresentation(),secondTower=b.camps.find(c=>c.id==='A01-N5')!;secondTower.owner='P';secondTower.nextShotAtMs=2000;view.observe(b,true);
  const first=advanceBattle(b,100);assert.equal(b.armies.find(a=>a.id===departing.id)!.remainingCount,3);view.consume(b,first,true);view.consume(b,first,true);assert.deepEqual(view.frames(100),[]);
  const second=eliminate(b,at);assert.ok(second.some(e=>e.type==='army-loss'&&e.targetId===departing.id&&e.amount===1));view.consume(b,[...first,...second],true);assert.deepEqual(view.frames(at).map(f=>f.id),[departing.id]);
});

test('F07: disabled presentation, 41 or 256 armies and terminal battles clear both observation and residual frames',()=>{
  for(const count of [41,256]){const {b,departing,at}=setup(),view=new RetreatPresentation();b.armies=Array.from({length:count},(_,i)=>({...structuredClone(departing),id:`pressure-${i}`}));view.observe(b,true);b.armies=[];factionOf(b,'E1')!.eliminated=true;b.gameMs=at;view.consume(b,[{id:99,atMs:at,type:'eliminated',faction:'E1'}],true);assert.deepEqual(view.frames(at),[]);}
  for(const method of ['observe','consume'] as const)for(const reason of ['disabled','crowded','finished'] as const){
    const {b,departing,at}=setup(),view=new RetreatPresentation();view.observe(b,true);view.consume(b,eliminate(b,at),true);assert.equal(view.frames(at).length,1);
    if(reason==='crowded')b.armies=Array.from({length:41},(_,i)=>({...structuredClone(departing),id:`crowded-${i}`}));if(reason==='finished')b.status='finished';
    if(method==='observe')view.observe(b,reason!=='disabled');else view.consume(b,[],reason!=='disabled');assert.deepEqual(view.frames(at),[]);
  }
});

test('F07: unobserved dispatches and unconfirmed eliminated events cannot fabricate retreat heads',()=>{
  const {b,at}=setup(),view=new RetreatPresentation();view.observe({...b,armies:[]},true);view.consume(b,eliminate(b,at),true);assert.deepEqual(view.frames(at),[]);
  const other=setup(),second=new RetreatPresentation();second.observe(other.b,true);second.consume(other.b,[{id:99,atMs:0,type:'eliminated',faction:'E1'}],true);assert.deepEqual(second.frames(0),[]);
});

test('F07: successive actual eliminations retain at most forty ghosts and replay batches cannot restart expired frames',()=>{
  const b=createBattle('A01',{id:'successive',ruleRevision:'1.5'});for(const f of b.factions)f.nextAiAtMs=10000;
  const p=b.camps.find(c=>c.id==='A01-P1')!,e2=b.camps.find(c=>c.id==='A01-E2')!;p.tier=3;p.garrison=140;factionOf(b,'E1')!.inventory.supply=30;
  for(let i=0;i<20;i++){e2.garrison=2;act(b,{kind:'dispatch',faction:'E2',sourceId:e2.id,targetId:'A01-E1'});}
  act(b,{kind:'dispatch',faction:'P',sourceId:p.id,targetId:e2.id});advanceBattle(b,1475);act(b,{kind:'dispatch',faction:'P',sourceId:p.id,targetId:'A01-E1'});
  const view=new RetreatPresentation();view.observe(b,true);const first=advanceBattle(b,3550);assert.ok(first.some(e=>e.type==='eliminated'&&e.faction==='E2'));view.consume(b,first,true);assert.equal(view.frames(3550).length,20);
  const commands:BattleEvent[]=[];for(let i=0;i<25;i++){commands.push(...act(b,{kind:'card',cardId:'supply',faction:'E1',targetId:'A01-E1'}));commands.push(...act(b,{kind:'dispatch',faction:'E1',sourceId:'A01-E1',targetId:'A01-E2'}));}
  view.consume(b,commands,true);view.observe(b,true);const second=advanceBattle(b,3650);assert.ok(second.some(e=>e.type==='eliminated'&&e.faction==='E1'));assert.equal(b.status,'running');const immutable=structuredClone({b,first,commands,second});view.consume(b,second,true);
  const frames=view.frames(3650);assert.equal(frames.length,40);assert.equal(new Set(frames.map(f=>f.id)).size,40);assert.equal(frames.filter(f=>f.faction==='E1').length,25);
  view.frames(3810);for(let i=0;i<300;i++)view.consume(b,[...first,...commands,...second],true);assert.deepEqual(view.frames(3810),[]);assert.deepEqual({b,first,commands,second},immutable);
});
