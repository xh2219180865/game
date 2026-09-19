import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/app/session.ts';
import {GameView,type Region} from '../src/render/game.ts';
import {CARD_IDS,CARDS} from '../src/core/progress.ts';
import type {CardId} from '../src/core/types.ts';

const NOW=Date.parse('2026-09-19T12:00:00+08:00');
const SIZES=[[280,508],[320,568],[375,812],[430,932]] as const;
type Mark={text:string;visible:boolean;left:number;right:number};
type ViewState={scroll:number;maxScroll:number;detailScroll:number;detailMaxScroll:number;librarySelection:CardId|null;cardRulesOpen:boolean};
function drawing(){
  const marks:Mark[]=[],state:Record<string,any>={font:'16px sans-serif',globalAlpha:1};
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
    if(key==='fillText')return (text:string,x:number,y:number)=>{const width=measure(text),left=x-(state.textAlign==='center'?width/2:state.textAlign==='right'?width:0);marks.push({text,visible:y-size()/2>=clip[0]!&&y+size()/2<=clip[1]!,left,right:left+width});};
    if(key==='measureText')return (text:string)=>({width:measure(text)});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(target,key,value){target[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  return {ctx,marks,depth:()=>stack.length};
}
async function harness(width:number,height:number){
  let writes=0,frame=0;const data=new Map<string,string>(),d=drawing();
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  const v=new GameView(d.ctx,s);v.viewport={width,height,top:60,bottom:28};await s.load();
  s.profile!.unlockedCardIds=[...CARD_IDS];s.profile!.activeInventory={mobilize:7,march:8,supply:9,feint:10};s.profile!.passiveLevels={farming:4,logistics:5,fortification:6};s.page='library';s.returnPage='home';
  const draw=()=>{d.marks.length=0;v.draw(++frame*200);assert.equal(d.depth(),0);};
  const find=(id:string)=>{const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id} at ${width}×${height}`);return r;};
  const tap=(id:string)=>{const r=find(id);v.down(1,r.x+r.w/2,r.y+r.h/2);v.up(1,r.x+r.w/2,r.y+r.h/2);};
  const snapshot=()=>({profile:JSON.stringify(s.profile),data:[...data],writes});
  const seek=(id:string)=>{v.wheel(-10000);draw();for(let i=0;i<120;i++){if(v.regions.some(r=>r.id===id))return find(id);v.wheel(12);draw();}assert.fail(`unreachable ${id}`);};
  draw();return {s,v,state:v as unknown as ViewState,d,draw,find,tap,seek,snapshot};
}
const rect=({id,x,y,w,h}:Region)=>({id,x,y,w,h});
function overlap(a:Region,b:Region){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

for(const [width,height]of SIZES)test(`compact strategy menu ${width}: all seven cards fit the safe first screen in four active and three passive slots`,async()=>{
  const h=await harness(width,height);h.s.profile!.unlockedCardIds=['mobilize'];h.s.profile!.activeInventory.mobilize=0;h.draw();
  const before=h.snapshot(),cards=CARD_IDS.map(id=>h.find(`library-${id}`)),active=cards.slice(0,4),passive=cards.slice(4);
  assert.equal(new Set(active.map(r=>r.y)).size,1);assert.equal(new Set(passive.map(r=>r.y)).size,1);assert.ok(passive[0]!.y>active[0]!.y+active[0]!.h);
  for(const [i,r]of cards.entries()){
    assert.ok(r.w>=44&&r.h>=44&&r.h<=110);assert.ok(r.x>=0&&r.x+r.w<=width&&r.y>=60&&r.y+r.h<=height-28,`${r.id} safe first screen`);
    for(const other of cards.slice(i+1))assert.ok(!overlap(r,other));
  }
  assert.ok(!h.d.marks.some(m=>/持有|累计|已解锁 \d/.test(m.text)));assert.equal(cards[0]!.label,`查看${CARDS.mobilize.name}，已解锁`);
  for(const r of cards.slice(1))assert.ok(r.label.includes('未解锁'));
  for(const mark of h.d.marks.filter(m=>m.visible))assert.ok(mark.left>=0&&mark.right<=width,`${mark.text} fits horizontally`);
  h.v.wheel(10000);h.draw();assert.equal(h.state.scroll,0,'ordinary seven-card catalogue does not scroll');assert.deepEqual(h.snapshot(),before);
});

for(const [width,height]of SIZES)test(`strategy explanation ${width}: fixed exits and complete rules remain usable without exposing personal counts or moving the catalogue`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;
  for(const id of Object.keys(p.activeInventory))p.activeInventory[id as keyof typeof p.activeInventory]=Number.MAX_SAFE_INTEGER;
  for(const id of Object.keys(p.passiveLevels))p.passiveLevels[id as keyof typeof p.passiveLevels]=Number.MAX_SAFE_INTEGER;
  h.draw();const before=h.snapshot();
  for(const id of CARD_IDS){
    h.tap(`library-${id}`);h.draw();const panel=h.find('card-sheet-surface'),close=h.find('card-sheet-close'),done=h.find('card-sheet-done');
    assert.ok(Math.abs(panel.y+panel.h/2-(60+(height-60-28)/2))<1,'explanation is centered within the safe area');
    assert.ok(!overlap(close,done));assert.ok(!h.v.regions.some(r=>r.id.startsWith('library-')));
    for(const r of [close,done])assert.ok(r.w>=44&&r.h>=44&&r.y>=60&&r.y+r.h<=height-28);
    const fixed=[close,done].map(rect),gridScroll=h.state.scroll;
    h.v.wheel(10000);h.draw();assert.deepEqual([h.find('card-sheet-close'),h.find('card-sheet-done')].map(rect),fixed);
    h.seek('card-rules');h.tap('card-rules');h.draw();assert.equal(h.state.detailScroll,0);
    const expanded=[h.find('card-sheet-close'),h.find('card-sheet-done')].map(rect),texts=new Set<string>();
    for(let i=0;i<100;i++){
      for(const mark of h.d.marks)if(mark.visible){texts.add(mark.text);assert.ok(mark.left>=0&&mark.right<=width,`${id}: ${mark.text} fits horizontally`);}
      assert.deepEqual([h.find('card-sheet-close'),h.find('card-sheet-done')].map(rect),expanded);
      for(const r of h.v.regions.filter(r=>r.id==='card-rules'))assert.ok(r.h>=44&&r.y>=expanded[0]!.y+expanded[0]!.h&&r.y+r.h<=expanded[1]!.y);
      assert.equal(h.state.scroll,gridScroll);const prior=h.state.detailScroll;h.v.wheel(12);h.draw();if(prior===h.state.detailScroll)break;
    }
    const text=[...texts].join('');assert.ok(text.includes(CARDS[id].description),`${id}: full description`);assert.ok(text.includes('到期'));
    assert.ok(!text.includes(String(Number.MAX_SAFE_INTEGER)),`${id}: catalogue omits personal stock/layers`);
    assert.ok(!/持有|本周累计|当前增益|一级容量|999\+/.test(text));assert.match(text,/通关.*解锁/);
    assert.equal(h.state.detailScroll,h.state.detailMaxScroll);
    h.seek('card-rules');h.tap('card-rules');h.draw();assert.equal(h.state.detailScroll,0);assert.equal(h.state.cardRulesOpen,false);
    assert.ok(h.state.detailScroll<=h.state.detailMaxScroll);h.tap('card-sheet-done');h.draw();assert.equal(h.state.librarySelection,null);assert.equal(h.s.page,'library');
    assert.deepEqual(h.snapshot(),before);
  }
});

for(const [width,height]of SIZES)test(`strategy pending reward ${width}: catalogue remains read-only and the home reward action remains reachable`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;p.unlockedCardIds=['mobilize'];
  p.choice={choiceId:'strategy-menu-pending',matchId:'memory-only',kind:'mixed',grantQuantity:1,candidateIds:['mobilize'],unlockSnapshot:['mobilize'],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};h.draw();const before=h.snapshot();
  assert.ok(!h.v.regions.some(r=>r.id==='library-claim'));assert.equal(h.state.maxScroll,0);
  for(const id of CARD_IDS){h.seek(`library-${id}`);const offset=h.state.scroll;h.tap(`library-${id}`);h.draw();h.tap('card-sheet-done');h.draw();assert.equal(h.state.scroll,offset);}
  h.seek('library-fortification');h.tap('library-fortification');h.draw();assert.match(h.d.marks.filter(m=>m.visible).map(m=>m.text).join(''),/通关.*解锁/);
  h.tap('card-sheet-close');h.draw();h.tap('back');h.draw();assert.equal(h.s.page,'home');assert.equal(h.find('primary').label,'领取奖励');h.tap('primary');h.draw();assert.equal(h.s.page,'choice');assert.deepEqual(h.snapshot(),before);
});

for(const [width,height]of SIZES)for(const maximum of [false,true])test(`preparation strategy details ${width}, maximum ${maximum}: real seven-card entries preserve exact holdings and bonuses separately from the catalogue`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;
  if(maximum){for(const id of Object.keys(p.activeInventory))p.activeInventory[id as keyof typeof p.activeInventory]=Number.MAX_SAFE_INTEGER;for(const id of Object.keys(p.passiveLevels))p.passiveLevels[id as keyof typeof p.passiveLevels]=Number.MAX_SAFE_INTEGER;}
  h.s.page='prepare';h.draw();const before=h.snapshot();
  for(const id of CARD_IDS){
    const entry=h.seek(`prepare-card-${id}`),offset=h.state.scroll,kind=CARDS[id].kind;
    const value=kind==='active'?p.activeInventory[id as keyof typeof p.activeInventory]:p.passiveLevels[id as keyof typeof p.passiveLevels];
    assert.ok(entry.w>=44&&entry.h>=44);assert.ok(entry.y>=60&&entry.y+entry.h<h.find('start-arena').y);assert.equal(entry.label,`查看${CARDS[id].name}，${value}${kind==='active'?'张':'层'}`);
    h.tap(`prepare-card-${id}`);h.draw();assert.equal(h.s.page,'prepare');assert.ok(!h.v.regions.some(r=>r.id==='start-arena'));
    h.seek('card-rules');h.tap('card-rules');h.draw();const texts=new Set<string>(),fixed=[h.find('card-sheet-close'),h.find('card-sheet-done')].map(rect);
    for(let i=0;i<120;i++){
      for(const m of h.d.marks)if(m.visible)texts.add(m.text);
      assert.deepEqual([h.find('card-sheet-close'),h.find('card-sheet-done')].map(rect),fixed);assert.equal(h.state.scroll,offset);
      const prior=h.state.detailScroll;h.v.wheel(12);h.draw();if(prior===h.state.detailScroll)break;
    }
    const text=[...texts].join('');assert.ok(text.includes(CARDS[id].description));assert.ok(text.includes('到期'));
    assert.ok(text.includes(kind==='active'?`持有 ${value} 张 · 每次使用扣 1`:`本周累计 ${value} 层`));
    if(kind==='passive'){
      const bonus=maximum?(id==='logistics'?'15.00':'20.00'):({farming:'10.00',logistics:'8.33',fortification:'12.00'} as const)[id as 'farming'|'logistics'|'fortification'];
      assert.ok(text.includes(`当前增益 +${bonus}%`));if(id==='fortification'){assert.ok(text.includes(`一级容量 ${maximum?59:56}`));assert.ok(!text.includes('一级容量 60'));}
    }
    h.tap('card-sheet-done');h.draw();assert.equal(h.state.scroll,offset);assert.equal(h.s.page,'prepare');assert.deepEqual(h.snapshot(),before);
  }
  h.seek('prepare-library');h.tap('prepare-library');h.draw();assert.equal(h.s.page,'library');assert.equal(h.s.returnPage,'prepare');
  h.tap('library-fortification');h.draw();const text=h.d.marks.filter(m=>m.visible).map(m=>m.text).join('');assert.ok(!/本周累计|当前增益|一级容量/.test(text),'opening from preparation must not turn the catalogue into a personal inventory');
  h.tap('card-sheet-close');h.draw();h.tap('back');h.draw();assert.equal(h.s.page,'prepare');assert.deepEqual(h.snapshot(),before);
});

test('strategy explanation: surface taps never penetrate, old exits cannot close a new card, and cancelled presses remain inert',async()=>{
  const h=await harness(320,568),before=h.snapshot(),oldCard=h.find('library-supply');h.tap('library-mobilize');h.draw();
  const surface=h.find('card-sheet-surface');h.v.down(2,surface.x+4,surface.y+surface.h/2);h.v.up(2,surface.x+4,surface.y+surface.h/2);h.draw();assert.equal(h.state.librarySelection,'mobilize');
  oldCard.run();h.draw();assert.equal(h.state.librarySelection,'mobilize');const oldDone=h.find('card-sheet-done');h.tap('card-sheet-close');h.draw();h.tap('library-march');h.draw();oldDone.run();h.draw();assert.equal(h.state.librarySelection,'march');
  const done=h.find('card-sheet-done'),x=done.x+done.w/2,y=done.y+done.h/2;h.v.down(3,x,y);h.v.cancel();h.v.up(3,x,y);h.draw();assert.equal(h.state.librarySelection,'march');
  h.v.down(4,x,y);h.v.move(4,x,y-70);h.v.up(4,x,y-70);h.draw();assert.equal(h.state.librarySelection,'march','a scroll starting at done must not dismiss');
  h.tap('card-sheet-done');h.draw();const card=h.find('library-feint');h.v.down(5,card.x+card.w/2,card.y+card.h/2);h.v.cancel();h.v.up(5,card.x+card.w/2,card.y+card.h/2);h.draw();assert.equal(h.state.librarySelection,null);assert.deepEqual(h.snapshot(),before);
});
