import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { createBattle, advanceBattle, applyBattleAction } from '../src/core/battle.ts';
import { freshProfile, CARD_IDS } from '../src/core/progress.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';
import type { Point } from '../src/core/types.ts';

const NOW=Date.parse('2026-09-12T12:00:00+08:00');
function drawing(){
  const shafts:Point[][]=[],heads:Point[][]=[];let path:Point[]=[];const state:Record<string,unknown>={lineWidth:1,globalAlpha:1},stack:Record<string,unknown>[]=[];
  const ctx=new Proxy(state,{get:(object,key)=>{
    if(key in object)return object[String(key)];
    if(key==='beginPath')return ()=>{path=[];};
    if(key==='moveTo'||key==='lineTo')return (x:number,y:number)=>{assert.ok(Number.isFinite(x)&&Number.isFinite(y));path.push({x,y});};
    if(key==='stroke')return ()=>{if(state.lineWidth===1.7&&path.length===2)shafts.push(structuredClone(path));};
    if(key==='fill')return ()=>{if(state.lineWidth===1.7&&path.length===3)heads.push(structuredClone(path));};
    if(key==='save')return ()=>stack.push({...state});
    if(key==='restore')return ()=>{assert.ok(stack.length);const saved=stack.pop()!;for(const key of Object.keys(state))delete state[key];Object.assign(state,saved);};
    if(key==='measureText')return (text:string)=>({width:[...text].length*8});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  }}) as unknown as CanvasRenderingContext2D;
  return {ctx,shafts,heads,clear(){shafts.length=0;heads.length=0;},depth:()=>stack.length};
}
function close(actual:number,expected:number){assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);}

for(const kind of ['tower-shot','volley'] as const)for(const [width,height]of [[320,568],[375,812],[430,932]])for(const reduced of [false,true])test(`painted projectile ${kind} ${width}×${height}: game-clock flight, count, expiry and reduced=${reduced}`,async()=>{
  await loadArt(()=>{const image:ArtImage={width:1774,height:1086,onload:null,onerror:null,get src(){return '';},set src(_value:string){image.onload?.call(image as HTMLImageElement,new Event('load'));}};return image;});
  let writes=0;const s=new GameSession({storage:{async read(){return null;},async write(){writes++;},async remove(){writes++;}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  const profile=freshProfile(NOW,'projectile-test'),battle=createBattle('A01',{id:`flight-${kind}`,firstDragCompleted:true});
  profile.firstDragCompleted=true;profile.tutorialFirstWins=['L01','L02','L03'];profile.unlockedCardIds=[...CARD_IDS];profile.settings.reducedMotion=reduced;
  profile.activeMatch={battle,modeId:'arena-four',rankedCommitment:true,realStartedAt:NOW,startWeekId:profile.weekId};s.profile=profile;s.page='battle';
  const source=battle.camps.find(c=>c.id==='A01-N2')!,tower=battle.camps.find(c=>c.id==='A01-N5')!;source.owner='P';source.garrison=20;tower.owner='E1';tower.nextShotAtMs=2000;
  if(kind==='volley'){
    tower.feintUntil=10000;
    assert.ok(applyBattleAction(battle,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}).ok);
  }
  const d=drawing(),view=new GameView(d.ctx,s);view.viewport={width:width!,height:height!,top:16,bottom:12};view.draw(0);
  const firedAt=kind==='volley'?battle.armies[0]!.volleyCheckAtMs!:2000,events=advanceBattle(battle,firedAt),shot=events.find(event=>event.type===kind)!;
  assert.ok(shot&&shot.position&&shot.amount!>0,'the projectile comes from a real damaging rules event');
  view.events([shot]);
  const renderer=view as unknown as {board:{x:number;y:number;k:number};activeAccents():Set<number>;drawCombatAccents(accents:Set<number>):unknown};
  const from=kind==='volley'?shot.position!:battle.camps.find(c=>c.id===shot.sourceId)!,to=kind==='volley'?battle.camps.find(c=>c.id===shot.targetId)!:shot.position!;
  const point=(p:Point)=>({x:renderer.board.x+p.x*renderer.board.k,y:renderer.board.y+p.y*renderer.board.k}),p=point(from),q=point(to),dx=q.x-p.x,dy=q.y-p.y;
  const snapshots:Point[][]=[];
  for(const age of [0,80,240,299,300]){
    advanceBattle(battle,firedAt+age);const before=JSON.stringify(profile);d.clear();
    renderer.drawCombatAccents(renderer.activeAccents());
    assert.equal(JSON.stringify(profile),before,'painting cannot change damage, ownership, armies, inventory or timers');assert.equal(writes,0);
    const expectedCount=age===300?0:kind==='volley'?3:1;
    assert.equal(d.shafts.length,expectedCount);assert.equal(d.heads.length,expectedCount);
    const tips=d.heads.map(path=>path[0]!);snapshots.push(tips);
    for(let i=0;i<expectedCount;i++){
      const shaft=d.shafts[i]!,tip=tips[i]!;assert.deepEqual(shaft[1],tip,'shaft meets the visible arrowhead');
      const length=Math.hypot(tip.x-shaft[0]!.x,tip.y-shaft[0]!.y);assert.ok(length<=24+1e-8,'short arrow never becomes a full-route beam');
      if(age>0)assert.ok(length>0,'in-flight arrows have a shaft');
      if(i>0){const length=Math.hypot(dx,dy);close(tip.x-tips[i-1]!.x,-dy/length*4);close(tip.y-tips[i-1]!.y,dx/length*4);}
    }
    assert.equal(d.depth(),0);
  }
  if(!reduced){
    const length=Math.hypot(dx,dy),laneOffset=kind==='volley'?-4:0;
    for(let i=0;i<snapshots[0]!.length;i++){
      const offset=kind==='volley'?laneOffset+i*4:0,start=snapshots[0]![i]!,middle=snapshots[1]![i]!,end=snapshots[2]![i]!;
      close(start.x,p.x-dy/length*offset);close(start.y,p.y+dx/length*offset);
      close(end.x,q.x-dy/length*offset);close(end.y,q.y+dx/length*offset);
      close(middle.x-start.x,dx/3);close(middle.y-start.y,dy/3-Math.sin(Math.PI/3)*(kind==='volley'?8:4));
      assert.ok(Math.hypot(middle.x-start.x,middle.y-start.y)>0);
      assert.deepEqual(snapshots[3],snapshots[2],'impact position remains legible while fading');
    }
  }else for(const frame of snapshots.slice(1,4))assert.deepEqual(frame,snapshots[0],'reduced motion keeps a static direction marker');
  assert.deepEqual(snapshots[4],[],'the 300 ms frame contains no projectile');
});
