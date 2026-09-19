import test from 'node:test';
import assert from 'node:assert/strict';
import { GameView } from '../src/render/game.ts';
import { GameSession } from '../src/app/session.ts';
import { freshProfile, CARD_IDS, CARDS, settleMatch } from '../src/core/progress.ts';
import { createBattle, applyBattleAction, advanceBattle } from '../src/core/battle.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';

const NOW=Date.parse('2026-09-12T12:00:00+08:00');
test.before(async()=>{
  await loadArt(()=>{
    const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
});

function harness(width:number,height:number){
  let writes=0,frame=0;
  const labels:{text:string;y:number}[]=[],state:Record<string,unknown>={globalAlpha:1};
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
  const p=session.profile=freshProfile(NOW,`scheme-a-pages-${width}`);
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.rankPoints=108;p.highestRankPoints=150;
  p.activeInventory={mobilize:3,march:2,supply:1,feint:0};p.passiveLevels={farming:4,logistics:5,fortification:6};
  const view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};
  const draw=()=>{labels.length=0;view.draw(frame++);};
  const controls=()=>{for(const r of view.regions){assert.ok(r.w>=44&&r.h>=44,`${r.id} has ${r.w}×${r.h} touch area`);assert.ok(r.y>=16&&r.y+r.h<=height-12,`${r.id} leaves safe bounds`);}};
  const seek=(id:string)=>{
    view.wheel(-10000);draw();
    for(let i=0;i<200;i++){
      controls();const found=view.regions.find(r=>r.id===id);if(found)return found;
      view.wheel(13);draw();
    }
    assert.fail(`${id} is not reachable at ${width}×${height}`);
  };
  const scan=(contentBottom=height-12)=>{
    const seen=new Set<string>();view.wheel(-10000);draw();
    for(let i=0;i<200;i++){
      controls();for(const l of labels)if(l.y>=80&&l.y<=contentBottom)seen.add(l.text);
      view.wheel(13);draw();
    }
    return [...seen].join('');
  };
  return {session,view,labels,draw,seek,scan,controls,writes:()=>writes};
}

for(const [width,height] of [[320,568],[375,812],[430,932]] as const){
  test(`scheme A merit ${width}: compact progress and reachable rules disclose without writes or stale reopening`,()=>{
    const h=harness(width,height),{session,view,draw,seek,scan}=h;session.page='ranks';draw();
    const before=JSON.stringify(session.profile);assert.ok(h.labels.some(l=>l.text==='军功 108'));
    assert.ok(!h.labels.some(l=>l.text.includes('军衔没有战斗属性')));
    seek('rank-rules').run();draw();
    const full=scan();assert.ok(full.includes('军衔没有战斗属性'));assert.ok(full.includes('第 2／3／4 名 −5／−8／−10'));
    const expanded=seek('rank-rules');assert.equal(expanded.label,'收起规则');expanded.run();draw();
    expanded.run();draw();assert.equal(seek('rank-rules').label,'军功规则 ›');assert.ok(!scan().includes('军衔没有战斗属性'));
    assert.equal(JSON.stringify(session.profile),before);assert.equal(h.writes(),0);assert.equal(session.page,'ranks');assert.ok(view.regions.some(r=>r.id==='back'));
  });

  test(`scheme A strategies ${width}: seven effects, full rules, one-tap return and stale disclosure protection`,()=>{
    const h=harness(width,height),{session,view,draw,seek,scan}=h;session.page='library';draw();
    const before=JSON.stringify(session.profile);
    for(const id of CARD_IDS){
      seek(`library-${id}`).run();draw();
      assert.ok(!h.labels.map(l=>l.text).join('').includes(CARDS[id].description),'long prose starts collapsed');
      seek('card-rules').run();draw();
      assert.ok(scan().includes(CARDS[id].description),`${id} complete prose must be readable via actual scrolling`);
      const expanded=seek('card-rules');assert.equal(expanded.label,'收起说明');expanded.run();draw();
      expanded.run();draw();assert.equal(seek('card-rules').label,'详细规则 ›','callback from the expanded state is rejected');
      const returnControl=seek('card-sheet-close');assert.equal(returnControl.label,'关闭');returnControl.run();draw();assert.equal(session.page,'library');
      expanded.run();draw();assert.ok(!view.regions.some(r=>r.id==='card-rules'),'old detail callback cannot reopen the returned catalogue');
    }
    assert.equal(JSON.stringify(session.profile),before);assert.equal(h.writes(),0);
  });

  for(const won of [true,false])test(`scheme A result ${width}: ${won?'qualified victory':'defeat'} uses authoritative settlement and discloses read-only war report`,()=>{
    const h=harness(width,height),{session,draw,seek,scan}=h,p=session.profile!;
    const battle=createBattle('A01',{id:`scheme-a-result-${width}-${won}`,firstDragCompleted:true});
    p.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:p.weekId};
    assert.ok(applyBattleAction(battle,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'}).ok);
    // Controlled ownership and a one-millisecond deadline feed the real terminal rule and normal economy settlement.
    for(const camp of battle.camps)camp.owner=won?'P':'E1';battle.deadlineMs=1;
    const events=advanceBattle(battle,1);assert.ok(events.some(e=>e.type==='result'));assert.equal(battle.status,'finished');
    const result=settleMatch(p,battle.id,NOW,'natural',()=>.3);assert.equal(result.qualified,won);session.page='result';draw();
    const before=JSON.stringify(session.profile),delta=`军功 ${result.rankDeltaApplied>=0?'+':''}${result.rankDeltaApplied}`;
    assert.ok(h.labels.some(l=>l.text===delta));assert.equal(result.rankDeltaApplied>0,won);
    assert.equal(h.labels.some(l=>l.text==='冠军奖励 · 策略任选一张'),won);
    if(won){
      assert.ok(h.view.regions.some(r=>r.id==='choose-reward'&&r.label==='领取奖励'));
      assert.ok(h.labels.some(l=>l.text==='冠军奖励 · 策略任选一张'&&l.y===height-12-143),'fixed action area retains the exact entitlement on every screen size');
    }
    assert.equal(h.view.regions.some(r=>r.id==='choose-reward'),won);assert.equal(h.view.regions.some(r=>r.id==='again'),!won);
    assert.ok(!h.labels.some(l=>l.text===`本周 ${result.winsAfter} 胜`));
    seek('result-details').run();draw();const full=scan(height-12-151);
    assert.ok(full.includes(`本周 ${result.winsAfter} 胜`));
    for(const stat of result.result!.stats)assert.ok(full.includes(`${stat.camps} 城 / ${stat.troops} 兵`));
    const expanded=seek('result-details');assert.equal(expanded.label,'收起战报');expanded.run();draw();expanded.run();draw();
    assert.equal(seek('result-details').label,'查看战报 ›');assert.ok(!scan(height-12-151).includes(`本周 ${result.winsAfter} 胜`));
    assert.equal(JSON.stringify(session.profile),before);assert.equal(h.writes(),0,'viewing results must never settle or grant twice');
  });
}
