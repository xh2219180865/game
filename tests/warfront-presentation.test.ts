import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { applyBattleAction, createBattle } from '../src/core/battle.ts';
import { armyPosition } from '../src/core/geometry.ts';
import { freshProfile } from '../src/core/progress.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';

async function harness(width=375,height=812){
  await loadArt(()=>{
    let src='';const image:ArtImage={width:1536,height:1024,onload:null,onerror:null,get src(){return src;},set src(v){src=v;queueMicrotask(()=>image.onload?.(new Event('load')));}};return image;
  });
  let position={x:0,y:0},state:Record<string,unknown>={globalAlpha:1};
  const stack:{position:typeof position;state:typeof state}[]=[],paints:{src:string;x:number;y:number}[]=[];
  const ctx=new Proxy({}, {get(_t,key){
    if(key in state)return state[String(key)];
    if(key==='measureText')return (s:string)=>({width:s.length*7});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return (...args:unknown[])=>{
      if(key==='save')stack.push({position:{...position},state:{...state}});
      if(key==='restore')({position,state}=stack.pop()!);
      if(key==='translate'){position.x+=Number(args[0]);position.y+=Number(args[1]);}
      if(key==='drawImage')paints.push({src:(args[0] as ArtImage).src,...position});
    };
  },set(_t,key,value){state[String(key)]=value;return true;}}) as CanvasRenderingContext2D;
  const now=Date.parse('2026-11-03T12:00:00+08:00'),session=new GameSession({storage:{async read(){return null;},async write(){},async remove(){}},now:()=>now,random:()=>.3,notify:()=>{},events:()=>{}});
  session.profile=freshProfile(now,'warfront-audit');session.profile.firstDragCompleted=true;
  session.profile.activeMatch={battle:createBattle('A01',{id:'warfront',firstDragCompleted:true}),modeId:'arena-four',rankedCommitment:true,realStartedAt:now,startWeekId:session.profile.weekId};session.page='battle';
  const view=new GameView(ctx,session);view.viewport={width,height,top:16,bottom:12};
  return {session,view,paints,stack,ctx};
}

for(const [width,height]of [[320,568],[375,812],[430,932]])test(`battle depth ${width}: approaching soldiers behind a camp paint before its roof; drawing is read-only`,async()=>{
  const h=await harness(width,height),b=h.session.match!.battle;
  const result=applyBattleAction(b,{kind:'dispatch',faction:'E2',sequence:1,sourceId:'A01-E2',targetId:'A01-N2'});assert.ok(result.ok);
  b.gameMs=b.armies[0]!.arrivalAtMs-300;
  const before=JSON.stringify(h.session.profile);h.view.draw(100);
  const point=(h.view as unknown as {point(p:{x:number;y:number}):{x:number;y:number}}).point(b.camps.find(c=>c.id==='A01-N2')!);
  const roof=h.paints.findIndex(p=>p.src.endsWith('warfront-camps.png')&&Math.abs(p.x-point.x)<.01&&Math.abs(p.y-(point.y-6))<.01);
  const head=(h.view as unknown as {point(p:{x:number;y:number}):{x:number;y:number}}).point(armyPosition(b.armies[0]!,b.gameMs));
  const leader=h.paints.findIndex(p=>Math.abs(p.x-head.x)<.01&&Math.abs(p.y-head.y)<.01);
  assert.ok(roof>=0&&leader>=0,'both authoritative camp and marching head are visible');
  assert.ok(leader<roof,'a soldier approaching from the far side must not float over the near roof');
  assert.equal(JSON.stringify(h.session.profile),before);assert.equal(h.stack.length,0);
});

test('strategy feedback remains readable at 400 game ms, freezes with pause, expires, and does not replay events',async()=>{
  const {session:s,view:v}=await harness(),b=s.match!.battle,target=b.camps.find(c=>c.owner==='P')!;
  const event={id:1,atMs:0,type:'card' as const,reason:'mobilize',targetId:target.id,faction:'P' as const,amount:0};
  target.mobilizeUntil=6000;v.draw(0);v.events([event]);b.gameMs=400;
  const subject=v as unknown as {activeAccents():Set<number>;effects:unknown[]};
  assert.ok(subject.activeAccents().has(1),'a successful order must remain visible beyond a 220 ms flash');
  const before=JSON.stringify(s.profile);v.draw(100);v.draw(5000);assert.equal(JSON.stringify(s.profile),before);
  assert.ok(subject.activeAccents().has(1),'wall-clock redraws cannot advance effect age');
  v.events([event]);assert.equal(subject.effects.length,1,'duplicate delivery does not restart an order');
  b.gameMs=800;assert.ok(!subject.activeAccents().has(1));
});

test('forty ordinary armies and a real fire order share eighty particle slots without hiding armies or changing the save',async()=>{
  const {session:s,view:v,ctx}=await harness(),b=s.match!.battle;
  const source=b.camps.find(c=>c.owner==='P')!,target=b.camps.find(c=>c.owner==='E1')!;
  for(let sequence=1;sequence<=40;sequence++){
    source.garrison=20;assert.ok(applyBattleAction(b,{kind:'dispatch',faction:'P',sequence,sourceId:source.id,targetId:'A01-N2'}).ok);
  }
  b.factions.find(f=>f.id==='P')!.inventory.feint=1;
  v.draw(0);const fire=applyBattleAction(b,{kind:'card',faction:'P',sequence:41,cardId:'feint',targetId:target.id});assert.ok(fire.ok);v.events(fire.events);
  let particles=0;
  ctx.ellipse=()=>{if(['#C6AF84','#6D6A60'].includes(String(ctx.fillStyle)))particles++;};
  ctx.arc=()=>{if(ctx.fillStyle==='#CB7051')particles++;};
  const before=JSON.stringify(s.profile);v.draw(100);
  assert.ok(particles>3&&particles<=80,`${particles} particles must include march dust and the successful order`);
  assert.equal(b.armies.length,40);assert.equal(JSON.stringify(s.profile),before);
});
