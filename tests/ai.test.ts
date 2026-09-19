import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSimulation, chooseAiAction, cloneBattle } from '../src/core/ai.ts';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { MAPS } from '../src/core/maps.ts';
import { fraction } from '../src/core/fraction.ts';

test('AI decisions are deterministic, read-only and legal under shared rules', () => {
  for(const map of Object.values(MAPS)){
    const b=createBattle(map.id,{id:map.id,firstDragCompleted:true});
    const id=b.factions.find(f=>f.id!=='P')!.id;
    for(const c of b.camps.filter(c=>c.owner===id))c.garrison=40;
    const before=JSON.stringify(b),a=chooseAiAction(b,id);
    assert.deepEqual(a,chooseAiAction(b,id));assert.equal(JSON.stringify(b),before);assert.ok(a);
    assert.equal(applyBattleAction(b,a).ok,true);
  }
});
test('AI respects first decision time and at most one action per interval', () => {
  const b=createBattle('L01',{id:'timing',firstDragCompleted:true});
  advanceSimulation(b,7999);assert.equal(factionOf(b,'E')!.lastActionSequence,0);
  advanceSimulation(b,8000);assert.ok(factionOf(b,'E')!.lastActionSequence<=1);
  assert.equal(factionOf(b,'E')!.nextAiAtMs,11500);
  const seq=factionOf(b,'E')!.lastActionSequence;advanceSimulation(b,11499);assert.equal(factionOf(b,'E')!.lastActionSequence,seq);
});
test('frame partitioning preserves simultaneous AI choices', () => {
  const b=createBattle('A01',{id:'ai-replay'}),z=cloneBattle(b);
  advanceSimulation(b,18000);
  for(let t=300;t<=18000;t+=300)advanceSimulation(z,t);
  assert.deepEqual(z,b);
  assert.ok(b.factions.filter(f=>f.id!=='P').every(f=>f.lastActionSequence>0));
});
test('all formal maps progress to a real terminal state within the deadline', () => {
  for(const id of ['A01','A02','A03'] as const){
    const b=createBattle(id,{id:`smoke-${id}`});advanceSimulation(b,240000);
    assert.equal(b.status,'finished');assert.ok(b.result);assert.ok(b.gameMs<=240000);
    for(const c of b.camps)assert.ok(Number.isInteger(c.garrison)&&c.garrison>=0);
    for(const a of b.armies)assert.ok(a.remainingCount>0&&a.arrivalAtMs>b.gameMs);
  }
});

// These hand-positioned 80-unit/s scenarios preserve exact v1.5 save compatibility.
test('A05: reinforcement may arrive after a clearing volley if it still prevents the subsequent capture',()=>{
  const b=createBattle('L03',{id:'rescue-after-volley',ruleRevision:'1.5',firstDragCompleted:true});
  for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;c.tier=3;c.garrison=140;}
  const target=b.camps.find(c=>c.id==='L03-P1')!,source=b.camps.find(c=>c.id==='L03-P2')!,enemy=b.camps.find(c=>c.id==='L03-E2')!;
  Object.assign(target,{x:0,y:0,type:'barracks',tier:1,garrison:2});Object.assign(source,{x:0,y:200,type:'barracks',tier:1,garrison:24});Object.assign(enemy,{x:236,y:0,garrison:20});
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:enemy.id,targetId:target.id}).ok,true);enemy.garrison=140;
  const attack=b.armies[0]!;assert.equal(attack.volleyCheckAtMs,1850);assert.equal(attack.arrivalAtMs,2500);
  const unassisted=cloneBattle(b);advanceBattle(unassisted,2500);assert.equal(unassisted.camps.find(c=>c.id===target.id)!.owner,'E');
  const action={kind:'dispatch' as const,faction:'P' as const,sequence:1,sourceId:source.id,targetId:target.id,march:false};
  const rescued=cloneBattle(b);assert.equal(applyBattleAction(rescued,action).ok,true);assert.equal(rescued.armies.at(-1)!.arrivalAtMs,2050);
  advanceBattle(rescued,1850);assert.equal(rescued.camps.find(c=>c.id===target.id)!.garrison,0);advanceBattle(rescued,2500);
  assert.equal(rescued.camps.find(c=>c.id===target.id)!.owner,'P');assert.equal(rescued.camps.find(c=>c.id===target.id)!.garrison,2);
  const before=JSON.stringify(b);assert.deepEqual(chooseAiAction(b,'P'),action);assert.equal(JSON.stringify(b),before);
  source.y=241;assert.equal(chooseAiAction(b,'P'),null,'an arrival after the capture is not a timely reinforcement');
});
test('A05: equal-time rescue sources use travel time, then troops, then source ID while destinations use ETA and ID',()=>{
  for(const [first,second,expected]of [[12,14,'A01-N3'],[16,14,'A01-E1'],[12,12,'A01-E1'],[14,15,'A01-E1']] as const){
    const b=createBattle('A01',{id:'rescue-order',ruleRevision:'1.5'});for(const [i,c]of b.camps.entries()){c.x=3000+i*300;c.y=3000;c.feintUntil=1000000;c.tier=3;c.garrison=140;}
    const c=(id:string)=>b.camps.find(c=>c.id===`A01-${id}`)!;factionOf(b,'E1')!.inventory.supply=0;
    Object.assign(c('N1'),{owner:'E1',x:0,y:0,tier:1,garrison:1});Object.assign(c('N2'),{owner:'E1',x:0,y:200,tier:1,garrison:1});
    Object.assign(c('E1'),{x:116,y:0,tier:1,garrison:first});Object.assign(c('N3'),{owner:'E1',x:0,y:116,type:'barracks',tier:1,garrison:second});Object.assign(c('N4'),{owner:'E1',x:0,y:-156,type:'barracks',tier:1,garrison:40});
    Object.assign(c('P1'),{x:196,y:0,garrison:12});Object.assign(c('E2'),{x:196,y:200,garrison:12});
    for(const [source,target,id]of [['P1','N1','P'],['E2','N2','E2']] as const)assert.equal(applyBattleAction(b,{kind:'dispatch',faction:id,sequence:1,sourceId:c(source).id,targetId:c(target).id}).ok,true);
    const before=JSON.stringify(b),action=chooseAiAction(b,'E1');assert.deepEqual(action,{kind:'dispatch',faction:'E1',sequence:1,sourceId:expected,targetId:'A01-N1',march:false});assert.equal(JSON.stringify(b),before);
    const earlier=cloneBattle(b);earlier.armies.find(a=>a.targetId==='A01-N2')!.arrivalAtMs=1999;assert.equal(chooseAiAction(earlier,'E1')!.targetId,'A01-N2');
  }
});
test('A05: emergency rescue can use nine troops while preserving five, but a threat beyond four seconds is not rescued early',()=>{
  for(const at of [4000,4001]){
    const b=createBattle('L03',{id:'rescue-window',ruleRevision:'1.5',firstDragCompleted:true});for(const [i,c]of b.camps.entries()){c.x=3000+i*300;c.y=3000;c.feintUntil=1000000;c.tier=3;c.garrison=140;c.nextShotAtMs=null;}
    const source=b.camps.find(c=>c.id==='L03-P1')!,target=b.camps.find(c=>c.id==='L03-P2')!,enemy=b.camps.find(c=>c.id==='L03-E1')!;
    Object.assign(source,{x:116,y:0,tier:1,garrison:9});Object.assign(target,{x:0,y:0,type:'barracks',tier:1,garrison:1});Object.assign(enemy,{x:36+at*80/1000,y:0,garrison:8});
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:enemy.id,targetId:target.id}).ok,true);assert.equal(b.armies[0]!.arrivalAtMs,at);const action=chooseAiAction(b,'P');
    if(at===4000){assert.equal(action?.kind,'dispatch');assert.equal(action!.targetId,target.id);assert.equal(applyBattleAction(b,action!).ok,true);assert.equal(source.garrison,5);advanceBattle(b,at);assert.equal(target.owner,'P');assert.equal(target.garrison,1);}
    else assert.equal(action,null);
  }
});
test('A07: neutral and last-camp bonuses apply equally to player and computer targets',()=>{
  for(const preferred of ['neutral-P1','neutral-E2','last-P1','last-E2']){
    const b=createBattle('A01',{id:'fair-score',ruleRevision:'1.5'});for(const [i,c]of b.camps.entries()){c.x=3000+i*300;c.y=3000;c.feintUntil=1000000;c.tier=3;c.garrison=140;}
    const c=(id:string)=>b.camps.find(c=>c.id===`A01-${id}`)!;Object.assign(c('E1'),{x:0,y:0,tier:1,garrison:40});Object.assign(c('P1'),{x:236,y:0,tier:1,garrison:5});Object.assign(c('E2'),{x:0,y:236,tier:1,garrison:5});
    const target=preferred.endsWith('P1')?'P1':'E2';
    if(preferred.startsWith('neutral')){c('N1').owner='P';c('N2').owner='E2';c(target).owner=null;}
    else c(target==='P1'?'N2':'N1').owner=target==='P1'?'E2':'P';
    const before=JSON.stringify(b),action=chooseAiAction(b,'E1');assert.equal(action?.kind,'dispatch');assert.equal(action!.targetId,`A01-${target}`);assert.equal(JSON.stringify(b),before);
  }
  const b=createBattle('A01',{id:'equal-enemies',ruleRevision:'1.5'});for(const [i,c]of b.camps.entries()){c.x=3000+i*300;c.y=3000;c.feintUntil=1000000;c.tier=3;c.garrison=140;}
  const source=b.camps.find(c=>c.id==='A01-E1')!,p=b.camps.find(c=>c.id==='A01-P1')!,e=b.camps.find(c=>c.id==='A01-E2')!;Object.assign(source,{x:0,y:0,tier:1,garrison:40});Object.assign(p,{x:236,y:0,tier:1,garrison:5});Object.assign(e,{x:0,y:236,tier:1,garrison:5});
  assert.equal(chooseAiAction(b,'E1')!.targetId,e.id);p.owner='E2';e.owner='P';assert.equal(chooseAiAction(b,'E1')!.targetId,e.id,'equal scores use the target ID even when its faction changes');
});
test('K27: attack forecasts use real production including passive gains, suppression and mobilization',()=>{
  for(const [effect,defenders,attacks]of [['base',4,true],['passive',5,false],['suppressed',0,true],['mobilized',9,false]] as const){
    const b=createBattle('L03',{id:'production-forecast',ruleRevision:'1.5',firstDragCompleted:true});for(const [i,c]of b.camps.entries()){c.x=3000+i*300;c.y=3000;c.feintUntil=1000000;c.tier=3;c.garrison=140;c.nextShotAtMs=null;}
    const source=b.camps.find(c=>c.id==='L03-P1')!,other=b.camps.find(c=>c.id==='L03-P2')!,target=b.camps.find(c=>c.id==='L03-E1')!;
    Object.assign(source,{x:0,y:0,tier:1,garrison:12});other.garrison=0;Object.assign(target,{x:356,y:0,tier:1,garrison:0,feintUntil:effect==='suppressed'?5000:0});if(effect==='passive')factionOf(b,'E')!.passives.farming=2;if(effect==='mobilized'){target.mobilizeUntil=6000;target.bonusBudget=fraction(8);}
    const original=JSON.stringify(b),prediction=chooseAiAction(b,'P');assert.equal(JSON.stringify(b),original);if(attacks)assert.equal(prediction!.targetId,target.id);else assert.equal(prediction,null);
    const baseline=cloneBattle(b);advanceBattle(baseline,4000);assert.equal(baseline.camps.find(c=>c.id===target.id)!.garrison,defenders);
    const action={kind:'dispatch' as const,faction:'P' as const,sequence:1,sourceId:source.id,targetId:target.id};assert.equal(applyBattleAction(b,action).ok,true);assert.equal(b.armies[0]!.arrivalAtMs,4000);advanceBattle(b,4000);assert.equal(target.owner,defenders<6?'P':'E');assert.equal(target.garrison,Math.abs(6-defenders));
  }
});

test('A02: player inventory and passive levels never mirror into standard computer properties',()=>{
  for(const mapId of ['A01','A02','A03'] as const){
    const empty=createBattle(mapId,{id:'independent'}),stocked=createBattle(mapId,{id:'independent',inventory:{supply:99,mobilize:98,march:97,feint:96},passives:{farming:20,logistics:30,fortification:40}});
    assert.deepEqual(stocked.factions.filter(f=>f.id!=='P'),empty.factions.filter(f=>f.id!=='P'));
    for(const f of stocked.factions.filter(f=>f.id!=='P')){assert.deepEqual(f.inventory,{supply:1,mobilize:0,march:0,feint:0});assert.deepEqual(f.passives,{farming:0,logistics:0,fortification:0});}
  }
});
test('A03: every map respects its first game-time decision and introductory reading does not advance it',()=>{
  const intro=createBattle('L01',{id:'reading'}),snapshot=JSON.stringify(intro);advanceSimulation(intro,30000);assert.equal(JSON.stringify(intro),snapshot);
  for(const id of ['L01','L02','L03','A01','A02','A03'] as const){
    const b=createBattle(id,{id,firstDragCompleted:true});for(const c of b.camps)if(c.owner!=='P'&&c.owner)c.garrison=40;
    const computers=b.factions.filter(f=>f.id!=='P');
    for(const [index,actor] of computers.entries()){
      const first=8000+index*700;
      advanceSimulation(b,first-1);assert.equal(actor.lastActionSequence,0);
      advanceSimulation(b,first);assert.equal(actor.lastActionSequence,1);assert.equal(actor.nextAiAtMs,first+3500);
    }
  }
});
test('A04: simultaneous computer actions come from the same public snapshot in either faction order',()=>{
  const b=createBattle('A01',{id:'shared'});for(const c of b.camps)c.feintUntil=1000000;for(const f of b.factions)if(f.id!=='P')f.nextAiAtMs=8000;advanceBattle(b,7999);
  const snapshot=cloneBattle(b);advanceBattle(snapshot,8000);const expected=snapshot.factions.filter(f=>f.id!=='P').map(f=>chooseAiAction(snapshot,f.id));assert.ok(expected.every(Boolean));
  const expectedDispatch=expected.map(a=>{assert.equal(a!.kind,'dispatch');return [a!.faction,a!.kind==='dispatch'?a!.sourceId:null,a!.targetId];}).sort();
  for(const reverse of [false,true]){const actual=cloneBattle(b);if(reverse)actual.factions.reverse();
    const events=advanceSimulation(actual,8000).filter(e=>e.type==='dispatch');assert.deepEqual(events.map(e=>[e.faction,e.sourceId,e.targetId]).sort(),expectedDispatch);
    for(const f of actual.factions.filter(f=>f.id!=='P'))assert.equal(f.lastActionSequence,1);
  }
});
test('A09 A10 A11: a computer spends three supplied cards on three real defensive decisions without refreshing inventory',()=>{
  const b=createBattle('A01',{id:'three-rescues',ruleRevision:'1.5'}),target=b.camps.find(c=>c.owner==='E1')!,source=b.camps.find(c=>c.owner==='P')!,actor=factionOf(b,'E1')!;
  for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}Object.assign(source,{x:0,y:0,garrison:28});Object.assign(target,{x:116,y:0,garrison:10});actor.inventory.supply=3;
  for(const f of b.factions)if(f.id!=='E1')f.nextAiAtMs=1000000;
  for(const [i,after]of [[0,2],[1,1],[2,4]]){const decision=3000+i!*1500;advanceBattle(b,decision);
    assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:i!+1,sourceId:source.id,targetId:target.id}).ok,true);const army=b.armies.at(-1)!;assert.equal(army.arrivalAtMs,decision+1000);
    const unsupported=cloneBattle(b);advanceBattle(unsupported,army.arrivalAtMs);assert.equal(unsupported.camps.find(c=>c.id===target.id)!.owner,'P');
    const before=target.garrison,events=advanceSimulation(b,decision+1);assert.deepEqual(events.filter(e=>e.type==='card').map(e=>[e.reason,e.targetId,e.amount]),[['supply',target.id,6]]);
    assert.equal(target.garrison,before+6);assert.equal(actor.inventory.supply,2-i!);assert.equal(actor.lastActionSequence,i!+1);
    advanceSimulation(b,army.arrivalAtMs);assert.equal(target.owner,'E1');assert.equal(target.garrison,after);
  }
  const before=JSON.stringify(b);assert.equal(chooseAiAction(b,'E1'),null);assert.equal(JSON.stringify(b),before);assert.equal(actor.inventory.supply,0);
  const camps=JSON.stringify(b.camps),inventories=b.factions.map(f=>({...f.inventory}));assert.deepEqual(advanceSimulation(b,7500),[]);
  assert.equal(JSON.stringify(b.camps),camps);assert.deepEqual(b.factions.map(f=>f.inventory),inventories);assert.equal(actor.lastActionSequence,3);
});

test('A06: an endangered source does not escape by attacking an easy neutral camp',()=>{
  const b=createBattle('L03',{id:'unsafe-source',ruleRevision:'1.5',firstDragCompleted:true});for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;c.tier=3;c.garrison=140;}
  const source=b.camps.find(c=>c.id==='L03-P1')!,other=b.camps.find(c=>c.id==='L03-P2')!,enemy=b.camps.find(c=>c.id==='L03-E1')!,neutral=b.camps.find(c=>c.id==='L03-N1')!;
  Object.assign(source,{x:0,y:0,tier:1,garrison:24});Object.assign(other,{garrison:0});Object.assign(enemy,{x:116,y:0,garrison:80});Object.assign(neutral,{x:0,y:64,tier:1,garrison:0});
  assert.equal(chooseAiAction(b,'P')?.kind,'dispatch','the source has a feasible expansion before the attack becomes public');
  applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:enemy.id,targetId:source.id});const before=JSON.stringify(b);
  assert.equal(chooseAiAction(b,'P'),null);assert.equal(JSON.stringify(b),before);advanceBattle(b,1000);assert.equal(source.owner,'E');assert.equal(source.garrison,16);
});
test('A08: rear transfers follow safe-upgrade priority and count already dispatched reinforcements against capacity',()=>{
  const b=createBattle('A01',{id:'rear-transfer',ruleRevision:'1.5'});for(const [i,c]of b.camps.entries()){c.feintUntil=1000000;c.nextShotAtMs=null;c.tier=3;c.garrison=140;c.x=600+i*64;c.y=500;}
  const source=b.camps.find(c=>c.id==='A01-E1')!,front=b.camps.find(c=>c.id==='A01-N4')!,enemy=b.camps.find(c=>c.id==='A01-P1')!;
  Object.assign(source,{x:0,y:0,tier:1,garrison:40,type:'barracks'});Object.assign(front,{x:40,y:0,owner:'E1',tier:1,garrison:10,type:'archery'});Object.assign(enemy,{x:516,y:0,garrison:140,type:'barracks'});
  assert.deepEqual(chooseAiAction(b,'E1'),{kind:'upgrade',faction:'E1',sequence:1,targetId:source.id});
  enemy.garrison=10;applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:enemy.id,targetId:source.id});enemy.garrison=140;assert.equal(b.armies[0]!.arrivalAtMs,6000);
  const action=chooseAiAction(b,'E1');assert.deepEqual(action,{kind:'dispatch',faction:'E1',sequence:1,sourceId:source.id,targetId:front.id,march:false});
  const tooLittle=cloneBattle(b);tooLittle.camps.find(c=>c.id===front.id)!.x=39.9;assert.equal(chooseAiAction(tooLittle,'E1'),null,'distance improvement below 40 is insufficient');
  const accepted=cloneBattle(b);applyBattleAction(accepted,action!);const army=accepted.armies.at(-1)!;assert.equal(army.initialCount,20);advanceBattle(accepted,army.arrivalAtMs);assert.equal(accepted.camps.find(c=>c.id===front.id)!.garrison,30);
  assert.equal(applyBattleAction(accepted,{kind:'dispatch',faction:'E1',sequence:2,sourceId:front.id,targetId:source.id}).ok,true);assert.equal(accepted.armies.at(-1)!.troopType,'archer');
  const reinforcement=b.camps.find(c=>c.id==='A01-N1')!;Object.assign(reinforcement,{x:-200,y:0,owner:'E1',tier:1,garrison:44,type:'barracks'});
  applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:reinforcement.id,targetId:front.id});assert.equal(b.armies.at(-1)!.remainingCount,22);
  assert.equal(chooseAiAction(b,'E1'),null,'10 + 22 already en route + 20 new soldiers would exceed capacity 50');
});
