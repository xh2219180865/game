import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GameView} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';
import {CARD_IDS} from '../src/core/progress.ts';
import {factionOf} from '../src/core/battle.ts';

type Point={x:number;y:number};
const NOW=Date.parse('2026-09-13T23:59:00+08:00');
const MONDAY=Date.parse('2026-09-14T00:00:00+08:00');

async function harness(width=375,height=812){
  const data=new Map<string,string>();let writes=0,now=NOW,frame=0;
  const state:Record<string,unknown>={};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    if(key==='measureText')return (text:string)=>({width:[...text].length*7});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(t,key,value){t[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  const storage={async read(k:string){return data.get(k)??null;},async write(k:string,v:string){writes++;data.set(k,v);},async remove(k:string){writes++;data.delete(k);}};
  const s=new GameSession({storage,now:()=>now,random:()=>.3,notify:()=>{},events:()=>{}});
  await s.load();s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];
  s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};
  const v=new GameView(ctx,s);v.viewport={width,height,top:16,bottom:12};await s.start('A01');
  const draw=()=>v.draw(++frame*100);
  const find=(id:string)=>{const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id}`);return r;};
  const center=(id:string):Point=>{const r=find(id);return {x:r.x+r.w/2,y:r.y+r.h/2};};
  const camp=(id:string):Point=>{const c=s.match!.battle.camps.find(c=>c.id===id);assert.ok(c);return (v as unknown as {point(c:Point):Point}).point(c);};
  const tap=(p:Point,id=1)=>{v.down(id,p.x,p.y);v.up(id,p.x,p.y);};
  const hold=(card:string,target:Point,id=2)=>{const p=center(`card-${card}`);v.down(id,p.x,p.y);v.move(id,target.x,target.y);draw();};
  const release=(p:Point,id=2)=>v.up(id,p.x,p.y);
  const prepare=(card:string)=>{tap(center(`card-${card}`));draw();};
  const targetDown=(card:string,target:Point,id=2)=>{prepare(card);v.down(id,target.x,target.y);};
  const snapshot=()=>({profile:JSON.stringify(s.profile),data:[...data],writes});
  draw();return {s,v,draw,find,center,camp,tap,hold,release,prepare,targetDown,snapshot,setTime:(value:number)=>{now=value;}};
}
async function idle(s:GameSession){for(let i=0;i<40&&s.busy;i++)await new Promise<void>(r=>setImmediate(r));assert.equal(s.busy,0,'transaction completed');}

for(const [width,height]of [[320,568],[375,812],[430,932]] as const){
  test(`M2 ${width}: tapping march only arms it; the next valid road dispatch consumes and persists it once`,async()=>{
    const h=await harness(width,height),before=h.snapshot(),source=h.camp('A01-P1'),target=h.camp('A01-N2');
    h.prepare('march');await idle(h.s);h.draw();
    assert.equal(h.v.card,'march');assert.deepEqual(h.snapshot(),before,'arming is read only');assert.equal(h.s.match!.battle.armies.length,0);
    h.v.down(3,source.x,source.y);h.v.move(3,target.x,target.y);h.draw();h.release(target,3);h.release(target,3);await idle(h.s);h.draw();
    assert.equal(h.s.profile!.activeInventory.march,2);assert.equal(h.s.match!.battle.armies.length,1);
    const army=h.s.match!.battle.armies[0]!;assert.equal(army.initialCount,10);assert.ok(Math.abs(army.speed-33.6)<1e-8);assert.equal(h.v.card,null);
    assert.equal(h.s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,10);assert.ok(h.snapshot().writes>before.writes);
    await h.s.load();assert.equal(h.s.profile!.activeInventory.march,2);assert.equal(h.s.match!.battle.armies.length,1);assert.equal(h.s.match!.battle.armies[0]!.id,army.id);
  });
}

for(const card of ['mobilize','supply','feint','march'] as const){
  test(`M2 ${card}: dragging to valid, wrong owner, blank, UI or cancelling never selects, targets, writes or spends`,async()=>{
    const h=await harness(),wrong=h.camp(card==='feint'?'A01-P1':'A01-E1'),valid=h.camp(card==='feint'?'A01-E1':'A01-P1');
    for(const end of ['valid','wrong','blank','ui','cancel'] as const){
      const before=h.snapshot(),target=end==='wrong'?wrong:end==='blank'?{x:2,y:100}:end==='ui'?h.center('pause'):valid;
      h.hold(card,target);assert.equal(h.v.card,null,'dragging a card must not prepare it');assert.equal(h.v.selected,null,'dragging a card must not select its target');if(end==='cancel')h.v.cancel(2);h.release(target);await idle(h.s);h.draw();
      assert.deepEqual(h.snapshot(),before,`${end} must preserve the complete atomic save`);assert.equal(h.v.card,null);
    }
  });
}

for(const signal of ['pagehide','visibilitychange','wechat-hide'] as const)for(const card of ['supply','march'] as const){
  test(`M2 ${signal}: selected ${card} with a pending target tap is cleared by the real platform binding and stale release after resume is free`,async()=>{
    const h=await harness(),target=h.camp('A01-P1');h.targetDown(card,target);assert.equal(h.v.card,card);
    const stock={...h.s.profile!.activeInventory},battle=structuredClone(h.s.match!.battle);
    const file=signal==='wechat-hide'?'wechat':'browser',prefix=signal==='wechat-hide'?'wx.onHide(':`${signal==='pagehide'?'window':'document'}.addEventListener('${signal}'`;
    const binding=readFileSync(new URL(`../src/platform/${file}.ts`,import.meta.url),'utf8').split('\n').find(line=>line.startsWith(prefix));assert.ok(binding,'real platform lifecycle registration');
    let handler:()=>void=()=>{throw new Error('missing lifecycle handler');};
    const host={hidden:true,addEventListener(_name:string,callback:()=>void){handler=callback;},onHide(callback:()=>void){handler=callback;}};
    new Function('window','document','wx','view','audio','session',`let last=0,hidden=false;${binding}`)(host,host,host,h.v,{suspend(){}},h.s);
    handler();assert.equal(h.v.card,null);await idle(h.s);assert.equal(h.s.page,'pause');assert.deepEqual(h.s.profile!.activeInventory,stock);assert.deepEqual(h.s.match!.battle,{...battle,status:'paused'});
    await h.s.resume();h.draw();const before=h.snapshot();h.release(target);await idle(h.s);assert.deepEqual(h.snapshot(),before);
  });
}

for(const redraw of [false,true]){
  test(`M2 cross-week pending target tap with redraw ${redraw}: weekly expiry persists without applying the old card`,async()=>{
    const h=await harness(),target=h.camp('A01-P1'),beforeCamp=structuredClone(h.s.match!.battle.camps.find(c=>c.id==='A01-P1'));
    h.targetDown('supply',target);h.setTime(MONDAY);h.s.tick(0);await idle(h.s);assert.equal(h.s.profile!.weekId,'2026-09-14');
    const expired=h.snapshot();if(redraw)h.draw();h.release(target);await idle(h.s);
    assert.deepEqual(h.snapshot(),expired);assert.deepEqual(h.s.profile!.activeInventory,{mobilize:0,march:0,supply:0,feint:0});
    assert.deepEqual(h.s.match!.battle.camps.find(c=>c.id==='A01-P1'),beforeCamp);assert.equal(h.v.card,null);
  });
  test(`M2 replaced match with redraw ${redraw}: an old card gesture cannot target the new match`,async()=>{
    const h=await harness(),target=h.camp('A01-P1');h.targetDown('supply',target);const oldId=h.s.match!.battle.id;
    await h.s.forfeit();assert.equal(await h.s.start('A01'),true);assert.notEqual(h.s.match!.battle.id,oldId);
    const before=h.snapshot();if(redraw)h.draw();h.release(target);await idle(h.s);assert.deepEqual(h.snapshot(),before);assert.equal(h.v.card,null);
  });
}

test('M2: crossing the week during the unobserved target tap expires stock and rejects its effect',async()=>{
  const h=await harness(),target=h.camp('A01-P1');h.targetDown('supply',target);h.setTime(MONDAY);h.release(target);await idle(h.s);h.draw();
  assert.equal(h.s.profile!.weekId,'2026-09-14');assert.equal(h.s.profile!.activeInventory.supply,0);assert.equal(h.s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,20);
  await h.s.load();assert.equal(h.s.profile!.weekId,'2026-09-14');assert.equal(h.s.profile!.activeInventory.supply,0);assert.equal(h.s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,20);
});

test('M2: tapping a card then its target remains available, with switching and cancellation free',async()=>{
  const h=await harness(),before=h.snapshot();
  for(const card of ['mobilize','march','feint','supply'] as const){h.tap(h.center(`card-${card}`));h.draw();assert.equal(h.v.card,card);assert.deepEqual(h.snapshot(),before);}
  h.tap(h.center('card-supply'));h.draw();assert.equal(h.v.card,null);assert.deepEqual(h.snapshot(),before);
  h.tap(h.center('card-supply'));h.draw();h.tap(h.camp('A01-P1'));await idle(h.s);h.draw();
  assert.equal(h.s.profile!.activeInventory.supply,2);assert.equal(h.s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,26);assert.equal(h.v.card,null);
});

test('M2: a second finger cannot release or retarget the pending selected-strategy target tap',async()=>{
  const h=await harness(),target=h.camp('A01-P1'),before=h.snapshot();h.targetDown('supply',target,7);
  const other=h.center('card-feint');h.v.down(8,other.x,other.y);h.v.move(8,target.x,target.y);h.release(target,8);await idle(h.s);assert.deepEqual(h.snapshot(),before);assert.equal(h.v.card,'supply');
  h.release(target,7);await idle(h.s);assert.equal(h.s.profile!.activeInventory.supply,2);assert.equal(h.s.profile!.activeInventory.feint,3);
});

test('M2: empty stock cannot be revived by dragging; a pending target tap rechecks stock spent by a concurrent transaction',async()=>{
  const h=await harness();h.s.profile!.activeInventory.supply=1;factionOf(h.s.match!.battle,'P')!.inventory.supply=1;await h.s.pause();await h.s.resume();h.draw();
  const target=h.camp('A01-P1');h.targetDown('supply',target);assert.equal(await h.s.action({kind:'card',cardId:'supply',targetId:'A01-P1'}),true);
  const before=h.snapshot();h.release(target);await idle(h.s);h.draw();assert.deepEqual(h.snapshot(),before);assert.equal(h.s.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,26);
  h.v.cancel();h.draw();h.hold('supply',target);h.release(target);await idle(h.s);assert.deepEqual(h.snapshot(),before);assert.equal(h.v.card,null);
});

for(const end of ['source','unconnected','blank','ui','cancel'] as const)test(`M2 armed march: ${end} release cannot consume a card or dispatch troops`,async()=>{
  const h=await harness(),source=h.camp('A01-P1');h.prepare('march');assert.equal(h.v.card,'march');
  const before=h.snapshot(),target=end==='source'?source:end==='unconnected'?h.camp('A01-E1'):end==='ui'?h.center('pause'):end==='cancel'?h.camp('A01-N2'):{x:2,y:100};
  h.v.down(3,source.x,source.y);h.v.move(3,target.x,target.y);h.draw();if(end==='cancel')h.v.cancel(3);h.release(target,3);await idle(h.s);
  assert.deepEqual(h.snapshot(),before);assert.equal(h.s.match!.battle.armies.length,0);assert.equal(h.s.profile!.activeInventory.march,3);
});

for(const card of ['supply','march'] as const)test(`M2 viewport changes: stale held ${card} release stays inert after layout adapts`,async()=>{
  const h=await harness(),target=h.camp('A01-P1');h.targetDown(card,target);const before=h.snapshot();
  h.v.viewport={width:430,height:932,top:24,bottom:20};h.draw();const moved=h.camp('A01-P1');h.release(moved);await idle(h.s);
  assert.deepEqual(h.snapshot(),before);assert.equal(h.v.card,null);assert.equal(h.s.page,'battle');
});

for(const card of ['mobilize','supply','feint','march'] as const)for(const move of [false,true])test(`M2 ${card}: card-origin drag with move=${move} never miscasts an already selected supply`,async()=>{
  const h=await harness(),target=h.camp(card==='feint'?'A01-E1':'A01-P1');h.prepare('supply');const before=h.snapshot(),origin=h.center(`card-${card}`);
  h.v.down(2,origin.x,origin.y);if(move){h.v.move(2,target.x,target.y);h.draw();}h.release(target);await idle(h.s);h.draw();
  assert.deepEqual(h.snapshot(),before);assert.equal(h.v.card,'supply');assert.equal(h.v.selected,null);
  assert.equal(h.s.match!.battle.armies.length,0);
});

for(const [width,height]of [[320,568],[375,812],[430,932]] as const)for(const card of ['mobilize','supply','feint'] as const)test(`M2 ${width} ${card}: tapping a valid target commits once, double release cannot duplicate the effect`,async()=>{
  const h=await harness(width,height),targetId=card==='feint'?'A01-E1':'A01-P1',target=h.camp(targetId);h.targetDown(card,target);
  h.release(target);h.release(target);await idle(h.s);h.draw();
  assert.equal(h.s.profile!.activeInventory[card],2);assert.equal(h.v.card,null);const camp=h.s.match!.battle.camps.find(c=>c.id===targetId)!;
  if(card==='mobilize'){assert.equal(camp.mobilizeUntil,6000);assert.equal(camp.bonusBudget.numerator,'8');}
  else if(card==='supply')assert.equal(camp.garrison,26);else assert.equal(camp.feintUntil,4000);
  await h.s.load();assert.equal(h.s.profile!.activeInventory[card],2);
});

for(const card of ['mobilize','supply','feint'] as const)test(`M2 ${card}: wrong target taps, blank taps and cancelling a pending target stay free`,async()=>{
  const h=await harness(),wrong=h.camp(card==='feint'?'A01-P1':'A01-E1'),valid=h.camp(card==='feint'?'A01-E1':'A01-P1');
  for(const end of ['wrong','blank','cancel','ui'] as const){
    h.v.cancel();h.draw();const before=h.snapshot(),target=end==='wrong'?wrong:end==='blank'?{x:2,y:100}:valid;
    h.targetDown(card,target);if(end==='cancel')h.v.cancel(2);if(end==='ui'){const ui=h.center('pause');h.v.move(2,ui.x,ui.y);h.release(ui);}else h.release(target);
    await idle(h.s);h.draw();assert.deepEqual(h.snapshot(),before);assert.equal(h.s.page,'battle');
  }
});
