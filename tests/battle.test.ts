import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { campCapacity, emptyInventory, naturalRate, passiveBonus, troopSpeed } from '../src/core/config.ts';
import { fraction, add, compare, floor, isFraction, subtract, ZERO } from '../src/core/fraction.ts';
import { armyPosition, distance, travelTime, volleyOffset } from '../src/core/geometry.ts';
import { MAPS, nextFormalMap } from '../src/core/maps.ts';
import type { Army, Battle, Camp, FactionId } from '../src/core/types.ts';

function fixture(): Battle {
  const b = createBattle('L03', { id: 'test', firstDragCompleted: true });
  for (const c of b.camps) { c.feintUntil = 1_000_000; c.nextShotAtMs = null; }
  return b;
}
function camp(b: Battle, id: string): Camp { return b.camps.find(c => c.id.endsWith(id))!; }
function dispatch(b: Battle, source: Camp, target: Camp, sequence = 1): Army {
  const r = applyBattleAction(b, { kind: 'dispatch', faction: source.owner!, sequence, sourceId: source.id, targetId: target.id });
  assert.equal(r.ok, true);
  return b.armies.at(-1)!;
}
function incoming(b: Battle, target: Camp, faction: FactionId, n: number, at = 1000): Army {
  const a: Army = { id: `incoming-${b.nextEntityId++}`, sourceId: b.camps.find(c => c.owner === faction)!.id, targetId: target.id, faction,
    initialCount: n, remainingCount: n, troopType: 'infantry', from: { x: 10, y: 10 }, to: { x: target.x, y: target.y },
    departedAtMs: 0, arrivalAtMs: at, speed: 80, volleyCheckAtMs: null, volleyState: null, volleySkipReason: null };
  b.armies.push(a); return a;
}

test('all 42 map nodes match the authoritative Markdown tables and geometry', () => {
  const doc = readFileSync(new URL('../docs/02-地图与电脑设计.md', import.meta.url), 'utf8');
  const rows = [...doc.matchAll(/^\| ([LA]0[123]-[PNE][12345]?) \| (\d+(?:\.\d+)?) \| (\d+(?:\.\d+)?) \| (P|E[123]?|N) \| (\w+) \| (\d) \| (\d+) \|$/gm)];
  const nodes = Object.values(MAPS).flatMap(m => m.camps);
  assert.equal(rows.length, 42); assert.equal(nodes.length, 42);
  assert.equal(new Set(nodes.map(c=>c.id)).size,42);
  for(const map of Object.values(MAPS))for(const c of createBattle(map.id,{id:'map-capacity'}).camps){
    assert.ok(['barracks','archery','relay','fort'].includes(c.type));assert.ok([1,2].includes(c.tier));assert.ok(c.x>=40&&c.x<=320&&c.y>=55&&c.y<=485);assert.ok(c.garrison>=0&&c.garrison<=campCapacity(c));
  }
  for (const [,id,x,y,owner,type,tier,garrison] of rows) assert.deepEqual(nodes.find(c => c.id === id), { id, x:+x!, y:+y!, owner: owner === 'N' ? null : owner, type, tier:+tier!, garrison:+garrison! });
  for (const m of Object.values(MAPS)) for (const a of m.camps) for (const z of m.camps) if (a !== z) {
    assert.ok(distance(a,z) >= 64);
    for (const speed of [80,112,160]) {
      const t = travelTime(a,z,speed), v = volleyOffset(a,z,t);
      assert.ok(v >= 500 && v < t);
      const d = distance(a,z), length = d - 36;
      assert.ok(d - 18 - length * v / t <= 70 + 1e-10);
      assert.ok(v === 500 || d - 18 - length * (v-1) / t > 70 - 1e-10);
    }
  }
});
test('formal map rotation uses completed matches, including losses', () => {
  assert.deepEqual(Array.from({length:11},(_,n)=>nextFormalMap(n)), ['A01','A01','A02','A01','A02','A03','A01','A02','A03','A01','A02']);
  assert.throws(()=>nextFormalMap(-1));
});
test('T11 T14: formal layouts mirror both map axes and A03 starts with thirty soldiers in each ninety-capacity tower',()=>{
  const horizontal={P:'E1',E1:'P',E2:'E3',E3:'E2'},vertical={P:'E2',E2:'P',E1:'E3',E3:'E1'};
  for(const id of ['A01','A02','A03'] as const){const b=createBattle(id,{id:'mirror'});
    const aligned=b.camps.map(c=>{
      if(id!=='A01')return c;
      const cos=Math.cos(Math.PI/20),sin=Math.sin(Math.PI/20),scale=1-Number.EPSILON;
      return {...c,x:180+((c.x-180)*cos+(c.y-270)*sin)/scale,y:270+(-(c.x-180)*sin+(c.y-270)*cos)/scale};
    });
    const equal=(a:number,z:number)=>id==='A01'?Math.abs(a-z)<1e-9:a===z;
    for(const c of aligned)for(const axis of ['x','y'] as const){const mirror=aligned.find(z=>equal(z.x,axis==='x'?360-c.x:c.x)&&equal(z.y,axis==='y'?540-c.y:c.y));assert.ok(mirror,`${id}:${c.id}:${axis}`);
      assert.equal(mirror.type,c.type);assert.equal(mirror.tier,c.tier);assert.equal(mirror.garrison,c.garrison);assert.equal(mirror.owner,c.owner?(axis==='x'?horizontal:vertical)[c.owner as keyof typeof horizontal]:null);}
    if(id==='A03')for(const c of b.camps.filter(c=>c.owner)){assert.equal(c.type,'fort');assert.equal(c.tier,2);assert.equal(c.garrison,30);assert.equal(campCapacity(c),90);for(const enemy of b.camps.filter(z=>z.owner&&z.owner!==c.owner))assert.ok(distance(c,enemy)>120);}
  }
});
test('fraction normalization, negative floor and serialization preserve exact values', () => {
  assert.deepEqual(add(fraction(1,3),fraction(1,6)),fraction(1,2));
  assert.equal(floor(fraction(-1,3)),-1);
  assert.ok(isFraction(JSON.parse(JSON.stringify(fraction(123456789123456789n,7n)))));
  assert.equal(isFraction({numerator:'2',denominator:'4'}),false);
  assert.throws(()=>fraction(1,0));
});
test('first teaching freezes the world and accepts only the prescribed drag', () => {
  const b=createBattle('L01',{id:'intro'}), before=JSON.stringify(b);
  advanceBattle(b,30000); assert.equal(JSON.stringify(b),before);
  assert.deepEqual(b.camps.map(c=>c.garrison),[24,6,8]);assert.equal(b.gameMs,0);
  const rejected=applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:'L01-P1',targetId:'L01-E1'});assert.equal(rejected.ok,false);if(!rejected.ok)assert.equal(rejected.reason,'请先拖到提示的营地');assert.equal(JSON.stringify(b),before);
  const a=dispatch(b,camp(b,'P1'),camp(b,'N1'));
  assert.equal(a.initialCount,12); assert.equal(a.arrivalAtMs,5209); assert.equal(camp(b,'P1').garrison,12);
  advanceBattle(b,a.arrivalAtMs); assert.equal(camp(b,'N1').owner,'P'); assert.equal(camp(b,'N1').garrison,6);
});
test('production is invariant under frame partitioning and JSON restore', () => {
  const a=createBattle('L03',{id:'exact'}), z=structuredClone(a);
  advanceBattle(a,10000);
  for(let t=17;t<10000;t+=17) advanceBattle(z,t);
  const restored=JSON.parse(JSON.stringify(z)); advanceBattle(restored,10000);
  assert.deepEqual(restored,a);
  assert.equal(camp(a,'P1').garrison,39); assert.deepEqual(camp(a,'P1').credit,fraction(7,10));
});
test('full camp discards production credit and starts fresh after dispatch', () => {
  const b=createBattle('L01',{id:'cap',firstDragCompleted:true}), c=camp(b,'P1'); c.garrison=49;
  advanceBattle(b,10000); assert.equal(c.garrison,50); assert.deepEqual(c.credit,ZERO);
  advanceBattle(b,20000);assert.equal(c.garrison,50);assert.deepEqual(c.credit,ZERO);
  dispatch(b,c,camp(b,'N1')); advanceBattle(b,21111); assert.equal(c.garrison,25);
  advanceBattle(b,21112); assert.equal(c.garrison,26);
});
test('half dispatch and action deduplication never subtract twice', () => {
  const b=fixture(), c=camp(b,'P1');c.garrison=21;
  dispatch(b,c,camp(b,'N1')); assert.equal(c.garrison,11);
  const before=JSON.stringify(b);
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:c.id,targetId:camp(b,'N2').id}).ok,false);
  assert.equal(JSON.stringify(b),before);
  c.garrison=1; assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:c.id,targetId:camp(b,'N2').id}).ok,false);
});
test('archer shoots once for floor(30%) then captures with the actual survivors', () => {
  const b=fixture(), source=camp(b,'P2'), target=camp(b,'N2'); source.garrison=20;target.garrison=12;
  const a=dispatch(b,source,target); advanceBattle(b,a.volleyCheckAtMs!);
  assert.equal(target.garrison,9); assert.equal(target.owner,null); assert.equal(a.remainingCount,10); assert.equal(a.volleyState,'fired');
  advanceBattle(b,a.arrivalAtMs);assert.equal(target.owner,'P');assert.equal(target.garrison,1);
  const next=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:target.id,targetId:source.id});assert.equal(next.ok,false);
  target.garrison=2;const converted=dispatch(b,target,source,3);assert.equal(converted.troopType,'cavalry');assert.equal(converted.volleyState,null);
});
test('volley clearing the garrison does not capture before arrival', () => {
  const b=fixture(), source=camp(b,'P2'), target=camp(b,'N2');source.garrison=20;target.garrison=2;
  const a=dispatch(b,source,target);advanceBattle(b,a.volleyCheckAtMs!);
  assert.equal(target.garrison,0);assert.equal(target.owner,null);assert.equal(b.status,'running');
  advanceBattle(b,a.arrivalAtMs);assert.equal(target.owner,'P');assert.equal(target.garrison,10);
});
for (const reason of ['friendly','empty','zeroDamage'] as const) test(`volley ${reason} consumes opportunity across save and target changes`, () => {
  const b=fixture(), source=camp(b,'P2'), target=camp(b,'N2');source.garrison=reason==='zeroDamage'?6:20;
  if(reason==='friendly')target.owner='P'; if(reason==='empty')target.garrison=0;
  const a=dispatch(b,source,target);advanceBattle(b,a.volleyCheckAtMs!);assert.equal(a.volleySkipReason,reason);
  target.owner='E';target.garrison=20;
  const restored=JSON.parse(JSON.stringify(b));const later=advanceBattle(restored,a.arrivalAtMs-1);
  assert.equal(later.filter(e=>e.type==='volley').length,0);assert.equal(camp(restored,'N2').garrison,20);
  const arrival=advanceBattle(restored,a.arrivalAtMs);assert.equal(arrival.some(e=>e.type==='volley'),false);assert.equal(camp(restored,'N2').owner,'E');assert.equal(camp(restored,'N2').garrison,20-a.remainingCount);
});
test('tower damage precedes simultaneous volley and uses the reduced count', () => {
  const b=fixture(), source=camp(b,'P2'), target=camp(b,'N2');source.garrison=20;target.garrison=12;target.owner='E';target.type='fort';target.feintUntil=0;
  target.x=source.x-100;target.y=source.y;
  const a=dispatch(b,source,target);target.nextShotAtMs=a.volleyCheckAtMs;
  const before={troop:a.troopType,speed:a.speed,arrival:a.arrivalAtMs,check:a.volleyCheckAtMs};const events=advanceBattle(b,a.volleyCheckAtMs!);
  assert.equal(a.remainingCount,9);assert.equal(target.garrison,10);assert.equal(events.find(e=>e.type==='volley')!.amount,2);
  assert.ok(events.findIndex(e=>e.type==='tower-shot')<events.findIndex(e=>e.type==='volley'));
  assert.deepEqual({troop:a.troopType,speed:a.speed,arrival:a.arrivalAtMs,check:a.volleyCheckAtMs},before);
});
test('tower killing the last archer cancels both volley and arrival', () => {
  const b=fixture(), source=camp(b,'P2'), target=camp(b,'N2');source.garrison=2;target.owner='E';target.type='fort';target.feintUntil=0;
  const a=dispatch(b,source,target);target.nextShotAtMs=a.volleyCheckAtMs;
  const events=advanceBattle(b,a.arrivalAtMs);assert.equal(b.armies.length,0);assert.equal(events.some(e=>e.type==='volley'||e.type==='arrival'),false);
});
test('simultaneous archer hits are independently rounded and clipped after aggregation', () => {
  const b=fixture(), target=camp(b,'N1');target.garrison=5;
  for(const f of ['P','E'] as const){const a=incoming(b,target,f,10,2000);a.troopType='archer';a.volleyState='pending';a.volleyCheckAtMs=1000;}
  const reversed=structuredClone(b);reversed.armies.reverse();
  const ev=advanceBattle(b,1000), rz=advanceBattle(reversed,1000);
  assert.equal(target.garrison,0);assert.equal(camp(reversed,'N1').garrison,0);assert.equal(ev.filter(e=>e.type==='volley').length,2);assert.equal(rz.filter(e=>e.type==='volley').length,2);
});
test('simultaneous arrivals combine defenders before final capacity clipping', () => {
  const b=fixture(),target=camp(b,'P2');target.garrison=45;
  incoming(b,target,'P',20);incoming(b,target,'E',10);advanceBattle(b,1000);
  assert.equal(target.owner,'P');assert.equal(target.garrison,50);
});
test('multi-faction majority rule and equality preserve the old owner', () => {
  const b=createBattle('A01',{id:'multi'});for(const c of b.camps)c.feintUntil=10000;
  const target=camp(b,'N1');target.garrison=4;
  incoming(b,target,'P',12);incoming(b,target,'E1',5);incoming(b,target,'E2',3);advanceBattle(b,1000);
  assert.equal(target.owner,null);assert.equal(target.garrison,0);
});
test('same-time last-camp exchange survives, one millisecond later does not', () => {
  for(const delay of [0,1]){
    const b=createBattle('L01',{id:'exchange',firstDragCompleted:true}),p=camp(b,'P1'),e=camp(b,'E1');
    p.garrison=0;e.garrison=0;p.feintUntil=10000;e.feintUntil=10000;
    incoming(b,p,'E',10,5000);incoming(b,e,'P',10,5000+delay);advanceBattle(b,5001);
    if(delay===0){assert.equal(b.status,'running');assert.equal(p.owner,'E');assert.equal(e.owner,'P');}
    else{assert.equal(b.status,'finished');assert.equal(b.result!.independentWinner,'E');assert.equal(b.result!.playerRank,2);assert.equal(b.gameMs,5000);assert.equal(b.armies.length,0);assert.equal(e.owner,'E');}
  }
});
test('upgrade preserves credit, active effects and already scheduled tower shot', () => {
  const b=createBattle('A03',{id:'upgrade'}),c=camp(b,'P1');c.garrison=70;c.credit=fraction(1,3);c.mobilizeUntil=6000;c.bonusBudget=fraction(8);
  assert.equal(applyBattleAction(b,{kind:'upgrade',sequence:1,faction:'P',targetId:c.id}).ok,true);
  assert.equal(c.tier,3);assert.equal(c.garrison,45);assert.equal(c.nextShotAtMs,1700);assert.deepEqual(c.credit,fraction(1,3));assert.equal(c.mobilizeUntil,6000);
  advanceBattle(b,1700);assert.equal(c.nextShotAtMs,3200);
});
test('march cannot consume a card when the one-second minimum negates it', () => {
  const b=fixture(),source=camp(b,'P1'),target=camp(b,'N1');target.x=source.x+60;target.y=source.y;factionOf(b,'P')!.inventory.march=1;
  const before=JSON.stringify(b);const r=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id,march:true});
  assert.equal(r.ok,false);assert.equal(JSON.stringify(b),before);
});
test('strategy inventory, stacked budget and suppression follow common rules', () => {
  const b=createBattle('A01',{id:'cards',inventory:{...emptyInventory(),mobilize:2,supply:1,feint:1}}),c=camp(b,'P1');
  for(const sequence of [1,2])assert.equal(applyBattleAction(b,{kind:'card',cardId:'mobilize',targetId:c.id,faction:'P',sequence}).ok,true);
  assert.equal(c.mobilizeUntil,12000);assert.deepEqual(c.bonusBudget,fraction(16));
  advanceBattle(b,10000);assert.equal(c.garrison,38);assert.deepEqual(c.bonusBudget,fraction(7));
  const enemy=camp(b,'E1');const n=enemy.garrison;
  assert.equal(applyBattleAction(b,{kind:'card',cardId:'feint',targetId:enemy.id,faction:'P',sequence:3}).ok,true);
  advanceBattle(b,14000);assert.equal(enemy.garrison,n);
});
test('passive curve stays diminishing, and capacity does not invent a level cap', () => {
  assert.deepEqual(passiveBonus(20,1),fraction(1,25));assert.ok(compare(passiveBonus(20,1000),fraction(1,5))<0);
  const b=fixture(),f=factionOf(b,'P')!,c=camp(b,'P2');f.passives.fortification=Number.MAX_SAFE_INTEGER;
  assert.equal(campCapacity(c,f),59);f.passives.logistics=Number.MAX_SAFE_INTEGER;assert.ok(troopSpeed(c,f)<92.000001);
});
test('N37: zero, one, three, ten and one hundred passive layers retain exact rates and integer capacity steps',()=>{
  const b=createBattle('A01',{id:'passive-values'}),f=factionOf(b,'P')!,c=b.camps[0]!;
  for(const [layers,numerator,denominator,capacities,rateN,rateD]of [[0,0,1,[50,90,140],6,5],[1,1,25,[52,93,145],156,125],[3,3,35,[54,97,152],228,175],[10,1,7,[57,102,160],48,35],[100,5,26,[59,107,166],93,65]] as const){
    assert.deepEqual(passiveBonus(20,layers),fraction(numerator,denominator));f.passives.farming=layers;f.passives.fortification=layers;c.tier=1;assert.deepEqual(naturalRate(c,f,0),fraction(rateN,rateD));
    for(const tier of [1,2,3] as const){c.tier=tier;assert.equal(campCapacity(c,f),capacities[tier-1]);}
  }
  let last=ZERO,previousGain=fraction(1);
  for(let layers=1;layers<=101;layers++){const bonus=passiveBonus(20,layers),gain=subtract(bonus,last);assert.ok(compare(gain,ZERO)>0);assert.ok(compare(gain,previousGain)<0);assert.ok(compare(bonus,fraction(1,5))<0);last=bonus;previousGain=gain;}
  c.tier=1;f.passives.fortification=100;const capacity=campCapacity(c,f);f.passives.fortification=101;assert.equal(campCapacity(c,f),capacity,'a positive fractional gain need not add a whole capacity unit');
});
test('deadline uses camps then all remaining troops and retains tied first', () => {
  const b=createBattle('A01',{id:'deadline'});for(const c of b.camps)c.feintUntil=300000;
  advanceBattle(b,240000);assert.equal(b.result!.playerRank,1);assert.equal(b.result!.independentWinner,null);assert.equal(b.status,'finished');
  assert.deepEqual(Object.values(b.result!.ranks),[1,1,1,1]);
  assert.equal(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:'A01-P1'}).ok,false);
});
test('paused battle freezes events and rejects mutations', () => {
  const b=fixture();dispatch(b,camp(b,'P2'),camp(b,'N2'));b.status='paused';const before=JSON.stringify(b);
  advanceBattle(b,10000);assert.equal(JSON.stringify(b),before);assert.throws(()=>advanceBattle(b,-1));assert.throws(()=>advanceBattle(b,1.5));
});
