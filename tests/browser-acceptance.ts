import { GameSession, type SessionPresentation } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { CARD_IDS, nextWeekAt, weekIdAt } from '../src/core/progress.ts';
import type { BattleEvent, MapId } from '../src/core/types.ts';
import { fraction } from '../src/core/fraction.ts';
import { applyBattleAction, createBattle } from '../src/core/battle.ts';
import { SLOT_KEYS } from '../src/app/storage.ts';
import { createStatePressure } from './pressure-fixture.ts';
import { createLastCampNotice } from './notice-fixtures.ts';
import { armyPosition } from '../src/core/geometry.ts';
import { loadArt } from '../src/render/assets.ts';

await loadArt(()=>new Image());

// Separate test entry: never bundled into either shipping platform.
const canvas=document.querySelector<HTMLCanvasElement>('canvas')!,ctx=canvas.getContext('2d')!;
const testWidth=Number(new URLSearchParams(location.search).get('width'));
const scenario=new URLSearchParams(location.search).get('scenario');
const rewardParam=new URLSearchParams(location.search).get('reward');
const rewardKind=rewardParam==='logistics'||rewardParam==='fortification'?rewardParam:'farming';
const highFeedback=scenario==='query'&&new URLSearchParams(location.search).get('layers')==='100';
if(new URLSearchParams(location.search).get('grayscale')==='true')canvas.style.filter='grayscale(1)';
if([280,320,375,430].includes(testWidth)){canvas.style.width=`${testWidth}px`;canvas.style.height=`${testWidth===280?508:testWidth===320?568:testWidth===375?812:932}px`;}
const testTop=Number(new URLSearchParams(location.search).get('safeTop')),testBottom=Number(new URLSearchParams(location.search).get('safeBottom'));
const status=document.querySelector<HTMLElement>('#status')!,controls=document.querySelector<HTMLElement>('#controls')!;
const data=new Map<string,string>();let fault:'before'|'after'|'unknown'|null=null,unreadable=false,view:GameView,session!:GameSession;
let events:BattleEvent[]=[],notices:string[]=[],working=false;
let presentations:SessionPresentation[]=[];
let threatSignals=0;
let feedbackReplay:{events:number;types:string[];profileUnchanged:boolean;storageUnchanged:boolean}|null=null;
let settlementTiming:{committedAt:number;actionsReadyMs:number|null;nextFrameMs:number|null;actionIds:string[]}|null=null;
let growthMoved=false,growthHeld=false;
const growthTrace:{stage:string;gameMs:number;garrison:number;labels:string[]}[]=[];
let drawnLabels:string[]=[];
const fillText=ctx.fillText.bind(ctx);
ctx.fillText=(...args:Parameters<CanvasRenderingContext2D['fillText']>)=>{if(scenario==='dispatch-growth')drawnLabels.push(args[0]);fillText(...args);};
function traceGrowth(stage:string){
  if(scenario!=='dispatch-growth'||!session.match)return;
  drawnLabels=[];view.draw(performance.now());const b=session.match.battle;
  growthTrace.push({stage,gameMs:b.gameMs,garrison:b.camps.find(c=>c.id==='A01-P1')!.garrison,labels:drawnLabels.filter(t=>t.startsWith('派 ')||t.startsWith('预计 '))});
}
let testNow=Date.parse('2026-09-11T12:00:00+08:00');
const now=()=>testNow;
const storage={async read(k:string){if(unreadable)throw new Error('测试：读回不可用');return data.get(k)??null;},async write(k:string,v:string){const f=fault;fault=null;if(f==='before')throw new Error('测试：写入前失败');data.set(k,v);if(f==='unknown')unreadable=true;if(f==='after'||f==='unknown')throw new Error('测试：回调丢失');},async remove(k:string){data.delete(k);}};
function connect(){
  presentations=[];
  threatSignals=0;
  feedbackReplay=null;
  settlementTiming=null;
  growthMoved=false;growthHeld=false;growthTrace.length=0;
  session=new GameSession({storage,now,random:()=>scenario==='passive-reward'?({farming:.2,logistics:.5,fortification:.9}[rewardKind]):.3,notify:message=>{notices.push(message);view.notify(message);},present:event=>{presentations.push(event);view.present(event);},events:batch=>{events.push(...batch);view.events(batch);if(batch.some(e=>e.type==='result')&&session.page==='result')settlementTiming={committedAt:performance.now(),actionsReadyMs:null,nextFrameMs:null,actionIds:[]};}});
  view=new GameView(ctx,session,()=>{threatSignals++;});resize();
}
function resize(){const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(view){view.viewport={width:r.width,height:r.height,top:[44,60].includes(testTop)?testTop:16,bottom:[28,34].includes(testBottom)?testBottom:12};view.cancel();}}
async function idle(){while(session.busy)await new Promise<void>(resolve=>setTimeout(resolve,0));}
async function run(action:()=>Promise<void>){if(working)return;working=true;try{await action();}catch(e){notices.push(String(e));}finally{working=false;render();}}
document.querySelector('#lesson')!.addEventListener('click',()=>void run(async()=>{data.clear();fault=null;unreadable=false;events=[];notices=[];connect();await session.load();await session.start('L01');}));
document.querySelector('#formal')!.addEventListener('click',()=>void run(async()=>{
  if(scenario==='week')testNow=Date.parse('2026-09-13T23:59:59+08:00');
  data.clear();fault=null;unreadable=false;events=[];notices=[];connect();await session.load();const p=session.profile!;
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:3,march:3,supply:3,feint:3};
  p.settings.reducedMotion=new URLSearchParams(location.search).get('motion')==='reduced';p.settings.sound=new URLSearchParams(location.search).get('sound')!=='off';
  if(scenario==='card-identity'){
    p.passiveLevels={farming:4,logistics:5,fortification:6};await session.setting('sound');session.page='prepare';return;
  }
  if(scenario==='query'){const layers=highFeedback?100:2;p.passiveLevels={farming:layers,logistics:layers,fortification:layers};}
  if(scenario==='week'){p.passiveLevels={farming:2,logistics:2,fortification:2};p.rankPoints=60;p.highestRankPoints=90;}
  const requestedMap=new URLSearchParams(location.search).get('map');
  await session.start(scenario==='query'?'A03':scenario==='tactical'&&['A01','A02','A03'].includes(requestedMap??'')?requestedMap as MapId:'A01');
  if(scenario==='query'){
    const b=session.match!.battle;
    for(const id of ['A03-P1','A03-N1','A03-N2','A03-N5']){
      const c=b.camps.find(c=>c.id===id)!;c.owner='P';c.garrison=c.tier===1?30:70;c.credit=fraction(0);
      if(c.type==='fort')c.nextShotAtMs=2000;
    }
    await session.pause();await session.resume();
  }
  if(scenario==='last-camp'){
    const prepared=createLastCampNotice(session.match!.battle.id);session.profile!.activeMatch!.battle=prepared.battle;
    session.profile!.activeInventory={...prepared.battle.factions.find(f=>f.id==='P')!.inventory};
    await session.pause();await session.resume();
  }
  if(scenario==='deadline'){
    const b=session.match!.battle;b.gameMs=209900;
    for(const f of b.factions)f.nextAiAtMs=240001;
    for(const c of b.camps)if(c.nextShotAtMs!==null)c.nextShotAtMs=212000;
    await session.pause();await session.resume();
  }
  if(scenario==='army-list'){
    const pressure=createStatePressure(session.match!.battle.id);
    session.profile!.activeMatch!.battle=pressure.battle;
    session.profile!.activeInventory={...pressure.battle.factions.find(f=>f.id==='P')!.inventory};
    await session.pause();await session.resume();
  }
  if(scenario==='dispatch-growth'){
    const b=session.match!.battle,c=b.camps.find(c=>c.id==='A01-P1')!;c.garrison=21;c.credit=fraction(0);
    for(const f of b.factions)f.nextAiAtMs=10000;
    await session.pause();await session.resume();
  }
  if(scenario==='capacity'||scenario==='mobilize'||scenario==='feint'||scenario==='coexist'||scenario==='attack-restoration'){
    const camp=session.match!.battle.camps.find(c=>c.id==='A01-P1')!;
    if(scenario==='capacity')camp.garrison=new URLSearchParams(location.search).get('start')==='42'?42:48;
    else if(scenario==='mobilize')camp.tier=3;
    else{
      const tower=session.match!.battle.camps.find(c=>c.id==='A01-N5')!,archery=session.match!.battle.camps.find(c=>c.id==='A01-N2')!;
      tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;archery.owner='P';archery.garrison=20;
      if(scenario==='coexist'){tower.garrison=4;tower.mobilizeUntil=6000;tower.bonusBudget=fraction(8);}
      if(scenario==='attack-restoration')for(const f of session.match!.battle.factions)f.nextAiAtMs=10000;
    }
    await session.pause();await session.resume();
  }
  if(scenario==='volley-clash'){
    const b=session.match!.battle,left=b.camps.find(c=>c.id==='A01-N2')!,right=b.camps.find(c=>c.id==='A01-N3')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    left.owner='P';left.garrison=20;right.owner='E2';right.garrison=20;tower.owner=new URLSearchParams(location.search).get('target')==='friend'?'P':'E1';tower.garrison=5;tower.nextShotAtMs=2000;
    const sent=applyBattleAction(b,{kind:'dispatch',faction:'E2',sequence:1,sourceId:right.id,targetId:tower.id});
    if(!sent.ok)throw new Error(sent.reason);events.push(...sent.events);view.events(sent.events);
    await session.pause();await session.resume();
  }
  if(scenario==='reinforce'){
    const b=session.match!.battle,source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    source.owner='P';source.garrison=20;tower.owner='P';tower.garrison=new URLSearchParams(location.search).get('capacity')==='full'?50:48;tower.nextShotAtMs=2000;
    await session.pause();await session.resume();
  }
  if(scenario==='eliminate'){
    const b=session.match!.battle,source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!,base=b.camps.find(c=>c.id==='A01-E1')!;
    source.owner='P';source.garrison=20;base.owner='E3';tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;
    const sent=applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:tower.id,targetId:'A01-N4'});
    if(!sent.ok)throw new Error(sent.reason);events.push(...sent.events);view.events(sent.events);
    await session.pause();await session.resume();
  }
  if(scenario==='crossing'){
    // Historical crossing trajectories deliberately exercise a restored v1.5 battle.
    const current=session.match!.battle;session.match!.battle=createBattle('A01',{id:current.id,ruleRevision:'1.5',firstDragCompleted:true,inventory:p.activeInventory,passives:p.passiveLevels});
    const b=session.match!.battle,tower=b.camps.find(c=>c.id==='A01-N5')!;
    tower.owner='E2';tower.nextShotAtMs=2000;
    for(const f of b.factions)f.nextAiAtMs=10000;
    const sent=applyBattleAction(b,{kind:'dispatch',faction:'E1',sequence:1,sourceId:'A01-E1',targetId:'A01-E2'});
    if(!sent.ok)throw new Error(sent.reason);events.push(...sent.events);view.events(sent.events);
    await session.pause();await session.resume();
  }
}));
if(scenario==='week'){
  const rollover=document.createElement('button');rollover.textContent='测试时钟推进至下周一';document.querySelector('#formal')!.after(rollover);
  rollover.addEventListener('click',()=>void run(async()=>{testNow=nextWeekAt(weekIdAt(testNow));if(session.page==='battle'){session.tick(1);await idle();}else await session.load();}));
}
const resultPreset=document.createElement('button');resultPreset.textContent='载入结算响应测试';document.querySelector('#formal')!.after(resultPreset);
resultPreset.addEventListener('click',()=>void run(async()=>{
  data.clear();fault=null;unreadable=false;events=[];notices=[];connect();await session.load();const p=session.profile!,losing=scenario==='result-loss';
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01'];p.unlockedCardIds=['mobilize','supply','farming'];p.rankPoints=losing?210:209;p.highestRankPoints=p.rankPoints;
  if(scenario==='card-result')p.activeInventory.supply=3;
  await session.start('A01');const b=session.match!.battle;b.hasPlayerDispatch=true;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){c.credit=fraction(0);if(c.owner)c.garrison=c.owner==='P'?(losing?1:40):(losing?40:10);if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  await session.pause();await session.resume();
}));
const choicePreset=document.createElement('button');choicePreset.textContent='载入选策事务测试';
document.querySelector('#formal')!.after(choicePreset);
choicePreset.addEventListener('click',()=>void run(async()=>{
  data.clear();fault=null;unreadable=false;events=[];notices=[];connect();await session.load();const p=session.profile!;
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01'];p.unlockedCardIds=['mobilize','supply','farming'];
  if(scenario==='passive-reward'){
    p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.passiveLevels[rewardKind]=3;
    p.settings.reducedMotion=new URLSearchParams(location.search).get('motion')==='reduced';
  }
  await session.start('A01');const b=session.match!.battle;
  // Controlled deadline fixture; production settlement/choice/storage still run, without persistent player rewards.
  b.hasPlayerDispatch=true;b.gameMs=239999;
  for(const f of b.factions)f.nextAiAtMs=240001;
  for(const c of b.camps){c.credit=fraction(0);if(c.owner)c.garrison=c.owner==='P'?40:10;if(c.nextShotAtMs!==null)c.nextShotAtMs=240001;}
  session.tick(1);await idle();await session.acknowledge('choice');
}));
document.querySelector('#step')!.addEventListener('click',()=>void run(async()=>{for(let i=0;i<12;i++){session.tick(250);await idle();}}));
const stepOne=document.createElement('button');stepOne.textContent='推进 1 游戏秒';document.querySelector('#step')!.after(stepOne);
stepOne.addEventListener('click',()=>void run(async()=>{for(let i=0;i<4;i++){session.tick(250);await idle();}}));
const stepFine=document.createElement('button');stepFine.textContent='推进 100 游戏毫秒';stepOne.after(stepFine);
stepFine.addEventListener('click',()=>void run(async()=>{session.tick(100);await idle();}));
const stepVolley=document.createElement('button');stepVolley.textContent='推进到最近齐射检查';stepFine.after(stepVolley);
stepVolley.addEventListener('click',()=>void run(async()=>{
  const b=session.match?.battle;if(!b||b.status!=='running')return;
  const pending=b.armies.filter(a=>a.volleyState==='pending'&&a.volleyCheckAtMs!==null).map(a=>a.volleyCheckAtMs!);if(!pending.length)return;
  const target=Math.min(...pending);
  while(session.match?.battle.status==='running'&&session.match.battle.gameMs<target){session.tick(Math.min(250,target-session.match.battle.gameMs));await idle();}
}));
const stepArrival=document.createElement('button');stepArrival.textContent='推进到最近到达';stepFine.after(stepArrival);
stepArrival.addEventListener('click',()=>void run(async()=>{
  const b=session.match?.battle;if(!b||b.status!=='running'||!b.armies.length)return;
  const target=Math.min(...b.armies.map(a=>a.arrivalAtMs));
  while(session.match?.battle.status==='running'&&session.match.battle.gameMs<target){session.tick(Math.min(250,target-session.match.battle.gameMs));await idle();}
}));
document.querySelector('#read')!.addEventListener('click',()=>void run(async()=>{await idle();fault=null;await session.load();}));
const recreateSession=document.createElement('button');recreateSession.textContent='重新创建会话并读取';document.querySelector('#read')!.after(recreateSession);
recreateSession.addEventListener('click',()=>void run(async()=>{await idle();connect();await session.load();}));
const corruptSlot=document.createElement('button');corruptSlot.textContent='损坏最新内存槽并读取';document.querySelector('#read')!.after(corruptSlot);
corruptSlot.addEventListener('click',()=>void run(async()=>{
  await idle();const latest=SLOT_KEYS.flatMap(key=>{try{const parsed=JSON.parse(data.get(key)??'null');return parsed&&Number.isFinite(parsed.revision)?[{key,revision:parsed.revision as number}]:[];}catch{return [];}}).sort((a,b)=>b.revision-a.revision)[0];
  if(latest){data.set(latest.key,'{broken');await session.load();}
}));
document.querySelector('#fail-before')!.addEventListener('click',()=>{fault='before';render();});
document.querySelector('#fail-after')!.addEventListener('click',()=>{fault='after';render();});
const failUnknown=document.createElement('button');failUnknown.textContent='下次写入后读回不可用';document.querySelector('#fail-after')!.after(failUnknown);
failUnknown.addEventListener('click',()=>{fault='unknown';render();});
const allowReads=document.createElement('button');allowReads.textContent='恢复存储读取';failUnknown.after(allowReads);
allowReads.addEventListener('click',()=>{unreadable=false;render();});
const repeatCard=document.createElement('button');repeatCard.textContent='重放最近施策反馈';allowReads.after(repeatCard);
repeatCard.addEventListener('click',()=>{const event=[...events].reverse().find(e=>e.type==='card');if(event)view.events([event]);render();});
if(highFeedback){
  const replay=document.createElement('button');replay.textContent='重放已提交战斗反馈';repeatCard.after(replay);
  replay.addEventListener('click',()=>{
    const before=JSON.stringify(session.profile),bytes=JSON.stringify([...data]),batch=events.filter(e=>e.type!=='production');
    view.events(batch);view.draw(performance.now());feedbackReplay={events:batch.length,types:[...new Set(batch.map(e=>e.type))],profileUnchanged:before===JSON.stringify(session.profile),storageUnchanged:bytes===JSON.stringify([...data])};render();
  });
}
function point(e:PointerEvent){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{const p=point(e);canvas.setPointerCapture(e.pointerId);view.down(e.pointerId,p.x,p.y);growthHeld=scenario==='dispatch-growth'&&session.page==='battle';traceGrowth('down');});
canvas.addEventListener('pointermove',e=>{const p=point(e);view.move(e.pointerId,p.x,p.y);
  // Finite test clock injection during a real pointer gesture; no production input or rules are replaced.
  if(growthHeld&&!growthMoved){growthMoved=true;for(let i=0;i<4;i++)session.tick(250);traceGrowth('move-after-1000ms');}
});
canvas.addEventListener('pointerup',e=>{const p=point(e);
  if(growthHeld&&growthMoved){for(let i=0;i<8;i++)session.tick(250);traceGrowth('before-release-after-2000ms');}
  growthHeld=false;view.up(e.pointerId,p.x,p.y);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(scenario==='dispatch-growth')void run(async()=>{await idle();traceGrowth('committed');});
});
canvas.addEventListener('pointercancel',e=>{growthHeld=false;view.cancel(e.pointerId);});
canvas.addEventListener('wheel',e=>{e.preventDefault();view.wheel(e.deltaY);},{passive:false});
window.addEventListener('resize',resize);
let realtime=false,lastFrame=0;
if(scenario==='tactical'){
  const clockButton=document.createElement('button');clockButton.textContent='开启正常时钟';document.querySelector('#step')!.after(clockButton);
  clockButton.addEventListener('click',()=>{realtime=!realtime;lastFrame=performance.now();clockButton.textContent=realtime?'停止正常时钟':'开启正常时钟';});
  const shortStep=document.createElement('button');shortStep.textContent='推进 300 毫秒';clockButton.after(shortStep);
  shortStep.addEventListener('click',()=>{session.tick(150);session.tick(150);render();});
}
let signature='';
function render(){
  drawnLabels=[];
  view.draw(performance.now());const b=session.match?.battle;
  status.textContent=[scenario==='tactical'?`仅内存测试数据；正常时钟 ${realtime?'运行':'停止'}，规则 ${b?.ruleRevision??'待开局'}。`:scenario==='dispatch-growth'?'仅内存测试数据；拖拽内按预设推进时钟。':'仅内存测试数据；时钟只由按钮推进。',scenario==='attack-restoration'?'预设：左己弓营与中心敌塔，检查暂停前后攻击节拍。':scenario==='query'?`预设：A03 四类己营，各被动 ${highFeedback?100:2} 层，兵数满足本级升级门槛。`:scenario==='crossing'?'预设：v1.5 历史对角直达、中心敌塔；电脑下一次决策为 10 秒。':scenario==='card-result'?'预设：用结算测试按钮载入截止前 1ms、有 3 张乡勇的战场。':scenario==='eliminate'?'预设：敌方仅余中心塔，已沿道路派出 10 守备兵至南营；左弓营为己方。':scenario==='reinforce'?'预设：20 兵己方弓营援助中心己塔，容量见下方。':scenario==='capacity'?'预设：己方步营临近满仓，起始兵数见下方。':scenario==='mobilize'?'预设：己方步营三级，检查增募预算耗尽。':scenario==='coexist'?'预设：敌塔 4 兵带征兵效果，用于共存／易主检查。':scenario==='volley-clash'?`预设：两侧弓营同距 5 兵${new URLSearchParams(location.search).get('target')==='friend'?'己':'敌'}塔，金方已派 10 弓兵。`:scenario==='feint'?'预设：N5 敌塔、N2 己方弓营，射程覆盖。':'预设：标准。',`页面 ${session.page} · 保存中 ${session.busy} · 故障 ${fault??'无'}`,`游戏时钟 ${b?.gameMs??'无'} ms`,`规则 ${b?.ruleRevision??'待开局'}${b?.ruleRevision==='1.5'?' · 历史直达模式（无道路限制）':' · 相邻道路模式'}`,
    ...(b?.camps.map(c=>`${c.id} ${c.owner??'中立'} ${c.garrison} 兵 · ${c.tier} 级`)??[]),
    `在途 ${b?.armies.length??0} 队`,...b?.armies.map(a=>`${a.id}: ${a.remainingCount} ${a.troopType} → ${a.targetId} · 到达 ${a.arrivalAtMs} ms`)??[],
    ...(scenario==='attack-restoration'&&b?[
      '攻击恢复预设：左弓营与中心敌塔，电脑第 10 秒开始决策。',
      ...b.camps.filter(c=>c.type==='fort').map(c=>`${c.id} 下次塔射 ${c.nextShotAtMs} ms`),
      ...b.armies.map(a=>{const p=armyPosition(a,b.gameMs);return `${a.id} 位置 ${p.x.toFixed(2)},${p.y.toFixed(2)} · 齐射 ${a.volleyState} · 检查 ${a.volleyCheckAtMs} ms`;}),
    ]:[]),
    `存储读取 ${unreadable?'不可用':'正常'}`,`库存 ${JSON.stringify(session.profile?.activeInventory)}`,`事件 ${events.slice(-12).map(e=>e.type+(e.amount===undefined?'':`:${e.amount}`)).join(', ')}`,
    `选策 ${JSON.stringify(session.profile?.choice)}`,`军功 ${session.profile?.rankPoints} · 周胜 ${session.profile?.qualifiedArenaWins}`,
    `结算计时 ${JSON.stringify(settlementTiming)}`,
    ...(scenario==='dispatch-growth'?[`拖拽时钟预设：按下 21 兵；首次移动推进 1 秒；松手前推进 2 秒。`, `拖拽绘制记录 ${JSON.stringify(growthTrace)}`]:[]),
    `表现设置 ${JSON.stringify(session.profile?.settings)}`,
    ...(['card-identity','passive-reward'].includes(scenario??'')?[`本周被动 ${JSON.stringify(session.profile?.passiveLevels)} · 局内被动 ${JSON.stringify(b?.factions.find(f=>f.id==='P')?.passives)}`]:[]),
    ...(['card-identity','passive-reward'].includes(scenario??'')?[`会话表现通知 ${JSON.stringify(presentations)}`]:[]),
    ...(highFeedback?[`本周被动 ${JSON.stringify(session.profile?.passiveLevels)} · 局内被动 ${JSON.stringify(b?.factions.find(f=>f.id==='P')?.passives)}`,`反馈重放 ${JSON.stringify(feedbackReplay)}`]:[]),
    ...(scenario==='week'?[`测试现实时间 ${new Date(testNow).toISOString()} · 记录周 ${session.profile?.weekId}`,`本周被动 ${JSON.stringify(session.profile?.passiveLevels)} · 局内被动 ${JSON.stringify(b?.factions.find(f=>f.id==='P')?.passives)}`,`历史最高 ${session.profile?.highestRankPoints} · 新周提示 ${session.weekNotice}`]:[]),
    ...(scenario==='last-camp'?[`末城提醒信号 ${threatSignals} 次（不输出震动）`]:[]),
    ...notices.slice(-2),session.error].join('\n');
  const next=view.regions.map(r=>r.id+':'+r.label).join('|');if(next!==signature){signature=next;controls.replaceChildren(...view.regions.map(r=>{const button=document.createElement('button');button.textContent=r.label;button.onclick=()=>view.regions.find(current=>current.id===r.id)?.run();return button;}));}
  if(settlementTiming&&settlementTiming.actionsReadyMs===null&&session.page==='result'&&!session.busy){
    const timing=settlementTiming;timing.actionIds=view.regions.filter(r=>['again','choose-reward','result-home'].includes(r.id)).map(r=>r.id);
    if(timing.actionIds.length){timing.actionsReadyMs=performance.now()-timing.committedAt;requestAnimationFrame(()=>{if(settlementTiming===timing)timing.nextFrameMs=performance.now()-timing.committedAt;});}
  }
}
connect();void session.load();
function frame(at:number){if(realtime&&lastFrame)session.tick(Math.min(100,Math.max(0,Math.round(at-lastFrame))));lastFrame=at;render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
