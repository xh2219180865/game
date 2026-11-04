import test from 'node:test';
import assert from 'node:assert/strict';
import {GameView} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';
import {CARD_IDS} from '../src/core/progress.ts';
import {applyBattleAction} from '../src/core/battle.ts';
import {advanceSimulation} from '../src/core/ai.ts';
import {loadArt,type ArtImage} from '../src/render/assets.ts';

async function harness(width=375,height=812){
  const data=new Map<string,string>();let writes=0;
  const labels:string[]=[],state:Record<string,unknown>={};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    if(key==='measureText')return (text:string)=>({width:[...text].length*7});
    if(key==='fillText')return (text:string)=>labels.push(text);
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(t,key,value){t[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  let view:GameView;
  const session=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>Date.parse('2026-09-12T23:00:00+08:00'),random:()=>.3,notify:message=>view.notify(message),events:events=>view.events(events)});
  view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};await session.load();
  session.profile!.firstDragCompleted=true;session.profile!.tutorialFirstWins=['L01','L02','L03'];session.profile!.unlockedCardIds=[...CARD_IDS];session.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};
  let frame=0;
  const draw=()=>{labels.length=0;view.draw(++frame*200);};
  const find=(id:string)=>{const r=view.regions.find(r=>r.id===id);assert.ok(r,`missing ${id}`);return r;};
  const tap=(id:string)=>{const r=find(id);view.down(1,r.x+r.w/2,r.y+r.h/2);view.up(1,r.x+r.w/2,r.y+r.h/2);};
  const camp=(id:string)=>{const c=session.match!.battle.camps.find(c=>c.id===id)!;return (view as unknown as {point(c:{x:number;y:number}):{x:number;y:number}}).point(c);};
  const snapshot=()=>({data:[...data],profile:JSON.stringify(session.profile),writes});
  draw();return {session,view,draw,find,tap,camp,snapshot,labels};
}
async function idle(s:GameSession){for(let i=0;i<40&&s.busy;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}
async function art(){await loadArt(()=>{let src='';const image:ArtImage={width:1774,height:887,onload:null,onerror:null,get src(){return src;},set src(value){src=value;queueMicrotask(()=>image.onload?.(new Event('load')));}};return image;});}

for(const [width,height]of [[320,568],[375,812],[430,932]] as const)test(`mobile result ${width}: a zero-merit fourth-place loss exposes a full war-report touch target before scrolling`,async()=>{
  const h=await harness(width,height);h.view.viewport={width,height,top:48,bottom:12};
  assert.equal(h.session.profile!.rankPoints,0);assert.equal(await h.session.start('A01'),true);
  // Memory-only last-camp setup; a legal enemy dispatch reaches the normal elimination and settlement path.
  const b=h.session.match!.battle;b.camps.find(c=>c.id==='A01-P1')!.garrison=0;
  Object.assign(b.camps.find(c=>c.id==='A01-N2')!,{owner:'E1',garrison:40});
  assert.equal(applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-N2',targetId:'A01-P1'}).ok,true);
  for(let i=0;i<40&&h.session.page==='battle';i++){h.session.tick(250);await idle(h.session);}
  assert.equal(h.session.page,'result');h.draw();
  const result=h.session.profile!.latestResult!;assert.equal(result.result!.playerRank,4);assert.equal(result.rankDeltaRequested,0);assert.equal(result.rankDeltaApplied,0);
  assert.ok(!h.labels.some(t=>t.includes('军功最低为 0')),'the zero-floor explanation belongs to the optional war report');assert.ok(h.labels.includes('查看战报 ›'));
  const report=h.find('result-details'),action=h.find('again'),before=h.snapshot();
  assert.equal(report.h,44);assert.ok(report.y>=48+72-8&&report.y+report.h<=height-12-151,'the first paint exposes the complete report control inside its clip');
  h.tap('result-details');h.draw();assert.equal(h.find('result-details').label,'收起战报');assert.ok(h.labels.join('').includes('最后一城失守'));assert.equal(h.find('again').y,action.y);assert.deepEqual(h.snapshot(),before);
  h.view.wheel(10000);h.draw();h.tap('result-details');h.draw();
  assert.equal((h.view as unknown as {scroll:number}).scroll,0,'collapsing a scrolled report returns to its summary instead of leaving blank space');
  assert.equal(h.find('result-details').label,'查看战报 ›');assert.deepEqual(h.snapshot(),before);
});

for(const [width,height]of [[320,568],[375,812],[430,932]] as const){
  test(`mobile lesson ${width}: upgrade cue follows eligibility and yields to the real upgrade flow without writing`,async()=>{
    const h=await harness(width,height);await h.session.start('L02');
    const b=h.session.match!.battle;advanceSimulation(b,15000);
    const c=b.camps.find(c=>c.id==='L02-P1')!;c.garrison=29;h.draw();
    const hasCue=()=>h.labels.some(label=>label.includes('轻点升级'));
    assert.equal(hasCue(),false);
    c.garrison=30;const saved=h.snapshot();h.draw();assert.equal(hasCue(),true);assert.deepEqual(h.snapshot(),saved);
    c.owner='E';h.draw();assert.equal(hasCue(),false);c.owner='P';h.draw();
    const p=h.camp(c.id);h.view.down(4,p.x,p.y);h.view.up(4,p.x,p.y);h.draw();
    assert.equal(hasCue(),false,'the selected camp needs no extra tutorial text');h.tap(`upgrade-camp-${c.id}`);await idle(h.session);h.draw();
    const upgraded=h.session.match!.battle.camps.find(camp=>camp.id===c.id)!;
    assert.equal(upgraded.tier,2);assert.equal(upgraded.garrison,20);assert.equal(hasCue(),false);
    h.session.page='pause';h.draw();assert.equal(hasCue(),false);
    for(const map of ['A01','L03'] as const){
      const other=await harness(width,height);await other.session.start(map);other.session.match!.battle.gameMs=15000;
      const own=other.session.match!.battle.camps.find(camp=>camp.owner==='P')!;own.tier=1;own.garrison=30;other.draw();
      assert.ok(!other.labels.some(label=>label.includes('轻点升级')),'the lesson-specific cue stays out of other maps');
    }
  });
  test(`mobile about ${width}: section alignment is bounded before a single-move swipe and every section remains reachable`,async()=>{
    const h=await harness(width,height);h.session.page='about';h.draw();h.tap('about-rules');h.draw();
    const state=h.view as unknown as {scroll:number;maxScroll:number};
    h.tap('about-section-1');h.draw();
    assert.ok(state.scroll<=state.maxScroll,'opening must not create an overscroll that rebounds on the next swipe');
    const before=state.scroll;h.view.down(1,width/2,height-150);h.view.move(1,width/2,height-350);h.view.up(1,width/2,height-350);h.draw();
    assert.ok(state.scroll>=before,'an upward single-move swipe cannot move content back downward');
    for(let i=0;i<9;i++){
      h.view.wheel(-10000);h.draw();
      for(let step=0;step<100&&!h.view.regions.some(r=>r.id===`about-section-${i}`);step++){h.view.wheel(12);h.draw();}
      h.tap(`about-section-${i}`);h.draw();
      assert.ok(state.scroll>=0&&state.scroll<=state.maxScroll);
      const open=h.find(`about-section-${i}`);assert.ok(open.y>=16+72-8&&open.y+open.h<=height-12);
      if(state.maxScroll>=i*60)assert.equal(open.y,16+72+60,'a section aligns to the reading top when content height permits');
      h.view.wheel(10000);h.draw();assert.equal(state.scroll,state.maxScroll);
      h.view.wheel(-10000);h.draw();
      for(let step=0;step<100&&!h.view.regions.some(r=>r.id===`about-section-${i}`);step++){h.view.wheel(12);h.draw();}
      h.tap(`about-section-${i}`);h.draw();assert.ok(state.scroll<=state.maxScroll,'closing also clamps to the smaller content height');
    }
  });
  test(`mobile home ${width}: single departure skips mandatory preparation and duplicate taps cannot create a second match`,async()=>{
    const h=await harness(width,height);await art();h.draw();
    for(const id of ['settings','lessons','library','leaderboard','rank-card']){const r=h.find(id);assert.ok(r.w<=200&&r.h>=44&&r.w>=44,'small, usable home entry');}
    h.tap('primary');h.tap('primary');await idle(h.session);h.draw();assert.equal(h.session.page,'battle');assert.equal(h.session.profile!.nextMatchSequence,2);
  });
  test(`mobile card ${width}: card drag never targets; tapping supply then its city commits once`,async()=>{
    const h=await harness(width,height);await h.session.start('A01');h.draw();
    const before=h.session.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison;
    const drag=(id:string,target:{x:number;y:number},cancel=false)=>{const r=h.find(id);h.view.down(2,r.x+r.w/2,r.y+r.h/2);h.view.move(2,target.x,target.y);h.draw();if(cancel)h.view.cancel(2);h.view.up(2,target.x,target.y);};
    for(const [target,cancel]of [[h.camp('A01-E1'),false],[{x:2,y:100},false],[h.camp('A01-P1'),true],[h.camp('A01-P1'),false]] as const){const snap=h.snapshot();drag('card-supply',target,cancel);await idle(h.session);h.draw();assert.deepEqual(h.snapshot(),snap);assert.equal(h.view.card,null);assert.equal(h.view.selected,null);}
    h.tap('card-supply');h.draw();assert.equal(h.view.card,'supply');const target=h.camp('A01-P1');h.view.down(2,target.x,target.y);h.view.up(2,target.x,target.y);h.view.up(2,target.x,target.y);await idle(h.session);h.draw();
    assert.equal(h.session.profile!.activeInventory.supply,2);assert.equal(h.session.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison,before+6);assert.equal(h.view.card,null);
  });
  test(`mobile upgrade ${width}: popup stays on battlefield and does not cover the selected source`,async()=>{
    const h=await harness(width,height);await h.session.start('A01');h.session.match!.battle.camps.find(c=>c.id==='A01-P1')!.garrison=30;h.draw();const p=h.camp('A01-P1');
    h.view.down(3,p.x,p.y);h.view.up(3,p.x,p.y);h.draw();const panel=h.find('camp-surface');
    assert.equal(panel.w,160);assert.equal(panel.h,64);assert.ok(!(p.x>=panel.x&&p.x<=panel.x+panel.w&&p.y>=panel.y&&p.y<=panel.y+panel.h));
    const close=h.find('close-camp'),upgrade=h.find('upgrade-camp-A01-P1');
    assert.ok(!h.view.regions.some(r=>['open-camp-details','upgrade'].includes(r.id)));
    assert.equal(close.h,44);assert.equal(close.w,44);assert.ok(close.x>=panel.x&&close.x+close.w<=panel.x+panel.w);
    assert.equal(upgrade.h,44);assert.equal(upgrade.w,44);
    assert.ok(panel.x+panel.w<=upgrade.x||upgrade.x+upgrade.w<=panel.x||panel.y+panel.h<=upgrade.y||upgrade.y+upgrade.h<=panel.y,'the camp metrics never cover its upgrade arrow');
    assert.ok(h.labels.includes('产兵 0.90 兵/秒'));assert.ok(h.labels.includes('容量 50 兵'));
    for(const id of ['card-mobilize','card-march','card-supply','card-feint'])h.find(id);
    assert.equal(h.session.page,'battle');
  });
  test(`mobile detail ${width}: opens above original library, no full-page return, closes to same grid`,async()=>{
    const h=await harness(width,height);await art();h.session.page='library';h.draw();const source=h.find('library-mobilize'),snap=h.snapshot();h.tap('library-mobilize');h.draw();
    assert.equal(h.session.page,'library');assert.ok(h.view.regions.some(r=>r.id==='card-sheet-close'));assert.ok(!h.view.regions.some(r=>r.id==='card-return'));assert.ok(!h.view.regions.some(r=>r.id==='library-mobilize'));
    h.tap('card-sheet-close');h.draw();const {run:beforeRun,...beforeRect}=source;const {run:afterRun,...afterRect}=h.find('library-mobilize');assert.deepEqual(afterRect,beforeRect);assert.deepEqual(h.snapshot(),snap);
  });
}
