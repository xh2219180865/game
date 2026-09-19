import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/app/session.ts';
import {GameView} from '../src/render/game.ts';
import {CARD_IDS} from '../src/core/progress.ts';
import {ART_SOURCES,drawArt,loadArt,type ArtImage} from '../src/render/assets.ts';

const NOW=Date.parse('2026-09-19T12:00:00+08:00');
const SIZES=[[280,508],[320,568],[375,812],[430,932]] as const;
const ENTRIES=['settings','rank-card','primary','home-prepare','lessons','library','leaderboard'] as const;
type Rect={x:number;y:number;w:number;h:number};
type Mark={text:string;visible:boolean};

function drawing(){
  const marks:Mark[]=[],state:Record<string,any>={font:'16px sans-serif'};
  let clip=[-Infinity,Infinity],path:number[]|null=null;
  const stack:{state:Record<string,any>;clip:number[]}[]=[];
  const size=()=>Number(String(state.font).match(/(\d+)px/)?.[1]??16);
  const measure=(text:string)=>[...String(text)].reduce((sum,c)=>sum+(/[^\x00-\x7F]/.test(c)?1:.55),0)*size();
  const ctx=new Proxy(state,{get(target,key){
    if(key in target)return target[String(key)];
    if(key==='save')return ()=>stack.push({state:{...state},clip:[...clip]});
    if(key==='restore')return ()=>{const saved=stack.pop();assert.ok(saved);for(const k of Object.keys(state))delete state[k];Object.assign(state,saved.state);clip=saved.clip;};
    if(key==='beginPath')return ()=>{path=null;};
    if(key==='rect')return (_x:number,y:number,_w:number,h:number)=>{path=[y,y+h];};
    if(key==='clip')return ()=>{if(path)clip=[Math.max(clip[0]!,path[0]!),Math.min(clip[1]!,path[1]!)];};
    if(key==='fillText')return (text:string,_x:number,y:number)=>marks.push({text,visible:y-size()/2>=clip[0]!&&y+size()/2<=clip[1]!});
    if(key==='measureText')return (text:string)=>({width:measure(text)});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(target,key,value){target[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  return {ctx,marks,depth:()=>stack.length};
}
async function harness(width=375,height=812,top=16){
  const data=new Map<string,string>();let writes=0,view:GameView,frame=0;
  const d=drawing();
  const session=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>NOW,random:()=>.3,notify:m=>view.notify(m),events:e=>view.events(e),present:e=>view.present(e)});
  view=new GameView(d.ctx,session);view.viewport={width,height,top,bottom:28};await session.load();
  const draw=()=>{d.marks.length=0;view.draw(++frame*200);assert.equal(d.depth(),0);};
  const find=(id:string)=>{const region=view.regions.find(r=>r.id===id);assert.ok(region,`missing ${id}`);return region;};
  const tap=(id:string)=>{const r=find(id);view.down(1,r.x+r.w/2,r.y+r.h/2);view.up(1,r.x+r.w/2,r.y+r.h/2);};
  const snapshot=()=>({profile:JSON.stringify(session.profile),data:[...data],writes});
  draw();return {session,view,d,draw,find,tap,snapshot};
}
async function idle(s:GameSession){for(let i=0;i<50&&s.busy;i++)await new Promise(r=>setImmediate(r));assert.equal(s.busy,0);}
function ready(s:GameSession){s.profile!.firstDragCompleted=true;s.profile!.tutorialFirstWins=['L01','L02','L03'];s.profile!.unlockedCardIds=[...CARD_IDS];}
function overlap(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

for(const [width,height]of SIZES)for(const top of [16,60])test(`courtyard layout ${width}, safe top ${top}: seven usable entries never overlap and the three lower entries share a row`,async()=>{
  const h=await harness(width,height,top),before=h.snapshot(),regions=ENTRIES.map(h.find);
  assert.ok(h.d.marks.some(mark=>mark.text==='谋定山河'&&mark.visible));
  assert.ok(!h.d.marks.some(mark=>mark.text==='四方夺城'));
  for(const [i,r]of regions.entries()){
    assert.ok(r.w>=44&&r.h>=44,`${r.id} touch target`);
    assert.ok(r.x>=0&&r.x+r.w<=width&&r.y>=top&&r.y+r.h<=height-28,`${r.id} safe bounds`);
    for(const other of regions.slice(i+1))assert.ok(!overlap(r,other),`${r.id} overlaps ${other.id}`);
  }
  const lessons=h.find('lessons'),library=h.find('library'),board=h.find('leaderboard');
  assert.equal(lessons.y,library.y);assert.equal(library.y,board.y);assert.ok(lessons.x<library.x&&library.x<board.x);
  assert.ok(h.find('primary').y+h.find('primary').h<lessons.y,'the main action is above the bottom entries');
  assert.ok(h.find('home-prepare').x>h.find('primary').x+h.find('primary').w,'optional map entry remains separate');
  h.view.wheel(10000);h.draw();assert.deepEqual(h.snapshot(),before);
  for(const r of regions){const now=h.find(r.id);assert.deepEqual([now.x,now.y,now.w,now.h],[r.x,r.y,r.w,r.h],'ordinary scrolling does not move fixed entries');}
});

for(const [width,height]of SIZES)for(const maximum of [false,true])test(`courtyard notices ${width}, maximum ${maximum}: full weekly and passive reward text remains scrollable above fixed controls`,async()=>{
  const h=await harness(width,height,60),p=h.session.profile!,beforeLevel=maximum?Number.MAX_SAFE_INTEGER-1:3,afterLevel=beforeLevel+1;
  p.passiveLevels.fortification=afterLevel;
  p.choice={choiceId:'courtyard-reward',matchId:'memory-reward-display',kind:'mixed',grantQuantity:1,candidateIds:['fortification'],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'claimed',selected:'fortification'};
  h.view.present({kind:'passive-claim',choiceId:'courtyard-reward',cardId:'fortification',before:beforeLevel,after:afterLevel});h.session.weekNotice=true;h.draw();
  const before=h.snapshot(),texts=new Set<string>(),fixed=ENTRIES.map(h.find);let reachedDismiss=false;
  for(let frame=0;frame<100;frame++){
    for(const mark of h.d.marks)if(mark.visible)texts.add(mark.text);
    const dismiss=h.view.regions.find(r=>r.id==='dismiss-week');
    if(dismiss){reachedDismiss=true;assert.ok(dismiss.w>=44&&dismiss.h>=44);for(const r of fixed)assert.ok(!overlap(dismiss,r),`weekly dismissal overlaps ${r.id}`);}
    for(const r of fixed){const now=h.find(r.id);assert.deepEqual([now.x,now.y],[r.x,r.y]);}
    h.view.wheel(12);h.draw();
  }
  const visible=[...texts].join('');
  for(const text of ['新周开启','旧锦囊、兵法、待选已到期','军功与历史最高保留',String(beforeLevel),String(afterLevel),'容量 +','一级容量'])assert.ok(visible.includes(text),`missing visible text: ${text}`);
  if(!maximum)assert.ok(visible.includes('一级容量 54 → 55'));
  assert.ok(reachedDismiss);assert.deepEqual(h.snapshot(),before);
  h.tap('dismiss-week');h.draw();assert.equal(h.session.weekNotice,false);assert.deepEqual(h.snapshot(),before);
});

for(const [width,height]of SIZES)test(`courtyard routing ${width}: each secondary entry returns home without saving, and old departure callbacks expire`,async()=>{
  const h=await harness(width,height,60);ready(h.session);h.draw();
  for(const [id,page]of [['settings','settings'],['rank-card','ranks'],['home-prepare','prepare'],['lessons','lessons'],['library','library'],['leaderboard','leaderboard']] as const){
    const before=h.snapshot(),oldPrimary=h.find('primary');
    h.tap(id);h.draw();assert.equal(h.session.page,page);assert.equal(h.session.returnPage,'home');
    oldPrimary.run();await idle(h.session);h.draw();assert.equal(h.session.page,page);assert.deepEqual(h.snapshot(),before);
    h.tap('back');h.draw();assert.equal(h.session.page,'home');assert.deepEqual(h.snapshot(),before);
  }
});

for(const [width,height]of SIZES)test(`courtyard primary ${width}: first lesson and saved battle resume use the real session without duplicate starts`,async()=>{
  const h=await harness(width,height,60);assert.equal(h.find('primary').label,'开始练兵');
  h.tap('primary');h.tap('primary');await idle(h.session);h.draw();
  assert.equal(h.session.page,'battle');assert.equal(h.session.match!.battle.mapId,'L01');assert.equal(h.session.profile!.nextMatchSequence,2);
  await h.session.pause('home');h.draw();assert.equal(h.find('primary').label,'继续对战');
  const before=h.snapshot();h.tap('primary');await idle(h.session);h.draw();
  assert.equal(h.session.page,'pause');assert.deepEqual(h.snapshot(),before);assert.equal(h.session.profile!.nextMatchSequence,2);
});

test('courtyard primary preserves unacknowledged result, reward and recovery priority',async()=>{
  const h=await harness();ready(h.session);assert.equal(await h.session.start('A01'),true);
  for(let i=0;i<1000&&h.session.page==='battle';i++){h.session.tick(250);if(h.session.busy)await idle(h.session);}
  await idle(h.session);assert.equal(h.session.page,'result');
  assert.ok(h.session.profile!.latestResult);h.session.page='home';h.draw();
  assert.equal(h.find('primary').label,'查看战果');const resultState=h.snapshot();
  h.tap('primary');h.draw();assert.equal(h.session.page,'result');assert.deepEqual(h.snapshot(),resultState);
  // A pending reward is a separate saved UI state; this does not manufacture a reward claim.
  const p=h.session.profile!;p.latestResult!.resultAcknowledged=true;
  p.choice={choiceId:'courtyard-pending',matchId:p.latestResult!.matchId,kind:'mixed',grantQuantity:1,candidateIds:['mobilize'],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
  h.session.page='home';h.draw();assert.equal(h.find('primary').label,'领取奖励');const rewardState=h.snapshot();
  h.tap('primary');h.draw();assert.equal(h.session.page,'choice');assert.deepEqual(h.snapshot(),rewardState);
  h.session.error='local test storage unavailable';h.session.page='home';h.draw();assert.equal(h.find('primary').label,'恢复记录');const failureState=h.snapshot();
  h.tap('primary');h.draw();assert.equal(h.session.page,'recovery');assert.deepEqual(h.snapshot(),failureState);
});

test('courtyard home remains operable after the background fails, and image recovery invalidates held input',async()=>{
  const broken={drawImage(){throw new Error('memory-only image failure');}} as unknown as CanvasRenderingContext2D;
  for(const id of Object.keys(ART_SOURCES))drawArt(broken,id as keyof typeof ART_SOURCES,0,0,10,10);
  await loadArt(()=>{throw new Error('memory-only unavailable image');});
  const h=await harness(320,568,60),before=h.snapshot();for(const id of ENTRIES)h.find(id);
  h.tap('library');h.draw();assert.equal(h.session.page,'library');h.tap('back');h.draw();assert.equal(h.session.page,'home');assert.deepEqual(h.snapshot(),before);
  const old=h.find('primary');h.view.down(4,old.x+old.w/2,old.y+old.h/2);
  await loadArt(()=>{let src='';const image:ArtImage={width:1024,height:1792,onload:null,onerror:null,get src(){return src;},set src(value){src=value;queueMicrotask(()=>image.onload?.(new Event('load')));}};return image;});
  h.view.up(4,old.x+old.w/2,old.y+old.h/2);old.run();await idle(h.session);h.draw();
  assert.equal(h.session.page,'home');assert.deepEqual(h.snapshot(),before);assert.equal(h.session.match,null);
});
