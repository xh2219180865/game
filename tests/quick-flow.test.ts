import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/render/game.ts';
import { GameSession } from '../src/app/session.ts';
import { ACTIVE_IDS, CARD_IDS } from '../src/core/progress.ts';
import { loadArt } from '../src/render/assets.ts';
import type { ArtImage } from '../src/render/assets.ts';

const NOW=Date.parse('2026-09-12T12:00:00+08:00');
const SIZES=[[320,568],[375,812],[430,932]] as const;

test.before(async()=>{
  await loadArt(()=>{
    const image={width:1774,height:1086,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});
    return image;
  });
});

async function harness(width:number,height:number){
  const data=new Map<string,string>();let writes=0;
  const state:Record<string,unknown>={};
  const ctx=new Proxy(state,{
    get(t,key){
      if(key in t)return t[String(key)];
      if(key==='measureText')return (text:string)=>({width:[...text].length*7});
      if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
      return ()=>{};
    },set(t,key,value){t[String(key)]=value;return true;},
  }) as unknown as CanvasRenderingContext2D;
  const session=new GameSession({storage:{async read(key){return data.get(key)??null;},async write(key,value){writes++;data.set(key,value);},async remove(key){writes++;data.delete(key);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  await session.load();
  session.profile!.firstDragCompleted=true;
  session.profile!.tutorialFirstWins=['L01','L02','L03'];
  session.profile!.unlockedCardIds=[...CARD_IDS];
  session.profile!.activeInventory={mobilize:3,march:3,supply:3,feint:3};
  const view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};
  const find=(id:string)=>{const region=view.regions.find(r=>r.id===id);assert.ok(region,`missing visible ${id}`);return region;};
  const snapshot=()=>({profile:JSON.stringify(session.profile),bytes:[...data],writes});
  return {session,view,find,snapshot};
}

async function idle(session:GameSession){
  for(let i=0;i<30&&session.busy;i++)await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(session.busy,0,'the requested local transaction must finish');
}

for(const [width,height]of SIZES){
  test(`quick pause ${width}: resume remains fixed and safe while inspection never advances or writes`,async()=>{
    const {session,view,find,snapshot}=await harness(width,height);
    await session.start('A01');await session.pause();view.draw(0);
    const before=snapshot(),gameMs=session.match!.battle.gameMs,first=find('resume');
    const position={x:first.x,y:first.y,w:first.w,h:first.h};
    assert.ok(first.h>=44&&first.y+first.h<=height-12&&first.y>=16);
    assert.ok(first.y+first.h<height-12-24,'resume belongs to the centered pause panel');
    assert.ok(find('pause-details').h>=44,'collapsed military details retain a complete touch target');
    find('pause-details').run();view.draw(.5);
    const expanded=find('resume');Object.assign(position,{x:expanded.x,y:expanded.y,w:expanded.w,h:expanded.h});
    for(let frame=1;frame<=40;frame++){
      view.wheel(frame<21?23:-23);session.tick(1000);view.draw(frame*1000);
      const resume=find('resume');
      assert.deepEqual({x:resume.x,y:resume.y,w:resume.w,h:resume.h},position,'scrolling must not move the main action');
      assert.ok(!view.regions.some(r=>r.id!=='resume'&&r.y<resume.y+resume.h&&r.y+r.h>resume.y&&r.x<resume.x+resume.w&&r.x+r.w>resume.x),'scrollable actions cannot overlap the fixed resume region');
      assert.equal(session.match!.battle.gameMs,gameMs);
      assert.deepEqual(snapshot(),before);
    }
    find('resume').run();await idle(session);view.draw(41000);
    assert.equal(session.page,'battle');assert.equal(session.match!.battle.gameMs,gameMs);
    session.tick(100);assert.equal(session.match!.battle.gameMs,gameMs+100,'only explicit resume allows simulation to advance');
  });

  test(`quick strategy ${width}: all four cards remain reachable for direct switching and cancellation without consumption`,async()=>{
    const {session,view,find,snapshot}=await harness(width,height);
    await session.start('A01');view.draw(0);const before=snapshot();
    let frame=0;
    for(const id of ACTIVE_IDS){
      find(`card-${id}`).run();view.draw(++frame);
      assert.equal(view.card,id);
      for(const visibleId of ACTIVE_IDS){
        const region=find(`card-${visibleId}`);
        assert.ok(region.w>=44&&region.h>=44&&region.y>=16&&region.y+region.h<=height-12);
      }
      assert.deepEqual(snapshot(),before,'choosing or replacing a prepared strategy is read only');
    }
    const current=ACTIVE_IDS[ACTIVE_IDS.length-1]!;
    find(`card-${current}`).run();view.draw(++frame);assert.equal(view.card,null);
    assert.deepEqual(snapshot(),before,'tapping the active card again cancels without consuming');
    find('card-supply').run();view.draw(++frame);view.escape();view.draw(++frame);
    assert.equal(view.card,null);assert.equal(session.page,'battle');assert.deepEqual(snapshot(),before);
  });

  test(`quick preparation ${width}: direct card detail returns in one step to the same scroll, while library detail stays in its library`,async()=>{
    const {session,view,find,snapshot}=await harness(width,height);
    session.page='prepare';view.draw(0);find('prepare-rules').run();view.draw(1);
    view.wheel(10000);view.draw(2);
    const before=snapshot(),geometry=()=>view.regions.map(({id,x,y,w,h})=>({id,x,y,w,h}));
    const prepared=geometry();
    find('prepare-card-supply').run();view.draw(3);assert.equal(session.page,'prepare');
    assert.ok(!view.regions.some(r=>r.id==='library-supply'),'direct entry displays the selected detail');
    const baseScroll=(view as unknown as {scroll:number}).scroll;
    find('card-rules').run();view.draw(3.1);view.wheel(10000);view.draw(3.2);
    assert.equal((view as unknown as {scroll:number}).scroll,baseScroll,'detail scrolling leaves the prepared page in place');
    find('card-sheet-close').run();view.draw(4);
    assert.equal(session.page,'prepare');assert.deepEqual(geometry(),prepared,'return preserves disclosure content and its prior scroll position');
    assert.deepEqual(snapshot(),before);assert.equal(session.match,null);
    find('prepare-library').run();view.draw(5);assert.equal(session.page,'library');
    find('library-mobilize').run();view.draw(6);
    find('card-sheet-close').run();view.draw(7);
    assert.equal(session.page,'library');assert.ok(find('library-mobilize'),'card-catalogue detail returns to its catalogue');
    find('back').run();view.draw(8);assert.equal(session.page,'prepare');
    assert.deepEqual(snapshot(),before);assert.equal(session.match,null);
  });
}
