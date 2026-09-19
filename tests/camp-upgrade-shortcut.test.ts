import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/app/session.ts';
import {GameView} from '../src/render/game.ts';
import {CARD_IDS} from '../src/core/progress.ts';
import {UPGRADE} from '../src/core/config.ts';

async function harness(width=375,height=812){
  const data=new Map<string,string>(),texts:string[]=[],state:Record<string,unknown>={};let fail=false;
  const ctx=new Proxy(state,{get(t,k){
    if(k in t)return t[String(k)];
    if(k==='measureText')return (s:string)=>({width:s.length*7});
    if(k==='fillText')return (s:string)=>texts.push(s);
    if(k==='createLinearGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(t,k,v){t[String(k)]=v;return true;}}) as CanvasRenderingContext2D;
  let view:GameView;
  const session=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){if(fail)throw Error('write blocked');data.set(k,v);},async remove(k){data.delete(k);}},now:()=>Date.parse('2026-09-19T20:00:00+08:00'),random:()=>.3,notify:m=>view.notify(m),events:e=>view.events(e)});
  view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};await session.load();
  session.profile!.firstDragCompleted=true;session.profile!.tutorialFirstWins=['L01','L02','L03'];session.profile!.unlockedCardIds=[...CARD_IDS];session.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};await session.start('A01');
  const draw=()=>{texts.length=0;view.draw(0);};
  const shortcuts=()=>view.regions.filter(r=>r.id.startsWith('upgrade-camp-'));
  const camp=()=>session.match!.battle.camps.find(c=>c.owner==='P')!;
  const tap=(id:string)=>{const r=view.regions.find(r=>r.id===id)!;assert.ok(r);view.down(1,r.x+r.w/2,r.y+r.h/2);draw();view.up(1,r.x+r.w/2,r.y+r.h/2);};
  return {session,view,draw,shortcuts,camp,tap,texts,data,fail:()=>{fail=true;}};
}
async function idle(s:GameSession){for(let i=0;i<100&&s.busy;i++)await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}

for(const [width,height]of [[320,568],[375,812],[430,932]])test(`upgrade shortcut ${width}: exact eligibility, unobstructed camp centre and one-tap commit`,async()=>{
  const h=await harness(width,height),b=h.session.match!.battle,c=h.camp();c.garrison=29;h.draw();assert.equal(h.shortcuts().length,0);
  c.garrison=30;h.draw();assert.equal(h.shortcuts().length,1);assert.ok(!h.texts.some(t=>['I','II','III'].includes(t)));
  const r=h.shortcuts()[0]!,point=(h.view as unknown as {point(p:{x:number;y:number}):{x:number;y:number}}).point(c);
  assert.equal(r.w,44);assert.equal(r.h,44);
  const scale=Math.max(20,30*Math.min((width!-16)/360,(height!-152)/540))/28;
  const badge={x:r.x+10,y:r.y+22};
  assert.ok(badge.x>point.x&&badge.x<=point.x+20*scale+10,'upgrade seal touches the right eave');
  assert.ok(badge.y>=point.y-6-12*scale&&badge.y<=point.y+2,'tier-one seal follows the low roof instead of floating above the tallest roof');
  assert.ok(r.x>point.x,'the camp centre remains a normal camp tap and drag target');assert.ok(r.y>=68);
  const before=JSON.stringify(h.session.profile),saved=[...h.data];h.view.draw(800);assert.equal(JSON.stringify(h.session.profile),before);assert.deepEqual([...h.data],saved);
  h.tap(r.id);await idle(h.session);h.draw();assert.equal(h.camp().tier,2);assert.equal(h.camp().garrison,20);assert.equal(h.shortcuts().length,0);assert.ok(h.texts.includes('已升至二级'));
  h.camp().garrison=70;h.draw();assert.equal(h.shortcuts().length,1);h.tap(h.shortcuts()[0]!.id);await idle(h.session);h.draw();assert.equal(h.camp().tier,3);assert.equal(h.camp().garrison,45);assert.equal(h.shortcuts().length,0);
});

for(const finalOnly of [false,true])test(`upgrade eave can dispatch without upgrading, release-only=${finalOnly}`,async()=>{
  const h=await harness(),c=h.camp();c.garrison=30;h.draw();
  const r=h.shortcuts()[0]!,target=h.session.match!.battle.camps.find(c=>c.id==='A01-N2')!;
  const point=(h.view as unknown as {point(p:{x:number;y:number}):{x:number;y:number}}).point(target);
  h.view.down(9,r.x+10,r.y+22);
  if(!finalOnly){h.view.move(9,point.x,point.y);h.draw();assert.equal(h.shortcuts().length,0);}
  h.view.up(9,point.x,point.y);await idle(h.session);h.draw();
  assert.equal(h.camp().tier,1);assert.equal(h.camp().garrison,15);
  assert.equal(h.session.match!.battle.armies.length,1);assert.equal(h.session.match!.battle.armies[0]!.targetId,target.id);
});

test('upgrade shortcut: stale threshold, ownership, tier, paused page and replaced match cannot spend',async()=>{
  for(const mode of ['loss','owner','tier','pause','match'] as const){
    const h=await harness(),c=h.camp();c.garrison=30;h.draw();const old=h.shortcuts()[0]!;
    if(mode==='loss')c.garrison=29;else if(mode==='owner')c.owner='E1';else if(mode==='tier')c.tier=3;else if(mode==='pause')h.session.page='pause';else h.session.match!.battle.id+='-other';
    const before=JSON.stringify(h.session.profile),saved=[...h.data];old.run();await idle(h.session);assert.equal(JSON.stringify(h.session.profile),before);assert.deepEqual([...h.data],saved);
  }
});

for(const move of [false,true])test(`friendly eave accepts dispatch through stale upgrade touch regions, move=${move}`,async()=>{
  const h=await harness(),c=h.camp(),target=h.session.match!.battle.camps.find(c=>c.id==='A01-N2')!;
  c.garrison=30;target.owner='P';target.garrison=30;h.draw();
  const source=h.shortcuts().find(r=>r.id===`upgrade-camp-${c.id}`)!,dest=h.shortcuts().find(r=>r.id===`upgrade-camp-${target.id}`)!;
  h.view.down(8,source.x+10,source.y+22);
  if(move)h.view.move(8,dest.x+10,dest.y+22);
  // No draw between down and up: native input may arrive within the same frame.
  h.view.up(8,dest.x+10,dest.y+22);await idle(h.session);
  assert.equal(h.camp().tier,1);assert.equal(h.camp().garrison,15);
  assert.equal(h.session.match!.battle.armies.length,1);assert.equal(h.session.match!.battle.armies[0]!.targetId,target.id);
  const receiver=h.session.match!.battle.camps.find(c=>c.id===target.id)!;assert.equal(receiver.tier,1);assert.equal(receiver.garrison,30);
});

test('upgrade shortcut: double invocation spends once and failed storage never paints upgraded success',async()=>{
  for(const fail of [false,true]){
    const h=await harness(),c=h.camp();c.garrison=30;h.draw();const button=h.shortcuts()[0]!,saved=[...h.data];
    if(fail)h.fail();button.run();button.run();await idle(h.session);h.draw();
    if(fail){assert.equal(h.session.page,'recovery');assert.deepEqual([...h.data],saved);assert.equal(h.camp().tier,1);assert.equal(h.camp().garrison,30);assert.ok(!h.texts.includes('已升至二级'));}
    else{assert.equal(h.camp().tier,2);assert.equal(h.camp().garrison,30-UPGRADE[1].cost);}
  }
});

test('upgrade shortcut: camp drag, card targeting and first-dispatch gate hide shortcuts, selected metrics retain their own eave',async()=>{
  const h=await harness(),c=h.camp();c.garrison=30;h.draw();
  const p=(h.view as unknown as {point(p:{x:number;y:number}):{x:number;y:number}}).point(c);
  h.view.down(1,p.x,p.y);h.view.move(1,p.x,p.y-12);h.draw();assert.equal(h.shortcuts().length,0);h.view.cancel();
  const other=h.session.match!.battle.camps.find(camp=>camp.id==='A01-N2')!;other.owner='P';other.garrison=30;
  h.view.selected=c.id;h.draw();assert.deepEqual(h.shortcuts().map(r=>r.id),[`upgrade-camp-${c.id}`]);
  const surface=h.view.regions.find(r=>r.id==='camp-surface')!,arrow=h.shortcuts()[0]!;
  assert.ok(surface.x+surface.w<=arrow.x||arrow.x+arrow.w<=surface.x||surface.y+surface.h<=arrow.y||arrow.y+arrow.h<=surface.y);
  h.view.selected=null;h.draw();assert.equal(h.shortcuts().length,2);
  h.view.regions.find(r=>r.id==='card-supply')!.run();h.draw();assert.equal(h.shortcuts().length,0);h.view.cancel();
  await h.session.start('L01');h.session.match!.battle.camps.find(c=>c.owner==='P')!.garrison=30;
  h.session.match!.battle.awaitingFirstDispatch=true;h.draw();assert.equal(h.shortcuts().length,0);
});

test('holding the eave seal does not replace strategies with a dispatch preview before dragging',async()=>{
  const h=await harness();h.camp().garrison=30;h.draw();const r=h.shortcuts()[0]!;
  h.view.down(1,r.x+10,r.y+22);h.draw();
  assert.ok(!h.texts.some(t=>t.startsWith('派 ')));assert.ok(h.view.regions.some(r=>r.id==='card-supply'));
  h.view.cancel(1);h.draw();assert.equal(h.camp().garrison,30);assert.equal(h.camp().tier,1);
});
