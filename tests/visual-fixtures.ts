import { GameSession } from '../src/app/session.ts';
import type { Page } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { createBattle, applyBattleAction, advanceBattle, factionOf } from '../src/core/battle.ts';
import { advanceSimulation } from '../src/core/ai.ts';
import { freshProfile, CARD_IDS } from '../src/core/progress.ts';
import { fraction } from '../src/core/fraction.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { COLORS, building, campPennant, marchingSoldier, soldier } from '../src/render/art.ts';
import { createStatePressure } from './pressure-fixture.ts';
import { loadArt } from '../src/render/assets.ts';
import { infantryWalkFrame, infantryDistanceFrame } from '../src/render/sample-sprite-regions.ts';

await loadArt(()=>new Image());

const canvas=document.querySelector<HTMLCanvasElement>('canvas')!,ctx=canvas.getContext('2d')!,now=Date.now(),params=new URLSearchParams(location.search),scene=params.get('scene');
if(params.get('grayscale')==='true')canvas.style.filter='grayscale(1)';
// Only the settings preview accepts writes. They live for this tab's current load.
const settingsPreview=params.get('screen')==='settings'?new Map<string,string>():null;
const session=new GameSession({storage:{
  async read(key){return settingsPreview?.get(key)??null;},
  async write(key,value){settingsPreview?.set(key,value);},
  async remove(key){settingsPreview?.delete(key);},
},now:()=>now,random:()=>.2,notify:()=>{},events:()=>{}});
const p=freshProfile(now,'visual-only');p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.rankPoints=480;p.highestRankPoints=480;
p.activeInventory={mobilize:3,march:2,supply:1,feint:4};p.passiveLevels={farming:3,logistics:1,fortification:10};p.qualifiedArenaWins=8;
p.settings.reducedMotion=params.get('motion')==='reduced';
if(scene==='high-count'){p.activeInventory.mobilize=999999999999;p.passiveLevels.farming=999999999999;}
if(scene==='record-boundary'){
  p.activeInventory.mobilize=Number.MAX_SAFE_INTEGER;p.passiveLevels.farming=Number.MAX_SAFE_INTEGER;p.passiveLevels.fortification=Number.MAX_SAFE_INTEGER;
  p.rankPoints=Number.MAX_SAFE_INTEGER-30;p.highestRankPoints=Number.MAX_SAFE_INTEGER;
}
let b=createBattle('L03',{id:'visual-battle',firstDragCompleted:true});const feedback:BattleEvent[]=[];let retreatAt=0;
applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'L03-P2',targetId:'L03-N2'});
advanceBattle(b,700);
if(scene==='lesson-upgrade'){
  b=createBattle('L02',{id:'lesson-upgrade',firstDragCompleted:true});advanceSimulation(b,15000);
  b.camps.find(c=>c.id==='L02-P1')!.garrison=30;
}
if(scene==='formal-ground'){
  const map=params.get('map');b=createBattle(map==='A02'||map==='A03'?map:'A01',{id:'ground-only',firstDragCompleted:true});
}
if(scene==='persistent-status'){b=createStatePressure().battle;advanceBattle(b,3000);}
if(scene==='clash'){
  b=createBattle('A01',{id:'clash-fixture',firstDragCompleted:true});const target=b.camps.find(c=>c.id==='A01-N4')!;target.owner='E1';target.garrison=40;
  const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:target.id});if(!result.ok)throw new Error(result.reason);const at=b.armies[0]!.arrivalAtMs;advanceBattle(b,at-1);feedback.push(...advanceBattle(b,at));
}
if(scene==='retreat'){
  b=createBattle('A01',{id:'retreat-fixture',firstDragCompleted:true});const source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=20;b.camps.find(c=>c.id==='A01-E1')!.owner='E3';tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;
  for(const action of [{kind:'dispatch',faction:'E1',sequence:1,sourceId:tower.id,targetId:'A01-N4'},{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}] as const){const result=applyBattleAction(b,action);if(!result.ok)throw new Error(result.reason);}
  retreatAt=b.armies.find(a=>a.faction==='P')!.arrivalAtMs;advanceBattle(b,retreatAt-1);
}
if(scene==='army-hit'){
  b=createBattle('A01',{id:'army-hit-fixture',firstDragCompleted:true});
  const source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=40;tower.owner='E1';tower.garrison=30;tower.nextShotAtMs=2000;
  const dispatched=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id});
  if(!dispatched.ok)throw new Error(dispatched.reason);
  advanceBattle(b,1999);feedback.push(...advanceBattle(b,2000));
}
if(scene==='tower-pose'||scene==='volley-pose'){
  b=createBattle('A01',{id:'shot-fixture',firstDragCompleted:true});
  const archer=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;archer.owner='P';archer.garrison=20;tower.owner='E1';tower.nextShotAtMs=2000;
  if(scene==='tower-pose'){advanceBattle(b,tower.nextShotAtMs!-1);feedback.push(...advanceBattle(b,tower.nextShotAtMs!));}
  else{tower.feintUntil=10000;const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:archer.id,targetId:tower.id});if(!result.ok)throw new Error(result.reason);const at=b.armies[0]!.volleyCheckAtMs!;advanceBattle(b,at-1);feedback.push(...advanceBattle(b,at));}
}
if(scene==='tower-drag'||scene==='dual-status'){
  const tower=b.camps.find(c=>c.type==='fort')!;tower.owner='E';
  if(scene==='tower-drag'){const source=b.camps.find(c=>c.id==='L03-N2')!;source.owner='P';source.type='archery';source.garrison=20;}
  if(scene==='dual-status'){tower.feintUntil=b.gameMs+4000;tower.mobilizeUntil=b.gameMs+6000;tower.bonusBudget=fraction(8);}
}
if(['reinforce','capture','supply','mobilize','feint','dispatch','march'].includes(scene??'')){
  b=createBattle('A01',{id:'visual-feedback',firstDragCompleted:true,inventory:p.activeInventory});
  const source=b.camps.find(c=>c.id==='A01-P1')!,target=b.camps.find(c=>c.id==='A01-N2')!;
  if(scene==='dispatch'||scene==='march'){
    source.garrison=40;
    const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:scene==='march'?'A01-N2':'A01-N4',march:scene==='march'});if(!result.ok)throw new Error(result.reason);feedback.push(...result.events);
  }else if(scene==='reinforce'||scene==='capture'){
    source.garrison=40;if(scene==='reinforce')target.owner='P';
    for(const c of b.camps)if(c.owner)c.feintUntil=1000000;
    const result=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:target.id});if(!result.ok)throw new Error(result.reason);const at=b.armies[0]!.arrivalAtMs;advanceBattle(b,at-1);feedback.push(...advanceBattle(b,at));
  }else{
    if(scene==='supply')source.garrison=48;
    const result=applyBattleAction(b,{kind:'card',faction:'P',sequence:1,cardId:scene as 'supply'|'mobilize'|'feint',targetId:scene==='feint'?'A01-E1':source.id});
    if(!result.ok)throw new Error(result.reason);feedback.push(...result.events);
  }
  p.activeInventory={...factionOf(b,'P')!.inventory};
}
p.activeMatch={battle:b,modeId:b.mapId.startsWith('A')?'arena-four':'tutorial',rankedCommitment:b.mapId.startsWith('A'),realStartedAt:now,startWeekId:p.weekId};
p.choice={choiceId:'visual-choice',matchId:'visual-result',kind:'mixed',grantQuantity:1,candidateIds:['mobilize','supply','farming'],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
p.latestResult={matchId:'visual-result',mapId:'A01',modeId:'arena-four',settledAt:now,settlementWeek:p.weekId,settlementKind:'natural',qualified:true,rankDeltaRequested:30,rankDeltaApplied:30,rankPointsBefore:450,rankPointsAfter:480,highestRankPointsAfter:480,winsBefore:7,winsAfter:8,formalCompletedBefore:7,formalCompletedAfter:8,fixedChoices:p.choice.candidateIds,resultAcknowledged:false,
  result:{reason:'deadline',playerRank:1,independentWinner:'P',ranks:{P:1,E1:2,E2:3,E3:4},stats:[{faction:'P',camps:4,troops:163,rank:1},{faction:'E1',camps:2,troops:90,rank:2},{faction:'E2',camps:1,troops:54,rank:3},{faction:'E3',camps:0,troops:0,rank:4}],atMs:240000}};
session.profile=p;
if(scene==='lesson-upgrade')session.temporary=p.activeMatch;
const allowed:Page[]=['home','battle','pause','result','lessons','prepare','choice','library','ranks','settings','about','leaderboard','recovery'];
const requested=new URLSearchParams(location.search).get('screen') as Page;session.page=allowed.includes(requested)?requested:'choice';session.returnPage='home';
if(session.page==='prepare')p.activeMatch=null;
if(settingsPreview){
  const profile=freshProfile(now,'visual-settings');
  profile.settings.reducedMotion=params.get('motion')==='reduced';
  session.profile=profile;
}
if(session.page==='recovery')session.error='存档校验失败。原记录已保留，可以重新读取、恢复完整副本或进入临时无奖励练兵。';
if(session.page==='pause'){b.status='paused';p.activeMatch!.realStartedAt=now-86400001;}
const view=new GameView(ctx,session);
function resize(){const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);view.viewport={width:r.width,height:r.height,top:16,bottom:18};view.cancel();view.draw(0);
  if(session.page==='battle'&&(scene==='archer-drag'||scene==='tower-drag')){
    const boardTop=78,boardHeight=r.height-18-148-boardTop,k=Math.min((r.width-16)/360,boardHeight/540),x=(r.width-360*k)/2,y=boardTop+(boardHeight-540*k)/2;
    const source=b.camps.find(c=>c.id===(scene==='tower-drag'?'L03-N2':'L03-P2'))!,target=scene==='tower-drag'?b.camps.find(c=>c.type==='fort')!:b.camps.find(c=>c.id==='L03-N2')!;
    view.down(99,x+source.x*k,y+source.y*k);view.move(99,x+target.x*k,y+target.y*k);
  }
}
function point(e:PointerEvent){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{const p=point(e);canvas.setPointerCapture(e.pointerId);view.down(e.pointerId,p.x,p.y);});
canvas.addEventListener('pointermove',e=>{const p=point(e);view.move(e.pointerId,p.x,p.y);});
canvas.addEventListener('pointerup',e=>{const p=point(e);view.up(e.pointerId,p.x,p.y);});
canvas.addEventListener('pointercancel',e=>view.cancel(e.pointerId));
canvas.addEventListener('wheel',e=>{e.preventDefault();view.wheel(e.deltaY);},{passive:false});
window.addEventListener('resize',resize);resize();
if(scene==='retreat'){view.events(advanceBattle(b,retreatAt));const at=Number(params.get('at'));view.events(advanceBattle(b,retreatAt+(params.has('at')&&[0,80,159,160].includes(at)?at:80)));}
if(feedback.length){view.events(feedback);const at=Number(params.get('at'));view.events(advanceBattle(b,b.gameMs+(params.has('at')&&[0,80,159,160,219,220,300,400,449,450,549,550,799,800].includes(at)?at:scene==='march'?400:80)));}
function identitySheet(){
  const {width:w,height:h}=view.viewport;
  ctx.fillStyle=COLORS.paper;ctx.fillRect(0,0,w,h);ctx.fillStyle=COLORS.ink;ctx.textAlign='center';ctx.font='600 18px sans-serif';ctx.fillText('阵营配色与四类三级营地',w/2,28);
  for(const [i,id]of (['P','E1','E2','E3',null] as const).entries()){
    const x=w*(i+.5)/5;building(ctx,x,53,22,'barracks',2,id);ctx.fillStyle=COLORS.ink;ctx.font='12px sans-serif';ctx.fillText(['青·你','赤·电脑','金·电脑','紫·电脑','中立'][i]!,x,87);
  }
  const rowHeight=Math.min(105,(h-180)/4);
  for(const [row,type]of (['barracks','archery','relay','fort'] as const).entries())for(const tier of [1,2,3]){
    const x=w*(tier-.5)/3,y=121+row*rowHeight;
    building(ctx,x,y+13,23,type,tier,'E2');
    campPennant(ctx,x,y+43,30,'E2',false,tier);
    ctx.fillStyle=COLORS.ink;
    ctx.font='13px sans-serif';ctx.fillText(['步兵营','弓营','骑营','塔营'][row]!,x,y+66);
  }
  for(const [i,type]of (['infantry','archer','cavalry','guard'] as const).entries()){
    const x=w*(i+.5)/4,y=h-47;soldier(ctx,x,y,type,'P',1.4);ctx.fillStyle=COLORS.ink;ctx.font='12px sans-serif';ctx.fillText(['步兵','弓兵','骑兵','守备兵'][i]!,x,y+25);
  }
}
function sampleSheet(t:number){
  const {width:w,height:h}=view.viewport;
  ctx.fillStyle=COLORS.paper;ctx.fillRect(0,0,w,h);ctx.fillStyle=COLORS.ink;ctx.textAlign='center';ctx.font='600 22px sans-serif';ctx.fillText('步兵营 · 战场样板',w/2,42);
  ctx.font='13px sans-serif';ctx.fillStyle=COLORS.muted;ctx.fillText('看建筑轮廓，也看士兵真正迈步',w/2,69);
  for(const tier of [1,2,3]){
    const x=w*(tier-.5)/3;building(ctx,x,155,36,'barracks',tier,'P');
    ctx.fillStyle=COLORS.ink;ctx.font='600 15px sans-serif';ctx.fillText(['一级 · 木栅营','二级 · 门楼院','三级 · 双塔堡'][tier-1]!,x,216);
  }
  ctx.font='600 17px sans-serif';ctx.fillText('连续迈步',w/2,283);
  const clock=params.has('at')?Math.max(0,Number(params.get('at'))||0):t;
  for(let i=0;i<3;i++)soldier(ctx,w/2+(i-1)*52,350,'infantry','P',1.8,0,0,1,infantryWalkFrame(clock,i,params.get('motion')!=='reduced'));
  ctx.fillStyle=COLORS.muted;ctx.font='13px sans-serif';ctx.fillText('抬腿、落脚，队员错开步点',w/2,404);
  ctx.fillText('实际战场尺寸',w/2,474);
  for(let i=0;i<3;i++)marchingSoldier(ctx,w/2+(i-1)*30,518,'infantry','P',1,0,0,-1,infantryWalkFrame(clock,i,params.get('motion')!=='reduced'));
}
function troopSheet(t:number){
  const {width:w,height:h}=view.viewport;
  ctx.fillStyle=COLORS.paper;ctx.fillRect(0,0,w,h);ctx.fillStyle=COLORS.ink;ctx.textAlign='center';ctx.font='600 20px sans-serif';ctx.fillText('四军行进 · 动作验收',w/2,40);
  const clock=params.has('at')?Math.max(0,Number(params.get('at'))||0):t;
  const moving=params.get('motion')!=='reduced',speed=params.get('speed')==='2'?2:1;
  const rowHeight=Math.min(165,(h-110)/4);
  for(const [row,type]of (['infantry','archer','cavalry','guard'] as const).entries()){
    const y=105+row*rowHeight;
    ctx.fillStyle=COLORS.ink;ctx.font='600 14px sans-serif';ctx.fillText(['步兵','弓兵','骑兵','守备兵'][row]!,w/2,y-15);
    for(let col=0;col<6;col++)soldier(ctx,w*(col+.5)/6,y+35,type,'P',1.2,0,0,1,col);
    const distance=clock/1000*24*speed;
    for(let slot=0;slot<3;slot++)marchingSoldier(ctx,w/2+(slot-1)*33,y+88,type,'P',1,0,0,-1,infantryDistanceFrame(distance,slot,moving));
  }
}
function frame(t:number){if(scene==='identity')identitySheet();else if(scene==='sample-art')sampleSheet(t);else if(scene==='troop-motion')troopSheet(t);else view.draw(t);ctx.font='10px sans-serif';ctx.fillStyle='#6D746C';ctx.textAlign='center';ctx.fillText(`布局测试 · ${b.ruleRevision==='1.5'?'旧版 1.5 直达':'1.6 道路'} · 不保存、不计奖`,view.viewport.width/2,view.viewport.height-5);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
