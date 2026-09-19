import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameSession } from '../src/app/session.ts';
import type { Page } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { freshProfile, CARD_IDS, CARDS } from '../src/core/progress.ts';
import { advanceBattle, applyBattleAction, createBattle } from '../src/core/battle.ts';
import { COLORS, arrivalAccent, cardAccent, soldier } from '../src/render/art.ts';
import { armyPosition, distance } from '../src/core/geometry.ts';
import { dispatchPreview } from '../src/render/battle-presentation.ts';
import { SLOT_KEYS } from '../src/app/storage.ts';
import { asNumber, fraction } from '../src/core/fraction.ts';
import { CAMP_CONFIG, TIER_RATE, campCapacity, productionRate } from '../src/core/config.ts';
import { createStatePressure } from './pressure-fixture.ts';
import { createMixedPressure } from './mixed-pressure-fixture.ts';
import { createLastCampNotice } from './notice-fixtures.ts';
import { validateBattle } from '../src/app/validation.ts';

const NOW=Date.parse('2026-09-10T12:00:00+08:00');
// Army budgets concern the battlefield. Static troops painted inside order cards
// must still render, but are not marching heads, tails or recruitment effects.
function battlefieldAudit(view:GameView):()=>boolean{
  const subject=view as unknown as {battleCards:(y:number)=>void},draw=subject.battleCards.bind(view);let orders=false;
  subject.battleCards=y=>{orders=true;try{draw(y);}finally{orders=false;}};
  return()=>!orders;
}
test('H02: preparation shows four compact active cards while the full library returns without consuming or starting at all three sizes',async()=>{
  const {s,v,d,data}=harness();await s.load();const p=s.profile!;
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:3,march:2,supply:1,feint:0};p.passiveLevels={farming:4,logistics:5,fortification:6};
  const expected=[['mobilize','鸣鼓征兵','征兵'],['march','倍道兼行','兼行'],['supply','征召乡勇','乡勇'],['feint','火袭粮营','火袭'],['farming','屯田积谷','屯田'],['logistics','兵贵神速','神速'],['fortification','扩营增垒','扩营']] as const;
  assert.deepEqual(CARD_IDS,expected.map(([id])=>id));for(const [id,name,short]of expected){assert.equal(CARDS[id].name,name);assert.equal(CARDS[id].short,short);}
  const before=JSON.stringify(p),bytes=[...data];
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    s.page='prepare';v.viewport={width:width!,height:height!,top:16,bottom:12};d.labels.length=0;d.statuses.length=0;v.draw(0);
    for(const [,,short]of expected.slice(0,4))assert.ok(d.labels.includes(short),`preparation missing ${short}`);assert.ok(!d.labels.some(t=>t.includes('电脑各有乡勇')));
    const start=v.regions.find(r=>r.id==='start-arena')!;assert.ok(start.h>=44&&start.y+start.h<=height!-12);
    v.wheel(10000);v.draw(1);const details=v.regions.find(r=>r.id==='prepare-library')!;assert.ok(details&&details.h>=44);assert.ok(details.y+details.h<=start.y-8);
    details.run();await idle(s);assert.equal(s.page,'library');assert.equal(s.returnPage,'prepare');d.labels.length=0;d.statuses.length=0;v.draw(2);
    for(const [,name]of expected)assert.ok(d.labels.includes(name));
    v.regions.find(r=>r.id==='back')!.run();v.draw(3);assert.equal(s.page,'prepare');assert.equal(s.match,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});
test('H02: all seven choice names and four battle short labels retain their canonical card IDs',async()=>{
  const {s,v,d}=await readyCards();v.draw(0);
  for(const id of ['mobilize','march','supply','feint'] as const){const r=v.regions.find(r=>r.id===`card-${id}`)!;assert.ok(r.label.startsWith(CARDS[id].short));r.run();assert.equal(v.card,id);v.cancel();}
  const p=s.profile!,before=JSON.stringify(s.match);
  // Display-only candidate batches exercise all seven identities; reward transactions have separate tests.
  s.page='choice';
  for(let i=0;i<CARD_IDS.length;i+=3){
    const candidateIds=CARD_IDS.slice(i,i+3);p.choice={choiceId:`display-${i}`,matchId:'display',kind:'mixed',grantQuantity:1,candidateIds,unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
    v.viewport={width:430,height:932,top:16,bottom:12};d.labels.length=0;d.statuses.length=0;v.draw(i);
    for(const id of candidateIds){assert.ok(d.labels.includes(CARDS[id].name));v.regions.find(r=>r.id===`choice-${id}`)!.run();assert.equal(v.selectedChoice,id);v.draw(i);}
  }
  assert.equal(JSON.stringify(s.match),before);
});
for(const id of ['farming','logistics','fortification'] as const)for(const reduced of [false,true])test(`G4.2: ${id} claimed summary is immediate, bounded and cannot replay in reduced motion ${reduced}`,async()=>{
  const {s,v,d,data}=harness();await s.load();const p=s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.passiveLevels[id]=4;p.settings.reducedMotion=reduced;
  p.choice={choiceId:'shown-once',matchId:'display',kind:'mixed',grantQuantity:1,candidateIds:[id],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'claimed',selected:id};
  const event={kind:'passive-claim' as const,choiceId:'shown-once',cardId:id,before:3,after:4};
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const draw=drawing(),view=new GameView(draw.ctx,s);view.viewport={width:width!,height:height!,top:16,bottom:12};view.draw(0);view.present(event);
    const before=JSON.stringify(s.profile),bytes=[...data];view.draw(100);
    assert.ok(draw.labels.includes(CARDS[id].name));assert.ok(draw.labels.includes('层数 3 → 4'));
    assert.ok(draw.labels.some(l=>l.includes(id==='logistics'?'6.43% → +7.50%':'8.57% → +10.00%')));
    if(id==='fortification')assert.ok(draw.labels.includes('一级容量 54 → 55'));
    assert.ok(view.regions.some(r=>r.id==='primary'&&r.h>=44));view.present(event);view.draw(349);view.draw(350);
    assert.equal((view as unknown as {passiveReward:{started:number}}).passiveReward.started,100);
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);view.cancel();view.present(event);draw.labels.length=0;view.draw(351);assert.ok(!draw.labels.includes('层数 3 → 4'));
  }
  v.draw(0);v.present(event);await s.load();d.labels.length=0;d.statuses.length=0;v.draw(1);assert.ok(!d.labels.includes('层数 3 → 4'));
});
for(const reduced of [false,true])test(`G4.2: passive bonuses are absent from the battle and readable in pause without changing their snapshot in reduced motion ${reduced}`,async()=>{
  const {s,v,d,data}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.passiveLevels={farming:4,logistics:4,fortification:4};s.profile!.settings.reducedMotion=reduced;
  await s.start('A01');v.draw(100);const before=JSON.stringify(s.profile),bytes=[...data];
  assert.ok(!d.labels.some(text=>/屯田|神速|扩营|10.00%|7.50%/.test(text)));
  assert.ok(!v.regions.some(r=>r.id==='army-list'));assert.equal(v.regions.filter(r=>r.id.startsWith('card-')).length,4);
  v.present({kind:'passive-start',matchId:s.match!.battle.id});v.draw(299);v.draw(300);
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  await s.pause();d.labels.length=0;d.statuses.length=0;v.draw(301);v.wheel(10000);v.draw(302);v.regions.find(r=>r.id==='pause-details')!.run();v.draw(303);v.wheel(10000);v.draw(304);
  for(const text of ['屯田 4 层 · 产兵 +10.00%','神速 4 层 · 移速 +7.50%','扩营 4 层 · 容量 +10.00%'])assert.ok(d.labels.includes(text),text);
  const paused=JSON.stringify(s.profile),saved=[...data];s.tick(10000);v.draw(10000);assert.equal(JSON.stringify(s.profile),paused);assert.deepEqual([...data],saved);
  await s.resume();v.draw(303);assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);assert.equal(s.match!.battle.armies.length,1);assert.equal(s.match!.battle.gameMs,0);
  await s.load();await s.resume();d.labels.length=0;d.statuses.length=0;v.draw(304);assert.ok(!d.labels.some(text=>/屯田|神速|扩营/.test(text)));
});
test('U07: ordinary text palette pairs retain at least 4.5 to 1 contrast',()=>{
  const luminance=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
  for(const [background,foreground]of [[COLORS.paper,COLORS.ink],[COLORS.surface,COLORS.ink],[COLORS.paper,COLORS.muted],[COLORS.surface,COLORS.muted],[COLORS.enemy2,COLORS.ink],[COLORS.neutral,COLORS.ink],[COLORS.player,'#FFFFFF'],[COLORS.enemy1,'#FFFFFF'],[COLORS.enemy3,'#FFFFFF']]){
    const a=luminance(background!),b=luminance(foreground!);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${background}/${foreground} loses text contrast`);
  }
});
function drawing(){
  let depth=0;const states:Record<string,unknown>[]=[];const statuses:{text:string;color:unknown}[]=[],labels:string[]=[],strokes:{width:unknown;alpha:unknown;color:unknown}[]=[],scales:number[]=[];const c:Record<string,unknown>={font:'16px sans-serif',globalAlpha:1,lineWidth:1,createLinearGradient:()=>({addColorStop:()=>{}}),createRadialGradient:()=>({addColorStop:()=>{}}),save:()=>{states.push({...c});depth++;},restore:()=>{assert.ok(depth>0);const state=states.pop()!;for(const key of Object.keys(c))if(!(key in state))delete c[key];Object.assign(c,state);depth--;},stroke:()=>strokes.push({width:c.lineWidth,alpha:c.globalAlpha,color:c.strokeStyle}),scale:(x:number)=>scales.push(x),fillText:(s:string)=>{labels.push(s);if(String(c.font).startsWith('600 11px')&&/^(?:尽·)?[0-9.]+s$/.test(s))statuses.push({text:s,color:c.fillStyle});},measureText:(s:string)=>({width:[...s].reduce((n,char)=>n+(/[^\x00-\x7F]/.test(char)?1:.55),0)*(parseFloat(String(c.font).match(/(\d+)px/)?.[1]??'16'))})};
  const ctx=new Proxy(c,{get:(obj,key)=>key in obj?obj[String(key)]:(...args:unknown[])=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));}}) as unknown as CanvasRenderingContext2D;
  return {ctx,labels,statuses,strokes,scales,depth:()=>depth};
}
function harness(feedback=false){
  const data=new Map<string,string>();let now=NOW;const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){data.set(k,v);},async remove(k){data.delete(k);}},now:()=>now,random:()=>.4,notify:()=>{},events:events=>{if(feedback)v.events(events);},present:event=>{if(feedback)v.present(event);}});
  const d=drawing(),v=new GameView(d.ctx,s);return {s,v,d,data,setTime:(time:number)=>{now=time;}};
}
function campPoint(v:GameView,s:GameSession,id:string):[number,number]{const c=s.match!.battle.camps.find(c=>c.id===id)!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board;return [board.x+c.x*board.k,board.y+c.y*board.k];}
test('camp touch: upper tower body, third-tier roof and wide building edge can begin an authoritative dispatch',async()=>{
  for(const [type,tier,width,height,dx,dy]of [['fort',1,375,812,0,-35],['barracks',3,375,812,0,-30],['barracks',3,430,932,35,0],['fort',3,320,568,0,-30]] as const){
    const {s,v}=await readyCards();
    const source=s.match!.battle.camps.find(c=>c.id===(type==='fort'?'A01-N5':'A01-P1'))!;source.owner='P';source.tier=tier;source.garrison=30;if(type==='fort')source.nextShotAtMs=1000;
    v.viewport={width,height,top:16,bottom:12};v.draw(0);const [x,y]=campPoint(v,s,source.id),target=campPoint(v,s,'A01-N4');
    v.down(1,x+dx,y+dy);assert.equal((v as unknown as {gesture:{source:string|null}}).gesture.source,source.id);v.move(1,...target);v.up(1,...target);await idle(s);
    assert.equal(s.match!.battle.armies.length,1,`${type} tier ${tier} at ${width}: visible upper/side body starts dispatch; ${s.error}`);
    assert.equal(s.match!.battle.armies[0]!.sourceId,source.id);assert.equal(s.match!.battle.camps.find(c=>c.id===source.id)!.garrison,15);assert.equal(v.selected,null);
  }
});
test('camp touch: dragging from beyond the building cannot turn its destination into a tap, while direct taps still query',async()=>{
  const {s,v}=harness();await s.load();s.profile!.firstDragCompleted=true;await s.start('L01');v.viewport={width:375,height:812,top:16,bottom:12};v.draw(0);
  const [x,y]=campPoint(v,s,'L01-P1'),target=campPoint(v,s,'L01-N1'),before=JSON.stringify(s.match);
  for(const [dx,dy]of [[44,0],[0,-49],[0,40]]){
    v.down(1,x+dx!,y+dy!);v.move(1,...target);v.up(1,...target);await idle(s);assert.equal(v.selected,null,'blank-origin drag does not open destination details');assert.equal(JSON.stringify(s.match),before);
  }
  v.down(1,...target);v.up(1,...target);assert.equal(v.selected,'L01-N1','a real tap still selects the camp');
});
// Rendering fixture only: the public detailed-query entry is covered by the paused army-list tests.
function renderCampDetailsFixture(v:GameView):void {v.draw(0);(v as unknown as {campDetailsOpen:boolean}).campDetailsOpen=true;v.draw(0);assert.ok(v.regions.some(r=>r.id==='camp-details'));}

for(const [width,height]of [[320,568],[375,812],[430,932]])test(`camp metrics ${width}: only actual production and capacity appear, while eligible eave upgrades remain available`,async()=>{
  const {s,v,d,data}=await readyCards();v.viewport={width:width!,height:height!,top:16,bottom:12};
  for(const type of ['barracks','archery','relay','fort'] as const)for(const tier of [1,2] as const){
    const b=s.match!.battle,c=b.camps.find(c=>c.owner==='P')!,owner=b.factions.find(f=>f.id==='P')!;
    c.type=type;c.tier=tier;c.garrison=tier===1?29:69;owner.passives={farming:2,fortification:2,logistics:0};
    c.feintUntil=10000;v.draw(0);v.selected=c.id;d.labels.length=0;v.draw(1);
    const snapshot=JSON.stringify(s.profile),bytes=[...data],rate=asNumber(productionRate(b,{...c,feintUntil:0},owner,0));
    const next=tier===1?2:3;
    assert.ok(d.labels.includes('产兵 0.00 兵/秒'));assert.ok(d.labels.includes(`容量 ${campCapacity(c,owner)} 兵`));
    assert.ok(!d.labels.some(t=>/产兵↑|上限|耗\d+兵|需\d+|留\d+|己方|敌方|城池详情/.test(t)));
    assert.ok(!v.regions.some(r=>['upgrade','open-camp-details','camp-details'].includes(r.id)));
    assert.ok(!v.regions.some(r=>r.id===`upgrade-camp-${c.id}`),'below threshold has no clickable upgrade');
    assert.equal(JSON.stringify(s.profile),snapshot);assert.deepEqual([...data],bytes);
    assert.ok(v.regions.every(r=>r.w>=44&&r.h>=44&&r.y+r.h<=height!-12));
    c.garrison++;d.labels.length=0;v.draw(2);
    const button=v.regions.find(r=>r.id===`upgrade-camp-${c.id}`)!;assert.ok(button);assert.ok(button.label.includes(`消耗 ${tier===1?10:25} 兵`));
    const surface=v.regions.find(r=>r.id==='camp-surface')!;
    assert.ok(surface.x+surface.w<=button.x||button.x+button.w<=surface.x||surface.y+surface.h<=button.y||button.y+button.h<=surface.y,'metrics never cover the eave upgrade touch target');
    renderCampDetailsFixture(v);for(let i=0;i<12;i++){v.regions.find(r=>r.id==='camp-details')!.run();v.draw(i+3);}
    assert.ok(d.labels.includes(`自然产速 ${rate.toFixed(2)} → ${(rate*asNumber(TIER_RATE[next])/asNumber(TIER_RATE[tier])).toFixed(2)}/秒`),'military detail fixture retains exact natural rates during suppression');
    assert.ok(d.labels.includes('停产剩 10.0 秒'));
    assert.ok(d.labels.some(t=>t.startsWith('产速：基础 ')&&t.endsWith('→ 0.00/秒')));v.escape();v.draw(20);
  }
});

test('camp metrics: actual rate accounts for revision, passives, mobilization budget, suppression, capacity and neutral ownership without writes',async()=>{
  for(const revision of ['1.5','1.6'] as const)for(const state of ['normal','mobilized','exhausted','expired','suppressed','full','neutral'] as const){
    const {s,v,d,data}=await readyCards(),b=s.match!.battle,c=b.camps.find(c=>c.id==='A01-P1')!,owner=b.factions.find(f=>f.id==='P')!;
    b.ruleRevision=revision;owner.passives={farming:2,fortification:2,logistics:0};c.garrison=20;c.mobilizeUntil=state==='expired'?0:6000;c.bonusBudget=fraction(state==='exhausted'||state==='normal'?0:8);c.feintUntil=state==='suppressed'?4000:0;
    if(state==='full')c.garrison=53;if(state==='neutral')c.owner=null;
    v.draw(0);v.selected=c.id;d.labels.length=0;const before=JSON.stringify(s.profile),bytes=[...data];v.draw(1);
    const base=revision==='1.5'?1.28:.96,rate=['suppressed','full','neutral'].includes(state)?0:base*(state==='mobilized'?2:1);
    assert.ok(d.labels.includes(`产兵 ${rate.toFixed(2)} 兵/秒`),`${revision}/${state}: ${d.labels.join(' | ')}`);
    assert.ok(d.labels.includes(`容量 ${state==='neutral'?50:53} 兵`));assert.ok(!v.regions.some(r=>['upgrade','open-camp-details','camp-details'].includes(r.id)));
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});

test('quick upgrade: repeated taps submit once, return to the map after saving, and never reuse a previous tier price',async()=>{
  const {s,v,d,data}=await readyCards();const c=s.match!.battle.camps.find(c=>c.owner==='P')!;c.garrison=50;
  v.draw(0);v.selected=c.id;v.draw(1);const click=v.regions.find(r=>r.id===`upgrade-camp-${c.id}`)!.run;
  click();click();await idle(s);v.draw(2);
  const upgraded=s.match!.battle.camps.find(camp=>camp.id===c.id)!;
  assert.equal(upgraded.tier,2);assert.equal(upgraded.garrison,40);assert.equal(s.match!.battle.factions.find(f=>f.id==='P')!.lastActionSequence,1);
  assert.equal(v.selected,null);assert.equal(v.regions.filter(r=>r.id.startsWith('card-')).length,4);assert.ok(d.labels.includes('已升至二级'));
  upgraded.garrison=70;v.selected=c.id;v.draw(3);const before=JSON.stringify(s.profile),bytes=[...data];click();await idle(s);
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});

test('quick upgrade: the entire operation card blocks map gestures and dragging a city dismisses it without dispatching early',async()=>{
  const {s,v,data}=await readyCards();const c=s.match!.battle.camps.find(c=>c.owner==='P')!;c.garrison=30;v.draw(0);v.selected=c.id;v.draw(1);
  const surface=v.regions.find(r=>r.id==='camp-surface')!,before=JSON.stringify(s.profile),bytes=[...data],target=campPoint(v,s,'A01-N2');
  v.down(1,surface.x+10,surface.y+surface.h/2);v.move(1,...target);v.up(1,...target);await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  const source=campPoint(v,s,c.id);v.down(2,...source);v.move(2,...target);v.draw(2);assert.equal(v.selected,null);assert.ok(!v.regions.some(r=>r.id==='camp-surface'));
  assert.equal(JSON.stringify(s.profile),before);v.up(2,...target);await idle(s);v.draw(3);assert.equal(s.match!.battle.armies.length,1);assert.equal(v.regions.filter(r=>r.id.startsWith('card-')).length,4);
});

test('quick upgrade: failed storage produces no success message or extra cost',async()=>{
  const data=new Map<string,string>();let fail=false;const d=drawing();let v:GameView;
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,value){if(fail)throw new Error('write blocked');data.set(k,value);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>.4,notify:()=>{},events:e=>v.events(e)});
  v=new GameView(d.ctx,s);await s.load();s.profile!.firstDragCompleted=true;await s.start('L01');s.match!.battle.camps[0]!.garrison=30;
  v.draw(0);v.selected=s.match!.battle.camps[0]!.id;v.draw(1);const bytes=[...data];fail=true;v.regions.find(r=>r.id===`upgrade-camp-${s.match!.battle.camps[0]!.id}`)!.run();await idle(s);d.labels.length=0;v.draw(2);
  assert.equal(s.match!.battle.camps[0]!.tier,1);assert.equal(s.match!.battle.camps[0]!.garrison,30);assert.equal(s.page,'recovery');assert.deepEqual([...data],bytes);assert.ok(!d.labels.some(t=>t.startsWith('已升至')));
});
async function openArmyList(s:GameSession,v:GameView):Promise<void>{
  if(s.page!=='pause'){await s.pause();v.draw(0);}v.wheel(10000);v.draw(0);
  if(!v.regions.some(r=>r.id==='army-list')){v.regions.find(r=>r.id==='pause-details')!.run();v.draw(0);v.wheel(10000);v.draw(0);}
  const entry=v.regions.find(r=>r.id==='army-list')!;assert.ok(entry&&entry.h>=44);entry.run();v.draw(0);
}
function departureDrawing(d:ReturnType<typeof drawing>){
  const turns:number[]=[],dust:{x:number;y:number;r:number}[]=[];let flags=0;
  let afterTranslation=false,flagScale=false,pendingTurn:number|undefined;const translate=d.ctx.translate.bind(d.ctx),scale=d.ctx.scale.bind(d.ctx);
  d.ctx.translate=(x,y)=>{afterTranslation=true;translate(x,y);};
  d.ctx.scale=(x,y)=>{flagScale=x===6&&y===6;afterTranslation=false;if(!flagScale)pendingTurn=undefined;scale(x,y);};
  // A diagonal road also rotates its trail. Count only rotations consumed by the six-pixel source flag.
  d.ctx.rotate=angle=>{pendingTurn=afterTranslation&&angle>=0&&angle<=Math.PI/18?angle:undefined;};
  d.ctx.arc=(x,y,r)=>{if(d.ctx.fillStyle===COLORS.muted&&r<=2&&d.ctx.globalAlpha<1)dust.push({x,y,r});};
  d.ctx.moveTo=(x,y)=>{if(flagScale&&x===-.82&&y===-.85&&d.ctx.fillStyle===COLORS.player&&d.ctx.lineWidth===.12){flags++;if(pendingTurn!==undefined)turns.push(pendingTurn);}pendingTurn=undefined;};
  return {turns,dust,flags:()=>flags,clear:()=>{turns.length=0;dust.length=0;flags=0;}};
}
test('F02: committed departures keep camps flag-free and spread two dust dots for 450 game milliseconds at every size',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true])for(const count of [1,40,41,256]){
    const {s,v,d}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];
    await s.start('A01');s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);
    const battle=s.match!.battle,source=battle.camps.find(c=>c.id==='A01-P1')!;
    for(let i=0;i<count;i++){source.garrison=2;const result=applyBattleAction(battle,{kind:'dispatch',faction:'P',sequence:i+1,sourceId:source.id,targetId:'A01-N4'});assert.equal(result.ok,true);v.events(result.events);}
    const paint=departureDrawing(d),animated=!reduced&&count<=40;
    for(const at of [0,80,300,449,450]){
      v.events(advanceBattle(battle,at));paint.clear();const before=JSON.stringify(s.profile);v.draw(5000+at);
      const active=animated&&at<450;assert.equal(paint.dust.length,active?2:0,`${width}/${count}/${reduced}/${at} departure dust`);
      assert.equal(paint.turns.length,0);assert.equal(paint.flags(),0,'camp ownership uses architecture colour without a stationary or animated flag');
      const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,p={x:board.x+source.x*board.k,y:board.y+source.y*board.k};
      for(const dot of paint.dust){assert.ok(Math.abs(dot.x-p.x)<=42&&Math.abs(dot.y-p.y)<=8,'dust stays beside its source');assert.ok(dot.y+dot.r<p.y+9,'dust does not cover the garrison badge');assert.ok(dot.y-dot.r>p.y-32,'dust stays below persistent status rows');}
      assert.equal(JSON.stringify(s.profile),before);assert.equal(battle.armies.length,count);assert.equal(d.depth(),0);
    }
  }
});
test('F02: duplicate feedback and UI time cannot restart a departure, while restored saves show no departure accent',async()=>{
  const {s,v,d,data}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];await s.start('A01');v.draw(0);
  assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);
  const events=(v as unknown as {effects:{event:import('../src/core/types.ts').BattleEvent}[]}).effects.map(e=>e.event),paint=departureDrawing(d);
  s.tick(1);const start=armyPosition(s.match!.battle.armies[0]!,0);assert.ok(distance(start,armyPosition(s.match!.battle.armies[0]!,1))>0);
  s.tick(79);paint.clear();v.draw(80);assert.equal(paint.dust.length,2);const turns=[...paint.turns],before=JSON.stringify(s.profile),bytes=[...data];
  v.events(events);paint.clear();v.draw(50000);assert.deepEqual(paint.turns,turns);assert.equal(paint.dust.length,2);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  await s.pause();await s.resume();paint.clear();v.draw(60000);assert.deepEqual(paint.turns,turns,'pause does not restart or age the game-clock effect');
  await s.load();await s.resume();paint.clear();const restored=JSON.stringify(s.profile);v.draw(70000);assert.equal(paint.turns.length,0);assert.equal(paint.dust.length,0);assert.equal(JSON.stringify(s.profile),restored);assert.equal(s.match!.battle.armies.length,1);
});
test('F02: a source captured during the departure window loses its old flag motion without changing its new ownership',()=>{
  const {s,v,d}=harness();pageProfile(s);const b=s.profile!.activeMatch!.battle=createBattle('A01',{id:'departure-capture',ruleRevision:'1.5',firstDragCompleted:true});s.page='battle';
  b.camps.find(c=>c.id==='A01-N4')!.owner='P';b.camps.find(c=>c.id==='A01-E1')!.garrison=40;for(const f of b.factions)f.nextAiAtMs=10000;
  applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-E1',targetId:'A01-P1'});advanceBattle(b,2100);v.draw(0);
  const departure=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-E2'});assert.equal(departure.ok,true);v.events(departure.events);
  const paint=departureDrawing(d);advanceBattle(b,2140);v.draw(40);assert.equal(paint.dust.length,2);
  const arrived=advanceBattle(b,2175);assert.ok(arrived.some(e=>e.type==='capture'&&e.targetId==='A01-P1'));v.events(arrived);paint.clear();const before=JSON.stringify(b);v.draw(75);
  assert.equal(b.camps.find(c=>c.id==='A01-P1')!.owner,'E1');assert.equal(paint.turns.length,0);assert.equal(paint.dust.length,0);assert.equal(JSON.stringify(b),before);
});
test('F02: a rejected dispatch write cannot display source flag motion or dust before or after reload',async()=>{
  const {s,v,d,data}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];await s.start('A01');v.draw(0);
  const write=data.set.bind(data),before=[...data];data.set=()=>{throw new Error('test departure write failure');};
  assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),false);data.set=write;assert.deepEqual([...data],before);
  const paint=departureDrawing(d);v.draw(80);assert.equal(paint.dust.length,0);assert.equal(paint.turns.length,0);
  await s.load();await s.resume();paint.clear();v.draw(1000);assert.equal(s.match!.battle.armies.length,0);assert.equal(paint.dust.length,0);assert.equal(paint.turns.length,0);
});
async function idle(s:GameSession){for(let i=0;s.busy&&i<100;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}
function pressEscape(v:GameView,s:GameSession,repeat=false):void{
  const binding=readFileSync(new URL('../src/platform/browser.ts',import.meta.url),'utf8').match(/^window.addEventListener\('keydown'.*$/m)?.[0];assert.ok(binding);
  let handler:(event:{key:string;repeat:boolean;preventDefault:()=>void})=>void=()=>{throw new Error('No key binding');};
  // Exercise the shipped keyboard binding with the real view/session; only the event host is a fixture.
  new Function('window','view','session',binding)({addEventListener:(_name:string,callback:typeof handler)=>{handler=callback;}},v,s);
  handler({key:'Escape',repeat,preventDefault:()=>{}});
}
for(const signal of ['pagehide','visibilitychange'] as const)for(const input of ['supply','held-march'] as const)test(`S17: browser ${signal} clears ${input} before saving and stale release cannot dispatch after manual resume`,async()=>{
  const {s,v,data,point,setTime}=await readyCards();
  v.regions.find(r=>r.id===`card-${input==='supply'?'supply':'march'}`)!.run();
  if(input==='held-march'){v.down(17,...point('A01-P1'));v.move(17,...point('A01-N2'));}
  assert.equal(v.card,input==='supply'?'supply':'march');
  const before=structuredClone(s.match!.battle),inventory=structuredClone(s.profile!.activeInventory);
  const binding=readFileSync(new URL('../src/platform/browser.ts',import.meta.url),'utf8').split('\n').find(l=>l.startsWith(`${signal==='pagehide'?'window':'document'}.addEventListener('${signal}'`));assert.ok(binding);
  let handler:()=>void=()=>{throw new Error('lifecycle listener missing');};
  const host={hidden:true,addEventListener:(_event:string,callback:()=>void)=>{handler=callback;}};
  new Function('window','document','view','audio','session',`let last=0;${binding}`)(host,host,v,{suspend(){}},s);
  handler();assert.equal(v.card,null);assert.equal((v as unknown as {gesture:unknown}).gesture,null);
  await idle(s);assert.equal(s.page,'pause');
  setTime(NOW+60000);await s.load();v.draw(1);s.tick(2000);
  assert.equal(s.page,'pause');assert.deepEqual(s.match!.battle,{...before,status:'paused'});
  assert.deepEqual(s.profile!.activeInventory,inventory);
  await s.resume();v.draw(2);const profile=JSON.stringify(s.profile),bytes=[...data];
  v.up(17,...point('A01-N2'));await idle(s);
  assert.equal(v.card,null);assert.equal(JSON.stringify(s.profile),profile);assert.deepEqual([...data],bytes);
  assert.equal(s.match!.battle.armies.length,before.armies.length);
});
test('U05: an undersized window cancels held input and pauses before another simulation tick',async()=>{
  const {s,v,data,point}=await readyCards();v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point('A01-P1'));v.move(1,...point('A01-N2'));const gameMs=s.match!.battle.gameMs,inventory=s.profile!.activeInventory.march;
  v.viewport={width:200,height:300,top:16,bottom:12};assert.equal(s.page,'pause');s.tick(250);await idle(s);assert.equal(s.match!.battle.gameMs,gameMs);assert.equal(s.match!.battle.status,'paused');v.up(1,...point('A01-N2'));assert.equal(v.card,null);assert.equal(s.profile!.activeInventory.march,inventory);assert.equal(s.match!.battle.armies.length,0);
  v.draw(0);assert.equal(v.regions.length,0);v.draw(1);assert.equal(v.regions.length,0);
  v.viewport={width:375,height:812,top:16,bottom:12};v.draw(2);assert.equal(s.page,'pause');assert.equal(s.match!.battle.gameMs,gameMs);const before=JSON.stringify(s.profile),bytes=[...data];s.tick(250);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
test('U05: shrinking during an accepted new-match save preserves the match in pause',async()=>{
  const {s,v}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];const starting=s.start('A01');v.viewport={width:200,height:300,top:16,bottom:12};await starting;await idle(s);
  assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(s.match!.battle.gameMs,0);await s.load();assert.equal(s.page,'pause');
});
test('U05 R34: a resume control drawn for the old viewport cannot restart an undersized battle',async()=>{
  const {s,v,data}=await readyCards();await s.pause();v.draw(0);const oldResume=v.regions.find(r=>r.id==='resume')!.run,before=JSON.stringify(s.profile),bytes=[...data];
  v.viewport={width:200,height:300,top:16,bottom:12};oldResume();await idle(s);assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
test('U05: insufficient width, height or safe-area space leaves only a stable resize prompt on every page',async()=>{
  const {s,v,d}=harness();await s.load();
  for(const viewport of [{width:279,height:812,top:16,bottom:12},{width:375,height:421,top:16,bottom:12},{width:320,height:568,top:150,bottom:34}])for(const page of ['home','settings','recovery'] as const){
    s.page=page;v.viewport=viewport;d.labels.length=0;d.statuses.length=0;v.draw(0);assert.equal(v.regions.length,0);assert.ok(d.labels.join('').includes('请竖屏使用'));assert.equal(d.depth(),0);
  }
  s.page='home';v.viewport={width:280,height:508,top:16,bottom:12};v.draw(0);assert.ok(v.regions.some(r=>r.id==='primary'));
});
test('N17: drawing the tower range at three viewport scales cannot change boundary hits or battle state',async()=>{
  const {s,v,d}=harness();await s.load();await s.start('L03',true);const original=structuredClone(s.match!.battle),radii:number[]=[];d.ctx.arc=(_x,_y,r)=>{radii.push(r);};
  for(const range of [119.9,120,120.1]){
    const b=structuredClone(original),tower=b.camps.find(c=>c.id==='L03-P1')!,target=b.camps.find(c=>c.id==='L03-E1')!;
    for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;c.x=1000;c.y=1000;}
    Object.assign(tower,{type:'fort',x:80,y:220,feintUntil:0,nextShotAtMs:1000});Object.assign(target,{x:80+range,y:220,garrison:10});
    const before=JSON.stringify(b),scales=new Set<number>();let expected:string|undefined;
    for(const [width,height]of [[320,568],[375,812],[430,932]]){
      s.temporary!.battle=structuredClone(b);v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);v.selected=tower.id;radii.length=0;v.draw(0);
      const scale=(v as unknown as {board:{k:number}}).board.k;scales.add(scale);assert.ok(radii.some(r=>Math.abs(r-120*scale)<1e-8));assert.equal(JSON.stringify(s.match!.battle),before);
      const events=advanceBattle(s.match!.battle,1000),shots=events.filter(e=>e.type==='tower-shot');assert.equal(shots.length,range<=120?1:0);if(shots.length)assert.equal(shots[0]!.targetId,target.id);
      assert.equal(s.match!.battle.camps.find(c=>c.id===target.id)!.garrison,range<=120?9:10);const outcome=JSON.stringify({battle:s.match!.battle,events});if(expected)assert.equal(outcome,expected);else expected=outcome;
    }
    assert.equal(scales.size,3);
  }
});
test('U04: Escape on the home page cannot start a lesson or change the saved profile',async()=>{
  const {s,v,data}=harness();await s.load();v.draw(0);const before=JSON.stringify(s.profile),bytes=[...data];pressEscape(v,s);await idle(s);
  assert.equal(s.page,'home');assert.equal(s.match,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
test('U04: Escape pauses an accepted battle before its first rendered frame',async()=>{
  const {s,v}=harness();await s.load();v.draw(0);await s.start('L01');
  const id=s.match!.battle.id,gameMs=s.match!.battle.gameMs;assert.equal(s.page,'battle');
  pressEscape(v,s);await idle(s);assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(s.match!.battle.id,id);assert.equal(s.match!.battle.gameMs,gameMs);
  await s.load();assert.equal(s.page,'pause');assert.equal(s.match!.battle.id,id);
});
test('U04: Escape follows the settings and about return path without resuming a paused match',async()=>{
  const {s,v,data}=await readyCards();await s.pause();v.draw(0);v.regions.find(r=>r.id==='pause-settings')!.run();v.draw(0);v.regions.find(r=>r.id==='about')!.run();v.draw(0);
  const before=JSON.stringify(s.profile),bytes=[...data];pressEscape(v,s);await idle(s);assert.equal(s.page,'settings');v.draw(0);pressEscape(v,s);await idle(s);assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
test('U04: repeated Escape cannot dismiss a destructive confirmation; a fresh press only cancels it',async()=>{
  const {s,v,data}=harness();await s.load();v.draw(0);v.regions.find(r=>r.id==='settings')!.run();v.draw(0);v.regions.find(r=>r.id==='reset')!.run();v.draw(0);const modal=v.modal,before=JSON.stringify(s.profile),bytes=[...data];
  pressEscape(v,s,true);assert.equal(v.modal,modal);pressEscape(v,s);assert.equal(v.modal,null);assert.equal(s.page,'settings');assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
for(const cancel of ['escape','button'] as const)test(`U04 S12: a confirmation cancelled by ${cancel} cannot execute through its retained callback`,async()=>{
  const {s,v,data}=harness();await s.load();v.draw(0);v.regions.find(r=>r.id==='settings')!.run();v.draw(0);v.regions.find(r=>r.id==='reset')!.run();v.draw(0);
  const confirm=v.regions.find(r=>r.id==='modal-confirm')!.run,before=JSON.stringify(s.profile),bytes=[...data];
  if(cancel==='escape')pressEscape(v,s);else v.regions.find(r=>r.id==='modal-cancel')!.run();
  confirm();await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(s.page,'settings');
  v.draw(0);v.regions.find(r=>r.id==='reset')!.run();const newModal=v.modal;confirm();await idle(s);assert.equal(v.modal,newModal);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});
test('U04: Escape cancels a held card dispatch or camp query before a later press pauses the battle',async()=>{
  const {s,v,data,point}=await readyCards();v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point('A01-P1'));v.move(1,...point('A01-N2'));
  const before=JSON.stringify(s.profile),bytes=[...data];pressEscape(v,s);assert.equal(s.page,'battle');assert.equal(v.card,null);v.up(1,...point('A01-N2'));await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  v.draw(0);v.down(2,...point('A01-P1'));v.up(2,...point('A01-P1'));v.draw(0);assert.equal(v.selected,'A01-P1');pressEscape(v,s);assert.equal(v.selected,null);assert.equal(s.page,'battle');assert.equal(JSON.stringify(s.profile),before);
  v.draw(0);pressEscape(v,s);await idle(s);assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');
});
test('U04: recovery with no readable profile offers no return to an unrenderable home page',async()=>{
  const {s,v,data}=harness();data.set(SLOT_KEYS[0],'{broken');await s.load();assert.equal(s.profile,null);assert.equal(s.page,'recovery');v.draw(0);
  assert.equal(v.regions.some(r=>r.id==='back'),false);const bytes=[...data];pressEscape(v,s);await idle(s);assert.equal(s.page,'recovery');assert.deepEqual([...data],bytes);v.draw(1);
  assert.ok(v.regions.some(r=>r.id==='retry-load'));assert.ok(v.regions.some(r=>r.id==='practice'));
});
test('U04 S10: every temporary-practice exit without a readable profile returns to recovery without altering damaged saves',async()=>{
  for(const exit of ['save-home','forfeit','result-back','result-home']){
    const {s,v,data}=harness();for(const key of SLOT_KEYS)data.set(key,'{broken');await s.load();assert.equal(s.profile,null);const bytes=[...data];
    await s.start('L01',true);assert.ok(s.temporary);
    if(exit.startsWith('result')){
      const b=s.match!.battle;b.camps.find(c=>c.owner==='E')!.garrison=0;b.camps.find(c=>c.owner==='E')!.feintUntil=1000000;
      assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);
      for(let frame=0;frame<30&&s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner!=='P';frame++){s.tick(250);await idle(s);}assert.equal(s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner,'P');assert.equal(await s.action({kind:'dispatch',sourceId:'L01-N1',targetId:'L01-E1'}),true);
      for(let i=0;i<40&&s.page==='battle';i++)s.tick(250);
      assert.equal(s.page,'result');
    }else await s.pause();
    v.draw(0);const id=exit==='result-back'?'back':exit;v.regions.find(r=>r.id===id)!.run();
    if(exit==='forfeit'){v.draw(0);v.regions.find(r=>r.id==='modal-confirm')!.run();}
    await idle(s);assert.equal(s.page,'recovery',exit);assert.equal(s.temporary,null);assert.equal(s.profile,null);assert.deepEqual([...data],bytes);
    assert.doesNotThrow(()=>v.draw(1));assert.ok(v.regions.some(r=>r.id==='retry-load'));assert.equal(v.regions.some(r=>r.id==='back'),false);
    await s.load();assert.equal(s.page,'recovery');assert.deepEqual([...data],bytes);
  }
});
test('U04 S10: returning home from temporary practice releases it and resumes the original saved match',async()=>{
  for(const button of ['save-home']){
    const {s,v,data}=await readyCards();await s.pause('home');const original=structuredClone(s.profile!.activeMatch),bytes=[...data];
    await s.start('L01',true);assert.ok(s.temporary);await s.pause();v.draw(0);v.regions.find(r=>r.id===button)!.run();await idle(s);
    assert.equal(s.page,'home');assert.equal(s.temporary,null);assert.deepEqual(s.profile!.activeMatch,original);assert.deepEqual([...data],bytes);
    v.draw(0);assert.equal(v.regions.find(r=>r.id==='primary')!.label,'继续对战');v.regions.find(r=>r.id==='primary')!.run();await idle(s);assert.equal(s.page,'pause');
    v.draw(0);v.regions.find(r=>r.id==='resume')!.run();await idle(s);assert.equal(s.page,'battle');assert.equal(s.match!.battle.id,original!.battle.id);assert.equal(s.match!.battle.mapId,'A01');
  }
});
test('H17 N63: two archers near the central tower keep exact count-only labels without altering volley',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=await readyCards();let b=s.match!.battle;const left=b.camps.find(c=>c.id==='A01-N2')!,right=b.camps.find(c=>c.id==='A01-N3')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    left.owner='P';left.garrison=20;right.owner='E2';right.garrison=20;tower.owner='E1';tower.garrison=5;tower.nextShotAtMs=2000;
    for(const [faction,sourceId]of [['P',left.id],['E2',right.id]] as const){const result=applyBattleAction(b,{kind:'dispatch',faction,sequence:1,sourceId,targetId:tower.id});assert.equal(result.ok,true);v.events(result.events);}
    v.viewport={width:width!,height:height!,top:16,bottom:12};
    const readouts:string[]=[];const fill=d.ctx.fillText;d.ctx.fillText=(text,x,y)=>{if(d.ctx.font.startsWith('600 14px')&&/^\d+$/.test(text))readouts.push(text);fill.call(d.ctx,text,x,y);};const shotAt=b.armies[0]!.volleyCheckAtMs!;for(const at of [shotAt-100,shotAt+100]){
      v.events(advanceBattle(b,at));d.labels.length=0;d.statuses.length=0;readouts.length=0;const before=JSON.stringify(b);v.draw(at);
      assert.ok(!d.labels.some(t=>/待射|已射|弓·/.test(t)));assert.ok(b.armies.every(a=>a.volleyState===(at<shotAt?'pending':'fired')));
      assert.deepEqual(readouts,['10','10'],`${width}px at${at}ms both ordinary army readouts must remain visible`);assert.equal(JSON.stringify(b),before);assert.equal(b.armies.length,2);const liveStates=b.armies.map(a=>a.volleyState);await openArmyList(s,v);d.labels.length=0;d.statuses.length=0;v.draw(at);assert.equal(d.labels.filter(t=>/弓兵 10 人$/.test(t)).length,2);assert.ok(d.labels.filter(t=>t.includes(at<shotAt?'待齐射':'已齐射')).length===2);v.escape();await s.resume();v.draw(at);b=s.match!.battle;assert.deepEqual(b.armies.map(a=>a.volleyState),liveStates);
    }
    assert.equal(b.camps.find(c=>c.id===tower.id)!.garrison,0);assert.equal(b.camps.find(c=>c.id===tower.id)!.owner,'E1');
  }
});
test('H10: one to five decorative soldiers never delay authoritative army arrival',()=>{
  for(const [count,figures]of [[1,1],[9,2],[10,3],[20,4],[40,5]]){
    const {s,v,d}=harness();const onBattlefield=battlefieldAudit(v);d.ctx.scale=x=>{if(onBattlefield())d.scales.push(x);};
    pageProfile(s);s.page='battle';const b=s.match!.battle;b.status='running';
    const source=b.camps.find(c=>c.owner==='P')!,target=b.camps.find(c=>c.id==='A01-N4')!;
    target.owner='E1';source.tier=3;source.garrison=count!*2;
    for(const c of b.camps)c.feintUntil=1000000;
    for(const f of b.factions)f.nextAiAtMs=1000000;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id}).ok);
    const army=b.armies[0]!;advanceBattle(b,army.arrivalAtMs-1);const before=JSON.stringify(b);
    d.scales.length=0;v.draw(0);assert.equal(d.scales.filter(scale=>scale===.7).length,figures!-1);
    assert.equal(army.remainingCount,count);assert.equal(JSON.stringify(b),before);
    const events=advanceBattle(b,army.arrivalAtMs);assert.equal(events.filter(e=>e.type==='arrival').length,1);assert.equal(b.armies.length,0);
    d.scales.length=0;v.draw(1);assert.equal(d.scales.filter(scale=>scale===.7).length,0,'decorative tails disappear with the settled army');
  }
});
test('H17 N63: compact army count avoids adjacent camp numbers at all three sizes',async()=>{
  const {s,v,d}=harness();await s.load();await s.start('L03',true);const b=s.match!.battle;
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'L03-P2',targetId:'L03-N2'});advanceBattle(b,700);
  const tower=b.camps.find(c=>c.type==='fort')!;tower.owner='E';tower.feintUntil=b.gameMs+4000;tower.mobilizeUntil=b.gameMs+6000;tower.bonusBudget=fraction(8);
  const before=JSON.stringify(b),rects:{text:string;x:number;y:number;w:number;h:number}[]=[];
  d.ctx.fillText=(text,x,y)=>{const w=d.ctx.measureText(text).width,h=Number(d.ctx.font.match(/(\d+)px/)![1]);rects.push({text,x:d.ctx.textAlign==='center'?x-w/2:x,y:y-h/2,w,h});};
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    v.viewport={width:width!,height:height!,top:16,bottom:18};rects.length=0;v.draw(0);
    const state=rects.find(r=>r.text==='8'&&r.h===14);assert.ok(state,'the exact marching count remains visible');assert.ok(!rects.some(r=>/待射|已射/.test(r.text)));
    for(const r of rects.filter(r=>r!==state&&/^\d+$/.test(r.text)))assert.ok(!(state.x<r.x+r.w&&state.x+state.w>r.x&&state.y<r.y+r.h&&state.y+state.h>r.y),`${width}: volley state overlaps ${r.text}`);
    assert.equal(JSON.stringify(b),before);
  }
});
test('H16 H17: transient captions never displace existing army quantity labels',async()=>{
  const {s,v,d}=await readyCards(),b=s.match!.battle;
  for(const c of b.camps)if(c.owner==='P'){c.garrison=40;applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:c.id,targetId:'A01-N2'});}
  advanceBattle(b,700);v.draw(0);d.labels.length=0;d.statuses.length=0;v.draw(0);const labels=d.labels.filter(t=>t==='20');assert.ok(labels.length);
  const before=JSON.stringify(b);v.events([{id:9999,type:'card',atMs:b.gameMs,targetId:'A01-P1',faction:'P',reason:'supply',amount:6}]);d.labels.length=0;d.statuses.length=0;v.draw(0);
  assert.deepEqual(d.labels.filter(t=>t==='20'),labels);assert.equal(JSON.stringify(b),before);
});
test('H16: 256 crossing armies retain every head and persistent camp status through decoration pressure',()=>{
  for(const reducedMotion of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);const {battle,events}=createStatePressure();validateBattle(battle);
    s.profile!.settings.reducedMotion=reducedMotion;
    s.profile!.activeMatch!.battle=battle;s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};v.events(events);
    for(const at of [0,100,3999,4000,4334,4335]){
      const batch=advanceBattle(battle,at);v.events(batch);validateBattle(battle);const before=JSON.stringify(battle);d.labels.length=0;d.statuses.length=0;d.scales.length=0;v.draw(at);
      assert.equal(JSON.stringify(battle),before);const suppressed=battle.camps.filter(c=>c.feintUntil>at),mobilized=battle.camps.filter(c=>c.mobilizeUntil>at);
      assert.equal(d.statuses.filter(t=>t.color===COLORS.enemy1).length,suppressed.length);
      assert.equal(d.statuses.filter(t=>t.color===COLORS.player).length,mobilized.length);
      if(width===320&&at===3999){assert.equal(d.statuses.filter(t=>t.color===COLORS.enemy1&&t.text==='1s').length,9);assert.equal(d.statuses.filter(t=>t.color===COLORS.player&&t.text==='3s').length,9);}
      const resources=v as unknown as {effects:unknown[];seenEffects:Set<string>};assert.ok(resources.effects.length<=100&&resources.seenEffects.size<=400);
      if(at<4335){assert.equal(battle.armies.length,256);assert.ok(d.scales.filter(n=>Math.abs(n)===1).length>=256,'every effective army retains its head');}
      else{assert.equal(batch.filter(e=>e.type==='arrival').length,256);assert.equal(battle.armies.length,0);}
    }
  }
});
for(const count of [40,41,256])for(const reducedMotion of [false,true])test(`H16: ${count} marching armies remove trails and steps before reducing soldiers (reduced motion ${reducedMotion})`,()=>{
  const {s,v,d}=harness();pageProfile(s);const b=createBattle('A01',{id:'march-pressure',ruleRevision:'1.5',firstDragCompleted:true,inventory:{mobilize:0,march:count,supply:0,feint:1}}),source=b.camps.find(c=>c.id==='A01-P1')!;
  source.tier=3;
  const onBattlefield=battlefieldAudit(v);d.ctx.scale=x=>{if(onBattlefield())d.scales.push(x);};
  for(let sequence=1;sequence<=count;sequence++){source.garrison=80;assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence,sourceId:source.id,targetId:'A01-E1',march:true}).ok);}
  advanceBattle(b,100);validateBattle(b);assert.equal(b.armies.length,count);assert.ok(b.armies.every(a=>a.remainingCount===40));
  s.profile!.activeMatch!.battle=b;s.profile!.settings.reducedMotion=reducedMotion;s.page='battle';v.viewport={width:375,height:812,top:16,bottom:12};
  const fire=applyBattleAction(b,{kind:'card',faction:'P',sequence:count+1,cardId:'feint',targetId:'A01-E1'});assert.ok(fire.ok);v.events(fire.events);
  const points:{x:number;y:number;lineWidth:number}[]=[],translations:{x:number;y:number}[]=[],smoke:unknown[]=[];
  d.ctx.ellipse=(...args)=>{if(d.ctx.fillStyle==='#8D8A7D')smoke.push(args);};
  d.ctx.lineTo=(x,y)=>points.push({x,y,lineWidth:d.ctx.lineWidth});d.ctx.translate=(x,y)=>translations.push({x,y});
  const before=JSON.stringify(b);d.scales.length=0;v.draw(100);
  const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,a=b.armies[0]!,p=armyPosition(a,b.gameMs),x=board.x+p.x*board.k,y=board.y+p.y*board.k,angle=Math.atan2(a.to.y-a.from.y,a.to.x-a.from.x);
  const trails=points.filter(t=>Math.abs(t.x-(x-30*Math.cos(angle)))<1e-8&&Math.abs(t.y-(y-30*Math.sin(angle)))<1e-8&&t.lineWidth===1);
  assert.equal(trails.length,count===40&&!reducedMotion?count:0,'crowding removes march trails with the decorative tail');
  const secondTrails=points.filter(t=>Math.abs(t.x-(x-26*Math.cos(angle)-4*Math.sin(angle)))<1e-8&&Math.abs(t.y-(y-26*Math.sin(angle)+4*Math.cos(angle)))<1e-8&&t.lineWidth===1);
  assert.equal(secondTrails.length,count===40&&!reducedMotion?count:0,'march has two short trails and both disappear in crowded or reduced motion');
  assert.equal(smoke.length,count===40&&!reducedMotion?1:0,'crowding removes smoke while suppression remains visible');
  assert.ok(d.statuses.some(l=>l.color===COLORS.enemy1));
  const feet=points.filter(t=>t.lineWidth===3&&t.y===8&&Math.abs(t.x)>=2&&Math.abs(t.x)<=6);assert.ok(feet.length>=count*2);
  if(count>40||reducedMotion)assert.ok(feet.every(t=>Math.abs(t.x)===4),'pressure keeps heads moving but removes periodic leg motion');
  else assert.ok(feet.some(t=>Math.abs(t.x)!==4));
  assert.equal(d.scales.filter(n=>n===.7).length,count===40?count*4:0);
  assert.ok(translations.filter(t=>Math.abs(t.x-x)<1e-8&&Math.abs(t.y-y)<1e-8).length>=count,'every real head retains its exact position');
  assert.equal(JSON.stringify(b),before);assert.equal(d.depth(),0);
});
for(const reducedMotion of [false,true])test(`P04 H16: mixed tower and volley pressure preserves state, live heads and controls at three sizes (reduced motion ${reducedMotion})`,()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);const {battle,events}=createMixedPressure();s.profile!.activeMatch!.battle=battle;s.profile!.settings.reducedMotion=reducedMotion;s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};v.events(events);
    const translations:{x:number;y:number}[]=[];d.ctx.translate=(x,y)=>translations.push({x,y});
    for(const at of [0,500,1550,2000,2601,2851,4000,4336]){
      const batch=advanceBattle(battle,at),eventBytes=JSON.stringify(batch);v.events(batch);const before=JSON.stringify(battle);d.labels.length=0;d.statuses.length=0;d.scales.length=0;translations.length=0;v.draw(at);
      assert.equal(JSON.stringify(battle),before);assert.equal(JSON.stringify(batch),eventBytes);const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
      for(const a of battle.armies){const p=armyPosition(a,at);assert.ok(translations.some(t=>Math.abs(t.x-board.x-p.x*board.k)<1e-8&&Math.abs(t.y-board.y-p.y*board.k)<1e-8));}
      assert.ok(d.scales.filter(n=>Math.abs(n)===1).length>=battle.armies.length);for(const c of battle.camps)assert.ok(d.labels.includes(String(c.garrison)));
      assert.equal(d.statuses.filter(t=>t.color===COLORS.enemy1).length,battle.camps.filter(c=>c.feintUntil>at).length);
      const cards=v.regions.filter(r=>r.id.startsWith('card-'));assert.equal(cards.length,4);assert.ok(cards.every(r=>r.w>=44&&r.h>=44));
      const resources=v as unknown as {effects:unknown[];seenEffects:Set<string>};assert.ok(resources.effects.length<=100&&resources.seenEffects.size<=400);assert.equal(d.depth(),0);
    }
    assert.equal(battle.armies.length,0);
  }
});
test('U15 H17: quiet reduced-motion pressure preserves moving heads, persistent numbers and usable card controls',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);const {battle,events}=createStatePressure();
    s.profile!.activeMatch!.battle=battle;s.profile!.settings={sound:false,vibration:false,reducedMotion:true};s.page='battle';
    v.viewport={width:width!,height:height!,top:16,bottom:12};v.events(events);
    const translations:{x:number;y:number}[]=[];d.ctx.translate=(x,y)=>{translations.push({x,y});};
    // Recognize soldier bodies as well as their scale: unrelated icons can use the same scale.
    const onBattlefield=battlefieldAudit(v),probe=d.ctx as CanvasRenderingContext2D&{auditScale:number};let path:number[][]=[],decorativeFigures=0;
    const scale=d.ctx.scale;d.ctx.scale=(x,y)=>{probe.auditScale=x;scale(x,y);};
    d.ctx.beginPath=()=>{path=[];};d.ctx.moveTo=d.ctx.lineTo=(x,y)=>{path.push([x,y]);};
    d.ctx.fill=()=>{const foot=path.some(p=>p[0]===-5&&p[1]===-9)&&path.some(p=>p[0]===7&&p[1]===3);if(onBattlefield()&&(probe.auditScale===.7||probe.auditScale===.55)&&foot)decorativeFigures++;};
    soldier(d.ctx,0,0,'infantry','P',.55);soldier(d.ctx,0,0,'cavalry','P',.7);assert.equal(decorativeFigures,2,'probe detects actual recruitment and arrival figures');
    const heads:{x:number;y:number}[]=[];
    for(const at of [0,100]){
      v.events(advanceBattle(battle,at));translations.length=0;d.labels.length=0;d.statuses.length=0;d.scales.length=0;decorativeFigures=0;
      const before=JSON.stringify(battle);v.draw(at);
      const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
      for(const a of battle.armies){
        const p=armyPosition(a,at),x=board.x+p.x*board.k,y=board.y+p.y*board.k;
        assert.ok(translations.some(t=>Math.abs(t.x-x)<1e-8&&Math.abs(t.y-y)<1e-8),'every effective head is at its current rule position');
      }
      heads.push(armyPosition(battle.armies[0]!,at));
      assert.equal(decorativeFigures,0,'quiet pressure omits decorative tails and recruitment figures');
      for(const c of battle.camps)assert.ok(d.labels.includes(String(c.garrison)),'persistent garrison stays visible');
      const cards=v.regions.filter(r=>r.id.startsWith('card-'));assert.equal(cards.length,4);
      for(const r of cards)assert.ok(r.w>=44&&r.h>=44,'each short-label card has a full hit target');
      assert.equal(JSON.stringify(battle),before);assert.equal(d.depth(),0);
    }
    assert.notDeepEqual(heads[0],heads[1],'reduced motion retains authoritative head movement');
  }
});
test('F05: enemy arrival shows a directional impact and three local dust puffs without delaying losses or crossing quiet and crowded limits',()=>{
  for(const reduced of [false,true])for(const crowded of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=createBattle('A01',{id:'enemy-arrival-dust',firstDragCompleted:true}),target=b.camps.find(c=>c.id==='A01-N4')!;target.owner='E1';target.garrison=40;target.feintUntil=1000000;s.profile!.activeMatch!.battle=b;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:target.id}).ok);
    if(crowded)for(let sequence=1;sequence<=41;sequence++){b.camps.find(c=>c.id==='A01-E1')!.garrison=2;assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence,sourceId:'A01-E1',targetId:'A01-N3'}).ok);}
    const arrivalAt=b.armies.find(a=>a.faction==='P')!.arrivalAtMs;v.draw(0);const events=advanceBattle(b,arrivalAt);assert.ok(events.some(e=>e.type==='arrival'&&e.reason==='enemy'));assert.ok(!events.some(e=>e.type==='capture'));v.events(events);assert.equal(target.garrison,30);
    const dust:{x:number;y:number}[]=[];d.ctx.arc=(x,y,r)=>{if(r>=2&&r<=5&&d.ctx.fillStyle==='#A18355'&&d.ctx.globalAlpha<1)dust.push({x,y});};
    const order:string[]=[],board=(v as unknown as {board:{x:number;y:number;k:number}}).board,tx=board.x+target.x*board.k,ty=board.y+target.y*board.k;
    const originalStroke=d.ctx.stroke,originalText=d.ctx.fillText;
    d.ctx.translate=(x,y)=>{if(Math.abs(x-tx)<1e-8&&Math.abs(y-(ty-6))<1e-8)order.push('building');};
    d.ctx.stroke=()=>{if(d.ctx.lineWidth===5&&d.ctx.strokeStyle==='#493E30')order.push('blade');originalStroke.call(d.ctx);};
    d.ctx.fillText=(value,x,y)=>{if(value===String(target.garrison)&&Math.abs(x-tx)<1e-8&&Math.abs(y-(ty+24.5))<1e-8)order.push('count');originalText.call(d.ctx,value,x,y);};
    for(const age of [0,300,549,550]){

      advanceBattle(b,arrivalAt+age);dust.length=0;order.length=0;const before=JSON.stringify(b);v.draw(9000+age);assert.equal(JSON.stringify(b),before);assert.equal(dust.length,!reduced&&!crowded&&age<550?3:0);
      assert.equal(order.filter(value=>value==='blade').length,age<550?2:0,'two crossed blades remain readable, including quiet and crowded modes');
      if(age<550){assert.ok(order.indexOf('building')<order.indexOf('blade'));assert.ok(order.lastIndexOf('blade')<order.indexOf('count'),'combat never covers the authoritative count');}
      for(const dot of dust)assert.ok(Math.abs(dot.x)<=18&&Math.abs(dot.y)<=12,'dust stays near the impact anchor, below city information');
    }
    assert.equal(d.depth(),0);
  }
});
test('F05 F06: a real successful assault retains contact before the capture flourish while ownership and losses settle immediately',()=>{
  for(const reduced of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=createBattle('A01',{id:'successful-assault',firstDragCompleted:true}),source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N4')!;
    s.profile!.activeMatch!.battle=b;source.garrison=40;target.owner='E1';target.garrison=8;for(const c of b.camps)c.feintUntil=1000000;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id}).ok);v.draw(0);
    const at=b.armies[0]!.arrivalAtMs,events=advanceBattle(b,at),arrival=events.find(e=>e.type==='arrival'&&e.targetId===target.id),capture=events.find(e=>e.type==='capture'&&e.targetId===target.id);
    assert.ok(arrival&&capture);assert.equal(arrival.reason,'enemy');assert.equal(arrival.atMs,capture.atMs);assert.equal(target.owner,'P');assert.equal(target.garrison,12);assert.equal(b.armies.length,0);v.events(events);v.events(events);
    const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;let seals=0;
    d.ctx.ellipse=(x,y,rx,ry)=>{if(Math.abs(x-(board.x+target.x*board.k))<1e-8&&Math.abs(y-(board.y+target.y*board.k+6))<1e-8&&rx>=31&&rx<=38&&ry>=17&&ry<=21)seals++;};
    for(const age of [0,180,550,800]){
      advanceBattle(b,at+age);const before=JSON.stringify(b);d.strokes.length=0;d.labels.length=0;seals=0;v.draw(age);
      assert.equal(d.strokes.filter(stroke=>stroke.color==='#F9EBCB'&&stroke.width===3).length,age<550?2:0,`${width}/${reduced}/${age}: successful capture must retain exactly one contact pair`);
      assert.equal(seals,age<800&&(reduced||age>=180)?1:0,'capture seal follows contact and ends at 800 game ms');
      assert.ok(d.labels.includes('12'),'the final garrison is already visible during contact');assert.equal(target.owner,'P');assert.equal(JSON.stringify(b),before);assert.equal(d.depth(),0);
    }
  }
});
test('F05: a real friendly arrival never draws enemy contact blades',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';const b=createBattle('L03',{firstDragCompleted:true});s.profile!.activeMatch!.battle=b;
  for(const c of b.camps)c.feintUntil=1000000;const source=b.camps.find(c=>c.id==='L03-P1')!,target=b.camps.find(c=>c.id==='L03-P2')!;source.garrison=20;target.garrison=0;
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id}).ok);v.draw(0);const events=advanceBattle(b,b.armies[0]!.arrivalAtMs);
  assert.ok(events.some(e=>e.type==='arrival'&&e.reason==='friendly'));assert.ok(!events.some(e=>e.type==='capture'));v.events(events);
  const before=JSON.stringify(b);d.strokes.length=0;v.draw(0);assert.ok(!d.strokes.some(stroke=>stroke.color==='#F9EBCB'));assert.equal(target.garrison,10);assert.equal(JSON.stringify(b),before);
});
test('F07: eliminated marching heads fade from their event positions while the real armies are already removed',()=>{
  for(const reduced of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=createBattle('A01',{id:'retreat-view',ruleRevision:'1.5',firstDragCompleted:true}),source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    source.owner='P';source.garrison=20;b.camps.find(c=>c.id==='A01-E1')!.owner='E3';tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;s.profile!.activeMatch!.battle=b;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:tower.id,targetId:'A01-P1'}).ok);
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}).ok);
    const old=structuredClone(b.armies.find(a=>a.faction==='E1')!);advanceBattle(b,900);v.draw(900);
    const events=advanceBattle(b,1000);assert.ok(events.some(e=>e.type==='eliminated'&&e.faction==='E1'));assert.equal(b.status,'running');assert.ok(!b.armies.some(a=>a.faction==='E1'));v.events(events);
    const probe=d.ctx as CanvasRenderingContext2D&{auditX:number;auditY:number},ghosts:{alpha:number;x:number;y:number}[]=[];
    d.ctx.translate=(x,y)=>{probe.auditX=x;probe.auditY=y;};d.ctx.ellipse=(_x,_y,rx,ry)=>{if(ry===2.4&&_y===9&&d.ctx.globalAlpha>0&&d.ctx.globalAlpha<=.45)ghosts.push({alpha:d.ctx.globalAlpha,x:probe.auditX,y:probe.auditY});};
    for(const age of [0,80,159,160]){
      advanceBattle(b,1000+age);ghosts.length=0;const before=JSON.stringify(b);v.draw(10000+age);assert.equal(JSON.stringify(b),before);assert.equal(ghosts.length,!reduced&&age<160?1:0);
      if(ghosts.length){const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,p=armyPosition(old,1000),g=ghosts[0]!;assert.ok(Math.abs(g.x-(board.x+p.x*board.k))<1e-8&&Math.abs(g.y-(board.y+p.y*board.k))<1e-8);assert.ok(g.alpha>0&&g.alpha<=.5);}
      const frozen=structuredClone(ghosts);v.events(events);ghosts.length=0;v.draw(90000+age);assert.deepEqual(ghosts,frozen,'duplicate events and wall time do not restart or progress retreat');
    }
    assert.equal(d.depth(),0);
  }
});
test('F07 H15: ordinary pause keeps the retreat phase but actual save reload clears it without reviving armies',async()=>{
  const {s,v,d}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];await s.start('A01');
  let b=s.match!.battle;b.ruleRevision='1.5';const source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=20;b.camps.find(c=>c.id==='A01-E1')!.owner='E3';tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;
  const enemy=applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:tower.id,targetId:'A01-P1'});assert.ok(enemy.ok);v.events(enemy.events);
  assert.equal(await s.action({kind:'dispatch',sourceId:source.id,targetId:tower.id}),true);
  b=s.match!.battle;v.events(advanceBattle(b,900));v.draw(900);v.events(advanceBattle(b,1000));advanceBattle(b,1080);
  let ghosts=0;d.ctx.ellipse=(_x,_y,rx,ry)=>{if(ry===2.4&&_y===9&&d.ctx.globalAlpha>0&&d.ctx.globalAlpha<=.45)ghosts++;};
  v.draw(1080);assert.equal(ghosts,1);const expected=structuredClone(b);
  await s.pause();v.draw(9000);await s.resume();ghosts=0;v.draw(10000);assert.equal(ghosts,1);assert.deepEqual(s.match!.battle,expected);
  await s.load();v.draw(11000);await s.resume();ghosts=0;v.draw(12000);assert.equal(ghosts,0);assert.deepEqual(s.match!.battle,expected);assert.ok(!s.match!.battle.armies.some(a=>a.faction==='E1'));assert.equal(d.depth(),0);
});
test('F09 F12: committed shots aim tower barrels and lift only the firing archer without moving rule state',()=>{
  for(const armyCount of [1,41])for(const reduced of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=createBattle('A01',{id:'shot-pose',firstDragCompleted:true}),source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    source.owner='P';source.garrison=20;tower.owner='E1';tower.nextShotAtMs=2000;s.profile!.activeMatch!.battle=b;
    const barrels:{x:number;y:number}[]=[],bows:number[]=[];
    d.ctx.lineTo=(x,y)=>{if(d.ctx.lineWidth===1.8&&Math.abs(Math.hypot(x,y)-Math.hypot(24,5))<1e-8)barrels.push({x,y});};
    d.ctx.arc=(x,y,r)=>{if(x===7&&r===9&&d.ctx.lineWidth===2)bows.push(y);};
    v.draw(0);const ev=advanceBattle(b,2000);v.events(ev);const shot=ev.find(e=>e.type==='tower-shot')!;assert.ok(shot);
    advanceBattle(b,2080);barrels.length=0;const before=JSON.stringify(b);v.draw(80);assert.equal(JSON.stringify(b),before);
    const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
    const angle=Math.atan2((shot.position!.y-tower.y)*board.k+6,(shot.position!.x-tower.x)*board.k),length=Math.hypot(24,5),actual=barrels.at(-1)!;
    assert.ok(Math.abs(actual.x-(reduced?24:Math.cos(angle)*length))<1e-8);assert.ok(Math.abs(actual.y-(reduced?-5:Math.sin(angle)*length))<1e-8);
    v.events(ev);barrels.length=0;v.draw(50000);assert.deepEqual(barrels.at(-1),actual,'UI time and duplicate event cannot turn a barrel again');
    advanceBattle(b,2300);barrels.length=0;v.draw(50001);assert.deepEqual(barrels.at(-1),{x:24,y:-5});
    const vb=createBattle('A01',{id:'volley-pose',firstDragCompleted:true}),vs=vb.camps.find(c=>c.id==='A01-N2')!,vt=vb.camps.find(c=>c.id==='A01-N5')!;vs.owner='P';vs.garrison=20;vt.owner='E1';vt.feintUntil=10000;s.profile!.activeMatch!.battle=vb;v.draw(0);
    for(let sequence=1;sequence<=armyCount;sequence++){vs.garrison=20;assert.ok(applyBattleAction(vb,{kind:'dispatch',faction:'P',sequence,sourceId:vs.id,targetId:vt.id}).ok);}const shotAt=vb.armies[0]!.volleyCheckAtMs!;const volley=advanceBattle(vb,shotAt);assert.ok(volley.some(e=>e.type==='volley'&&e.amount!>0));v.events(volley);advanceBattle(vb,shotAt+150);
    bows.length=0;const snapshot=JSON.stringify(vb);v.draw(80);assert.equal(JSON.stringify(vb),snapshot);assert.equal(bows.filter(y=>y!==-6).length,reduced||armyCount>40?0:1);if(!reduced&&armyCount<=40)assert.ok(bows.includes(-8));
    v.events(volley);bows.length=0;v.draw(90000);assert.equal(bows.filter(y=>y!==-6).length,reduced||armyCount>40?0:1);
    const restored=new GameView(d.ctx,s);bows.length=0;restored.viewport=v.viewport;restored.draw(90001);assert.ok(bows.every(y=>y===-6),'restored presentation does not replay old shot poses');
    advanceBattle(vb,shotAt+300);bows.length=0;v.draw(90002);assert.ok(bows.every(y=>y===-6));assert.equal(d.depth(),0);
  }
});
test('G4.1: persistent camp symbols survive absent transient events and disappear with their authoritative timers',()=>{
  for(const reducedMotion of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);const b=createStatePressure().battle;
    s.profile!.activeMatch!.battle=b;s.profile!.settings.reducedMotion=reducedMotion;s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};
    let icons=0;const scale=d.ctx.scale;d.ctx.scale=(x,y)=>{if(x===4.5/16&&y===4.5/16)icons++;scale(x,y);};
    const before=JSON.stringify(b);v.draw(0);assert.equal(icons,18,'two static symbols per camp without any transient event');assert.equal(JSON.stringify(b),before);
    icons=0;v.draw(100000);assert.equal(icons,18,'wall time cannot expire a persistent symbol');
    advanceBattle(b,4000);icons=0;v.draw(100001);assert.equal(icons,9,'suppression icons disappear at their exact expiry');
    advanceBattle(b,6000);icons=0;v.draw(100002);assert.equal(icons,0,'all drum icons expire by game time');assert.equal(d.depth(),0);
  }
});
test('H16 H17: simultaneous camp timers remain separate at three viewport sizes',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.profile!.activeMatch!.battle=createStatePressure().battle;s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};
    const rects:{text:string;x:number;y:number;w:number;h:number}[]=[];
    d.ctx.fillText=(text,x,y)=>{if(!/^(?:尽·)?[0-9.]+s$/.test(text))return;const w=d.ctx.measureText(text).width;rects.push({text,x:x-w/2-12,y:y-7.5,w:w+14,h:15});};
    v.draw(0);assert.equal(rects.length,18);
    for(const [i,r]of rects.entries())for(const z of rects.slice(i+1))assert.ok(!(r.x<z.x+z.w&&r.x+r.w>z.x&&r.y<z.y+z.h&&r.y+r.h>z.y),`${width}: ${JSON.stringify(r)} overlaps ${JSON.stringify(z)}`);
  }
});
test('H17 U15: camp status backdrops cover moving figures without map-spanning army leaders',()=>{
  for(const reducedMotion of [false,true])for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);const b=createStatePressure().battle;advanceBattle(b,3000);
    s.profile!.activeMatch!.battle=b;s.profile!.settings.reducedMotion=reducedMotion;s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};
    let order=0;const leaders:number[]=[],backgrounds:{x:number;y:number;w:number;h:number;order:number}[]=[],statuses:number[]=[];
    d.ctx.stroke=()=>{if(d.ctx.strokeStyle==='#87958B')leaders.push(++order);};
    d.ctx.fillRect=(x,y,w,h)=>{if(d.ctx.fillStyle===COLORS.surface)backgrounds.push({x,y,w,h,order:++order});};
    d.ctx.fillText=(text,x,y)=>{
      if(!/^(?:尽·)?[0-9.]+s$/.test(text))return;
      const current=++order,w=d.ctx.measureText(text).width;statuses.push(current);
      assert.ok(backgrounds.some(r=>r.order<current&&r.x<=x-w/2&&r.x+r.w>=x+w/2&&r.y<=y-5.5&&r.y+r.h>=y+5.5),'each status has an opaque backing over moving figures');
    };
    const before=JSON.stringify(b);v.draw(3000);assert.equal(statuses.length,18);assert.equal(leaders.length,0,'stable army labels do not require map-spanning leader lines');assert.equal(JSON.stringify(b),before);
  }
});
test('H17 U05: capture feedback avoids neighboring last-camp and suppression text at all three sizes',async()=>{
  const {s,v,d}=await readyCards(),b=s.match!.battle,source=b.camps.find(c=>c.id==='A01-P1')!;
  source.garrison=40;for(const c of b.camps)if(c.owner)c.feintUntil=1000000;
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:'A01-N2'});
  v.events(advanceBattle(b,b.armies[0]!.arrivalAtMs));
  const before=JSON.stringify(b),rects:{text:string;x:number;y:number;w:number;h:number}[]=[];
  d.ctx.fillText=(text,x,y)=>{const w=d.ctx.measureText(text).width,h=Number(d.ctx.font.match(/(\d+)px/)![1]);rects.push({text,x:d.ctx.textAlign==='center'?x-w/2:x,y:y-h/2,w,h});};
  let displayed=0;
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    v.viewport={width:width!,height:height!,top:16,bottom:18};rects.length=0;v.draw(0);
    const label=rects.find(r=>r.text.startsWith('夺城'));
    if(label){displayed++;for(const r of rects.filter(r=>r!==label&&(/末城|^(?:尽·)?[0-9.]+s$/.test(r.text)||/^\d+$/.test(r.text))))assert.ok(!(label.x<r.x+r.w&&label.x+label.w>r.x&&label.y<r.y+r.h&&label.y+label.h>r.y),`${width}: ${label.text} overlaps ${r.text}`);}
    else assert.equal(width,320,'only the crowded small screen may omit the decorative caption');
    assert.equal(JSON.stringify(b),before,'layout never changes ownership, troops or timers');
  }
  assert.ok(displayed>=2,'larger boards retain the capture caption');
});
async function readyCards(fortification=0){
  const h=harness(),{s,v}=h;await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:2,march:2,supply:2,feint:2};s.profile!.passiveLevels.fortification=fortification;await s.start('A01');v.draw(0);
  const point=(id:string)=>{const c=s.match!.battle.camps.find(c=>c.id===id)!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board;return [board.x+c.x*board.k,board.y+c.y*board.k] as const;};return {...h,point};
}
async function recoveryFixture(){
  const h=await readyCards(),{s,data,setTime}=h;s.profile!.rankPoints=30;s.profile!.highestRankPoints=30;await s.pause();
  const slots=()=>SLOT_KEYS.map(key=>({key,raw:data.get(key)!,revision:JSON.parse(data.get(key)!).revision as number})).sort((a,b)=>b.revision-a.revision);const earlier=slots()[0]!.raw;await s.pause();
  setTime(NOW+1000);s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;await s.setting('sound');setTime(NOW+2000);s.profile!.rankPoints=90;s.profile!.highestRankPoints=90;await s.setting('vibration');
  const [newest,backup]=slots();assert.equal(JSON.parse(earlier).revision%2,backup!.revision%2);data.set(newest!.key,'{broken');await s.load();assert.equal(s.page,'recovery');assert.equal(s.backup!.data.rankPoints,60);assert.equal(s.backup!.writtenAt,NOW+1000);
  return {...h,earlier,backupKey:backup!.key};
}
for(const operation of ['recover','reset'] as const)test(`S12: recovery confirmation shows the backup time and rollback risk, then ${operation} executes only after confirmation`,async()=>{
  const {s,v,data}=await recoveryFixture();data.set('another-game:save','untouched');const expected=structuredClone(s.backup!.data),bytes=[...data];v.draw(0);v.regions.find(r=>r.id==='recover-backup')!.run();
  assert.ok(v.modal!.body.includes(new Date(NOW+1000).toLocaleString('zh-CN')));assert.ok(v.modal!.body.includes('进度可能回退'));assert.ok(v.modal!.body.includes('不会混合两份库存或补发奖励'));v.draw(0);v.regions.find(r=>r.id==='modal-cancel')!.run();assert.deepEqual([...data],bytes);assert.equal(s.profile!.rankPoints,90);assert.equal(s.page,'recovery');
  v.draw(0);if(operation==='reset'){v.wheel(1000);v.draw(0);v.regions.find(r=>r.id==='recovery-reset')!.run();assert.ok(v.modal!.body.includes('全部清除'));assert.ok(v.modal!.body.includes('无法云找回'));}else v.regions.find(r=>r.id==='recover-backup')!.run();
  v.draw(0);v.regions.find(r=>r.id==='modal-confirm')!.run();await idle(s);assert.equal(s.error,'');assert.equal(s.backup,null);assert.equal(data.get('another-game:save'),'untouched');
  if(operation==='recover'){assert.equal(s.page,'pause');expected.maxObservedTime=NOW+2000;assert.deepEqual(s.profile,expected);assert.equal(s.profile!.rankPoints,60);assert.equal(s.profile!.activeInventory.supply,2);}
  else{assert.equal(s.page,'home');assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.highestRankPoints,0);assert.equal(s.profile!.activeMatch,null);assert.deepEqual(s.profile!.tutorialFirstWins,[]);assert.notEqual(s.profile!.generation,expected.generation);}
  const committed=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),committed);
});
test('S12 R34: an old recovery confirmation cannot restore a different backup discovered by a later reload',async()=>{
  const {s,v,data,earlier,backupKey}=await recoveryFixture();v.draw(0);v.regions.find(r=>r.id==='recover-backup')!.run();v.draw(0);const stale=v.regions.find(r=>r.id==='modal-confirm')!.run;
  // Replace only this test's valid slot with an earlier valid snapshot; current profile and match identity stay the same.
  data.set(backupKey,earlier);await s.load();assert.equal(s.backup!.data.rankPoints,30);const bytes=[...data],before=JSON.stringify(s.profile);stale();await idle(s);
  assert.deepEqual([...data],bytes);assert.equal(JSON.stringify(s.profile),before);assert.equal(s.page,'recovery');v.draw(0);assert.equal(v.modal,null);
  v.regions.find(r=>r.id==='recover-backup')!.run();assert.ok(v.modal!.body.includes(new Date(NOW).toLocaleString('zh-CN')));v.draw(0);v.regions.find(r=>r.id==='modal-confirm')!.run();await idle(s);assert.equal(s.profile!.rankPoints,30);assert.equal(s.error,'');
});
test('T08: second-lesson queries distinguish volley and tower fire and offer upgrading or a road-connected expansion',async()=>{
  for(const upgrade of [false,true]){
    const {s,v,d,data}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];await s.start('L02');v.draw(0);
    const point=(id:string)=>{const c=s.match!.battle.camps.find(c=>c.id===id)!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board;return [board.x+c.x*board.k,board.y+c.y*board.k] as const;};
    const before=JSON.stringify(s.profile),bytes=[...data];
    for(const [id,expected]of [['L02-N1','出征齐射一次 · 驻营不自动射击'],['L02-N2','可打路过敌军与范围内敌营']] as const){
      v.down(1,...point(id));v.up(1,...point(id));d.labels.length=0;d.statuses.length=0;
      renderCampDetailsFixture(v);for(let page=0;page<8;page++){v.draw(page);v.regions.find(r=>r.id==='camp-details')!.run();}
      assert.ok(d.labels.join('').includes(expected));assert.equal(v.regions.some(r=>r.id==='upgrade'),false);v.escape();v.draw(0);v.selected=null;
    }
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    v.down(1,...point('L02-P1'));v.up(1,...point('L02-P1'));v.draw(0);assert.ok(v.regions.find(r=>r.id==='upgrade-camp-L02-P1')!.label.includes('消耗 10 兵'));
    if(upgrade){v.regions.find(r=>r.id==='upgrade-camp-L02-P1')!.run();await idle(s);assert.equal(s.match!.battle.camps[0]!.tier,2);assert.equal(s.match!.battle.camps[0]!.garrison,20);}
    else{v.down(2,...point('L02-P1'));v.move(2,...point('L02-N1'));v.up(2,...point('L02-N1'));await idle(s);assert.equal(s.match!.battle.camps[0]!.tier,1);assert.equal(s.match!.battle.camps[0]!.garrison,15);assert.equal(s.match!.battle.armies[0]!.targetId,'L02-N1');assert.equal(s.match!.battle.armies[0]!.initialCount,15);assert.ok(s.match!.battle.camps.filter(c=>c.id.includes('-N')).every(c=>c.owner===null));}
    const snapshot=structuredClone(s.match!);snapshot.battle.status='paused';await s.load();assert.deepEqual(s.match,snapshot);assert.equal(s.error,'');
  }
});
for(const redraw of [false,true])test(`R34: an old held march cannot enter a replacement match ${redraw?'after':'before'} its first draw`,async()=>{
  const {s,v,data,point}=await readyCards();const old=s.match!.battle.id;v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point('A01-P1'));v.move(1,...point('A01-N2'));
  await s.forfeit();await s.start('A01');assert.notEqual(s.match!.battle.id,old);const before=JSON.stringify(s.profile),bytes=[...data];if(redraw)v.draw(1);v.up(1,...point('A01-N2'));await idle(s);
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(s.match!.battle.armies.length,0);assert.equal(v.card,null);
});
test('R34: a captured forfeit confirmation cannot forfeit a later paused match',async()=>{
  const {s,v,data}=await readyCards();await s.pause();v.draw(0);v.regions.find(r=>r.id==='forfeit')!.run();v.draw(0);const stale=v.regions.find(r=>r.id==='modal-confirm')!.run;
  await s.forfeit();await s.start('A01');await s.pause();const before=JSON.stringify(s.profile),bytes=[...data];stale();await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);v.draw(1);assert.equal(v.modal,null);assert.equal(s.page,'pause');
});
test('R34 S20: a captured reset confirmation cannot clear a replacement generation',async()=>{
  const {s,v,data}=await readyCards();await s.pause('settings');v.draw(0);v.wheel(1000);v.draw(0);v.regions.find(r=>r.id==='reset')!.run();v.draw(0);const stale=v.regions.find(r=>r.id==='modal-confirm')!.run;
  await s.reset();s.profile!.rankPoints=30;s.profile!.highestRankPoints=30;await s.setting('vibration');s.page='settings';const before=JSON.stringify(s.profile),bytes=[...data];stale();await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);v.draw(1);assert.equal(v.modal,null);
});
test('R34: controls from the previous drawing cannot prepare a card in a replacement match',async()=>{
  const {s,v}=await readyCards();const oldButton=v.regions.find(r=>r.id==='card-march')!;await s.forfeit();await s.start('A01');const before=JSON.stringify(s.profile);
  oldButton.run();v.down(1,oldButton.x+10,oldButton.y+10);v.up(1,oldButton.x+10,oldButton.y+10);assert.equal(v.card,null);assert.equal(JSON.stringify(s.profile),before);
  v.draw(1);v.regions.find(r=>r.id==='card-march')!.run();assert.equal(v.card,'march');oldButton.run();assert.equal(v.card,'march','an ignored old callback must not clear a newer preparation');
});
test('R34 G11: an old reward confirmation cannot claim a later choice or clear its current selection',async()=>{
  const {s,v,data}=await readyCards();let stale:()=>void=()=>{};
  for(let round=0;round<2;round++){
    if(round===1)await s.start('A01');const b=s.match!.battle;b.gameMs=239999;b.hasPlayerDispatch=true;for(const f of b.factions)f.nextAiAtMs=240001;for(const c of b.camps){if(c.owner)c.garrison=c.owner==='P'?50:0;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
    s.tick(1);await idle(s);await s.acknowledge('choice');v.draw(0);const selected=s.profile!.choice!.candidateIds[0]!;v.regions.find(r=>r.id===`choice-${selected}`)!.run();v.draw(0);
    if(round===0){stale=v.regions.find(r=>r.id==='claim')!.run;stale();await idle(s);assert.equal(s.profile!.choice!.state,'claimed');}
    else{const before=JSON.stringify(s.profile),bytes=[...data];stale();await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(v.selectedChoice,selected);assert.equal(s.profile!.choice!.state,'pending');v.regions.find(r=>r.id==='claim')!.run();await idle(s);assert.equal(s.profile!.choice!.state,'claimed');}
  }
});
test('R04 K03 K30: dragging back, to blank space or onto UI and starting a drag from UI never dispatches',async()=>{
  for(const march of [false,true])for(const end of ['source','blank','ui','cancel','from-ui']){
    const {s,v,data,point}=await readyCards();if(march)v.regions.find(r=>r.id==='card-march')!.run();const before=JSON.stringify(s.profile),bytes=[...data];
    if(end==='from-ui')v.down(1,40,40);else v.down(1,...point('A01-P1'));v.move(1,...point('A01-N4'));
    if(end==='cancel'){v.cancel(1);v.up(1,...point('A01-N4'));}
    else if(end==='source'){v.move(1,...point('A01-P1'));v.up(1,...point('A01-P1'));}
    else if(end==='blank')v.up(1,10,400);
    else if(end==='ui')v.up(1,40,40);
    else v.up(1,...point('A01-N4'));
    await idle(s);assert.equal(JSON.stringify(s.profile),before,`${march}:${end}`);assert.deepEqual([...data],bytes);assert.equal(s.match!.battle.armies.length,0);
  }
});
test('K03: selecting, deselecting or cancelling each card leaves every saved asset and battle field unchanged',async()=>{
  for(const id of ['mobilize','march','supply','feint'] as const){
    const {s,v,data}=await readyCards(),before=JSON.stringify(s.profile),bytes=[...data];const select=()=>{v.draw(0);v.regions.find(r=>r.id===(v.card?'cancel-card':`card-${id}`))!.run();};select();assert.equal(v.card,id);v.draw(0);assert.equal(JSON.stringify(s.profile),before);select();assert.equal(v.card,null);
    select();v.cancel();assert.equal(v.card,null);select();v.down(1,10,400);v.up(1,10,400);await idle(s);assert.equal(v.card,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});
for(const redraw of [false,true])test(`R05 K04: source capture ${redraw?'with':'without'} an intervening draw cancels the pending march before release`,async()=>{
  const {s,v,data,point}=await readyCards();s.match!.battle.camps.find(c=>c.id==='A01-N4')!.owner='P';v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point('A01-P1'));v.move(1,...point('A01-N2'));s.match!.battle.camps.find(c=>c.id==='A01-P1')!.owner='E1';
  const before=JSON.stringify(s.profile),bytes=[...data];if(redraw)v.draw(1);v.up(1,...point('A01-N2'));await idle(s);assert.equal(v.card,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(s.match!.battle.armies.length,0);
});
test('K05: a formal march saves its one-card cost, half dispatch and speed together, then ordinary dragging stays ordinary',async()=>{
  const {s,v,point}=await readyCards();v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point('A01-P1'));v.move(1,...point('A01-N2'));v.up(1,...point('A01-N2'));await idle(s);
  assert.equal(s.profile!.activeInventory.march,1);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,10);assert.equal(s.match!.battle.armies[0]!.initialCount,10);assert.equal(s.match!.battle.armies[0]!.speed,33.599999999999994);assert.equal(v.card,null);
  v.down(2,...point('A01-P1'));v.move(2,...point('A01-N2'));v.up(2,...point('A01-N2'));await idle(s);assert.equal(s.profile!.activeInventory.march,1);assert.equal(s.match!.battle.armies[1]!.speed,24);const snapshot=structuredClone(s.match!);snapshot.battle.status='paused';await s.load();assert.deepEqual(s.match,snapshot);assert.equal(s.profile!.activeInventory.march,1);
});
test('Q18: the legacy real short route cancels a useless march without cost, retains preparation and permits ordinary dispatch after explicit cancellation',async()=>{
  const {s,v,d,data,point}=await readyCards(),b=s.match!.battle,source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N4')!;
  b.ruleRevision='1.5';
  const preview=dispatchPreview(b,source,target,true);assert.equal(preview.normalMs,1000);assert.equal(preview.travelMs,1000);assert.equal(preview.valid,false);const before=JSON.stringify(s.profile),bytes=[...data];
  v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point(source.id));v.move(1,...point(target.id));d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.join('').includes('此路线无需加急，松手取消'));v.up(1,...point(target.id));await idle(s);
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(v.card,'march');assert.equal((v as unknown as {gesture:unknown}).gesture,null);d.labels.length=0;d.statuses.length=0;v.draw(1);assert.ok(!d.labels.join('').includes('此路线无需加急，松手取消'));
  v.regions.find(r=>r.id==='cancel-card')!.run();assert.equal(v.card,null);v.down(2,...point(source.id));v.move(2,...point(target.id));v.up(2,...point(target.id));await idle(s);assert.equal(s.match!.battle.armies.length,1);assert.equal(s.match!.battle.armies[0]!.arrivalAtMs,1000);assert.equal(s.match!.battle.armies[0]!.speed,80);assert.equal(s.profile!.activeInventory.march,2);assert.equal(s.match!.battle.camps.find(c=>c.id===source.id)!.garrison,10);
});
test('Q19: a valid held march rechecks current stock on release after another committed dispatch used the last card',async()=>{
  const {s,v,data,point}=await readyCards();s.profile!.activeInventory.march=1;s.match!.battle.factions.find(f=>f.id==='P')!.inventory.march=1;await s.pause();await s.resume();v.draw(0);
  const b=s.match!.battle,source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N2')!,preview=dispatchPreview(b,source,target,true);assert.equal(preview.valid,true);v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point(source.id));v.move(1,...point(target.id));v.draw(0);
  assert.equal(await s.action({kind:'dispatch',sourceId:source.id,targetId:target.id,march:true}),true);assert.equal(s.match!.battle.armies[0]!.arrivalAtMs,preview.travelMs);const before=JSON.stringify(s.profile),bytes=[...data];v.up(1,...point(target.id));await idle(s);
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(s.match!.battle.armies.length,1);assert.equal(s.profile!.activeInventory.march,0);assert.equal(v.card,'march');assert.equal((v as unknown as {gesture:unknown}).gesture,null);
});
test('K28: all empty card buttons explain missing stock without preparing a card or changing the saved match',async()=>{
  const {s,v,d,data}=await readyCards();s.profile!.activeInventory={mobilize:0,supply:0,feint:0,march:0};s.match!.battle.factions.find(f=>f.id==='P')!.inventory={...s.profile!.activeInventory};await s.pause();await s.resume();v.draw(0);const before=JSON.stringify(s.profile),bytes=[...data];
  for(const card of ['mobilize','supply','feint','march']){v.regions.find(r=>r.id===`card-${card}`)!.run();assert.equal(v.card,null);d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.join('').includes('暂无库存，获胜后可选择获得'));assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);}
  await s.pause();v.draw(0);assert.ok(!v.regions.some(r=>r.id.startsWith('card-')));assert.equal(s.match!.battle.status,'paused');
});
test('Q19: a one-millisecond march benefit remains visible instead of displaying identical rounded times',async()=>{
  const {s,v,d,point}=await readyCards(),b=s.match!.battle,source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N2')!;
  // Geometry-only drawing fixture; no action is committed with modified map coordinates.
  target.x=source.x+60.001;target.y=source.y;v.draw(0);v.regions.find(r=>r.id==='card-march')!.run();v.down(1,...point(source.id));v.move(1,...point(target.id));const before=JSON.stringify(s.profile);d.labels.length=0;d.statuses.length=0;v.draw(0);
  assert.ok(d.labels.join('').includes('普通 1.001 → 加急 1.000 秒'));assert.equal(JSON.stringify(s.profile),before);v.cancel();
});
test('K15: three fortification layers preview and persist four supplied soldiers above the base fifty capacity',async()=>{
  const {s,v,d,point}=await readyCards(3);s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison=50;await s.pause();await s.resume();v.draw(0);v.regions.find(r=>r.id==='card-supply')!.run();v.down(1,...point('A01-P1'));d.labels.length=0;d.statuses.length=0;v.draw(1);
  assert.ok(d.labels.join('').includes('松手补 4 兵：50 → 54/54'));v.up(1,...point('A01-P1'));await idle(s);assert.equal(s.profile!.activeInventory.supply,1);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,54);await s.load();assert.equal(s.profile!.activeInventory.supply,1);assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,54);
});
test('G04: a supply-only champion shows the no-dispatch reason without points, rewards, wins or a card refund',async()=>{
  const {s,v,d}=await readyCards();assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);const b=s.match!.battle;assert.equal(b.hasPlayerDispatch,false);
  // Final standings are controlled; the card action and natural settlement are real session transactions.
  b.gameMs=239999;for(const f of b.factions)f.nextAiAtMs=240001;for(const c of b.camps){if(c.owner)c.garrison=c.owner==='P'?50:0;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  s.tick(1);await idle(s);assert.equal(s.page,'result');d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.join('').includes('本局未有效派兵，不获军功、策略或周胜。'));
  assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.formalCompleted,0);assert.equal(s.profile!.choice,null);assert.equal(s.profile!.activeInventory.supply,1);const before=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),before);
});
test('S14: ordinary forfeit confirmation can be cancelled or committed once before a new match without refunding a used card',async()=>{
  const {s,v,data}=await readyCards();s.profile!.rankPoints=7;s.profile!.highestRankPoints=7;assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);await s.pause();assert.equal(s.expired,false);const id=s.match!.battle.id,before=JSON.stringify(s.profile),bytes=[...data];
  v.draw(0);v.regions.find(r=>r.id==='forfeit')!.run();assert.ok(v.modal!.body.includes('军功 7 → 0'));assert.ok(v.modal!.body.includes('已用锦囊不返还'));v.draw(0);v.regions.find(r=>r.id==='modal-cancel')!.run();assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  v.draw(0);v.regions.find(r=>r.id==='forfeit')!.run();v.draw(0);const confirm=v.regions.find(r=>r.id==='modal-confirm')!.run;confirm();confirm();await idle(s);await s.load();assert.equal(s.page,'home');assert.equal(s.profile!.activeMatch,null);assert.equal(s.profile!.latestResult!.matchId,id);assert.equal(s.profile!.latestResult!.settlementKind,'forfeit');assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.activeInventory.supply,1);
  assert.equal(await s.start('A01'),true);assert.notEqual(s.match!.battle.id,id);assert.equal(s.match!.battle.gameMs,0);assert.equal(s.profile!.activeInventory.supply,1);assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.choice,null);assert.equal(s.profile!.qualifiedArenaWins,0);
});
for(const card of ['supply','march'] as const)for(const preparation of ['held gesture','reselected card'] as const)test(`S09 K18: a slow ${card} commit cannot clear a newer ${preparation}`,async()=>{
  const data=new Map<string,string>();let hold=false,entered:()=>void=()=>{},release:()=>void=()=>{};const writing=new Promise<void>(resolve=>{entered=resolve;});
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){if(hold){hold=false;entered();await new Promise<void>(resolve=>{release=resolve;});}data.set(k,v);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>.4,notify:()=>{},events:()=>{}});
  const d=drawing(),v=new GameView(d.ctx,s);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory[card]=2;
  await s.start('A01');v.draw(0);const c=s.match!.battle.camps.find(c=>c.owner==='P')!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board,x=board.x+c.x*board.k,y=board.y+c.y*board.k;
  const target=card==='march'?s.match!.battle.camps.find(c=>c.id==='A01-N2')!:c,tx=board.x+target.x*board.k,ty=board.y+target.y*board.k;
  v.regions.find(r=>r.id===`card-${card}`)!.run();hold=true;v.down(1,x,y);if(card==='march')v.move(1,tx,ty);v.up(1,tx,ty);await writing;v.draw(200);
  const frozen=JSON.stringify(s.match);s.tick(250);assert.equal(JSON.stringify(s.match),frozen);assert.ok(d.labels.includes('保存中…'));
  if(preparation==='held gesture'){v.down(2,x,y);if(card==='march')v.move(2,tx,ty);}else{v.regions.find(r=>r.id==='cancel-card')!.run();v.draw(201);v.regions.find(r=>r.id===`card-${card}`)!.run();}
  release();await idle(s);assert.equal(v.card,card);assert.equal(s.profile!.activeInventory[card],1);
  if(preparation==='reselected card'){v.down(2,x,y);if(card==='march')v.move(2,tx,ty);}v.up(2,tx,ty);await idle(s);
  assert.equal(s.profile!.activeInventory[card],0);assert.equal(s.match!.battle.camps.find(c=>c.id===c.id)!.garrison,card==='supply'?32:5);assert.equal(v.card,null);
  if(card==='march'){assert.equal(s.match!.battle.armies.length,2);assert.ok(s.match!.battle.armies.every(a=>Math.abs(a.speed-33.6)<1e-8));}
});
function pageProfile(s:GameSession){const p=freshProfile(NOW,'layout');p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];
  p.choice={choiceId:'choice',matchId:'old',kind:'mixed',grantQuantity:1,candidateIds:['mobilize','supply','farming'],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
  const b=createBattle('A01',{id:'layout-match'});b.status='paused';p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
  p.latestResult={matchId:'old',mapId:'A01',modeId:'arena-four',settledAt:NOW,settlementWeek:p.weekId,settlementKind:'natural',qualified:true,result:{reason:'deadline',playerRank:1,independentWinner:'P',ranks:{P:1,E1:2,E2:3,E3:4},stats:b.factions.map((f,i)=>({faction:f.id,camps:i===0?4:1,troops:20,rank:i+1})),atMs:240000},rankDeltaRequested:30,rankDeltaApplied:30,rankPointsBefore:0,rankPointsAfter:30,highestRankPointsAfter:30,winsBefore:0,winsAfter:1,formalCompletedBefore:0,formalCompletedAfter:1,fixedChoices:['mobilize','supply','farming'],resultAcknowledged:false};s.profile=p;
}
test('N39: preparation preserves extreme passive counts and reports the exact integer capacity',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='prepare';s.profile!.passiveLevels.fortification=Number.MAX_SAFE_INTEGER;
  const before=JSON.stringify(s.profile);v.draw(0);v.wheel(10000);v.draw(1);v.regions.find(r=>r.id==='prepare-card-fortification')!.run();v.draw(2);
  assert.ok(d.labels.some(t=>t.includes('一级容量 59')));assert.ok(!d.labels.some(t=>t.includes('一级容量 60')));
  assert.ok(d.labels.join('').includes(String(Number.MAX_SAFE_INTEGER)));assert.equal(JSON.stringify(s.profile),before);
});
for(const feedback of ['F09 tower shot','F10 arrival conversion','F11 upgrade'] as const)for(const reducedMotion of [false,true])test(`N39: restored 100-layer ${feedback} feedback cannot replay damage or costs (reduced motion ${reducedMotion})`,async()=>{
  const initial=harness(),layers={farming:100,logistics:100,fortification:100};
  await initial.s.load();const p=initial.s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];
  p.passiveLevels={...layers};p.activeInventory={mobilize:2,march:2,supply:2,feint:2};p.settings.reducedMotion=reducedMotion;
  assert.equal(await initial.s.start('A03'),true);const prepared=initial.s.match!.battle,tower=prepared.camps.find(c=>c.id==='A03-P1')!;
  tower.garrison=70;
  // Only the initial scenario is controlled; all subsequent actions, ticks and saves use the real session.
  for(const f of prepared.factions)f.nextAiAtMs=10000;
  for(const c of prepared.camps)if(c.owner&&c.owner!=='P')c.feintUntil=1000000;
  if(feedback==='F09 tower shot'){
    const source=prepared.camps.find(c=>c.id==='A03-N2')!;source.owner='E1';source.garrison=20;source.feintUntil=1000000;tower.nextShotAtMs=500;
    assert.equal(applyBattleAction(prepared,{kind:'dispatch',faction:'E1',sequence:1,sourceId:source.id,targetId:tower.id}).ok,true);
  }else if(feedback==='F10 arrival conversion')for(const id of ['A03-N5','A03-N4']){const c=prepared.camps.find(c=>c.id===id)!;c.owner='P';c.garrison=20;}
  await initial.s.pause();assert.equal(initial.s.error,'');const saved=structuredClone(initial.s.profile),data=initial.data;
  const create=()=>{
    const events:Parameters<GameView['events']>[0]=[],d=drawing();let v:GameView;
    const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,value){data.set(k,value);},async remove(k){data.delete(k);}},now:()=>NOW,random:()=>.4,notify:()=>{},events:batch=>{events.push(...batch);v.events(batch);}});
    v=new GameView(d.ctx,s);return {s,v,d,events};
  };
  const {s,v,d,events}=create();await s.load();assert.equal(s.error,'');assert.deepEqual(s.profile,saved);assert.deepEqual(events,[]);
  assert.deepEqual(s.profile!.passiveLevels,layers);assert.deepEqual(s.match!.battle.factions.find(f=>f.id==='P')!.passives,layers);
  assert.equal(campCapacity(s.match!.battle.camps.find(c=>c.id===tower.id)!,s.match!.battle.factions.find(f=>f.id==='P')),107);
  await s.resume();v.draw(0);assert.equal(await s.action({kind:'card',cardId:'mobilize',targetId:tower.id}),true);assert.equal(s.profile!.activeInventory.mobilize,1);events.length=0;
  if(feedback==='F11 upgrade'){
    const before=structuredClone(s.match!.battle.camps.find(c=>c.id===tower.id)!);
    assert.equal(await s.action({kind:'upgrade',targetId:tower.id}),true);const upgraded=s.match!.battle.camps.find(c=>c.id===tower.id)!;
    assert.equal(upgraded.tier,3);assert.equal(upgraded.garrison,45);assert.equal(upgraded.nextShotAtMs,before.nextShotAtMs);assert.equal(upgraded.mobilizeUntil,before.mobilizeUntil);assert.deepEqual(upgraded.bonusBudget,before.bonusBudget);
    assert.deepEqual(events.filter(e=>e.type==='upgrade').map(e=>e.amount),[25]);
  }else{
    if(feedback==='F10 arrival conversion'){
      assert.equal(await s.action({kind:'dispatch',sourceId:'A03-N5',targetId:'A03-N4'}),true);
      assert.equal(s.match!.battle.armies[0]!.troopType,'cavalry');assert.equal(s.match!.battle.armies[0]!.remainingCount,10);events.length=0;
    }
    const until=feedback==='F09 tower shot'?2200:s.match!.battle.armies[0]!.arrivalAtMs;
    for(let frame=0;frame<100&&s.match!.battle.gameMs<until;frame++){const previous=s.match!.battle.gameMs;s.tick(Math.min(250,until-previous));await idle(s);assert.ok(s.match!.battle.gameMs>previous,`clock blocked: ${s.error}`);}assert.equal(s.match!.battle.gameMs,until);
    if(feedback==='F09 tower shot'){
      assert.equal(events.filter(e=>e.type==='tower-shot').length,1);assert.deepEqual(events.filter(e=>e.type==='army-loss').map(e=>e.amount),[1]);assert.equal(s.match!.battle.armies[0]!.remainingCount,9);
      assert.equal(s.match!.battle.camps.find(c=>c.id===tower.id)!.nextShotAtMs,3900);
    }else{
      assert.equal(events.filter(e=>e.type==='arrival'&&e.reason==='friendly').length,1);assert.deepEqual(events.filter(e=>e.type==='garrison-change'&&e.targetId==='A03-N4').map(e=>e.amount),[10]);
      const target=s.match!.battle.camps.find(c=>c.id==='A03-N4')!;assert.equal(target.type,'archery');assert.equal(target.garrison,32);assert.equal(s.match!.battle.armies.length,0);
    }
  }
  await s.pause();await s.resume();assert.equal(s.error,'');v.draw(0);
  const batch=structuredClone(events),before=JSON.stringify(s.profile),bytes=[...data],resources=v as unknown as {effects:unknown[];seenEffects:Set<string>};
  const effectCount=resources.effects.length,seen=[...resources.seenEffects];assert.ok(effectCount>0);
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    v.viewport={width:width!,height:height!,top:16,bottom:12};
    for(const now of [0,100,1000]){v.events(batch);v.events(batch);v.draw(now);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(resources.effects.length,effectCount);assert.deepEqual([...resources.seenEffects],seen);assert.equal(d.depth(),0);}
  }
  assert.deepEqual(events,batch,'replaying view feedback cannot emit another logical event');assert.deepEqual(s.profile!.activeInventory,{mobilize:1,march:2,supply:2,feint:2});
  const expected=structuredClone(s.profile!);expected.activeMatch!.battle.status='paused';const restored=create();await restored.s.load();assert.equal(restored.s.error,'');assert.deepEqual(restored.s.profile,expected);assert.deepEqual(restored.events,[]);assert.deepEqual([...data],bytes);
});
test('U12: the deadline notice stays readable above the battlefield and never covers live controls',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const selected of [false,true]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);if(selected)v.selected='A01-P1';
    const message='还剩 30 秒：到时城多者胜，同城数比兵力';v.notify(message);
    let notice:{x:number;y:number;w:number;h:number}|null=null;
    d.ctx.fillText=(text,x,y)=>{if(text!==message)return;const w=d.ctx.measureText(text).width,h=Number(d.ctx.font.match(/(\d+)px/)![1]);notice={x:x-w/2,y:y-h/2,w,h};};
    const before=JSON.stringify(s.profile);v.draw(0);assert.ok(notice);const n=notice as {x:number;y:number;w:number;h:number};
    assert.ok(n.x>=8&&n.x+n.w<=width!-8);assert.ok(n.y>=16&&n.y+n.h<=78,'notice stays outside the map');
    for(const r of v.regions)assert.ok(!(n.x<r.x+r.w&&n.x+n.w>r.x&&n.y<r.y+r.h&&n.y+n.h>r.y),`notice covers ${r.id}`);
    assert.equal(JSON.stringify(s.profile),before);
  }
});
test('U17: the weekly battle notice fits above the map without covering controls or following the player home',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const selected of [false,true]){
    const {s,v,d}=harness();pageProfile(s);s.page='battle';v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);if(selected)v.selected='A01-P1';
    const message='新周已开始，旧锦囊到期，本局兵法保留';v.notify(message);
    const labels:{text:string;x:number;y:number;w:number;h:number}[]=[];
    d.ctx.fillText=(text,x,y)=>{const w=d.ctx.measureText(text).width,h=Number(d.ctx.font.match(/(\d+)px/)![1]);labels.push({text,x:x-w/2,y:y-h/2,w,h});};
    const before=JSON.stringify(s.profile);v.draw(0);const n=labels.find(l=>l.text===message);assert.ok(n);
    assert.ok(n.x>=8&&n.x+n.w<=width!-8);assert.ok(n.y>=16&&n.y+n.h<=78);
    for(const r of v.regions)assert.ok(!(n.x<r.x+r.w&&n.x+n.w>r.x&&n.y<r.y+r.h&&n.y+n.h>r.y),`notice covers ${r.id}`);
    s.page='home';labels.length=0;v.draw(0);assert.ok(!labels.some(l=>l.text===message));assert.equal(JSON.stringify(s.profile),before);
  }
});
test('U04 U17: the home weekly summary names expired and retained records and closes without changing saved progress',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d,data}=harness();await s.load();s.weekNotice=true;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const before=JSON.stringify(s.profile),bytes=[...data],labels:{text:string;x:number;y:number;w:number;h:number}[]=[];
    d.ctx.fillText=(text,x,y)=>{const w=d.ctx.measureText(text).width,h=Number(d.ctx.font.match(/(\d+)px/)![1]);labels.push({text,x,y:y-h/2,w,h});};
    v.draw(0);const close=v.regions.find(r=>r.id==='dismiss-week');assert.ok(close);assert.equal(close.label,'知道了');assert.ok(close.h>=44);
    for(const text of ['新周开启','旧锦囊、兵法、待选已到期','军功与历史最高保留']){
      assert.ok(labels.map(l=>l.text).join('').includes(text),text);
      const lines=labels.filter(l=>l.text.length>1&&text.includes(l.text));assert.ok(lines.length);
      for(const label of lines){
        assert.ok(label.x>=32&&label.x+label.w<=width!-32,'summary wraps inside its centered notice');assert.ok(label.y>=16&&label.y+label.h<=height!-12);
        for(const r of v.regions)assert.ok(!(label.x<r.x+r.w&&label.x+label.w>r.x&&label.y<r.y+r.h&&label.y+label.h>r.y),`summary covers ${r.id}`);
      }
    }
    close.run();v.draw(1);assert.equal(s.page,'home');assert.equal(s.weekNotice,false);assert.ok(!v.regions.some(r=>r.id==='dismiss-week'));assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    await s.load();assert.equal(s.weekNotice,false);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});
test('U05 U17: compact home scrolling keeps the full weekly summary and dismiss button reachable inside the safe area',async()=>{
  for(const viewport of [{width:280,height:508,top:16,bottom:12},{width:320,height:568,top:60,bottom:28}]){
    const {s,v,d,data}=harness();await s.load();s.weekNotice=true;v.viewport=viewport;v.draw(0);assert.equal(v.viewportUsable,true);
    assert.ok(v.regions.every(r=>r.h>=44),'a clipped sliver must not become a tiny interactive target');
    const before=JSON.stringify(s.profile),bytes=[...data],settings={...v.regions.find(r=>r.id==='settings')!};
    v.wheel(1000);d.labels.length=0;d.statuses.length=0;v.draw(1);const close=v.regions.find(r=>r.id==='dismiss-week');assert.ok(close,'scroll must reveal the dismiss control');assert.equal(close.h,44);
    assert.ok(close.y>=viewport.top+82&&close.y+close.h<=viewport.height-viewport.bottom);
    assert.equal(v.regions.find(r=>r.id==='settings')!.y,settings.y);assert.ok(d.labels.join('').includes('旧锦囊、兵法、待选已到期'));assert.ok(d.labels.includes('军功与历史最高保留'));
    for(const r of v.regions)assert.ok(r.y>=viewport.top&&r.y+r.h<=viewport.height-viewport.bottom,`${r.id} extends outside safe area`);
    close.run();v.draw(2);assert.equal(s.weekNotice,false);assert.ok(v.regions.some(r=>r.id==='primary'&&r.h>=44));assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    v.viewport={width:375,height:812,top:16,bottom:12};v.draw(3);const expanded=v.regions.find(r=>r.id==='rank-card')!;assert.equal(expanded.y,67,'rank entry stays anchored to the safe area after resize');assert.equal(s.page,'home');
  }
});
test('U11: losing an ordinary camp keeps battle active and only the remaining threatened camp receives a bounded reminder',()=>{
  for(const reduced of [false,true]){
    const {s,d}=harness();pageProfile(s);s.page='battle';s.profile!.settings.reducedMotion=reduced;
    const {battle:b}=createLastCampNotice();s.profile!.activeMatch!.battle=b;let reminders=0;
    const v=new GameView(d.ctx,s,()=>{reminders++;});v.draw(0);assert.equal(reminders,0);
    v.events(advanceBattle(b,1000));d.labels.length=0;d.statuses.length=0;v.draw(0);assert.equal(b.camps.filter(c=>c.owner==='P').length,1);assert.equal(b.result,null);assert.equal(s.page,'battle');assert.equal(reminders,1);
    assert.ok(d.labels.includes('末城受袭'));assert.ok(v.regions.some(r=>r.id==='pause'));assert.equal(v.modal,null);
    for(let frame=0;frame<20;frame++)v.draw(frame);assert.equal(reminders,1);
    const resources=v as unknown as {threats:{update:(battle:typeof b)=>{emphasized:boolean}}};
    advanceBattle(b,1300);v.draw(0);assert.equal(resources.threats.update(b).emphasized,false);
    s.restorationVersion++;v.draw(0);assert.equal(reminders,1,'restoration must not replay a new-threat reminder');
    const arrival=Math.max(...b.armies.map(a=>a.arrivalAtMs));v.events(advanceBattle(b,arrival));d.labels.length=0;d.statuses.length=0;v.draw(0);
    assert.ok(!d.labels.includes('末城受袭'));assert.ok(!d.labels.includes('末城'));assert.equal(b.result,null);assert.equal(b.camps.find(c=>c.id==='A01-P1')!.owner,'P');
  }
});
test('N39: long rank and historical records wrap within all three screen widths without losing digits',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=harness();pageProfile(s);s.page='ranks';s.profile!.rankPoints=Number.MAX_SAFE_INTEGER-30;s.profile!.highestRankPoints=Number.MAX_SAFE_INTEGER;
    v.viewport={width:width!,height:height!,top:16,bottom:12};const rendered:string[]=[];
    d.ctx.fillText=(text,x)=>{rendered.push(text);const size=d.ctx.measureText(text).width,left=d.ctx.textAlign==='center'?x-size/2:d.ctx.textAlign==='right'?x-size:x;assert.ok(left>=0&&left+size<=width!,`${width}: ${text} overflows`);};
    const before=JSON.stringify(s.profile);v.draw(0);v.wheel(10000);v.draw(0);
    assert.ok(rendered.join('').includes(String(s.profile!.rankPoints)));assert.ok(rendered.join('').includes(String(Number.MAX_SAFE_INTEGER)));assert.ok(!rendered.join('').includes('军衔为游戏化设计，并非历史统一晋升制度。'));v.regions.find(r=>r.id==='rank-rules')!.run();v.draw(0);assert.ok(rendered.join('').includes('军衔为游戏化设计，并非历史统一晋升制度。'));assert.equal(JSON.stringify(s.profile),before);assert.equal(d.depth(),0);
  }
});
test('N39 U10: an unrepresentable next card count cannot crash or submit the choice page and other candidates stay selectable',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='choice';s.profile!.passiveLevels.farming=Number.MAX_SAFE_INTEGER;s.profile!.activeInventory.mobilize=Number.MAX_SAFE_INTEGER;
  v.viewport={width:320,height:568,top:16,bottom:12};const before=JSON.stringify(s.profile);let claims=0;s.claim=async()=>{claims++;};
  v.draw(0);assert.ok(d.labels.join('').includes('数量超出可保存范围'));
  v.regions.find(r=>r.id==='choice-mobilize')?.run();assert.equal(v.selectedChoice,null);
  v.wheel(10000);v.draw(0);v.regions.find(r=>r.id==='choice-farming')!.run();v.regions.find(r=>r.id==='claim')!.run();assert.equal(claims,0);
  assert.equal(JSON.stringify(s.profile),before);
  v.wheel(-10000);v.draw(0);for(let i=0;i<40&&!v.regions.some(r=>r.id==='choice-supply');i++){v.wheel(30);v.draw(0);}
  const supply=v.regions.find(r=>r.id==='choice-supply');assert.ok(supply&&supply.h>=44,'scroll the second candidate into a usable touch area');supply.run();v.draw(0);v.regions.find(r=>r.id==='claim')!.run();assert.equal(claims,1);
  s.profile!.passiveLevels.farming=Number.MAX_SAFE_INTEGER-1;v.selectedChoice=null;v.wheel(10000);d.labels.length=0;d.statuses.length=0;v.draw(0);
  v.regions.find(r=>r.id==='choice-farming')!.run();assert.equal(v.selectedChoice,'farming');assert.ok(d.labels.join('').includes(`${Number.MAX_SAFE_INTEGER-1} → ${Number.MAX_SAFE_INTEGER}`));
});
for(const [width,height]of [[320,568],[375,812],[430,932]])test(`U04 U05 U10: ${width}×${height} controls remain reachable and drawing stacks balanced`,()=>{
  const {s,v,d}=harness();pageProfile(s);v.viewport={width:width!,height:height!,top:16,bottom:12};
  for(const page of ['home','lessons','prepare','pause','result','choice','library','ranks','settings','about','recovery','leaderboard'] as Page[]){
    s.page=page;v.draw(0);assert.equal(d.depth(),0,page);
    for(const r of v.regions){assert.ok(r.w>=44,page+': '+r.id);assert.ok(r.x>=0&&r.x+r.w<=width!,page+': '+r.id);assert.ok(r.y>=0&&r.y+r.h<=height!,page+': '+r.id);}
    if(page==='choice'){v.wheel(10000);v.draw(0);assert.ok(v.regions.some(r=>r.id==='choice-farming'));assert.ok(v.regions.some(r=>r.id==='claim'));}
  }
});
test('R03: pointer release uses the current garrison, not the pointer-down snapshot',async()=>{
  const {s,v}=harness();await s.load();await s.start('L01');v.draw(0);
  const b=s.match!.battle,c=b.camps[0]!;c.garrison=21;v.down(1,...campPoint(v,s,'L01-P1'));v.move(1,...campPoint(v,s,'L01-N1'));c.garrison=22;v.up(1,...campPoint(v,s,'L01-N1'));await idle(s);
  assert.equal(s.match!.battle.armies[0]!.initialCount,11);assert.equal(s.match!.battle.camps[0]!.garrison,11);
});
test('H09: held previews track production and release dispatches immediately from the latest count',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=await readyCards();v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=s.match!.battle,source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N4')!;
    source.garrison=21;source.credit=fraction(0);for(const f of b.factions)f.nextAiAtMs=10000;
    await s.pause();await s.resume();v.draw(0);
    const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
    const point=(c:typeof source):[number,number]=>[board.x+c.x*board.k,board.y+c.y*board.k];
    const preview=(expected:string)=>{d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.includes(expected),d.labels.join(' | '));assert.equal(s.match!.battle.armies.length,0);};
    v.down(1,...point(source));d.labels.length=0;v.draw(0);assert.ok(!d.labels.some(t=>t.startsWith('派 ')),'holding a camp is not a dispatch preview');
    v.move(1,...point(target));preview('派 10 · 留 11');for(let i=0;i<5;i++){s.tick(250);await idle(s);}preview('派 11 · 留 11');
    for(let i=0;i<9;i++){s.tick(250);await idle(s);}preview('派 12 · 留 12');
    v.up(1,...point(target));await idle(s);
    const current=s.match!.battle,army=current.armies[0]!;assert.equal(army.initialCount,12);assert.equal(current.camps.find(c=>c.id===source.id)!.garrison,12);
    const start=armyPosition(army,current.gameMs);s.tick(1);await idle(s);assert.ok(distance(start,armyPosition(s.match!.battle.armies[0]!,s.match!.battle.gameMs))>0);
  }
});
test('R04 R05 R06: UI release, cancellation and a second finger cannot dispatch',async()=>{
  const {s,v}=harness();await s.load();await s.start('L01');v.draw(0);const before=s.match!.battle.camps[0]!.garrison;
  v.down(1,...campPoint(v,s,'L01-P1'));v.move(1,40,40);v.up(1,40,40);await idle(s);assert.equal(s.match!.battle.armies.length,0);
  v.down(2,...campPoint(v,s,'L01-P1'));v.move(2,...campPoint(v,s,'L01-N1'));v.cancel(2);v.up(2,...campPoint(v,s,'L01-N1'));await idle(s);assert.equal(s.match!.battle.camps[0]!.garrison,before);
  v.down(3,...campPoint(v,s,'L01-P1'));v.down(4,...campPoint(v,s,'L01-P1'));v.cancel(4);v.move(4,...campPoint(v,s,'L01-N1'));v.up(4,...campPoint(v,s,'L01-N1'));assert.equal(s.match!.battle.armies.length,0);
  v.move(3,...campPoint(v,s,'L01-N1'));v.up(3,...campPoint(v,s,'L01-N1'));v.up(3,...campPoint(v,s,'L01-N1'));await idle(s);assert.equal(s.match!.battle.armies.length,1);
});
test('U08: military detail rendering fixture retains paged production and roads without changing battle status',async()=>{
  const {s,v,d}=harness();await s.load();await s.start('L01');v.draw(0);v.down(1,...campPoint(v,s,'L01-P1'));v.up(1,...campPoint(v,s,'L01-P1'));v.draw(0);
  renderCampDetailsFixture(v);assert.ok(v.regions.some(r=>r.id==='camp-details'));assert.ok(v.regions.some(r=>r.id==='upgrade'));assert.equal(s.match!.battle.status,'running');
  v.regions.find(r=>r.id==='camp-details')!.run();v.draw(0);assert.ok(d.labels.some(t=>t.includes('道路出口')));v.regions.find(r=>r.id==='camp-details')!.run();v.draw(0);assert.ok(d.labels.some(t=>t.includes('产速：基础')));
});
test('U08: all four camp queries disclose conversion and upgrade capacity using the actual upgrade outcome at every size',()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const type of ['barracks','archery','relay','fort'] as const)for(const tier of [1,2] as const){
    const {s,v,d}=harness();pageProfile(s);const b=s.profile!.activeMatch!.battle=createBattle('A03',{id:'query-upgrade',firstDragCompleted:true});s.page='battle';
    const c=b.camps.find(c=>c.type===type)!,owner=b.factions.find(f=>f.id==='P')!;c.owner='P';c.tier=tier;c.garrison=tier===1?30:70;c.nextShotAtMs=type==='fort'?2000:null;owner.passives={farming:2,logistics:2,fortification:2};
    const before=JSON.stringify(b),upgraded=structuredClone(b),oldCapacity=campCapacity(c,owner),oldRate=asNumber(productionRate(b,c,owner,0));
    assert.ok(applyBattleAction(upgraded,{kind:'upgrade',faction:'P',sequence:1,targetId:c.id}).ok);
    const next=upgraded.camps.find(camp=>camp.id===c.id)!,newCapacity=campCapacity(next,owner),newRate=asNumber(productionRate(upgraded,next,owner,0));
    v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);v.selected=c.id;d.labels.length=0;d.statuses.length=0;v.draw(0);
    renderCampDetailsFixture(v);const pages=Number(v.regions.find(r=>r.id==='camp-details')!.label.split('/')[1]!.split(' ')[0]);
    for(let page=1;page<pages;page++){v.regions.find(r=>r.id==='camp-details')!.run();v.draw(0);}
    assert.ok(d.labels.join('').includes(`友援或占领后转为${CAMP_CONFIG[type].troopName}`),`${width}/${type}: missing conversion`);
    assert.ok(d.labels.includes(`升级容量：${oldCapacity} → ${newCapacity}`),`${width}/${type}: missing upgrade capacity`);
    assert.ok(d.labels.includes(`自然产速 ${oldRate.toFixed(2)} → ${newRate.toFixed(2)}/秒`));
    assert.ok(v.regions.find(r=>r.id==='upgrade')!.label.includes(`留 ${next.garrison}`));assert.equal(JSON.stringify(b),before);assert.equal(d.depth(),0);
  }
});

test('H16 H17 U08: the paused army list exposes all 256 independent forces at three sizes without changing battle state',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=await readyCards();s.profile!.activeMatch!.battle=createStatePressure().battle;s.profile!.activeInventory={...s.match!.battle.factions[0]!.inventory};s.page='battle';
    v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);assert.ok(!v.regions.some(r=>r.id==='army-list'));
    await openArmyList(s,v);const b=s.match!.battle,before=JSON.stringify(b),found=new Set<string>();
    for(let page=0;page<100;page++){
      d.labels.length=0;d.statuses.length=0;v.draw(0);const rows=v.regions.filter(r=>r.id.startsWith('army-target-'));assert.ok(rows.length);
      for(const r of rows){assert.ok(!found.has(r.id),'no repeated/merged row');found.add(r.id);assert.ok(r.y>=16&&r.y+r.h<height!-68);assert.ok(r.w>=44&&r.h>=44);}
      assert.equal(d.labels.filter(t=>/^[青赤金紫]旗军 步兵 1 人$/.test(t)).length,rows.length);
      const next=v.regions.find(r=>r.id==='army-next');if(!next)break;next.run();
    }
    assert.deepEqual(found,new Set(b.armies.map(a=>`army-target-${a.id}`)));s.tick(10000);assert.equal(JSON.stringify(b),before);assert.equal(b.status,'paused');assert.equal(d.depth(),0);
  }
});

test('U08 H16: paused army inspection freezes time, then resumed arrivals clamp the new list and reject stale target actions',async()=>{
  const {s,v,d}=await readyCards();s.profile!.activeMatch!.battle=createStatePressure().battle;s.profile!.activeInventory={...s.match!.battle.factions[0]!.inventory};s.page='battle';v.draw(0);await openArmyList(s,v);
  const first=v.regions.find(r=>r.id.startsWith('army-target-'))!,army=s.match!.battle.armies.find(a=>`army-target-${a.id}`===first.id)!;
  first.run();v.draw(0);assert.equal(v.selected,army.targetId);assert.ok(v.regions.some(r=>r.id==='camp-details'));assert.ok(!v.regions.some(r=>r.id==='upgrade'));
  v.escape();v.draw(0);await openArmyList(s,v);const stale=v.regions.find(r=>r.id==='army-next')!.run;
  s.tick(250);assert.equal(s.match!.battle.gameMs,0);assert.equal(s.page,'pause');
  for(let i=0;i<100;i++){v.draw(0);const next=v.regions.find(r=>r.id==='army-next');if(!next)break;next.run();}
  const oldRow=v.regions.find(r=>r.id.startsWith('army-target-'))!.run;
  v.escape();v.draw(0);await s.resume();v.draw(0);const b=s.match!.battle;advanceBattle(b,4335);await openArmyList(s,v);
  d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.includes('当前没有行军部队'));assert.ok(d.labels.includes('1 / 1'));assert.ok(!v.regions.some(r=>r.id==='army-next'||r.id==='army-prev'));
  oldRow();stale();v.draw(0);assert.equal(v.selected,null);assert.ok(v.regions.some(r=>r.id==='back'));v.escape();v.draw(0);assert.equal(s.page,'pause');v.wheel(-10000);v.draw(0);assert.ok(v.regions.some(r=>r.id==='resume'));
});

test('H17 U04: army inspection blocks map input and its text stays inside a 320-wide list in reduced motion',async()=>{
  const {s,v,d}=await readyCards();s.profile!.activeMatch!.battle=createStatePressure().battle;s.profile!.activeInventory={...s.match!.battle.factions[0]!.inventory};s.page='battle';s.profile!.settings.reducedMotion=true;
  v.viewport={width:320,height:568,top:16,bottom:12};v.draw(0);await openArmyList(s,v);const b=s.match!.battle,before=JSON.stringify(b);
  v.down(1,12,200);v.move(1,300,280);v.up(1,300,280);assert.equal(JSON.stringify(b),before);assert.equal(v.selected,null);
  const texts:{text:string;x:number;width:number;align:CanvasTextAlign}[]=[];
  d.ctx.fillText=(text,x)=>{texts.push({text,x,width:d.ctx.measureText(text).width,align:d.ctx.textAlign});};v.draw(0);
  const start=texts.findIndex(t=>t.text==='行军军情');assert.ok(start>=0);
  for(const t of texts.slice(start)){const left=t.align==='center'?t.x-t.width/2:t.align==='right'?t.x-t.width:t.x;assert.ok(left>=0&&left+t.width<=320,`${t.text} leaves the viewport`);}
  v.escape();v.draw(0);assert.equal(s.page,'pause');assert.equal(d.depth(),0);
});

test('N63 U08: reopened army inspection reflects tower casualties and the one-time volley while preserving troop identity',async()=>{
  const {s,v,d}=harness();pageProfile(s);let b=s.match!.battle;b.status='running';s.page='battle';
  const source=b.camps.find(c=>c.id==='A01-N2')!,target=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=20;target.owner='E1';target.garrison=20;target.nextShotAtMs=500;
  const sent=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id});assert.ok(sent.ok);
  v.draw(0);await openArmyList(s,v);d.labels.length=0;d.statuses.length=0;v.draw(0);
  assert.ok(d.labels.includes('青旗军 弓兵 10 人'));assert.ok(d.labels.some(t=>t.includes('待齐射')));
  const frozen=JSON.stringify(s.match!.battle);s.tick(10000);assert.equal(JSON.stringify(s.match!.battle),frozen);
  v.escape();await s.resume();v.draw(0);b=s.match!.battle;
  const events=advanceBattle(b,b.armies[0]!.volleyCheckAtMs!);assert.ok(events.some(e=>e.type==='tower-shot'));assert.ok(events.some(e=>e.type==='volley'));assert.equal(b.armies[0]!.remainingCount,9);
  b.camps.find(c=>c.id===source.id)!.owner='E2';await openArmyList(s,v);d.labels.length=0;d.statuses.length=0;v.draw(0);
  assert.ok(d.labels.includes('青旗军 弓兵 9 人'));assert.ok(d.labels.some(t=>t.includes('已齐射')));assert.ok(!d.labels.some(t=>t.includes('待齐射')));assert.equal(s.match!.battle.armies[0]!.troopType,'archer');
});

test('N41: all archer tiers expose the actual production, equal speed and unchanged volley rules at three widths',()=>{
  for(const width of [320,375,430])for(const [tier,rate]of [[1,'0.60'],[2,'0.78'],[3,'0.96']] as const){
    const {s,v,d}=harness();pageProfile(s);s.match!.battle=createBattle('L03',{id:'tier-query',firstDragCompleted:true});s.page='battle';
    const b=s.match!.battle,source=b.camps.find(c=>c.id==='L03-P2')!,target=b.camps.find(c=>c.id==='L03-N2')!;source.tier=tier;source.garrison=20;
    v.viewport={width,height:812,top:16,bottom:12};v.draw(0);v.selected=source.id;d.labels.length=0;d.statuses.length=0;
    const before=JSON.stringify(b);renderCampDetailsFixture(v);for(let page=0;page<8;page++){v.draw(0);v.regions.find(r=>r.id==='camp-details')!.run();}
    assert.ok(d.labels.includes(`产速：基础 ${rate} → ${rate}/秒`));assert.ok(d.labels.includes('速度：基础 24.00 → 24.00/秒'));
    assert.ok(d.labels.includes('出征齐射一次 · 驻营不自动射击'));assert.ok(d.labels.join('').includes('70 范围，准备 0.5 秒，30%向下取整'));assert.equal(JSON.stringify(b),before);
    assert.equal(applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:source.id,targetId:target.id}).ok,true);const army=b.armies[0]!;
    assert.equal(army.speed,24);assert.equal(army.initialCount,10);assert.equal(army.volleyState,'pending');assert.ok(army.volleyCheckAtMs!>=500);
    for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}target.garrison=12;
    const events=advanceBattle(b,army.volleyCheckAtMs!);assert.deepEqual(events.filter(e=>e.type==='volley').map(e=>e.amount),[3]);
  }
});
test('U08: query current production reflects mobilization, exhausted budget, expiry, suppression and full capacity without mutation',()=>{
  for(const width of [320,375,430])for(const state of ['active','exhausted','expired','suppressed','full'] as const){
    const {s,v,d}=harness();pageProfile(s);const b=s.match!.battle=createBattle('A01',{id:'production-query',firstDragCompleted:true});s.page='battle';
    const c=b.camps.find(c=>c.id==='A01-P1')!;c.tier=3;c.garrison=state==='full'?140:20;c.mobilizeUntil=state==='expired'?0:6000;c.bonusBudget=fraction(state==='exhausted'?0:8);c.feintUntil=state==='suppressed'?4000:0;
    v.viewport={width,height:812,top:16,bottom:12};v.draw(0);v.selected=c.id;d.labels.length=0;d.statuses.length=0;const before=JSON.stringify(b);
    renderCampDetailsFixture(v);for(let page=0;page<8;page++){v.draw(0);v.regions.find(r=>r.id==='camp-details')!.run();}
    const expected=state==='active'?'2.88':state==='suppressed'||state==='full'?'0.00':'1.44';
    assert.ok(d.labels.includes(`产速：基础 1.44 → ${expected}/秒`),`${width}px ${state}: ${d.labels.join(' | ')}`);assert.equal(JSON.stringify(b),before);
  }
});
test('K27: camp queries distinguish base and passive production, speed and capacity while suppression shows zero current production',async()=>{
  const {s,v,d,point}=await readyCards();s.profile!.passiveLevels={farming:2,logistics:2,fortification:2};s.match!.battle.factions.find(f=>f.id==='P')!.passives={...s.profile!.passiveLevels};await s.pause();await s.resume();v.draw(0);
  for(const suppressed of [false,true]){
    const c=s.match!.battle.camps.find(c=>c.id==='A01-P1')!;c.feintUntil=suppressed?4000:0;c.garrison=20;c.credit={numerator:'0',denominator:'1'};if(v.regions.some(r=>r.id==='camp-details'))v.escape();v.selected=null;v.draw(0);v.down(1,...point(c.id));v.up(1,...point(c.id));const before=JSON.stringify(s.profile);d.labels.length=0;d.statuses.length=0;
    renderCampDetailsFixture(v);for(let page=0;page<8;page++){v.draw(0);v.regions.find(r=>r.id==='camp-details')!.run();}
    assert.ok(d.labels.includes(`产速：基础 0.90 → ${suppressed?'0.00':'0.96'}/秒`));assert.ok(d.labels.includes('容量：基础 50 → 53'));assert.ok(d.labels.includes('速度：基础 24.00 → 25.20/秒'));assert.equal(JSON.stringify(s.profile),before);
    const control=structuredClone(s.match!.battle);advanceBattle(control,1000);assert.equal(control.camps.find(t=>t.id===c.id)!.garrison,20);assert.deepEqual(control.camps.find(t=>t.id===c.id)!.credit,suppressed?{numerator:'0',denominator:'1'}:{numerator:'24',denominator:'25'});
  }
});
test('A01: the preparation page discloses computer stock and each enemy camp identifies its computer faction',async()=>{
  const {s,v,d,point}=await readyCards();s.page='prepare';d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.join('').includes('你与 3 个电脑'));assert.ok(!d.labels.join('').includes('电脑各有乡勇 1 张，无被动加成'));v.wheel(10000);v.draw(0);v.regions.find(r=>r.id==='prepare-rules')!.run();v.draw(0);assert.ok(d.labels.join('').includes('电脑各有乡勇 1 张，无被动加成'));
  s.page='battle';v.draw(0);const before=JSON.stringify(s.profile);
  for(const [id,label]of [['A01-E1','电脑甲'],['A01-E2','电脑乙'],['A01-E3','电脑丙']] as const){v.down(1,...point(id));v.up(1,...point(id));d.labels.length=0;d.statuses.length=0;renderCampDetailsFixture(v);assert.ok(d.labels.join('').includes(label));v.escape();v.draw(0);v.selected=null;}
  assert.equal(JSON.stringify(s.profile),before);
});
test('N42: changing the Canvas scale cannot advance the first inclusive 70-range check',()=>{
  const {s,v}=harness();pageProfile(s);s.match!.battle=createBattle('L03',{id:'scale-boundary',firstDragCompleted:true});s.page='battle';
  const b=s.match!.battle,source=b.camps.find(c=>c.id==='L03-P2')!,target=b.camps.find(c=>c.id==='L03-N2')!;
  target.x=source.x+236;target.y=source.y;target.garrison=12;source.garrison=20;for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}
  applyBattleAction(b,{kind:'dispatch',sequence:1,faction:'P',sourceId:source.id,targetId:target.id});const army=b.armies[0]!;
  const crossing=army.arrivalAtMs*148/200,delta=army.arrivalAtMs*.1/200,check=Math.ceil(crossing);
  for(const [at,range]of [[crossing-delta,70.1],[crossing,70],[crossing+delta,69.9]])assert.ok(Math.abs(distance(armyPosition(army,at!),target)-range!)<1e-8);
  advanceBattle(b,check-1);assert.equal(army.volleyState,'pending');assert.equal(target.garrison,12);
  const before=JSON.stringify(b),scales:number[]=[];for(const width of [320,375,430]){v.viewport={width,height:812,top:16,bottom:12};v.draw(0);scales.push((v as unknown as {board:{k:number}}).board.k);assert.equal(JSON.stringify(b),before);}
  assert.equal(new Set(scales).size,3);const events=advanceBattle(b,check);assert.equal(army.volleyState,'fired');assert.equal(target.garrison,9);assert.equal(events.filter(e=>e.type==='volley').length,1);
  assert.equal(advanceBattle(b,check+2).filter(e=>e.type==='volley').length,0);
});

test('U18: settings and about return to the original paused page',()=>{
  const {s,v}=harness();pageProfile(s);s.page='settings';s.returnPage='pause';v.draw(0);
  v.regions.find(r=>r.id==='about')!.run();v.draw(0);assert.equal(s.page,'about');
  v.regions.find(r=>r.id==='back')!.run();v.draw(0);assert.equal(s.page,'settings');
  v.regions.find(r=>r.id==='back')!.run();assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');
});
test('S20 U18: reset confirmation cancellation is inert, and explicit confirmation creates empty local progress',async()=>{
  const {s,v}=harness();await s.load();s.profile!.rankPoints=60;s.profile!.highestRankPoints=60;await s.setting('vibration');const before=JSON.stringify(s.profile),old=s.profile!.generation;
  s.page='settings';v.draw(0);v.wheel(1000);v.draw(0);v.regions.find(r=>r.id==='reset')!.run();assert.ok(v.modal);assert.equal(JSON.stringify(s.profile),before);v.draw(0);
  v.regions.find(r=>r.id==='modal-cancel')!.run();assert.equal(v.modal,null);assert.equal(JSON.stringify(s.profile),before);
  v.draw(0);v.regions.find(r=>r.id==='reset')!.run();v.draw(0);v.regions.find(r=>r.id==='modal-confirm')!.run();await idle(s);
  assert.equal(s.page,'home');assert.notEqual(s.profile!.generation,old);assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.highestRankPoints,0);assert.equal(s.profile!.settings.vibration,false);
});
for(const points of [7,100])test(`S15 Q14: expired formal confirmation at ${points} points preserves cancellation and forfeits only once`,async()=>{
  const {s,v,d,data,setTime}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=points;s.profile!.highestRankPoints=points;s.profile!.activeInventory.supply=1;
  await s.start('A01');const id=s.match!.battle.id,target=s.match!.battle.camps.find(c=>c.owner==='P')!.id;await s.action({kind:'card',cardId:'supply',targetId:target});await s.pause();setTime(NOW+86460000);await s.setting('vibration');
  const before=JSON.stringify(s.profile),bytes=[...data.entries()];v.draw(0);assert.ok(d.labels.join('').includes('超过 24 小时不能继续'));v.regions.find(r=>r.id==='resume')!.run();await idle(s);assert.equal(s.page,'pause');
  v.regions.find(r=>r.id==='forfeit')!.run();assert.ok(v.modal!.body.includes(`军功 ${points} → ${Math.max(0,points-10)}`));assert.ok(v.modal!.body.includes('已用锦囊不返还'));v.draw(0);v.regions.find(r=>r.id==='modal-cancel')!.run();
  assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data.entries()],bytes);assert.equal(await s.start('A02'),false);assert.equal(s.match!.battle.id,id);assert.equal(s.page,'pause');
  v.draw(0);v.regions.find(r=>r.id==='forfeit')!.run();v.draw(0);const confirm=v.regions.find(r=>r.id==='modal-confirm')!.run;confirm();confirm();await idle(s);await s.load();
  assert.equal(s.page,'home');assert.equal(s.profile!.activeMatch,null);assert.equal(s.profile!.rankPoints,Math.max(0,points-10));assert.equal(s.profile!.highestRankPoints,points);assert.equal(s.profile!.activeInventory.supply,0);
  assert.equal(s.profile!.latestResult!.settlementKind,'forfeit');assert.equal(s.profile!.latestResult!.result,null);assert.equal(s.profile!.choice,null);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.formalCompleted,0);assert.equal(s.profile!.latestResult!.rankDeltaApplied,-Math.min(points,10));
  assert.equal(await s.start('A01'),true);assert.notEqual(s.match!.battle.id,id);
});
test('U01: the single home action follows recovery, result, choice and active-match priority',()=>{
  const {s,v,d}=harness();pageProfile(s);
  for(const [label,page]of [['恢复记录','recovery'],['查看战果','result'],['领取奖励','choice'],['继续对战','pause']] as const){
    s.error=page==='recovery'?'test recovery':'';if(page==='choice')s.profile!.latestResult!.resultAcknowledged=true;if(page==='pause')s.profile!.choice!.state='claimed';
    s.page='home';d.labels.length=0;d.statuses.length=0;const before=JSON.stringify(s.profile);v.draw(0);assert.ok(d.labels.includes(label));assert.equal(v.regions.filter(r=>r.id==='primary').length,1);v.regions.find(r=>r.id==='primary')!.run();assert.equal(s.page,page);assert.equal(JSON.stringify(s.profile),before);
  }
});
test('U02: the home action starts the first lesson or a formal battle directly',async()=>{
  for(const returning of [false,true]){const {s,v,d}=harness();await s.load();if(returning){s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];}
    v.draw(0);assert.ok(d.labels.includes(returning?'出征':'开始练兵'));v.regions.find(r=>r.id==='primary')!.run();await idle(s);assert.equal(s.page,'battle');assert.equal(s.match!.battle.mapId,returning?'A01':'L01');}
});
test('Q02: a fourth-place result at zero or three points explains the floor and displays only the actual deduction',async()=>{
  for(const points of [0,3]){
    const {s,v,d}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=points;s.profile!.highestRankPoints=480;
    await s.start('A01');const b=s.match!.battle;b.gameMs=239999;for(const f of b.factions)f.nextAiAtMs=240001;for(const c of b.camps){if(c.owner)c.garrison=c.owner==='P'?0:1;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
    s.tick(1);await idle(s);const r=s.profile!.latestResult!;assert.equal(r.result!.playerRank,4);assert.equal(r.rankDeltaRequested,-10);assert.equal(r.rankDeltaApplied,0-points);assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.highestRankPoints,480);v.draw(0);
    assert.ok(d.labels.includes(`军功 ${points===0?'+0':`-${points}`}`));assert.ok(!d.labels.join('').includes('军功最低为 0'));
    const disclosure=v.regions.find(r=>r.id==='result-details');assert.ok(disclosure);disclosure.run();d.labels.length=0;v.draw(1);
    assert.ok(d.labels.join('').includes(`军功最低为 0，本次实际扣除 ${points}。`));assert.ok(!d.labels.some(t=>t.startsWith('-10 ·')));
    const saved=JSON.stringify(s.profile);await s.load();assert.equal(JSON.stringify(s.profile),saved);
  }
});
test('Q10: leaving formal preparation creates no match, score responsibility or storage write',async()=>{
  const {s,v,data}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;await s.setting('vibration');
  s.page='home';s.primary();assert.equal(s.page,'prepare');const before=JSON.stringify(s.profile),bytes=[...data.entries()];v.draw(0);assert.ok(v.regions.some(r=>r.id==='start-arena'));v.regions.find(r=>r.id==='back')!.run();s.tick(250);
  assert.equal(s.page,'home');assert.equal(s.match,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data.entries()],bytes);
});
test('S13: saving home and following the main action retains the paused formal snapshot without a forfeit',async()=>{
  const {s,v,d}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.rankPoints=100;s.profile!.highestRankPoints=100;await s.start('A01');
  await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'});s.tick(250);v.draw(0);v.regions.find(r=>r.id==='pause')!.run();await idle(s);v.draw(0);v.regions.find(r=>r.id==='save-home')!.run();await idle(s);
  assert.equal(s.page,'home');const saved=JSON.stringify(s.match);s.tick(250);assert.equal(JSON.stringify(s.match),saved);v.draw(0);assert.ok(d.labels.includes('继续对战'));v.regions.find(r=>r.id==='primary')!.run();assert.equal(s.page,'pause');assert.equal(JSON.stringify(s.match),saved);
  assert.equal(await s.start('A02'),false);assert.equal(JSON.stringify(s.match),saved);v.draw(0);v.regions.find(r=>r.id==='resume')!.run();await idle(s);assert.equal(s.page,'battle');assert.equal(s.match!.battle.gameMs,250);assert.equal(s.profile!.rankPoints,100);assert.equal(s.profile!.latestResult,null);
  const resumed=structuredClone(s.match!);resumed.battle.status='paused';assert.equal(JSON.stringify(resumed),saved);
});
test('T05 T07: first-lesson wins and replay offer formal preparation without extra rewards or requiring later lessons',async()=>{
  const {s,v}=harness();await s.load();
  for(let attempt=0;attempt<2;attempt++){
    assert.equal(await s.start('L01'),true);const enemy=s.match!.battle.camps.find(c=>c.owner==='E')!;enemy.garrison=0;enemy.feintUntil=1000000;
    // A vulnerable opponent is a fixture; both dispatches, occupation, rewards and page actions are real.
    assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);for(let frame=0;frame<30&&s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner!=='P';frame++){s.tick(250);await idle(s);}assert.equal(s.match!.battle.camps.find(c=>c.id==='L01-N1')!.owner,'P');assert.equal(await s.action({kind:'dispatch',sourceId:'L01-N1',targetId:'L01-E1'}),true);
    for(let frame=0;frame<40&&s.page==='battle';frame++){s.tick(250);await idle(s);}assert.equal(s.page,'result');assert.equal(s.profile!.latestResult!.result!.independentWinner,'P');assert.deepEqual(s.profile!.tutorialFirstWins,['L01']);assert.deepEqual(s.profile!.unlockedCardIds,['mobilize','supply','farming']);
    assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.qualifiedArenaWins,0);assert.equal(s.profile!.formalCompleted,0);assert.equal(s.profile!.choice,null);assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));
    v.draw(0);v.regions.find(r=>r.id==='result-home')!.run();await idle(s);assert.equal(s.page,'prepare');assert.equal(s.profile!.latestResult!.resultAcknowledged,true);
  }
  v.draw(0);v.regions.find(r=>r.id==='start-arena')!.run();await idle(s);assert.equal(s.match!.battle.mapId,'A01');assert.equal(s.match!.rankedCommitment,true);assert.deepEqual(s.profile!.tutorialFirstWins,['L01']);
});
test('T05 U13: final-lesson victory offers distinct formal battle and home actions without granting cards twice',async()=>{
  for(const action of ['again','result-home'] as const){
    const {s,v}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02'];s.profile!.unlockedCardIds=['mobilize','supply','farming','feint','fortification'];
    assert.equal(await s.start('L03'),true);const b=s.match!.battle;
    // Controlled final capture; the production action, terminal settlement and navigation run unchanged.
    for(const c of b.camps){c.owner=c.id==='L03-E1'?'E':'P';c.feintUntil=1000000;if(c.type==='fort')c.nextShotAtMs=2000;if(c.id==='L03-E1')c.garrison=0;}
    assert.equal(await s.action({kind:'dispatch',sourceId:'L03-E2',targetId:'L03-E1'}),true);
    for(let i=0;i<40&&s.page==='battle';i++){s.tick(250);await idle(s);}assert.equal(s.page,'result');v.draw(0);
    assert.equal(v.regions.find(r=>r.id==='again')!.label,'开始征战');assert.equal(v.regions.find(r=>r.id==='result-home')!.label,'回首页');
    v.regions.find(r=>r.id===action)!.run();await idle(s);assert.equal(s.page,action==='again'?'battle':'home');if(action==='again')assert.equal(s.match!.battle.mapId,'A01');
    assert.equal(s.profile!.latestResult!.resultAcknowledged,true);assert.deepEqual(s.profile!.tutorialFirstWins,['L01','L02','L03']);assert.deepEqual([...s.profile!.unlockedCardIds].sort(),[...CARD_IDS].sort());
    assert.ok(Object.values(s.profile!.activeInventory).every(n=>n===0));assert.ok(Object.values(s.profile!.passiveLevels).every(n=>n===0));assert.equal(s.profile!.rankPoints,0);assert.equal(s.profile!.qualifiedArenaWins,0);
    const saved=structuredClone(s.profile!);if(action==='again')saved.activeMatch!.battle.status='paused';await s.load();assert.deepEqual(s.profile,saved);
  }
});
test('K04 K05: march clears only after a successful committed dispatch',async()=>{
  const {s,v}=harness();await s.load();await s.start('L01');v.draw(0);
  s.match!.battle.factions[0]!.inventory.march=2;v.card='march';
  v.down(1,...campPoint(v,s,'L01-P1'));v.move(1,...campPoint(v,s,'L01-P1'));v.up(1,...campPoint(v,s,'L01-P1'));assert.equal(v.card,'march');
  v.down(2,...campPoint(v,s,'L01-P1'));v.move(2,...campPoint(v,s,'L01-N1'));v.up(2,...campPoint(v,s,'L01-N1'));await idle(s);
  assert.equal(v.card,null);assert.equal(s.match!.battle.armies.length,1);assert.equal(s.match!.battle.factions[0]!.inventory.march,1);
  v.down(3,...campPoint(v,s,'L01-P1'));v.move(3,...campPoint(v,s,'L01-N1'));v.up(3,...campPoint(v,s,'L01-N1'));await idle(s);
  assert.equal(s.match!.battle.factions[0]!.inventory.march,1);
});
test('K13 K14: supply previews the effective capacity and full camps do not consume',async()=>{
  const {s,v,d}=harness();await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=2;
  await s.start('A01');v.draw(0);const c=s.match!.battle.camps.find(c=>c.owner==='P')!;c.garrison=48;
  const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,x=board.x+c.x*board.k,y=board.y+c.y*board.k;
  v.card='supply';v.down(1,x,y);v.draw(0);assert.ok(d.labels.some(t=>t.includes('松手补 2 兵')));
  v.up(1,x,y);await idle(s);assert.equal(s.match!.battle.camps.find(c=>c.owner==='P')!.garrison,50);assert.equal(s.profile!.activeInventory.supply,1);
  const full=JSON.stringify(s.profile);v.card='supply';v.down(2,x,y);v.draw(1);assert.ok(d.labels.join('').includes('此营已满，不消耗'));v.up(2,x,y);await idle(s);assert.equal(s.profile!.activeInventory.supply,1);assert.equal(v.card,'supply');assert.equal(JSON.stringify(s.profile),full);assert.equal(s.error,'');
});

test('N68 F01: archer drag stays brief while explicit details explain volley and conversion without changing battle',()=>{
  const {s,v,d}=harness();pageProfile(s);s.profile!.activeMatch!.battle=createBattle('L03',{id:'preview',firstDragCompleted:true});s.page='battle';v.draw(0);
  const b=s.match!.battle,source=b.camps.find(c=>c.type==='archery'&&c.owner==='P')!,target=b.camps.find(c=>c.id==='L03-N2')!;
  const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;const point=(c:{x:number;y:number})=>[board.x+c.x*board.k,board.y+c.y*board.k] as const;
  const before=JSON.stringify(b);v.down(1,...point(source));v.move(1,...point(target));v.draw(10);
  assert.ok(d.labels.some(t=>t.startsWith('派 ')));assert.ok(d.labels.some(t=>t.includes('秒到达')));assert.ok(!d.labels.some(t=>t.includes('理论齐射')));v.cancel();v.selected=source.id;renderCampDetailsFixture(v);for(let i=0;i<8;i++){v.regions.find(r=>r.id==='camp-details')!.run();v.draw(0);}assert.ok(d.labels.join('').includes('30%向下取整'));assert.ok(d.labels.join('').includes('友援或占领后转为弓兵'));assert.equal(JSON.stringify(b),before);
});
test('F08: source capture immediately cancels a prepared march gesture',()=>{
  const {s,v}=harness();pageProfile(s);s.page='battle';s.match!.battle.status='running';v.draw(0);
  const source=s.match!.battle.camps.find(c=>c.owner==='P')!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
  v.card='march';v.down(1,board.x+source.x*board.k,board.y+source.y*board.k);v.move(1,160,160);source.owner='E1';v.draw(10);
  assert.equal(v.card,null);assert.equal((v as unknown as {gesture:unknown}).gesture,null);
});

test('F12: feedback freezes with game time, deduplicates and reduced motion keeps actual loss',t=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';s.match!.battle.status='running';v.draw(0);
  let wall=100;t.mock.method(Date,'now',()=>wall);const target=s.match!.battle.camps[0]!;
  const event={id:100,atMs:0,type:'garrison-loss' as const,targetId:target.id,amount:2,reason:'volley'};
  v.events([event,event]);s.profile!.settings.reducedMotion=true;d.labels.length=0;d.statuses.length=0;v.draw(20);assert.equal(d.labels.filter(t=>t==='齐射 −2').length,1);
  wall+=10000;s.match!.battle.status='paused';d.labels.length=0;d.statuses.length=0;v.draw(10020);assert.equal(d.labels.filter(t=>t==='齐射 −2').length,1);
  s.match!.battle.gameMs=601;d.labels.length=0;d.statuses.length=0;v.draw(10021);assert.equal(d.labels.filter(t=>t==='齐射 −2').length,0);
});
test('H15: restoring an older same-match save discards future card feedback and accepts reused event IDs',async()=>{
  const {s,v,d,data}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory.supply=2;
  await s.start('A01');await s.pause();await s.resume();v.draw(0);
  for(let i=0;i<4;i++){s.tick(250);await idle(s);}
  assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);v.draw(1000);assert.ok(d.labels.includes('乡勇 +6'));
  const matchId=s.match!.battle.id,newest=SLOT_KEYS.map(key=>({key,revision:JSON.parse(data.get(key)!).revision as number})).sort((a,b)=>b.revision-a.revision)[0]!;
  data.set(newest.key,'{broken');await s.load();assert.equal(s.page,'recovery');v.draw(1100);await s.recover();v.draw(1200);await s.resume();
  assert.equal(s.match!.battle.id,matchId);assert.equal(s.match!.battle.gameMs,0);assert.equal(s.profile!.activeInventory.supply,2);
  d.labels.length=0;d.statuses.length=0;v.draw(1300);assert.ok(!d.labels.includes('乡勇 +6'),'a rolled-back card must not appear in the restored battle');
  assert.equal(await s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);d.labels.length=0;d.statuses.length=0;v.draw(1400);
  assert.equal(d.labels.filter(t=>t==='乡勇 +6').length,1);assert.equal(s.profile!.activeInventory.supply,1);
});
test('H15: pause preserves march position and effect deadlines while reload rebuilds only persistent state',async()=>{
  const {s,v,d}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:2,march:2,supply:2,feint:2};await s.start('A01');
  for(const f of s.match!.battle.factions)f.nextAiAtMs=10000;
  assert.equal(await s.action({kind:'card',cardId:'mobilize',targetId:'A01-P1'}),true);
  assert.equal(await s.action({kind:'card',cardId:'feint',targetId:'A01-E1'}),true);
  assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N2',march:true}),true);
  s.tick(100);await idle(s);v.draw(100);assert.ok(d.labels.includes('停产 +4秒'));const before=structuredClone(s.match!.battle),inventory=structuredClone(s.profile!.activeInventory),position=armyPosition(before.armies[0]!,before.gameMs);
  await s.pause();for(let i=0;i<20;i++)s.tick(250);v.draw(10000);assert.equal(s.match!.battle.gameMs,100);
  await s.resume();d.labels.length=0;d.statuses.length=0;v.draw(11000);assert.deepEqual(s.match!.battle,before);assert.ok(d.labels.includes('停产 +4秒'));
  await s.load();v.draw(12000);assert.equal(s.page,'pause');await s.resume();d.labels.length=0;d.statuses.length=0;d.scales.length=0;v.draw(13000);assert.equal(d.scales.filter(scale=>scale===4.5/16).length,2,'actual reload rebuilds both persistent symbols');
  assert.deepEqual(s.match!.battle,before);assert.deepEqual(s.profile!.activeInventory,inventory);assert.deepEqual(armyPosition(s.match!.battle.armies[0]!,100),position);
  assert.ok(d.labels.includes('3.9s'));assert.ok(d.labels.includes('5.9s'));assert.ok(!d.labels.includes('停产 +4秒'));assert.ok(!d.labels.some(t=>t.startsWith('征兵 +')));
  s.tick(100);await idle(s);assert.equal(s.match!.battle.gameMs,200);assert.ok(distance(position,armyPosition(s.match!.battle.armies[0]!,200))>0);
});
test('R34: old visual feedback is discarded on a new match and cannot mutate either battle',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';const old=s.match!.battle;old.status='running';v.draw(0);
  v.events([{id:100,atMs:0,type:'garrison-loss',targetId:old.camps[0]!.id,amount:2,reason:'volley'}]);
  v.draw(0);assert.ok(d.labels.includes('齐射 −2'));const before=JSON.stringify(old);
  s.match!.battle=createBattle('A01',{id:'replacement'});const replacement=JSON.stringify(s.match!.battle);
  for(const wall of [1,600,100000]){d.labels.length=0;d.statuses.length=0;v.draw(wall);assert.ok(!d.labels.includes('齐射 −2'));assert.equal(JSON.stringify(old),before);assert.equal(JSON.stringify(s.match!.battle),replacement);}
  const state=v as unknown as {effects:unknown[];seenEffects:Set<string>};assert.equal(state.effects.length,0);assert.equal(state.seenEffects.size,0);
});

test('K30: dragging while targeting supply cannot accidentally dispatch soldiers',async()=>{
  const {s,v,data,point}=await readyCards();v.regions.find(r=>r.id==='card-supply')!.run();const before=JSON.stringify(s.profile),bytes=[...data];
  v.down(1,...point('A01-P1'));v.move(1,...point('A01-N4'));v.up(1,...point('A01-N4'));await idle(s);
  assert.equal(v.card,null);assert.equal(s.match!.battle.armies.length,0);assert.equal(s.profile!.activeInventory.supply,2);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});

test('W06 F08: crossing a week cancels prepared cards and the held pointer',()=>{
  const {s,v}=harness();pageProfile(s);s.page='battle';s.match!.battle.status='running';v.draw(0);
  v.card='march';v.down(1,150,150);s.profile!.weekId='2026-09-14';v.draw(1);v.up(1,180,180);
  assert.equal(v.card,null);assert.equal((v as unknown as {gesture:unknown}).gesture,null);assert.equal(s.match!.battle.armies.length,0);
});
test('W06: a persisted Monday rollover cancels an actual held march gesture without dispatch or another write',async()=>{
  const {s,v,data,setTime}=harness(),monday=Date.parse('2026-09-14T00:00:00+08:00');setTime(monday-1);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory.march=1;await s.start('A01');v.draw(0);
  const b=s.match!.battle,c=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N4')!,board=(v as unknown as {board:{x:number;y:number;k:number}}).board,x=board.x+c.x*board.k,y=board.y+c.y*board.k,tx=board.x+target.x*board.k,ty=board.y+target.y*board.k;
  v.regions.find(r=>r.id==='card-march')!.run();v.down(1,x,y);v.move(1,tx,ty);assert.equal(v.card,'march');setTime(monday);await s.setting('vibration');const saved=JSON.stringify(s.profile),bytes=[...data.entries()];v.draw(1);v.up(1,tx,ty);await idle(s);
  assert.equal(v.card,null);assert.equal(s.profile!.activeInventory.march,0);assert.equal(s.match!.battle.armies.length,0);assert.equal(s.match!.battle.camps.find(c=>c.id===c.id)!.garrison,20);assert.equal(JSON.stringify(s.profile),saved);assert.deepEqual([...data.entries()],bytes);
});
test('H18: result shows committed elapsed time, rank change and settlement week wins',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='result';const r=s.profile!.latestResult!;
  r.result.atMs=73500;r.rankPointsBefore=151;r.rankPointsAfter=143;r.rankDeltaApplied=-8;r.winsBefore=4;r.winsAfter=4;r.result.playerRank=3;r.result.independentWinner='E1';
  v.draw(0);assert.ok(d.labels.includes('用时 01:13'));assert.ok(d.labels.includes('军功 -8'));
  assert.ok(d.labels.some(t=>t.includes('当前 143')));assert.ok(!d.labels.some(t=>t.includes('当前军衔调整')),'the default result keeps detailed rank history collapsed');
  for(let i=0;i<60&&!v.regions.some(r=>r.id==='result-details');i++){v.wheel(24);v.draw(i+1);}
  const disclosure=v.regions.find(r=>r.id==='result-details');assert.ok(disclosure&&disclosure.h>=44);disclosure.run();v.draw(100);
  assert.ok(d.labels.some(t=>t.includes('当前军衔调整')));
  assert.ok(d.labels.some(t=>t.includes('本周 4 胜')));assert.ok(!d.labels.some(t=>t.includes('军衔晋升')));
});
test('U05 U10 H08: large inventory stays complete, wraps and leaves every choice reachable',()=>{
  const {s,v,d}=harness();pageProfile(s);v.viewport={width:320,height:568,top:16,bottom:12};
  s.profile!.activeInventory.mobilize=999999999999;s.profile!.passiveLevels.farming=999999999999;
  s.page='choice';v.draw(0);assert.ok(d.labels.join('').includes('库存 999999999999 → 1000000000000'));
  assert.ok(d.labels.some(line=>line.includes('1000000000000')),'a readable number must stay on one line when it fits');
  v.wheel(10000);v.draw(0);assert.ok(v.regions.some(r=>r.id==='choice-farming'));assert.ok(v.regions.some(r=>r.id==='claim'));
  s.page='prepare';d.labels.length=0;d.statuses.length=0;v.draw(0);
  for(let i=0;i<40&&!v.regions.some(r=>r.id==='prepare-card-mobilize');i++){v.wheel(20);v.draw(0);}
  const mobilize=v.regions.find(r=>r.id==='prepare-card-mobilize');assert.ok(mobilize);mobilize.run();v.draw(1);assert.ok(d.labels.join('').includes('持有 999999999999 张'));
  v.regions.find(r=>r.id==='card-sheet-close')!.run();v.draw(2);v.wheel(10000);v.draw(3);v.regions.find(r=>r.id==='prepare-card-farming')!.run();v.draw(4);assert.ok(d.labels.join('').includes('999999999999 层'));assert.equal(d.depth(),0);
});

for(const [before,after,duration]of [[30,60,220],[150,180,300]] as const)test(`G3: committed rank ${before} to ${after} emphasizes once for ${duration} ms`,()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='result';const r=s.profile!.latestResult!;r.rankPointsBefore=before;r.rankPointsAfter=after;
  const event={id:900,atMs:240000,type:'result' as const};v.events([event]);const saved=JSON.stringify(s.profile);
  v.draw(100);assert.ok(d.strokes.some(o=>o.width===2&&o.color===COLORS.player&&o.alpha===.65));assert.ok(d.labels.includes('军功 +30'));
  v.events([event]);d.strokes.length=0;v.draw(100+duration-1);assert.ok(d.strokes.some(o=>o.width===2&&o.color===COLORS.player));
  d.strokes.length=0;v.draw(100+duration);assert.ok(!d.strokes.some(o=>o.width===2&&o.color===COLORS.player));
  v.events([event]);d.strokes.length=0;v.draw(100+duration+1);assert.ok(!d.strokes.some(o=>o.width===2&&o.color===COLORS.player));assert.equal(JSON.stringify(s.profile),saved);assert.equal(d.depth(),0);
});
test('G3: restored results, reduced motion and background cancellation never replay promotion',()=>{
  for(const mode of ['restored','reduced','background','return'] as const){const {s,v,d}=harness();pageProfile(s);s.page='result';const event={id:900,atMs:240000,type:'result' as const};
    if(mode!=='restored')v.events([event]);
    if(mode==='reduced')s.profile!.settings.reducedMotion=true;
    if(mode==='background')v.cancel();
    if(mode==='return'){s.page='home';v.draw(0);s.page='result';}
    d.strokes.length=0;v.draw(1);assert.ok(!d.strokes.some(o=>o.width===2&&o.color===COLORS.player),mode);assert.ok(d.labels.includes('军功 +30'));
  }
});
test('G3: demotion fades gently for 150 ms without a promotion outline',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='result';const r=s.profile!.latestResult!;r.rankPointsBefore=151;r.rankPointsAfter=143;
  v.events([{id:900,atMs:240000,type:'result'}]);v.draw(100);assert.ok(!d.strokes.some(o=>o.width===2&&o.color===COLORS.player));assert.ok(d.strokes.some(o=>o.alpha===.65));
  d.strokes.length=0;v.draw(250);assert.ok(!d.strokes.some(o=>o.alpha===.65));assert.ok(!d.labels.some(t=>t.includes('军衔晋升')));
});
test('N10: a tier-three camp exposes no further upgrade control',()=>{
  const {s,v}=harness();pageProfile(s);s.page='battle';const camp=s.match!.battle.camps.find(c=>c.owner==='P')!;camp.tier=3;camp.garrison=140;v.draw(0);
  const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;const x=board.x+camp.x*board.k,y=board.y+camp.y*board.k;
  v.down(1,x,y);v.up(1,x,y);v.draw(0);assert.ok(!v.regions.some(r=>r.id==='upgrade'));assert.equal(camp.garrison,140);
});
for(const change of ['captured','damaged','eliminated'] as const)test(`N14: upgrade preview rechecks a camp that is ${change} before confirmation`,async()=>{
  const {s,v}=harness();await s.load();s.profile!.firstDragCompleted=true;await s.start('L01');const b=s.match!.battle,camp=b.camps.find(c=>c.owner==='P')!,enemy=b.camps.find(c=>c.id==='L01-N1')!;
  camp.garrison=30;v.draw(0);const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,x=board.x+camp.x*board.k,y=board.y+camp.y*board.k;
  v.down(1,x,y);v.up(1,x,y);v.draw(0);const upgrade=v.regions.find(r=>r.id===`upgrade-camp-${camp.id}`)!;assert.ok(upgrade);
  if(change==='damaged')camp.garrison=29;
  else if(change==='captured')camp.owner='E';
  else{
    camp.garrison=1;enemy.owner='E';enemy.garrison=4;assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E',sequence:1,sourceId:enemy.id,targetId:camp.id}).ok,true);
    for(const c of b.camps)c.feintUntil=1000000;advanceBattle(b,b.armies[0]!.arrivalAtMs);assert.equal(b.status,'finished');
  }
  const snapshot=JSON.stringify(s.profile);upgrade.run();await idle(s);assert.equal(JSON.stringify(s.profile),snapshot);assert.equal(camp.tier,1);
});
test('H13: two independent supplies aggregate actual gains while duplicate callbacks remain inert',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';const b=s.match!.battle,camp=b.camps.find(c=>c.owner==='P')!;b.status='running';v.draw(0);
  const first={id:901,atMs:0,type:'card' as const,targetId:camp.id,faction:'P' as const,reason:'supply',amount:6};
  v.events([first]);b.gameMs=50;const second={...first,id:902,atMs:50,amount:2};v.events([second,second]);
  const snapshot=JSON.stringify(s.profile);d.labels.length=0;d.statuses.length=0;v.draw(50);assert.ok(d.labels.includes('乡勇 +8'));assert.equal(JSON.stringify(s.profile),snapshot);
  b.gameMs=601;d.labels.length=0;d.statuses.length=0;v.draw(601);assert.ok(d.labels.includes('乡勇 +2'));assert.ok(!d.labels.includes('乡勇 +8'));
});
test('H13 F12: simultaneous clipped tower and volley losses retain both actual totals',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';const camp=s.match!.battle.camps.find(c=>c.owner==='P')!;v.draw(0);s.profile!.settings.reducedMotion=true;
  v.events([{id:903,atMs:0,type:'garrison-loss',targetId:camp.id,reason:'tower-shot',amount:1},{id:904,atMs:0,type:'garrison-loss',targetId:camp.id,reason:'volley',amount:2}]);
  d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.includes('塔射 −1 · 齐射 −2'));
});
test('H13: committed supply actions publish +8 only after the real 42 to 48 to 50 transactions',async()=>{
  const {s,v,d}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01'];s.profile!.unlockedCardIds=['mobilize','supply','farming'];s.profile!.activeInventory.supply=2;
  await s.start('A01');const id=s.match!.battle.camps.find(c=>c.owner==='P')!.id;s.match!.battle.camps.find(c=>c.id===id)!.garrison=42;await s.pause();await s.resume();v.draw(0);
  assert.equal(await s.action({kind:'card',cardId:'supply',targetId:id}),true);assert.equal(s.match!.battle.camps.find(c=>c.id===id)!.garrison,48);assert.equal(s.profile!.activeInventory.supply,1);
  s.match!.battle.gameMs=50;assert.equal(await s.action({kind:'card',cardId:'supply',targetId:id}),true);assert.equal(s.match!.battle.camps.find(c=>c.id===id)!.garrison,50);assert.equal(s.profile!.activeInventory.supply,0);
  d.labels.length=0;d.statuses.length=0;v.draw(50);assert.ok(d.labels.includes('乡勇 +8'));assert.equal(await s.action({kind:'card',cardId:'supply',targetId:id}),false);
  d.labels.length=0;d.statuses.length=0;v.draw(51);assert.ok(d.labels.includes('乡勇 +8'));assert.ok(!d.labels.includes('乡勇 +14'));
});
test('F04 F10: successful reinforcement animates settled conversion, full camps and reduced motion do not add figures',()=>{
  for(const [garrison,reduced]of [[0,false],[50,false],[0,true]] as const){
    const {s,v,d}=harness();pageProfile(s);const b=createBattle('L03',{id:'arrival-feedback',firstDragCompleted:true});s.profile!.activeMatch!.battle=b;s.page='battle';s.profile!.settings.reducedMotion=reduced;
    const source=b.camps.find(c=>c.id==='L03-P1')!,target=b.camps.find(c=>c.id==='L03-P2')!;source.garrison=20;target.garrison=garrison;
    for(const c of b.camps)c.feintUntil=1000000;
    applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id});const events=advanceBattle(b,b.armies[0]!.arrivalAtMs);
    assert.equal(target.garrison,garrison===50?50:10);assert.equal(target.type,'archery');const snapshot=JSON.stringify(b);
    v.events(events);d.scales.length=0;v.draw(0);assert.equal(d.scales.includes(.7),garrison===0&&!reduced);
    assert.equal(JSON.stringify(b),snapshot);assert.equal(d.depth(),0);
    b.status='paused';d.scales.length=0;v.draw(10000);assert.equal(d.scales.includes(.7),garrison===0&&!reduced,'wall-clock pause does not finish the arrival');
    b.gameMs+=550;d.scales.length=0;v.draw(10001);assert.ok(!d.scales.includes(.7));
  }
});
test('F06 F10: capture immediately exposes the final flag and conversion without delaying new-owner actions',()=>{
  const {s,v,d}=harness();pageProfile(s);const b=createBattle('L03',{id:'capture-feedback',firstDragCompleted:true});s.profile!.activeMatch!.battle=b;s.page='battle';
  const source=b.camps.find(c=>c.id==='L03-P1')!,target=b.camps.find(c=>c.id==='L03-N1')!;source.garrison=28;target.garrison=10;for(const c of b.camps)c.feintUntil=1000000;
  applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id});const events=advanceBattle(b,b.armies[0]!.arrivalAtMs);
  assert.equal(target.owner,'P');assert.equal(target.garrison,4);assert.equal(target.type,'relay');v.events(events);d.scales.length=0;v.draw(0);assert.ok(d.labels.some(t=>t.includes('夺城')));
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:2,sourceId:target.id,targetId:source.id}).ok,true);assert.equal(b.armies[0]!.troopType,'cavalry');assert.equal(b.armies[0]!.initialCount,2);
});
test('G4: supply uses at most three local figures; card accents preserve Canvas state and do not loop in reduced motion',()=>{
  const d=drawing();for(const amount of [1,2,6]){d.scales.length=0;cardAccent(d.ctx,100,100,'supply','archer','P',amount,50,false);assert.equal(d.scales.filter(s=>s===.55).length,Math.min(3,amount));assert.equal(d.depth(),0);}
  d.scales.length=0;cardAccent(d.ctx,100,100,'supply','archer','P',6,50,true);assert.ok(!d.scales.includes(.55));
  for(const id of ['mobilize','feint'] as const){for(const age of [0,100,220]){cardAccent(d.ctx,100,100,id,'infantry','P',0,age,false);assert.equal(d.depth(),0);assert.equal(d.ctx.globalAlpha,1);}}
  arrivalAccent(d.ctx,100,100,'cavalry','archer','P',80);assert.equal(d.depth(),0);assert.equal(d.ctx.globalAlpha,1);
});
test('G4: committed orders display their identity once for 600 game milliseconds and restore without replay',async()=>{
  for(const id of ['mobilize','supply','feint','march'] as const){
    const {s,v,d}=harness(true);await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:2,march:2,supply:2,feint:2};await s.start('A01');v.draw(0);
    const result=id==='march'?await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N2',march:true}):await s.action({kind:'card',cardId:id,targetId:id==='feint'?'A01-E1':'A01-P1'});
    assert.equal(result,true);const before=JSON.stringify(s.profile);d.labels.length=0;d.statuses.length=0;v.draw(0);assert.ok(d.labels.includes(CARDS[id].name));assert.equal(JSON.stringify(s.profile),before);
    d.labels.length=0;d.statuses.length=0;v.draw(50000);assert.ok(d.labels.includes(CARDS[id].name),'wall time cannot age a game-clock confirmation');
    s.match!.battle.gameMs=600;d.labels.length=0;d.statuses.length=0;v.draw(50001);assert.ok(!d.labels.includes(CARDS[id].name));
    await s.load();d.labels.length=0;d.statuses.length=0;v.draw(50002);assert.ok(!d.labels.includes(CARDS[id].name),'restoration does not replay a confirmed order');
  }
});
test('G4 H13: renewing suppression uses a 160 ms accent and retains the complete 8-second commitment',()=>{
  const {s,v,d}=harness();pageProfile(s);s.page='battle';const b=s.match!.battle;b.status='running';b.factions.find(f=>f.id==='P')!.inventory.feint=2;v.draw(0);
  v.events(applyBattleAction(b,{kind:'card',cardId:'feint',faction:'P',sequence:1,targetId:'A01-E1'}).events);b.gameMs=50;
  v.events(applyBattleAction(b,{kind:'card',cardId:'feint',faction:'P',sequence:2,targetId:'A01-E1'}).events);assert.equal(b.camps.find(c=>c.id==='A01-E1')!.feintUntil,8000);
  d.scales.length=0;v.draw(50);assert.ok(d.scales.includes(10/16));
  b.gameMs=210;d.scales.length=0;d.labels.length=0;d.statuses.length=0;v.draw(210);assert.ok(!d.scales.includes(10/16));assert.ok(d.labels.includes('停产 +8秒'));assert.ok(d.labels.includes('7.8s'));assert.equal(b.factions.find(f=>f.id==='P')!.inventory.feint,0);
});

test('S03: pause retains full-size camp and march positions while its backdrop rejects input and clock advancement',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true]){
    const {s,v,d,data}=await readyCards();s.profile!.settings.reducedMotion=reduced;
    await s.action({kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N4'});s.tick(350);await idle(s);
    v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(100);
    const originalBoard={...(v as unknown as {board:{x:number;y:number;k:number}}).board};await s.pause();
    const before=JSON.stringify(s.profile),bytes=[...data],shifts:{x:number;y:number}[]=[];
    d.ctx.translate=(x,y)=>{shifts.push({x,y});};d.labels.length=0;d.statuses.length=0;v.draw(101);
    assert.ok(d.labels.includes('休整片刻'));assert.deepEqual((v as unknown as {board:unknown}).board,originalBoard);
    const b=s.match!.battle,{x:ox,y:oy,k}=originalBoard;
    for(const c of b.camps){assert.ok(shifts.some(p=>Math.abs(p.x-(ox+c.x*k))<.001&&Math.abs(p.y-(oy+c.y*k-6))<.001));assert.ok(d.labels.includes(String(c.garrison)));}
    for(const a of b.armies){const p=armyPosition(a,b.gameMs);assert.ok(shifts.some(q=>Math.abs(q.x-(ox+p.x*k))<.001&&Math.abs(q.y-(oy+p.y*k))<.001));}
    assert.ok(!v.regions.some(r=>r.id==='pause'||r.id.startsWith('card-')||r.id==='upgrade'));
    v.down(70,6,height!/2);v.move(70,width!-6,height!/2);v.up(70,width!-6,height!/2);s.tick(5000);v.draw(10000);await idle(s);
    assert.equal(s.page,'pause');assert.equal(v.selected,null);assert.equal(v.card,null);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    await s.load();v.draw(10004);assert.equal(s.match!.battle.gameMs,b.gameMs);assert.deepEqual(s.match!.battle,b);
  }
});

test('U04 S10: closing the pause panel resumes temporary practice and preserves original unreadable records',async()=>{
  for(const button of ['back','resume']){
    const {s,v,data}=harness();for(const key of SLOT_KEYS)data.set(key,'{broken');await s.load();const bytes=[...data];
    await s.start('L01',true);await s.pause();v.draw(0);const id=s.match!.battle.id;
    v.regions.find(r=>r.id===button)!.run();await idle(s);v.draw(1);
    assert.equal(s.page,'battle');assert.equal(s.match!.battle.id,id);assert.ok(s.temporary);assert.equal(s.profile,null);assert.deepEqual([...data],bytes);
  }
});

test('P3: page and confirmation fade for 180 UI ms, or stay static in reduced motion, with immediate actions',async()=>{
  for(const reduced of [false,true]){
    const {s,v,d,data}=await readyCards();s.profile!.settings.reducedMotion=reduced;await s.pause();const before=JSON.stringify(s.profile),bytes=[...data];
    const washes:number[]=[];d.ctx.fillRect=(x,y,w,h)=>{if(x===0&&y===0&&w===375&&h===812&&d.ctx.fillStyle===COLORS.paper&&d.ctx.globalAlpha<1)washes.push(d.ctx.globalAlpha);};
    v.draw(100);if(reduced)assert.equal(washes.length,0);else assert.ok(washes.some(a=>Math.abs(a-.18)<.001));assert.ok(v.regions.some(r=>r.id==='resume'));
    washes.length=0;v.draw(190);if(reduced)assert.equal(washes.length,0);else assert.ok(washes.some(a=>Math.abs(a-.09)<.001));washes.length=0;v.draw(280);assert.equal(washes.length,0);
    v.draw(5000);assert.equal(washes.length,0);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    v.wheel(10000);v.draw(5001);v.regions.find(r=>r.id==='forfeit')!.run();
    const alpha:number[]=[];d.ctx.fillText=(label)=>{if(label==='放弃本局？')alpha.push(d.ctx.globalAlpha);};
    v.draw(6000);assert.equal(alpha.at(-1),reduced?1:.82);assert.ok(v.regions.some(r=>r.id==='modal-confirm'));assert.ok(v.regions.every(r=>r.id.startsWith('modal-')));
    v.draw(6090);assert.ok(Math.abs(alpha.at(-1)!-(reduced?1:.91))<.001);v.draw(6180);assert.equal(alpha.at(-1),1);
    v.regions.find(r=>r.id==='modal-cancel')!.run();v.draw(6181);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});

test('S03: full-size paused maps retain exact high garrisons and every crowded march head without changing snapshots',async()=>{
  for(const mapId of ['L01','L02','L03','A01','A02','A03'] as const)for(const [width,height]of [[280,508],[320,568],[375,812],[430,932]]){
    const {s,v,d}=await readyCards();s.profile!.activeMatch!.battle=createBattle(mapId,{firstDragCompleted:true});const b=s.match!.battle;
    for(const c of b.camps)c.garrison=10000;b.status='paused';s.page='pause';v.viewport={width:width!,height:height!,top:16,bottom:12};
    const positions:{x:number;y:number;width:number}[]=[];d.ctx.fillText=(text,x,y)=>{if(text==='10000')positions.push({x,y,width:d.ctx.measureText(text).width});};v.draw(0);
    assert.equal(positions.length,b.camps.length);for(const a of positions)for(const z of positions)if(a!==z)assert.ok(Math.abs(a.x-z.x)>=(a.width+z.width)/2||Math.abs(a.y-z.y)>=20,'full-size garrison text overlaps');
  }
  const {s,v,d,data}=await readyCards();s.profile!.activeMatch!.battle=createStatePressure().battle;s.match!.battle.status='paused';s.page='pause';const before=JSON.stringify(s.profile),bytes=[...data],heads:{x:number;y:number}[]=[];
  d.ctx.translate=(x,y)=>{heads.push({x,y});};v.draw(0);const board=(v as unknown as {board:{x:number;y:number;k:number}}).board;
  for(const a of s.match!.battle.armies){const p=armyPosition(a,s.match!.battle.gameMs);assert.ok(heads.some(q=>Math.abs(q.x-(board.x+p.x*board.k))<1e-8&&Math.abs(q.y-(board.y+p.y*board.k))<1e-8));}
  assert.equal(s.match!.battle.armies.length,256);v.draw(200);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
});

test('T2: valid fire-strategy and dispatch target rings stay below buildings and exact garrison text at all phone sizes',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true])for(const mode of ['feint','dispatch']){
    const {s,v,d,data,point}=await readyCards();s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};v.draw(0);
    const targetId=mode==='feint'?'A01-E1':'A01-N4',target=s.match!.battle.camps.find(c=>c.id===targetId)!,[tx,ty]=point(targetId);
    const before=JSON.stringify(s.profile),bytes=[...data],order:string[]=[];let ringPath=false;
    const originalStroke=d.ctx.stroke,originalText=d.ctx.fillText;
    d.ctx.beginPath=()=>{ringPath=false;};
    d.ctx.ellipse=(x,y,rx,ry)=>{ringPath=Math.abs(x-tx)<1e-8&&Math.abs(y-(ty+9))<1e-8&&rx===32&&ry===18;};
    d.ctx.stroke=()=>{if(ringPath){assert.equal(d.ctx.strokeStyle,COLORS.player,'the target is legal');order.push('ground-ring');}originalStroke.call(d.ctx);};
    d.ctx.translate=(x,y)=>{if(Math.abs(x-tx)<1e-8&&Math.abs(y-(ty-6))<1e-8)order.push('building');};
    d.ctx.fillText=(text,x,y)=>{if(text===String(target.garrison)&&Math.abs(x-tx)<1e-8&&Math.abs(y-(ty+24.5))<1e-8)order.push('count');originalText.call(d.ctx,text,x,y);};
    if(mode==='feint'){v.regions.find(r=>r.id==='card-feint')!.run();assert.equal(v.card,'feint');}
    else{v.down(89,...point('A01-P1'));v.move(89,tx,ty);}
    v.draw(1);
    assert.equal(order.filter(kind=>kind==='ground-ring').length,1,`${width}/${reduced}/${mode}: the legal target ring is present`);
    assert.ok(order.includes('building')&&order.includes('count'));
    assert.ok(order.indexOf('ground-ring')<order.indexOf('building'),'city artwork paints over the ground ring');
    assert.ok(order.indexOf('ground-ring')<order.indexOf('count'),'the ground ring cannot cover authoritative troops');
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);assert.equal(d.depth(),0);
    v.cancel();assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});

test('T2: a real 300 ms departure stays above city artwork and below authoritative garrison text at three phone sizes',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true]){
    const {s,v,d}=await readyCards();s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=s.match!.battle;assert.equal(await s.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N2'}),true);
    const current=s.match!.battle;advanceBattle(current,300);v.draw(0);
    const board=(v as unknown as {board:{x:number;y:number;k:number}}).board,army=current.armies[0]!,position=armyPosition(army,current.gameMs);
    const head={x:board.x+position.x*board.k,y:board.y+position.y*board.k},events:{kind:string;x:number;y:number;text?:string}[]=[];
    d.ctx.translate=(x,y)=>events.push({kind:'translate',x,y});d.ctx.fillText=(text,x,y)=>events.push({kind:'text',text,x,y});
    const before=JSON.stringify(current);v.draw(100000);assert.equal(JSON.stringify(current),before);assert.equal(current.gameMs,300);assert.equal(army.remainingCount,10);
    const close=(a:number,z:number)=>Math.abs(a-z)<1e-8;
    const headIndex=events.findLastIndex(e=>e.kind==='translate'&&close(e.x,head.x)&&close(e.y,head.y));assert.ok(headIndex>=0);
    for(const camp of current.camps){
      const x=board.x+camp.x*board.k,y=board.y+camp.y*board.k;
      const buildingIndex=events.findIndex(e=>e.kind==='translate'&&close(e.x,x)&&close(e.y,y-6));
      const countIndex=events.findIndex(e=>e.kind==='text'&&e.text===String(camp.garrison)&&close(e.x,x)&&close(e.y,y+24.5));
      assert.ok(buildingIndex>=0&&buildingIndex<headIndex,'city artwork cannot cover the departing head');
      assert.ok(countIndex>headIndex,'true garrison numbers stay above marching illustrations');
    }
    assert.equal(b.id,current.id);assert.equal(d.depth(),0);
  }
});


test('T2: cavalry queries format the new 33.60 base speed without changing movement arithmetic',()=>{
  const {s,v,d}=harness();pageProfile(s);s.match!.battle=createBattle('A02',{id:'cavalry-speed',firstDragCompleted:true});s.page='battle';
  const b=s.match!.battle,camp=b.camps.find(c=>c.type==='relay')!;camp.owner='P';const before=JSON.stringify(b);v.draw(0);v.selected=camp.id;d.labels.length=0;d.statuses.length=0;
  renderCampDetailsFixture(v);for(let page=0;page<8;page++){v.draw(0);v.regions.find(r=>r.id==='camp-details')!.run();}
  assert.equal(b.ruleRevision,'1.6');assert.ok(d.labels.includes('速度：基础 33.60 → 33.60/秒'));assert.ok(!d.labels.some(text=>text.includes('33.5999')));assert.equal(JSON.stringify(b),before);
});

test('U05 H17: the light battle reserves only 52 top and 72 bottom pixels without resizing roads during selection',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d}=await readyCards();v.viewport={width:width!,height:height!,top:16,bottom:12};
    const fills:{y:number;h:number}[]=[];d.ctx.fillRect=(x,y,w,h)=>{if(x===0&&w===width&&d.ctx.fillStyle==='#D7C5A1F2')fills.push({y,h});};
    d.labels.length=0;v.draw(0);const board=structuredClone((v as unknown as {board:{x:number;y:number;k:number}}).board);
    assert.equal(board.k,Math.min((width!-16)/360,(height!-16-12-124)/540));
    assert.ok(board.y>=68&&board.y+540*board.k<=height!-12-72);
    assert.deepEqual(fills.at(-1),{y:height!-12-72,h:84});
    assert.deepEqual(v.regions.map(r=>r.id).sort(),['pause','card-mobilize','card-march','card-supply','card-feint'].sort());
    assert.ok(!d.labels.some(t=>/末城|行军军情|屯田|神速|扩营|沿路扩张/.test(t)));
    const snapshot=JSON.stringify(s.profile),source=campPoint(v,s,'A01-P1'),target=campPoint(v,s,'A01-N2');
    v.down(1,...source);v.up(1,...source);v.draw(0);
    assert.deepEqual((v as unknown as {board:unknown}).board,board);assert.ok(v.regions.some(r=>r.id==='camp-surface'));assert.ok(!v.regions.some(r=>r.id==='open-camp-details')); 
    assert.ok(!v.regions.some(r=>r.id==='camp-details'));assert.ok(d.labels.includes('产兵 0.90 兵/秒'));assert.ok(d.labels.includes('容量 50 兵')); assert.equal(s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,20);
    for(const r of v.regions)assert.ok(r.w>=44&&r.h>=44&&r.y+r.h<=height!-12,`${r.id} must remain a full touch target`);
    v.down(2,...source);v.move(2,...target);v.draw(0);assert.deepEqual((v as unknown as {board:unknown}).board,board);
    assert.ok(d.labels.includes('派 10 · 留 10'));v.cancel();assert.equal(JSON.stringify(s.profile),snapshot);
  }
});

test('U08 R34: military detail rendering fixture blocks map input, closes to metrics and invalidates hidden eave upgrades',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,data}=await readyCards();v.viewport={width:width!,height:height!,top:16,bottom:12};s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison=30;v.draw(0);
    const point=campPoint(v,s,'A01-P1'),target=campPoint(v,s,'A01-N2');v.down(1,...point);v.up(1,...point);v.draw(0);
    const stale=v.regions.find(r=>r.id==='upgrade-camp-A01-P1')!.run;renderCampDetailsFixture(v);const before=JSON.stringify(s.profile),bytes=[...data];
    assert.ok(v.regions.every(r=>['back','close-camp','camp-details','upgrade'].includes(r.id)));
    v.down(2,...point);v.move(2,...target);v.up(2,...target);await idle(s);assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
    stale();await idle(s);assert.equal(JSON.stringify(s.profile),before,'an eave action cannot run through the military detail screen');
    v.escape();v.draw(0);assert.ok(v.regions.some(r=>r.id==='camp-surface'));assert.ok(!v.regions.some(r=>r.id==='open-camp-details')); assert.ok(!v.regions.some(r=>r.id==='camp-details'));
    v.regions.find(r=>r.id==='close-camp')!.run();v.draw(0);assert.equal(v.selected,null);assert.equal(v.regions.filter(r=>r.id.startsWith('card-')).length,4);
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);
  }
});

test('H17 N63: stationary render time never changes real camp or marching counts and only the army head tracks the rule position',async()=>{
  const {s,v,d}=await readyCards();const b=s.match!.battle;
  for(const c of b.camps){c.feintUntil=1000000;c.nextShotAtMs=null;}for(const f of b.factions)f.nextAiAtMs=1000000;
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'}).ok,true);advanceBattle(b,800);
  const texts:{text:string;x:number;y:number;font:string}[]=[];d.ctx.fillText=(text,x,y)=>texts.push({text,x,y,font:d.ctx.font});
  const before=JSON.stringify(b);v.draw(100);const first=texts.filter(t=>t.font.startsWith('600 14px')&&t.text==='10');assert.equal(first.length,1,'one ordinary army must have one exact count label');
  for(const wallTime of [200,5000,90000]){texts.length=0;v.draw(wallTime);assert.deepEqual(texts.filter(t=>t.font.startsWith('600 14px')&&t.text==='10'),first);assert.equal(JSON.stringify(b),before);}
  assert.equal(b.armies[0]!.remainingCount,10);assert.equal(b.camps.find(c=>c.id==='A01-P1')!.garrison,10);
  for(const c of b.camps)assert.ok(texts.some(t=>t.text===String(c.garrison)&&t.font==='600 16px sans-serif'),'every city keeps its exact original integer');
});

test('U04 N39: rank rules are folded initially, explicitly readable and never spend inventory or write progress',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]]){
    const {s,v,d,data}=await readyCards();await s.pause();s.page='ranks';s.returnPage='pause';v.viewport={width:width!,height:height!,top:16,bottom:12};
    const before=JSON.stringify(s.profile),bytes=[...data];d.labels.length=0;v.draw(0);
    assert.ok(d.labels.some(t=>t.startsWith('下一级还需')));assert.ok(d.labels.some(t=>t.startsWith('曾达')));assert.ok(!d.labels.join('').includes('军衔为游戏化设计'));
    const toggle=v.regions.find(r=>r.id==='rank-rules')!;assert.ok(toggle.w>=44&&toggle.h>=44);toggle.run();v.draw(0);assert.ok(d.labels.join('').includes('军衔没有战斗属性'));
    v.regions.find(r=>r.id==='rank-rules')!.run();d.labels.length=0;v.draw(0);assert.ok(!d.labels.join('').includes('军衔没有战斗属性'));
    assert.equal(JSON.stringify(s.profile),before);assert.deepEqual([...data],bytes);v.regions.find(r=>r.id==='back')!.run();assert.equal(s.page,'pause');assert.equal(s.match!.battle.status,'paused');
  }
});

test('F12 H17 N63: real tower casualties keep 19 troops and a local −1 together for 300 game ms, including reduced motion',async()=>{
  for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true]){
    const {s,v,d}=await readyCards();s.profile!.settings.reducedMotion=reduced;v.viewport={width:width!,height:height!,top:16,bottom:12};
    const b=createBattle('A01',{id:'local-tower-loss',firstDragCompleted:true}),source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    source.owner='P';source.garrison=40;tower.owner='E1';tower.garrison=30;tower.nextShotAtMs=2000;s.profile!.activeMatch!.battle=b;
    assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}).ok);
    advanceBattle(b,1999);v.draw(0);assert.equal(b.armies[0]!.remainingCount,20);
    const events=advanceBattle(b,2000),loss=events.filter(e=>e.type==='army-loss');assert.equal(loss.length,1);assert.equal(loss[0]!.amount,1);assert.equal(loss[0]!.reason,'tower-shot');
    assert.equal(loss[0]!.targetId,b.armies[0]!.id);assert.equal(b.armies[0]!.remainingCount,19);v.events(events);
    const texts:{text:string;x:number;y:number;font:string;color:string|CanvasGradient|CanvasPattern}[]=[];
    d.ctx.fillText=(text,x,y)=>texts.push({text,x,y,font:d.ctx.font,color:d.ctx.fillStyle});
    for(const age of [0,150,299,300]){
      advanceBattle(b,2000+age);texts.length=0;const before=JSON.stringify(b);v.draw(5000+age);
      const badge=texts.filter(t=>t.text==='19'&&t.font.startsWith('600 14px'));assert.equal(badge.length,1,`${width}/${reduced}/${age}: the hit army keeps its exact current count`);
      const localLoss=texts.filter(t=>t.text==='−1');assert.equal(localLoss.length,age<300?1:0,'one actual loss, without a second board-wide caption');
      if(age<300){assert.equal(badge[0]!.color,'#FFF3D5');assert.equal(localLoss[0]!.color,COLORS.enemy1);assert.ok(Math.abs(localLoss[0]!.x-badge[0]!.x)<=24&&Math.abs(localLoss[0]!.y-badge[0]!.y)<=24,'loss stays attached to the same army badge');}
      else assert.equal(badge[0]!.color,'#FFF3D5');
      const stationary=structuredClone(texts);texts.length=0;v.events(events);v.draw(90000+age);
      assert.deepEqual(texts,stationary,'UI time and duplicate events do not animate, move or double the loss readout');assert.equal(JSON.stringify(b),before);assert.equal(b.armies[0]!.remainingCount,19);assert.equal(d.depth(),0);
    }
  }
});
