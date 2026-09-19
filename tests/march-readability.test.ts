import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { StableArmyLabels } from '../src/render/battle-presentation.ts';
import { CARD_IDS } from '../src/core/progress.ts';
import { advanceBattle, applyBattleAction } from '../src/core/battle.ts';

async function harness(){
  const data=new Map<string,string>(),texts:{value:string;font:string;align:string;x:number}[]=[];
  const state:Record<string,unknown>={};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    if(key==='measureText')return (value:string)=>({width:value.length*7});
    if(key==='fillText')return (value:string,x:number)=>texts.push({value,font:String(state.font),align:String(state.textAlign),x});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(t,key,value){t[String(key)]=value;return true;}}) as CanvasRenderingContext2D;
  const session=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){data.set(k,v);},async remove(k){data.delete(k);}},now:()=>Date.parse('2026-09-19T10:00:00+08:00'),random:()=>.3,notify(){},events(){}});
  await session.load();session.profile!.firstDragCompleted=true;session.profile!.tutorialFirstWins=['L01','L02','L03'];session.profile!.unlockedCardIds=[...CARD_IDS];
  assert.equal(await session.start('A01'),true);
  const view=new GameView(ctx,session);view.viewport={width:375,height:812,top:16,bottom:12};
  const labels=Object.getOwnPropertyDescriptor(view,'armyLabels')!.value as StableArmyLabels;
  let items:Parameters<StableArmyLabels['layout']>[0]=[];
  const layout=labels.layout.bind(labels);
  labels.layout=(input,bounds,obstacles)=>{items=input;return layout(input,bounds,obstacles);};
  const draw=()=>{texts.length=0;view.draw(2000);return items;};
  return {session,view,draw,texts,data};
}

for(const count of [10,100])test(`real tower loss ${count}→${count-1} keeps the marching banner width reserved for the dispatched army`,async()=>{
  const h=await harness(),b=h.session.match!.battle;
  const source=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
  source.owner='P';source.garrison=count*2;tower.owner='E1';tower.tier=3;tower.garrison=150;tower.nextShotAtMs=2000;
  assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:source.id,targetId:tower.id}).ok);
  const army=b.armies[0]!,original=b.id;
  advanceBattle(b,1999);const before=h.draw().find(i=>i.id===army.id)!.width;
  const events=advanceBattle(b,2000);assert.equal(army.remainingCount,count-1);assert.equal(army.initialCount,count);
  h.view.events(events);const after=h.draw().find(i=>i.id===army.id)!.width;
  assert.equal(after,before,'damage must change the truthful text, not the banner width and collision footprint');
  assert.ok(h.texts.some(t=>t.value===String(count-1)&&t.font.includes('monospace')&&t.align==='right'),'the actual GameView banner shows the remaining count after the hit');
  h.view.events(events);h.draw();
  const effects=Object.getOwnPropertyDescriptor(h.view,'effects')!.value as {event:{id:number;type:string}}[];
  assert.equal(effects.filter(e=>e.event.type==='army-loss').length,1,'replayed feedback does not duplicate casualty notices');
  assert.equal(army.remainingCount,count-1,'rendering and replay do not mutate the count');
  // A new match with a reused army ID must derive its width from its own dispatch, not prior presentation state.
  b.id=`${original}-new`;army.initialCount=2;army.remainingCount=2;
  const fresh=h.draw().find(i=>i.id===army.id)!;assert.ok(fresh.width<before);
  assert.equal((Object.getOwnPropertyDescriptor(h.view,'effects')!.value as unknown[]).length,0);
});
