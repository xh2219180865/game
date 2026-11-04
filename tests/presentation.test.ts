import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBattleAction, createBattle, factionOf, advanceBattle } from '../src/core/battle.ts';
import { fraction } from '../src/core/fraction.ts';
import { cardTargetPreview, dispatchPreview, isMarching, LastCampAlerts, placeArmyLabels, selectBattleAccents } from '../src/render/battle-presentation.ts';

test('H11 H16: one transient accent per camp favors capture, with a bounded decoration budget',()=>{
  const events=[{id:1,atMs:0,type:'card' as const,targetId:'camp'},{id:2,atMs:0,type:'upgrade' as const,targetId:'camp'},{id:3,atMs:0,type:'capture' as const,targetId:'camp'},
    ...Array.from({length:100},(_,i)=>({id:i+4,atMs:0,type:'volley' as const,targetId:`target-${i}`}))];
  const before=JSON.stringify(events),selected=selectBattleAccents(events);assert.ok(selected.has(3));assert.ok(!selected.has(1)&&!selected.has(2));
  const cost=events.filter(e=>selected.has(e.id)).reduce((n,e)=>n+(['volley','card','capture'].includes(e.type)?3:1),0);assert.ok(cost<=80);assert.equal(JSON.stringify(events),before);
  const cards=Array.from({length:100},(_,i)=>({id:i+1,atMs:0,type:'card' as const,targetId:`card-${i}`,reason:'supply'}));
  assert.equal(selectBattleAccents(cards).size,26,'three decorative figures per supply stay within the 80-particle budget');
});

test('F02 H16: two departure dust particles consume the eighty-particle budget and yield to a source capture',()=>{
  const events=Array.from({length:100},(_,i)=>({id:i+1,atMs:0,type:'dispatch' as const,sourceId:`source-${i}`,targetId:'shared-target',faction:'P' as const}));
  const before=structuredClone(events);assert.equal(selectBattleAccents(events).size,40);
  const capture={id:101,atMs:0,type:'capture' as const,targetId:'source-99',faction:'E1' as const};
  const selected=selectBattleAccents([...events,capture]);assert.ok(selected.has(capture.id));assert.ok(!selected.has(100));
  assert.ok([...selected].reduce((cost,id)=>cost+(id===101?3:2),0)<=80);assert.deepEqual(events,before);
});

test('F05 H16: enemy arrival dust shares the eighty-particle budget and yields to capture',()=>{
  const events=Array.from({length:100},(_,i)=>({id:i+1,atMs:0,type:'arrival' as const,targetId:`camp-${i}`,reason:'enemy'}));
  assert.equal(selectBattleAccents(events).size,40);
  const capture={id:101,atMs:0,type:'capture' as const,targetId:'camp-99'};
  const selected=selectBattleAccents([...events,capture]);assert.ok(selected.has(101)&&!selected.has(100));assert.ok([...selected].reduce((n,id)=>n+(id===101?3:2),0)<=80);
});

test('U11 H15: last-camp alerts track new threats, rate-limit and do not replay restored warnings',()=>{
  const b=createBattle('L01',{id:'threat',firstDragCompleted:true,ruleRevision:'1.5'}),alerts=new LastCampAlerts();assert.equal(alerts.update(b).campId,null);
  applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:'L01-E1',targetId:'L01-P1'});
  const army=b.armies[0]!;assert.equal(alerts.update(b).fresh,true);assert.equal(alerts.update(b).fresh,false);
  assert.equal(alerts.update(b).emphasized,true);b.gameMs=300;assert.equal(alerts.update(b).emphasized,false);
  b.armies=[];alerts.update(b);b.armies=[army];assert.equal(alerts.update(b).fresh,false);
  b.gameMs=3000;b.armies=[];alerts.update(b);b.armies=[army];assert.equal(alerts.update(b).fresh,true);
  const restored=new LastCampAlerts();assert.deepEqual(restored.update(b),{campId:'L01-P1',fresh:false,emphasized:false});
  b.camps.find(c=>c.id==='L01-N1')!.owner='P';assert.equal(alerts.update(b).campId,null);
});

test('N68: previews report conversion and independent volley rounding without mutating state',()=>{
  const b=createBattle('L03',{id:'preview',firstDragCompleted:true,ruleRevision:'1.5'}),s=b.camps.find(c=>c.id==='L03-P2')!,t=b.camps.find(c=>c.type==='fort')!;
  s.garrison=21;const before=JSON.stringify(b),p=dispatchPreview(b,s,t,false);
  assert.equal(p.sent,10);assert.equal(p.retained,11);assert.equal(p.volleyDamage,3);assert.equal(p.valid,true);assert.match(p.conversion,/弓兵 → 守备兵（占领后）/);assert.equal(JSON.stringify(b),before);
  t.owner='P';assert.match(dispatchPreview(b,s,t,false).conversion,/到达后/);
});
test('v1.5 K04 K05: preview and accepted march agree at the integer-ms minimum',()=>{
  const b=createBattle('L03',{id:'march',firstDragCompleted:true,ruleRevision:'1.5'}),s=b.camps[0]!,t=b.camps[1]!,p=factionOf(b,'P')!;p.inventory.march=2;
  t.x=s.x+64;t.y=s.y;const short=dispatchPreview(b,s,t,true);assert.equal(short.normalMs,1000);assert.equal(short.travelMs,1000);assert.equal(short.valid,false);
  const before=JSON.stringify(b);assert.equal(applyBattleAction(b,{kind:'dispatch',sourceId:s.id,targetId:t.id,march:true,faction:'P',sequence:1}).ok,false);assert.equal(JSON.stringify(b),before);
  t.x=s.x+236;const long=dispatchPreview(b,s,t,true);assert.equal(long.valid,true);assert.ok(long.travelMs<long.normalMs);
  assert.equal(applyBattleAction(b,{kind:'dispatch',sourceId:s.id,targetId:t.id,march:true,faction:'P',sequence:2}).ok,true);assert.equal(b.armies[0]!.arrivalAtMs,long.travelMs);assert.equal(isMarching(b,b.armies[0]!),true);
});
test('v1.5 Q18 Q19: march eligibility uses exact integer travel times for 69, 100 and 200 routes rather than rounded seconds',()=>{
  for(const [route,normal,fast]of [[69,1000,1000],[100,1250,1000],[200,2500,1786],[80.001,1001,1000]]){
    const b=createBattle('L03',{id:'exact-march',firstDragCompleted:true,ruleRevision:'1.5'}),s=b.camps[0]!,t=b.camps[1]!,f=factionOf(b,'P')!;s.garrison=20;f.inventory.march=1;t.x=s.x+route!+36;t.y=s.y;
    const before=JSON.stringify(b),preview=dispatchPreview(b,s,t,true);assert.equal(preview.normalMs,normal);assert.equal(preview.travelMs,fast);assert.equal(preview.valid,normal!>fast!);assert.equal(JSON.stringify(b),before);
    if(route===80.001)assert.equal((normal!/1000).toFixed(2),(fast!/1000).toFixed(2),'the same displayed seconds still represent different integer travel times');
    const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:s.id,targetId:t.id,march:true});assert.equal(result.ok,normal!>fast!);
    if(normal===fast){assert.equal(JSON.stringify(b),before);assert.deepEqual(result.events,[]);}else{assert.equal(f.inventory.march,0);assert.equal(s.garrison,10);assert.equal(b.armies.length,1);assert.equal(b.armies[0]!.arrivalAtMs,fast);}
  }
});
test('F01: tower risk uses the actual route segment and excludes neutral or friendly towers',()=>{
  const b=createBattle('L03',{id:'tower',firstDragCompleted:true}),s=b.camps[0]!,t=b.camps[1]!,tower=b.camps.find(c=>c.type==='fort')!;
  s.x=0;s.y=0;t.x=300;t.y=0;tower.x=150;tower.y=120;tower.owner='E';
  assert.ok(dispatchPreview(b,s,t,false).towerIds.includes(tower.id));tower.y=120.001;assert.ok(!dispatchPreview(b,s,t,false).towerIds.includes(tower.id));
  tower.y=0;for(const owner of ['P',null] as const){tower.owner=owner;assert.ok(!dispatchPreview(b,s,t,false).towerIds.includes(tower.id));}
});
test('K07 K11 K13 K15: previews show actual capacity, duration and remaining budget',()=>{
  const b=createBattle('A01',{id:'cards',inventory:{mobilize:2,march:2,supply:2,feint:2}}),p=factionOf(b,'P')!,c=b.camps.find(c=>c.owner==='P')!,enemy=b.camps.find(c=>c.owner==='E1')!;
  p.passives.fortification=3;c.garrison=50;assert.match(cardTargetPreview(b,'supply',c).message,/补 4 兵/);
  c.mobilizeUntil=5000;c.bonusBudget=fraction(2);assert.match(cardTargetPreview(b,'mobilize',c).message,/5.0 → 11.0 秒，额度 2.0 → 10.0/);
  enemy.feintUntil=2000;assert.match(cardTargetPreview(b,'feint',enemy).message,/2.0 → 6.0/);
  c.feintUntil=1000;assert.equal(cardTargetPreview(b,'mobilize',c).valid,false);assert.equal(cardTargetPreview(b,'feint',c).valid,false);c.garrison=54;assert.equal(cardTargetPreview(b,'supply',c).valid,false);
});
test('P04 U05: crowd labels stay inside the board and never cover camps or each other',()=>{
  const bounds={x:8,y:80,w:304,h:320},camp={x:130,y:160,w:60,h:60};
  const items=Array.from({length:256},(_,i)=>({id:String(i),point:{x:160+(i%5)*2,y:150+Math.floor(i/5)},width:60}));
  const overlaps=(a:typeof camp,z:typeof camp)=>a.x<z.x+z.w&&a.x+a.w>z.x&&a.y<z.y+z.h&&a.y+a.h>z.y;
  for(const searchBoard of [false,true]){
  const result=placeArmyLabels(items,bounds,[camp],searchBoard);assert.ok(result.size>0);assert.ok(result.size<256);
  const values=[...result.values()];for(const [i,r]of values.entries()){assert.ok(r.x>=8&&r.x+r.w<=312&&r.y>=80&&r.y+r.h<=400);assert.equal(overlaps(r,camp),false);for(const z of values.slice(i+1))assert.equal(overlaps(r,z),false);}
  }
});
test('F09: several towers killing a one-soldier army emit one actual loss',()=>{
  const b=createBattle('L03',{id:'clipped',firstDragCompleted:true,ruleRevision:'1.5'});for(const c of b.camps){c.feintUntil=10000;c.nextShotAtMs=null;}
  const s=b.camps.find(c=>c.owner==='P')!,t=b.camps.find(c=>c.owner==='E')!;s.garrison=2;
  applyBattleAction(b,{kind:'dispatch',sourceId:s.id,targetId:t.id,faction:'P',sequence:1});const army=b.armies[0]!;
  const towers=b.camps.filter(c=>c.owner==='E');for(const c of towers){c.type='fort';c.x=s.x+30;c.y=s.y;c.nextShotAtMs=100;c.feintUntil=0;}
  const events=advanceBattle(b,100);assert.equal(events.filter(e=>e.type==='tower-shot').length,2);assert.deepEqual(events.filter(e=>e.type==='army-loss').map(e=>e.amount),[1]);assert.ok(!b.armies.includes(army));
});

test('current standings and competing arrivals use public state without predicting capture',async()=>{
  const {standingSummary,incomingSummary,resultExplanation}=await import('../src/render/battle-presentation.ts');
  const b=createBattle('A01',{id:'awareness',firstDragCompleted:true,ruleRevision:'1.5'});
  for(const f of b.factions)f.nextAiAtMs=10000;
  assert.match(standingSummary(b),/1城 · 并列第1/);
  const target=b.camps.find(c=>c.id==='A01-N5')!;
  assert.equal(incomingSummary(b,target),null);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-E1',targetId:target.id}).ok,true);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:target.id}).ok,true);
  const before=JSON.stringify(b),summary=incomingSummary(b,target)!;
  assert.equal(summary.teams,2);assert.equal(summary.count,10);assert.ok(summary.etaMs>0);
  assert.equal(JSON.stringify(b),before);
  const result={reason:'deadline' as const,playerRank:2,independentWinner:'E1' as const,ranks:{P:2,E1:1},atMs:240000,
    stats:[{faction:'P' as const,camps:2,troops:100,rank:2},{faction:'E1' as const,camps:3,troops:10,rank:1}]};
  assert.match(resultExplanation(result),/你有 2 城.*领先方 3 城/);
  result.stats[1]!.camps=2;result.stats[1]!.troops=110;
  assert.match(resultExplanation(result),/你有 100 兵.*110 兵/);
  assert.match(resultExplanation({...result,reason:'eliminated'}),/最后一城失守.*在途部队/);
});
