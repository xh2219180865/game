import test from 'node:test';
import assert from 'node:assert/strict';
import {GameView,type Region} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';
import {freshProfile,CARD_IDS,type Profile} from '../src/core/progress.ts';
import {SLOT_KEYS,envelopeFor} from '../src/app/storage.ts';
import {createWechatAuditProfile} from './wechat-audit-fixture.ts';

const NOW=Date.parse('2026-09-13T12:00:00+08:00');
const SIZES=[[320,568],[375,812],[430,932],[280,454]] as const;
function completedProfile():Profile{
  const p=freshProfile(NOW,'lesson-scene-complete');p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];return p;
}
async function idle(s:GameSession){for(let i=0;i<60&&s.busy;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(s.busy,0);}
async function harness(width:number,height:number,p=freshProfile(NOW,'lesson-scene-new')){
  let writes=0,frame=0;const data=new Map<string,string>([[SLOT_KEYS[1],JSON.stringify(envelopeFor(p,1,NOW))]]),labels:{text:string;y:number}[]=[],state:Record<string,unknown>={globalAlpha:1};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];if(key==='measureText')return (text:string)=>({width:[...text].length*8});
    if(key==='fillText')return (text:string,_x:number,y:number)=>labels.push({text,y});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});return ()=>{};
  },set(t,key,value){t[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  const v=new GameView(ctx,s);v.viewport={width,height,top:48,bottom:12};await s.load();
  const draw=()=>{labels.length=0;v.draw(++frame*200);};
  const find=(id:string)=>{const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id} at ${width}×${height}`);return r;};
  const tap=(r:Region)=>{v.down(1,r.x+r.w/2,r.y+r.h/2);v.up(1,r.x+r.w/2,r.y+r.h/2);};
  const seek=(id:string)=>{v.wheel(-10000);draw();for(let step=0;step<160;step++){const r=v.regions.find(r=>r.id===id);if(r)return r;v.wheel(12);draw();}assert.fail(`unreachable ${id} at ${width}×${height}`);};
  const scan=()=>{const seen=new Set<string>();v.wheel(-10000);for(let i=0;i<160;i++){draw();for(const l of labels)if(l.y>=48+64&&l.y<=height-12)seen.add(l.text);v.wheel(12);}return [...seen].join('');};
  const snapshot=()=>({profile:JSON.stringify(s.profile),data:[...data],writes});
  const openLessons=()=>{s.page='home';draw();tap(find('lessons'));draw();assert.equal(s.page,'lessons');};
  return {s,v,draw,find,tap,seek,scan,snapshot,openLessons};
}

for(const [width,height]of SIZES){
  test(`lesson scene ${width}×${height}: every lesson and reward note are reachable, locked taps and scrolling cannot start play`,async()=>{
    const h=await harness(width,height);assert.equal(h.v.viewportUsable,true);h.openLessons();const before=h.snapshot();
    for(const id of ['L01','L02','L03']){
      const r=h.seek(`lesson-${id}`);assert.ok(r.w>=44&&r.h>=44);assert.ok(r.x>=0&&r.x+r.w<=width&&r.y>=48&&r.y+r.h<=height-12);
      if(id!=='L01'){h.tap(r);await idle(h.s);h.draw();assert.equal(h.s.page,'lessons');assert.equal(h.s.match,null);assert.deepEqual(h.snapshot(),before);}
      const current=h.seek(`lesson-${id}`);h.v.down(2,current.x+current.w/2,current.y+current.h/2);h.v.move(2,current.x+current.w/2,current.y-60);h.v.up(2,current.x+current.w/2,current.y-60);h.draw();
      assert.equal(h.s.page,'lessons');assert.equal(h.s.match,null);assert.deepEqual(h.snapshot(),before);
    }
    assert.ok(h.scan().includes('不直接赠卡'),'the accurate reward limitation can be read through actual scrolling');
    h.tap(h.find('back'));h.draw();assert.equal(h.s.page,'home');assert.deepEqual(h.snapshot(),before);
  });

  for(const id of ['L01','L02','L03'] as const)test(`lesson scene ${width}×${height}: one tap starts the chosen unlocked ${id}`,async()=>{
    const h=await harness(width,height,completedProfile());h.openLessons();const original=h.s.profile!;
    const rewards=JSON.stringify({points:original.rankPoints,cards:original.activeInventory,passives:original.passiveLevels,choice:original.choice,wins:original.qualifiedArenaWins});
    h.tap(h.seek(`lesson-${id}`));await idle(h.s);h.draw();assert.equal(h.s.page,'battle');assert.equal(h.s.match!.battle.mapId,id);assert.equal(h.s.temporary,null);assert.equal(h.s.profile!.nextMatchSequence,2);
    const p=h.s.profile!;assert.equal(JSON.stringify({points:p.rankPoints,cards:p.activeInventory,passives:p.passiveLevels,choice:p.choice,wins:p.qualifiedArenaWins}),rewards);
  });
}

test('lesson scene: naturally winning an already completed lesson does not grant cards, merit or new qualifications',async()=>{
  const h=await harness(375,812,completedProfile());h.openLessons();h.tap(h.seek('lesson-L01'));await idle(h.s);
  const p=h.s.profile!,before=JSON.stringify({rank:p.rankPoints,highest:p.highestRankPoints,cards:p.activeInventory,passives:p.passiveLevels,choice:p.choice,unlocks:p.unlockedCardIds,lessons:p.tutorialFirstWins,wins:p.qualifiedArenaWins});
  // Controlled memory setup places a legal final attack within one march; settlement still uses the real session.
  const b=h.s.match!.battle;Object.assign(b.camps.find(c=>c.id==='L01-N1')!,{owner:'P',tier:3,garrison:100});b.camps.find(c=>c.id==='L01-E1')!.garrison=0;
  assert.equal(await h.s.action({kind:'dispatch',sourceId:'L01-N1',targetId:'L01-E1'}),true);
  for(let i=0;i<60&&h.s.page==='battle';i++){h.s.tick(250);await idle(h.s);}
  assert.equal(h.s.page,'result');assert.equal(h.s.profile!.latestResult!.result!.independentWinner,'P');
  const after=h.s.profile!;assert.equal(JSON.stringify({rank:after.rankPoints,highest:after.highestRankPoints,cards:after.activeInventory,passives:after.passiveLevels,choice:after.choice,unlocks:after.unlockedCardIds,lessons:after.tutorialFirstWins,wins:after.qualifiedArenaWins}),before);
});

for(const origin of ['formal','pending-choice'] as const)test(`lesson scene: starting from ${origin} creates only temporary practice and preserves all original bytes`,async()=>{
  const p=origin==='pending-choice'?createWechatAuditProfile('reward',NOW):completedProfile(),h=await harness(320,568,p);
  if(origin==='formal'){assert.equal(await h.s.start('A01'),true);await h.s.pause('home');}else await h.s.acknowledge('home');
  h.openLessons();const before=h.snapshot(),notice=h.scan();assert.ok(notice.includes('无奖励练兵')&&notice.includes('原对局和待领策略保留'),'the no-reward and original-record preservation notice remains readable');
  h.tap(h.seek('lesson-L02'));await idle(h.s);h.draw();assert.equal(h.s.page,'battle');assert.equal(h.s.temporary!.battle.mapId,'L02');assert.deepEqual(h.snapshot(),before);
  assert.equal(await h.s.action({kind:'dispatch',sourceId:'L02-P1',targetId:'L02-N1'}),true);h.s.tick(250);await idle(h.s);await h.s.pause();assert.deepEqual(h.snapshot(),before);
  await h.s.forfeit();h.draw();assert.equal(h.s.temporary,null);assert.equal(h.s.page,'lessons');assert.deepEqual(h.snapshot(),before);
});

test('lesson scene: reduced-motion frames and scrolling leave progress untouched and register only visible lesson targets',async()=>{
  const p=completedProfile();p.settings.reducedMotion=true;const h=await harness(280,454,p);h.openLessons();const before=h.snapshot();
  for(let i=0;i<20;i++){h.v.wheel(12);h.draw();for(const r of h.v.regions){assert.ok(r.w>=44&&r.h>=44);assert.ok(r.y>=48&&r.y+r.h<=454-12);assert.ok(r.id==='back'||/^lesson-L0[123]$/.test(r.id));}}
  assert.deepEqual(h.snapshot(),before);assert.equal(h.s.page,'lessons');
});
