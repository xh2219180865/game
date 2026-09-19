import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/render/game.ts';
import { GameSession } from '../src/app/session.ts';
import { freshProfile } from '../src/core/progress.ts';
import { createBattle, applyBattleAction } from '../src/core/battle.ts';

const NOW=Date.parse('2026-09-12T12:00:00+08:00');
function harness(width=320,height=568){
  let writes=0;
  const labels:{text:string;y:number}[]=[],state:Record<string,unknown>={};
  const ctx=new Proxy(state,{
    get(t,key){
      if(key in t)return t[String(key)];
      if(key==='measureText')return (text:string)=>({width:[...text].length*7});
      if(key==='fillText')return (text:string,_x:number,y:number)=>labels.push({text,y});
      if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
      return ()=>{};
    },set(t,key,value){t[String(key)]=value;return true;},
  }) as unknown as CanvasRenderingContext2D;
  const session=new GameSession({storage:{async read(){return null;},async write(){writes++;},async remove(){writes++;}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  session.profile=freshProfile(NOW,'light-page-audit');
  const view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};
  const find=(id:string)=>{const region=view.regions.find(r=>r.id===id);assert.ok(region,`missing visible ${id}`);return region;};
  return {session,view,labels,find,writes:()=>writes};
}

for(const [width,height]of [[320,568],[375,812],[430,932]] as const)test(`strategy album ${width}: unlock status stays distinct while personal stock is absent from the catalogue`,()=>{
  const {session,view,labels,find,writes}=harness(width,height);
  session.profile!.unlockedCardIds=['mobilize'];session.page='library';view.draw(0);
  const before=JSON.stringify(session.profile),beforeWrites=writes();
  assert.ok(!labels.some(l=>/持有|累计|已解锁 \d/.test(l.text)));assert.ok(labels.some(l=>l.text==='未解锁'));
  assert.equal(find('library-mobilize').label,'查看鸣鼓征兵，已解锁');
  const initial=find('library-mobilize');find('library-march').run();labels.length=0;view.draw(1);
  assert.match(labels.map(l=>l.text).join(''),/通关.*解锁/);
  assert.ok(!view.regions.some(r=>r.id.startsWith('card-')&&!['card-sheet-scrim','card-sheet-surface','card-sheet-close','card-sheet-done','card-rules'].includes(r.id)));
  find('card-sheet-close').run();view.draw(2);
  const restored=find('library-mobilize');assert.equal(restored.x,initial.x);assert.equal(restored.y,initial.y);
  restored.run();labels.length=0;view.draw(3);assert.match(labels.map(l=>l.text).join(''),/通关.*解锁/);
  assert.ok(!labels.some(l=>/持有|累计|当前增益/.test(l.text)));
  assert.equal(JSON.stringify(session.profile),before);assert.equal(writes(),beforeWrites);
});

for(const [width,height]of [[320,568],[375,812],[430,932]] as const)test(`preparation ${width}: clipped cards have no tiny touch target, while all seven remain reachable`,()=>{
  const {session,view,find,writes}=harness(width,height);session.page='prepare';view.draw(0);
  const before=JSON.stringify(session.profile);
  find('prepare-rules').run();view.draw(1);
  view.wheel(10);view.draw(2);
  assert.ok(view.regions.every(r=>r.h>=44&&r.w>=44),'the original 320 px regression left four 6 px card strips clickable');
  const reached=new Set<string>();
  for(let i=0;i<80;i++){
    for(const r of view.regions){
      assert.ok(r.h>=44&&r.w>=44,`${r.id} must retain a usable touch region`);
      assert.ok(r.y>=view.viewport.top&&r.y+r.h<=height-12);
      if(r.id.startsWith('prepare-card-'))reached.add(r.id);
    }
    const start=find('start-arena');assert.equal(start.h,50);assert.ok(start.y+start.h<=height-12);
    view.wheel(10);view.draw(i+3);
  }
  assert.equal(reached.size,7,'filtering clipped strips cannot make a strategy permanently unreachable');
  assert.equal(JSON.stringify(session.profile),before);assert.equal(writes(),0);
});

test('switching an expanded about section keeps its new heading and opening explanation visible',()=>{
  const {session,view,labels,find,writes}=harness();session.page='about';view.draw(0);find('about-rules').run();view.draw(0);const before=JSON.stringify(session.profile);
  find('about-section-0').run();view.draw(1);view.wheel(80);view.draw(2);
  const clicked=find('about-section-1');assert.ok(clicked.y>=80);
  clicked.run();labels.length=0;view.draw(3);
  const selected=find('about-section-1');assert.ok(selected.label.endsWith('−'));
  assert.ok(selected.y>=80&&selected.y+selected.h<=556,'a newly opened heading must not jump underneath the header');
  const opening=labels.find(line=>line.text.startsWith('新局一级步营每秒'));
  assert.ok(opening&&opening.y>selected.y+selected.h&&opening.y<556,'the beginning of the selected explanation remains visible');
  selected.run();view.draw(4);assert.ok(find('about-section-1').label.endsWith('+'));
  clicked.run();view.draw(5);assert.ok(find('about-section-1').label.endsWith('+'),'an old collapsed/expanded callback cannot reopen a different UI state');
  assert.equal(JSON.stringify(session.profile),before);assert.equal(writes(),0);
});

test('paused army query opens its target read only, and a closed query rejects its stale army callback',()=>{
  const {session,view,find,writes}=harness();
  const battle=createBattle('A01',{id:'paused-army-query',firstDragCompleted:true});
  session.profile!.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:session.profile!.weekId};
  assert.ok(applyBattleAction(battle,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'}).ok);
  session.page='pause';view.draw(0);view.wheel(10000);view.draw(1);
  const before=JSON.stringify(session.profile);
  find('pause-details').run();view.draw(2);view.wheel(10000);view.draw(2);
  find('army-list').run();view.draw(2);
  const target=view.regions.find(r=>r.id.startsWith('army-target-'));assert.ok(target);assert.ok(target.h>=44);
  target.run();view.draw(3);assert.equal(view.selected,'A01-N2');assert.ok(view.regions.some(r=>r.id==='camp-details'));
  assert.ok(!view.regions.some(r=>r.id==='upgrade'),'a paused query must not expose an upgrade operation');
  find('back').run();view.draw(4);assert.ok(view.regions.some(r=>r.id==='resume'));
  target.run();view.draw(5);assert.ok(!view.regions.some(r=>r.id==='camp-details'));
  assert.equal(JSON.stringify(session.profile),before);assert.equal(writes(),0);
});

test('scroll clipping retains 44 px targets and required entries across pause, settings, ranks and library at three widths',async()=>{
  const {loadArt}=await import('../src/render/assets.ts');
  await loadArt(()=>{
    const image={width:1774,height:1086,onload:null,onerror:null} as unknown as import('../src/render/assets.ts').ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
  const required={
    pause:['back','resume','save-home','forfeit','pause-settings','pause-details','army-list'],
    settings:['back','setting-sound','setting-vibration','setting-reducedMotion','about','reset'],
    ranks:['back','rank-rules'],
    library:['back',...['mobilize','march','supply','feint','farming','logistics','fortification'].map(id=>`library-${id}`)],
  };
  for(const [width,height]of [[320,568],[375,812],[430,932]] as const)for(const page of ['pause','settings','ranks','library'] as const){
    const {session,view,find,writes}=harness(width,height);
    const battle=createBattle('A01',{id:`scroll-${page}-${width}`,firstDragCompleted:true});
    session.profile!.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:session.profile!.weekId};
    session.page=page;view.draw(0);if(page==='ranks'){find('rank-rules').run();view.draw(1);}
    const before=JSON.stringify(session.profile),seen=new Set<string>();let opened=false;
    for(let frame=0;frame<155;frame++){
      for(const r of view.regions){
        assert.ok(r.h>=44&&r.w>=44,`${page} ${width}: ${r.id} clipped to ${r.w}×${r.h}`);
        assert.ok(r.y>=16&&r.y+r.h<=height-12,`${page} ${width}: ${r.id} outside safe touch bounds`);
        seen.add(r.id);
      }
      if(page==='pause'&&!opened&&view.regions.some(r=>r.id==='pause-details')){find('pause-details').run();opened=true;view.draw(frame+2);}
      view.wheel(13);view.draw(frame+2);
    }
    for(const id of required[page])assert.ok(seen.has(id),`${page} ${width}: ${id} must remain reachable by scrolling`);
    assert.equal(JSON.stringify(session.profile),before);assert.equal(writes(),0);
  }
});
