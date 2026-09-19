import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { chooseAiAction } from '../src/core/ai.ts';
import { CAMP_CONFIG, naturalRate, productionRate, movementSpeed } from '../src/core/config.ts';
import { asNumber, fraction } from '../src/core/fraction.ts';
import { armyPosition, distance } from '../src/core/geometry.ts';
import type { Army, Battle, Camp, FactionId } from '../src/core/types.ts';

// Legacy fixtures retain hand-positioned 80-unit/s timing and unrestricted-route regressions.
function frozen(ruleRevision:Battle['ruleRevision']='1.6'):Battle {const b=createBattle('L03',{id:'boundary',firstDragCompleted:true,ruleRevision});for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}return b;}
const get=(b:Battle,suffix:string):Camp=>b.camps.find(c=>c.id.endsWith(suffix))!;
function shoot(b:Battle,n=10):Army {const s=get(b,'P2');s.garrison=n*2;assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:s.id,targetId:get(b,b.ruleRevision==='1.5'?'N1':'N2').id}).ok,true);return b.armies.at(-1)!;}
function addArmy(b:Battle,target:Camp,owner:FactionId,count:number,at:number):Army{
  const s=b.camps.find(c=>c.owner===owner)!;const a:Army={id:`extra-${b.nextEntityId++}`,sourceId:s.id,targetId:target.id,faction:owner,troopType:'infantry',initialCount:count,remainingCount:count,from:{x:s.x,y:s.y},to:{x:target.x,y:target.y},departedAtMs:0,arrivalAtMs:at,speed:80,volleyCheckAtMs:null,volleyState:null,volleySkipReason:null};b.armies.push(a);return a;
}
test('N41: archer production varies by tier but speed and volley parameters do not',()=>{
  const b=frozen(),s=get(b,'P2'),f=factionOf(b,'P')!;s.feintUntil=0;
  for(const [tier,rate]of [[1,.6],[2,.78],[3,.96]] as const){s.tier=tier;assert.equal(asNumber(productionRate(b,s,f,0)),rate);assert.equal(movementSpeed(b,s,f),24);}
  assert.equal(CAMP_CONFIG.archery.speed,1);
});
test('N42 N43 N44: exact long-route and short-route preparation boundaries',()=>{
  for(const [d,check,arrival]of [[236,1850,2500],[64,500,1000]]){
    const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'N1');t.x=s.x+d!;t.y=s.y;t.garrison=20;const a=shoot(b);
    assert.equal(a.volleyCheckAtMs,check);assert.equal(a.arrivalAtMs,arrival);const departed=armyPosition(a,0);advanceBattle(b,check!-1);assert.equal(a.volleyState,'pending');assert.equal(t.garrison,20);assert.ok(distance(departed,armyPosition(a,b.gameMs))>0);
    if(d===236)assert.ok(distance(armyPosition(a,check!-1),t)>70);
    advanceBattle(b,check!);assert.equal(a.volleyState,'fired');assert.ok(distance(armyPosition(a,check!),t)<=70);assert.equal(t.garrison,17);
  }
});
for(const [n,damage]of [[1,0],[2,0],[3,0],[4,1],[9,2],[10,3]])test(`N47: ${n} archers yield ${damage} damage with no minimum`,()=>{
  const b=frozen(),t=get(b,'N2');t.garrison=20;const a=shoot(b,n);advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.garrison,20-damage!);assert.equal(a.volleyState,damage?'fired':'skipped');
});
test('N47: splitting 10 archers into 5+5 produces two independently rounded shots',()=>{
  const b=frozen(),t=get(b,'N2');t.garrison=20;const a=shoot(b,5),z={...a,id:'second-five'};b.armies.push(z);advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.garrison,18);
});
test('N50: a friendly destination that becomes hostile before the check can be shot',()=>{
  for(const owner of ['E',null] as const){const b=frozen(),t=get(b,'N2');t.owner='P';t.garrison=12;const a=shoot(b);t.owner=owner;advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.garrison,9);assert.equal(a.volleyState,'fired');}
});
test('N52: passing an enemy camp and nearby army never redirects the neutral-destination volley',()=>{
  const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'N1'),other=get(b,'N2');
  t.x=s.x+236;t.y=s.y;t.garrison=12;other.owner='E';other.garrison=22;other.x=s.x+140;other.y=s.y;other.type='barracks';
  const a=shoot(b),enemyTarget=get(b,'P1');enemyTarget.x=other.x+236;enemyTarget.y=other.y;
  advanceBattle(b,1600);assert.ok(armyPosition(a,b.gameMs).x>other.x);assert.equal(other.garrison,22);
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'E',sourceId:other.id,targetId:enemyTarget.id}).ok,true);const enemy=b.armies.at(-1)!;
  assert.ok(distance(armyPosition(a,a.volleyCheckAtMs!),armyPosition(enemy,a.volleyCheckAtMs!))<70);
  const events=advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.owner,null);assert.equal(t.garrison,9);
  assert.equal(other.garrison,11);assert.equal(enemy.remainingCount,11);
  assert.deepEqual(events.filter(e=>e.type==='volley').map(e=>[e.sourceId,e.targetId]),[[a.id,t.id]]);
  const later=advanceBattle(b,a.arrivalAtMs);assert.ok(!later.some(e=>e.type==='volley'));assert.equal(t.owner,'P');assert.equal(t.garrison,1);assert.equal(other.garrison,11);assert.equal(enemy.remainingCount,11);
});
test('N53: unsuppressed stationary archers neither fire at intruders nor reflect a volley; contact remains one for one',()=>{
  const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'E2');t.x=s.x+64;t.y=s.y;t.garrison=12;t.feintUntil=0;s.garrison=20;
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:s.id,targetId:t.id}).ok,true);const a=b.armies[0]!;
  assert.ok(distance(armyPosition(a,0),t)<70);assert.ok(asNumber(naturalRate(t,factionOf(b,'E'),0))>0);
  const before=advanceBattle(b,499);assert.ok(!before.some(e=>e.type==='tower-shot'||e.type==='volley'));assert.equal(a.remainingCount,10);assert.equal(t.garrison,12);
  const fired=advanceBattle(b,500);assert.deepEqual(fired.filter(e=>e.type==='volley').map(e=>e.sourceId),[a.id]);assert.ok(!fired.some(e=>e.type==='tower-shot'));assert.equal(a.remainingCount,10);assert.equal(t.garrison,9);
  const arrival=advanceBattle(b,1000);assert.ok(!arrival.some(e=>e.type==='tower-shot'||e.type==='volley'));assert.equal(t.owner,'P');assert.equal(t.garrison,1);
});
test('N53: guards dispatched from a tower have no volley state or ranged damage',()=>{
  const b=frozen('1.5'),s=get(b,'P1'),t=get(b,'E2');s.type='fort';s.garrison=20;t.x=s.x+64;t.y=s.y;t.garrison=14;t.feintUntil=0;
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:s.id,targetId:t.id}).ok,true);const a=b.armies[0]!;
  assert.equal(a.troopType,'guard');assert.equal(a.volleyState,null);assert.equal(a.volleyCheckAtMs,null);assert.equal(a.volleySkipReason,null);
  const before=advanceBattle(b,a.arrivalAtMs-1);assert.equal(a.remainingCount,10);assert.equal(t.garrison,14);assert.ok(!before.some(e=>e.type==='tower-shot'||e.type==='volley'||e.type==='volley-skipped'));
  const arrival=advanceBattle(b,a.arrivalAtMs);assert.equal(t.owner,'E');assert.equal(t.garrison,4);assert.ok(!arrival.some(e=>e.type==='tower-shot'||e.type==='volley'||e.type==='volley-skipped'));
});
test('N46: clipped loss preserves the empty camp owner, tier and production until physical capture',()=>{
  for(const tier of [1,2,3] as const){const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'N1');t.type='archery';t.owner='E';t.tier=tier;t.garrison=2;t.x=s.x+64;t.y=s.y;t.feintUntil=500;
    const a=shoot(b),events=advanceBattle(b,500);assert.equal(t.garrison,0);assert.equal(t.owner,'E');assert.equal(t.tier,tier);assert.equal(factionOf(b,'E')!.eliminated,false);
    assert.deepEqual(events.filter(e=>e.type==='garrison-loss').map(e=>e.amount),[2]);assert.ok(!events.some(e=>e.type==='capture'));assert.ok(asNumber(naturalRate(t,factionOf(b,'E'),500))>0);
    // A separate no-arrival branch proves that clearing the camp did not stop its own production.
    const producing=structuredClone(b);producing.armies=[];advanceBattle(producing,500+Math.ceil(1000/asNumber(naturalRate(t,factionOf(b,'E'),500))));
    const emptyOwner=get(producing,'N1');assert.equal(emptyOwner.owner,'E');assert.equal(emptyOwner.tier,tier);assert.equal(emptyOwner.garrison,1);
    advanceBattle(b,a.arrivalAtMs);assert.equal(t.owner,'P');assert.equal(t.tier,tier);assert.equal(t.garrison,10);
  }
});
test('N54: simultaneous volley reports the real clipped loss once',()=>{
  const b=frozen(),t=get(b,'N2'),other=get(b,'N1');t.garrison=4;other.owner='E';other.garrison=11;other.x=t.x+1;other.y=t.y;const a=shoot(b);b.armies.push({...a,id:'other-archers'});
  const ev=advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.garrison,0);assert.equal(ev.filter(e=>e.type==='volley').length,2);
  assert.deepEqual(ev.filter(e=>e.type==='garrison-loss').map(e=>e.amount),[4]);assert.equal(other.garrison,11);assert.ok(b.armies.every(a=>a.volleyState==='fired'));assert.deepEqual(ev.filter(e=>e.type==='volley').map(e=>e.amount),[3,3]);
});
test('N55: opposite volleys both clear garrisons without eliminating either faction',()=>{
  const b=frozen('1.5'),p=get(b,'P2'),e=get(b,'E2');p.garrison=20;e.garrison=20;
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:p.id,targetId:e.id}).ok,true);
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'E',sourceId:e.id,targetId:p.id}).ok,true);
  p.garrison=2;e.garrison=2;assert.equal(b.armies[0]!.volleyCheckAtMs,b.armies[1]!.volleyCheckAtMs);
  const reversed=structuredClone(b);reversed.armies.reverse();reversed.camps.reverse();
  advanceBattle(b,b.armies[0]!.volleyCheckAtMs!);advanceBattle(reversed,reversed.armies[0]!.volleyCheckAtMs!);assert.equal(p.garrison,0);assert.equal(e.garrison,0);assert.equal(b.status,'running');assert.ok(b.armies.every(a=>a.volleyState==='fired'));
  assert.deepEqual(reversed.camps.map(c=>[c.id,c.owner,c.garrison]).sort(),b.camps.map(c=>[c.id,c.owner,c.garrison]).sort());assert.ok(reversed.armies.every(a=>a.volleyState==='fired'));assert.equal(reversed.status,'running');
});
test('N57: same-time arrival changes ownership before archers decide to skip',()=>{
  for(const owner of ['P','E'] as const){const b=frozen(),t=get(b,'N2');t.garrison=6;const a=shoot(b);addArmy(b,t,owner,10,a.volleyCheckAtMs!);
    advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.owner,owner);assert.equal(t.garrison,owner==='P'?4:1);assert.equal(a.volleySkipReason,owner==='P'?'friendly':null);assert.equal(a.volleyState,owner==='P'?'skipped':'fired');}
});
for(const last of [false,true])test(`N58: source capture ${last?'eliminates a last-camp army':'preserves a surviving-faction army'}`,()=>{
  const b=frozen(),source=get(b,'P2'),target=get(b,'N2');target.garrison=12;if(last)get(b,'P1').owner='E';const a=shoot(b);
  const before={troop:a.troopType,speed:a.speed,arrival:a.arrivalAtMs,check:a.volleyCheckAtMs};addArmy(b,source,'E',50,a.volleyCheckAtMs!);const ev=advanceBattle(b,a.volleyCheckAtMs!);
  assert.equal(ev.some(e=>e.type==='volley'),!last);assert.equal(target.garrison,last?12:9);
  if(!last)assert.deepEqual({troop:a.troopType,speed:a.speed,arrival:a.arrivalAtMs,check:a.volleyCheckAtMs},before);
});
test('N59: clearing a tower after its shot does not undo that shot or reset its clock',()=>{
  const b=frozen(),s=get(b,'P2'),t=get(b,'N2');t.owner='E';t.type='fort';t.garrison=1;t.feintUntil=0;t.x=s.x+64;t.y=s.y;const a=shoot(b);t.nextShotAtMs=500;
  advanceBattle(b,500);assert.equal(a.remainingCount,9);assert.equal(t.garrison,0);assert.equal(t.owner,'E');assert.equal(t.nextShotAtMs,2200);
});
test('N62: volley damage invalidates an upgrade threshold before new commands',()=>{
  const b=frozen(),t=get(b,'N2');t.owner='E';t.tier=1;t.garrison=30;const a=shoot(b);advanceBattle(b,a.volleyCheckAtMs!);
  assert.equal(t.garrison,27);assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'E',sequence:1,targetId:t.id}).ok,false);
  factionOf(b,'E')!.inventory.supply=1;assert.equal(applyBattleAction(b,{kind:'card',cardId:'supply',faction:'E',sequence:2,targetId:t.id}).ok,true);assert.equal(t.garrison,33);
});
test('N64: AI predicts a single volley once and requires the actual arrival margin',()=>{
  for(const defenders of [11,12]){
    const b=frozen(),s=get(b,'P2'),t=get(b,'N2');get(b,'P1').garrison=0;s.garrison=20;t.garrison=defenders;
    for(const c of b.camps)if(c!==s&&c!==t&&c.owner!=='P')c.garrison=140;
    const action=chooseAiAction(b,'P');if(defenders===11){assert.equal(action?.kind,'dispatch');assert.equal(action!.targetId,t.id);}else assert.equal(action,null);
    const army=shoot(b);advanceBattle(b,army.arrivalAtMs);assert.equal(t.owner,'P');assert.equal(t.garrison,defenders===11?2:1);
  }
});
test('N66: deadline volley contributes to troop ranking before commands are rejected',()=>{
  const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'E2');b.gameMs=239500;b.deadlineMs=240000;s.garrison=20;t.garrison=22;get(b,'P1').garrison=0;get(b,'E1').garrison=0;t.x=s.x+64;t.y=s.y;
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:s.id,targetId:t.id}).ok,true);
  advanceBattle(b,240000);assert.equal(t.garrison,19);assert.equal(b.result!.independentWinner,'P');assert.equal(b.result!.playerRank,1);
  assert.equal(applyBattleAction(b,{kind:'upgrade',sequence:2,faction:'P',targetId:s.id}).ok,false);
  const snapshot=JSON.stringify(b);assert.deepEqual(advanceBattle(b,241000),[]);assert.equal(JSON.stringify(b),snapshot);
});
test('N67: source suppression and upgrade cannot refresh an in-flight volley',()=>{
  const b=frozen(),s=get(b,'P2');s.tier=2;s.garrison=80;const a=shoot(b,40),at=a.volleyCheckAtMs,eta=a.arrivalAtMs;
  assert.equal(applyBattleAction(b,{kind:'upgrade',sequence:2,faction:'P',targetId:s.id}).ok,false);
  s.garrison=70;assert.equal(applyBattleAction(b,{kind:'upgrade',sequence:3,faction:'P',targetId:s.id}).ok,true);
  s.feintUntil=100000;advanceBattle(b,at!);assert.equal(a.volleyState,'fired');assert.equal(a.volleyCheckAtMs,at);assert.equal(a.arrivalAtMs,eta);
});
test('N69: reinforcement after a volley can still defeat the arriving archers',()=>{
  const b=frozen(),t=get(b,'N2');t.owner='E';t.garrison=12;const a=shoot(b);advanceBattle(b,a.volleyCheckAtMs!);addArmy(b,t,'E',2,a.arrivalAtMs);
  advanceBattle(b,a.arrivalAtMs);assert.equal(t.owner,'E');assert.equal(t.garrison,1);
});
for(const d of [119.9,120,120.1])test(`N17: tower range boundary at ${d}`,()=>{
  const b=frozen(),s=get(b,'P1'),t=get(b,'E1');s.type='fort';s.x=0;s.y=0;s.feintUntil=0;s.nextShotAtMs=1000;t.x=d;t.y=0;t.garrison=10;
  for(const c of b.camps)if(c!==s&&c!==t){c.x=1000;c.y=1000;}
  advanceBattle(b,1000);assert.equal(t.garrison,d<=120?9:10);
});
test('N21 N22: empty towers preserve cadence and upgrading cannot reset a scheduled shot',()=>{
  const b=frozen(),s=get(b,'P1'),t=get(b,'E1');s.type='fort';s.tier=1;s.garrison=0;s.feintUntil=0;s.nextShotAtMs=2000;t.x=s.x+100;t.y=s.y;
  assert.equal(advanceBattle(b,2000).some(e=>e.type==='tower-shot'),false);assert.equal(s.nextShotAtMs,4000);
  assert.equal(advanceBattle(b,3334).some(e=>e.type==='tower-shot'),false);assert.equal(s.garrison,1);
  s.garrison=30;assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:s.id}).ok,true);assert.equal(s.nextShotAtMs,4000);
  advanceBattle(b,4000);assert.equal(s.nextShotAtMs,5700);
});
test('N23: simultaneous towers never redirect overflow damage to a second target',()=>{
  const b=frozen(),s=get(b,'P1'),z=get(b,'P2'),t=get(b,'E1'),other=get(b,'E2');
  for(const [c,y]of [[s,0],[z,10]] as const){c.type='fort';c.x=0;c.y=y;c.feintUntil=0;c.nextShotAtMs=1000;}
  t.x=50;t.y=0;t.garrison=1;other.x=100;other.y=0;other.garrison=10;
  const reverse=structuredClone(b);reverse.camps.reverse();
  const ev=advanceBattle(b,1000),reversedEvents=advanceBattle(reverse,1000);assert.equal(t.garrison,0);assert.equal(other.garrison,10);assert.equal(ev.filter(e=>e.type==='tower-shot'&&e.targetId===t.id).length,2);
  assert.deepEqual(reverse.camps.map(c=>[c.id,c.garrison]).sort(),b.camps.map(c=>[c.id,c.garrison]).sort());
  assert.deepEqual(reversedEvents.filter(e=>e.type==='tower-shot').map(e=>[e.sourceId,e.targetId]).sort(),ev.filter(e=>e.type==='tower-shot').map(e=>[e.sourceId,e.targetId]).sort());
});
test('N27 R29: deadline resolves reinforcement, tower, volley and remaining troops before rejecting input',()=>{
  const b=frozen('1.5'),source=get(b,'P1'),archers=get(b,'P2'),tower=get(b,'E1'),target=get(b,'E2');
  b.gameMs=239000;b.deadlineMs=240000;
  source.x=0;source.y=0;source.garrison=4;archers.x=116;archers.y=0;archers.garrison=20;
  target.x=180;target.y=0;target.garrison=23;tower.x=116;tower.y=100;tower.type='fort';tower.tier=1;tower.garrison=1;tower.feintUntil=0;tower.nextShotAtMs=240000;
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:source.id,targetId:archers.id}).ok,true);
  assert.equal(b.armies[0]!.arrivalAtMs,240000);advanceBattle(b,239500);
  assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:2,faction:'P',sourceId:archers.id,targetId:target.id}).ok,true);
  const volley=b.armies.at(-1)!;assert.equal(volley.volleyCheckAtMs,240000);assert.equal(volley.arrivalAtMs,240500);
  const events=advanceBattle(b,240000),types=events.map(e=>e.type);
  assert.ok(types.indexOf('arrival')<types.indexOf('tower-shot'));assert.ok(types.indexOf('tower-shot')<types.indexOf('volley'));assert.ok(types.indexOf('volley')<types.indexOf('result'));
  assert.equal(archers.garrison,12);assert.equal(volley.remainingCount,9);assert.equal(target.garrison,21);assert.equal(events.find(e=>e.type==='volley')!.amount,2);
  assert.deepEqual(b.result!.stats.map(s=>[s.faction,s.camps,s.troops,s.rank]),[['P',2,23,1],['E',2,22,2]]);
  const snapshot=JSON.stringify(b);
  for(const action of [
    {kind:'dispatch',sequence:3,faction:'P',sourceId:source.id,targetId:target.id},
    {kind:'upgrade',sequence:3,faction:'P',targetId:archers.id},
    {kind:'card',cardId:'supply',sequence:3,faction:'P',targetId:archers.id},
  ] as const){const result=applyBattleAction(b,action);assert.equal(result.ok,false);if(!result.ok)assert.equal(result.reason,'当前不能行动');assert.equal(JSON.stringify(b),snapshot);}
});
test('R29: deadline production precedes capture and elimination cancels a due volley before tower fire and final ranking',()=>{
  const b=createBattle('A01',{id:'deadline-elimination',ruleRevision:'1.5'});b.gameMs=239000;
  for(const [i,c]of b.camps.entries()){c.x=2000+i*300;c.y=2000;c.feintUntil=1000000;c.nextShotAtMs=null;}
  const source=get(b,'P1'),captured=get(b,'E1'),tower=get(b,'E2'),target=get(b,'N2');source.x=0;source.y=0;source.garrison=4;
  captured.x=116;captured.y=0;captured.type='archery';target.x=180;target.y=0;target.owner='P';target.garrison=10;
  tower.x=116;tower.y=100;tower.type='fort';tower.feintUntil=0;tower.nextShotAtMs=240000;
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:captured.id}).ok,true);assert.equal(b.armies[0]!.arrivalAtMs,240000);advanceBattle(b,239500);
  captured.garrison=20;assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:captured.id,targetId:target.id}).ok,true);const archer=b.armies.at(-1)!;assert.equal(archer.volleyCheckAtMs,240000);
  // Controlled last half-second: one defender is produced exactly when two attackers arrive.
  captured.garrison=0;captured.feintUntil=0;captured.credit=fraction(3,5);source.garrison=30;factionOf(b,'P')!.inventory.supply=1;
  const events=advanceBattle(b,240000),order=['production','arrival','capture','eliminated','tower-shot','result'];let previous=-1;
  for(const type of order){const index=events.findIndex(e=>e.type===type);assert.ok(index>previous,type);previous=index;}
  assert.equal(events.find(e=>e.type==='production'&&e.targetId===captured.id)!.amount,1);assert.equal(events.find(e=>e.type==='capture')!.amount,1);assert.equal(events.find(e=>e.type==='eliminated')!.faction,'E1');
  assert.equal(events.find(e=>e.type==='tower-shot')!.targetId,captured.id);assert.equal(captured.owner,'P');assert.equal(captured.garrison,0);assert.equal(target.garrison,10);assert.ok(!events.some(e=>e.type==='volley'||e.type==='volley-skipped'));assert.ok(!b.armies.some(a=>a.id===archer.id));assert.equal(b.result!.ranks.E1,4);assert.equal(b.result!.independentWinner,'P');
  const before=JSON.stringify(b);for(const action of [
    {kind:'upgrade',faction:'P',sequence:2,targetId:source.id},
    {kind:'card',cardId:'supply',faction:'P',sequence:2,targetId:source.id},
    {kind:'dispatch',faction:'P',sequence:2,sourceId:source.id,targetId:target.id},
  ] as const){const result=applyBattleAction(b,action);assert.equal(result.ok,false);assert.deepEqual(result.events,[]);assert.equal(JSON.stringify(b),before);}
});
test('N51: a camp that produces after an empty-target skip is fought normally without another volley',()=>{
  const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'N1');t.x=s.x+236;t.y=s.y;t.owner='E';t.garrison=0;t.credit=fraction(1,2);const a=shoot(b);t.feintUntil=a.volleyCheckAtMs!;
  advanceBattle(b,a.volleyCheckAtMs!);assert.equal(t.garrison,0);assert.equal(a.volleySkipReason,'empty');assert.equal(t.feintUntil,0);
  const later=advanceBattle(b,a.arrivalAtMs-1);assert.equal(t.garrison,1);assert.ok(!later.some(e=>e.type==='volley'));
  const arrival=advanceBattle(b,a.arrivalAtMs);assert.ok(!arrival.some(e=>e.type==='volley'));assert.equal(t.owner,'P');assert.equal(t.garrison,9);
});
test('N67: logistics and march affect only the new archer travel and one prepared check',()=>{
  for(const march of [false,true]){const b=frozen('1.5'),s=get(b,'P2'),t=get(b,'N1'),f=factionOf(b,'P')!;s.garrison=20;t.garrison=12;t.x=s.x+236;t.y=s.y;f.passives.logistics=3;f.inventory.march=1;
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:s.id,targetId:t.id,march}).ok,true);const a=b.armies[0]!,speed=march?119.2:80+36/7;
    assert.ok(Math.abs(a.speed-speed)<1e-10);assert.equal(a.arrivalAtMs,Math.ceil(200000/speed));assert.equal(a.volleyCheckAtMs,Math.max(500,Math.ceil(a.arrivalAtMs*.74)));
    const events=advanceBattle(b,a.arrivalAtMs-1);assert.equal(events.filter(e=>e.type==='volley').length,1);assert.equal(t.garrison,9);assert.equal(a.volleyState,'fired');
  }
});
test('N68: arrival destroys the old volley opportunity; only a new departure from an archer camp gets one',()=>{
  for(const friendly of [true,false]){
    const b=frozen(),source=get(b,'P2'),relay=get(b,'N2');relay.owner=friendly?'P':null;relay.garrison=friendly?0:2;source.garrison=20;
    applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:relay.id});const first=b.armies[0]!;advanceBattle(b,first.arrivalAtMs);assert.equal(relay.owner,'P');assert.equal(relay.garrison,10);assert.equal(b.armies.length,0);
    applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:relay.id,targetId:source.id});const cavalry=b.armies[0]!;assert.equal(cavalry.troopType,'cavalry');assert.equal(cavalry.volleyState,null);assert.equal(cavalry.volleyCheckAtMs,null);
    const arrival=advanceBattle(b,cavalry.arrivalAtMs);assert.ok(!arrival.some(e=>e.type==='volley'));assert.equal(source.garrison,15);assert.equal(b.armies.length,0);
    const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:3,sourceId:source.id,targetId:relay.id});const next=b.armies[0]!;
    assert.equal(next.troopType,'archer');assert.equal(next.initialCount,7);assert.equal(next.volleyState,'pending');assert.ok(next.volleyCheckAtMs!>=b.gameMs+500);assert.notEqual(next.id,first.id);assert.ok(!result.events.some(e=>e.type==='volley'));
  }
  const b=frozen(),infantry=get(b,'P1'),archery=get(b,'P2');archery.garrison=0;
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:infantry.id,targetId:archery.id});assert.equal(b.armies[0]!.troopType,'infantry');const arrival=advanceBattle(b,b.armies[0]!.arrivalAtMs);assert.ok(!arrival.some(e=>e.type==='volley'));
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:archery.id,targetId:infantry.id});assert.equal(b.armies[0]!.troopType,'archer');assert.equal(b.armies[0]!.volleyState,'pending');assert.ok(b.armies[0]!.volleyCheckAtMs!>=b.gameMs+500);
});
test('N65: reciprocal volleys and captures are identical at 30/60 fps and reversed entity order',()=>{
  function run(fps:number,reverse:boolean){const b=frozen('1.5'),p=get(b,'P2'),e=get(b,'E2');p.garrison=20;e.garrison=20;
    applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:p.id,targetId:e.id});applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:e.id,targetId:p.id});
    if(reverse){b.armies.reverse();b.camps.reverse();b.factions.reverse();}
    let volleys=0;for(let frame=1;frame<=fps*5;frame++)volleys+=advanceBattle(b,Math.round(frame*1000/fps)).filter(e=>e.type==='volley').length;
    assert.equal(volleys,2);assert.equal(p.owner,'E');assert.equal(e.owner,'P');assert.equal(b.armies.length,0);
    b.camps.sort((a,z)=>a.id.localeCompare(z.id));b.factions.sort((a,z)=>a.id.localeCompare(z.id));return b;
  }
  const baseline=run(30,false);for(const [fps,reverse]of [[60,false],[30,true],[60,true]] as const)assert.deepEqual(run(fps,reverse),baseline);
});
