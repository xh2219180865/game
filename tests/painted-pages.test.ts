import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/app/session.ts';
import { GameView } from '../src/render/game.ts';
import { CARD_IDS, CARDS } from '../src/core/progress.ts';
import type { CardId } from '../src/core/types.ts';
import { drawArt, loadArt, getArtStatus, ART_SOURCES, type ArtImage } from '../src/render/assets.ts';

const NOW=Date.parse('2026-09-12T12:00:00+08:00');
const SIZES=[[320,568],[375,812],[430,932]] as const;
const ART_COUNT=Object.keys(ART_SOURCES).length;
type TextMark={text:string;x:number;y:number;size:number;visible:boolean;left:number;right:number};
function drawing(){
  const texts:TextMark[]=[],images:string[]=[];
  const c:Record<string,any>={font:'16px sans-serif',globalAlpha:1,lineWidth:1};
  let clip=[-Infinity,-Infinity,Infinity,Infinity],path:number[]|null=null;
  const stack:{state:Record<string,any>;clip:number[]}[]=[];
  const size=()=>parseFloat(String(c.font).match(/(\d+)px/)?.[1]??'16');
  const measure=(text:string)=>[...String(text)].reduce((sum,char)=>sum+(/[^\x00-\x7F]/.test(char)?1:.55),0)*size();
  const ctx=new Proxy(c,{get:(obj,key)=>{
    if(key in obj)return obj[String(key)];
    if(key==='save')return ()=>stack.push({state:{...c},clip:[...clip]});
    if(key==='restore')return ()=>{const saved=stack.pop();assert.ok(saved,'balanced canvas save/restore');for(const key of Object.keys(c))delete c[key];Object.assign(c,saved.state);clip=saved.clip;};
    if(key==='beginPath')return ()=>{path=null;};
    if(key==='rect')return (x:number,y:number,w:number,h:number)=>{path=[x,y,x+w,y+h];};
    if(key==='clip')return ()=>{if(path)clip=[Math.max(clip[0]!,path[0]!),Math.max(clip[1]!,path[1]!),Math.min(clip[2]!,path[2]!),Math.min(clip[3]!,path[3]!)];};
    if(key==='fillText')return (text:string,x:number,y:number)=>{const width=measure(text),left=x-(c.textAlign==='center'?width/2:c.textAlign==='right'?width:0);texts.push({text:String(text),x,y,size:size(),visible:y-size()/2>=clip[1]!&&y+size()/2<=clip[3]!,left,right:left+width});};
    if(key==='measureText')return (text:string)=>({width:measure(text)});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    if(key==='drawImage')return (image:ArtImage,...coords:number[])=>{images.push(image.src);assert.ok(coords.every(Number.isFinite));};
    return (...args:unknown[])=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));};
  }}) as unknown as CanvasRenderingContext2D;
  return {ctx,texts,images,depth:()=>stack.length};
}
function factory(fails:()=>boolean=()=>false){return ()=>{
  let source='';const image:ArtImage={width:1448,height:1086,onload:null,onerror:null,
    get src(){return source;},set src(value:string){source=value;if(fails())image.onerror?.call(image as HTMLImageElement,new Event('error'));else image.onload?.call(image as HTMLImageElement,new Event('load'));},
  };return image;
};}
async function idle(){await new Promise(resolve=>setImmediate(resolve));}
async function harness(width:number,height:number){
  await loadArt(factory());assert.equal(getArtStatus().ready,ART_COUNT);
  const data=new Map<string,string>(),d=drawing();let v:GameView;
  const s=new GameSession({storage:{async read(key){return data.get(key)??null;},async write(key,value){data.set(key,value);},async remove(key){data.delete(key);}},now:()=>NOW,random:()=>.4,notify:text=>v.notify(text),present:event=>v.present(event),events:events=>v.events(events)});
  v=new GameView(d.ctx,s);v.viewport={width,height,top:16,bottom:12};await s.load();
  const p=s.profile!;p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:7,march:8,supply:9,feint:10};p.passiveLevels={farming:4,logistics:5,fortification:6};
  let time=0;
  const draw=()=>{d.texts.length=0;v.draw(time+=200);assert.equal(d.depth(),0);};
  draw();return {s,v,d,data,draw};
}
type Harness=Awaited<ReturnType<typeof harness>>;
function tap(h:Harness,id:string){
  const r=h.v.regions.find(r=>r.id===id);assert.ok(r,`missing touch target ${id}`);assert.ok(r.h>=44&&r.w>=44,`${id} below 44px`);
  h.v.down(1,r.x+r.w/2,r.y+r.h/2);h.v.up(1,r.x+r.w/2,r.y+r.h/2);
}
function scan(h:Harness){
  const ids=new Set<string>(),texts=new Set<string>();h.v.wheel(-100000);h.draw();
  for(let i=0;i<80;i++){
    for(const r of h.v.regions){assert.ok(r.y>=h.v.viewport.top&&r.y+r.h<=h.v.viewport.height-h.v.viewport.bottom,`${r.id} outside viewport`);assert.ok(r.x>=0&&r.x+r.w<=h.v.viewport.width);if(r.h>=44)ids.add(r.id);}
    for(const mark of h.d.texts)if(mark.visible&&mark.y>=16&&mark.y<=h.v.viewport.height-12)texts.add(mark.text);
    const view=h.v as unknown as {scroll:number;detailScroll:number;librarySelection:CardId|null},before=view.librarySelection?view.detailScroll:view.scroll;h.v.wheel(64);h.draw();if((view.librarySelection?view.detailScroll:view.scroll)===before)break;
  }
  return {ids,text:[...texts].join('')};
}
function find(h:Harness,id:string){h.v.wheel(-100000);h.draw();for(let i=0;i<80;i++){const r=h.v.regions.find(r=>r.id===id&&r.h>=44);if(r)return r;h.v.wheel(64);h.draw();}assert.fail(`unreachable ${id}`);}
function baseline(h:Harness){return {profile:JSON.stringify(h.s.profile),storage:[...h.data]};}
function unchanged(h:Harness,b:ReturnType<typeof baseline>){assert.equal(JSON.stringify(h.s.profile),b.profile);assert.deepEqual([...h.data],b.storage);assert.equal(h.s.match,null);}

for(const [width,height]of SIZES)for(const state of ['ordinary','week','farming','logistics','fortification','week-and-reward'] as const)test(`painted home ${width}×${height}: ${state} retains all actions and full reward text through scroll`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;
  if(state==='week'||state==='week-and-reward')h.s.weekNotice=true;
  if(!['ordinary','week'].includes(state)){
    const id=state==='week-and-reward'?'fortification':state as 'farming'|'logistics'|'fortification';p.passiveLevels[id]=4;
    p.choice={choiceId:'painted-reward',matchId:'shown',kind:'mixed',grantQuantity:1,candidateIds:[id],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'claimed',selected:id};
    h.v.present({kind:'passive-claim',choiceId:'painted-reward',cardId:id,before:3,after:4});
  }
  h.draw();const before=baseline(h),seen=scan(h);
  assert.ok(h.d.images.includes(ART_SOURCES.home),'test must enter painted home');
  for(const id of ['settings','rank-card','primary','lessons','library','leaderboard'])assert.ok(seen.ids.has(id),`unreachable ${id}`);
  if(h.s.weekNotice){assert.ok(seen.ids.has('dismiss-week'));assert.ok(seen.text.includes('旧锦囊、兵法、待选已到期'));assert.ok(seen.text.includes('军功与历史最高保留'));}
  if(!['ordinary','week'].includes(state)){assert.ok(seen.text.includes('层数 3 → 4'));if(state==='fortification'||state==='week-and-reward')assert.ok(seen.text.includes('一级容量 54 → 55'));}
  unchanged(h,before);
  find(h,'library');tap(h,'library');h.draw();assert.equal(h.s.page,'library');assert.equal(h.s.returnPage,'home');
});

for(const [width,height]of SIZES)for(const maximum of [false,true])test(`painted library ${width}×${height}: seven cards, full same-page details and close restores scroll (maximum=${maximum})`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;
  if(maximum){for(const id of Object.keys(p.activeInventory))p.activeInventory[id as keyof typeof p.activeInventory]=Number.MAX_SAFE_INTEGER;for(const id of Object.keys(p.passiveLevels))p.passiveLevels[id as keyof typeof p.passiveLevels]=Number.MAX_SAFE_INTEGER;}
  h.s.page='library';h.s.returnPage='prepare';h.draw();const before=baseline(h),seen=scan(h);
  for(const id of CARD_IDS)assert.ok(seen.ids.has(`library-${id}`),`unreachable card ${id}`);
  assert.ok(!/持有|累计|已解锁 \d/.test(seen.text),'the catalogue does not expose personal holdings');
  if(maximum){assert.ok(!seen.text.includes('999+'));assert.ok(!seen.text.includes(String(Number.MAX_SAFE_INTEGER)),'personal counts belong to preparation, not the catalogue');}
  assert.ok(!h.d.images.includes(ART_SOURCES.cards),'the catalogue uses compact ink seals');
  for(const id of CARD_IDS){
    const r=find(h,`library-${id}`),staleOther=h.v.regions.find(r=>r.id.startsWith('library-')&&r.id!==`library-${id}`);
    assert.equal(r.label,`查看${CARDS[id].name}，已解锁`);
    const gridScroll=(h.v as unknown as {scroll:number}).scroll;
    tap(h,`library-${id}`);staleOther?.run();h.draw();assert.equal(h.s.page,'library');assert.equal((h.v as unknown as {librarySelection:CardId|null}).librarySelection,id,'old grid region cannot replace selected details');
    assert.ok(!h.v.regions.some(r=>r.id.startsWith('library-')),'detail shows no grid touch targets');
    find(h,'card-rules');tap(h,'card-rules');h.draw();
    const detail=scan(h);assert.ok(detail.text.includes(CARDS[id].description),`${id} full description must be reachable`);
    assert.ok(detail.text.includes('到期'),'the full sheet retains the weekly expiry rule');
    assert.ok(!/持有|本周累计|当前增益|一级容量|999\+/.test(detail.text),`${id}: a catalogue opened from preparation still contains no personal state`);
    assert.ok(!detail.text.includes(String(Number.MAX_SAFE_INTEGER)));
    assert.match(detail.text,/通关.*解锁/);
    assert.equal((h.v as unknown as {scroll:number}).scroll,gridScroll,'sheet scrolling cannot move the catalogue');
    const staleClose=h.v.regions.find(r=>r.id==='card-sheet-close')!;tap(h,'card-sheet-close');h.draw();assert.equal(h.s.page,'library');assert.ok(h.v.regions.some(r=>r.id.startsWith('library-')));
    assert.equal((h.v as unknown as {scroll:number}).scroll,gridScroll,'closing restores the catalogue position');
    staleClose.run();assert.equal(h.s.page,'library','a stale detail close cannot leave the new grid');
  }
  tap(h,'back');h.draw();assert.equal(h.s.page,'prepare');unchanged(h,before);
});

for(const [width,height]of SIZES)test(`painted page ${width}×${height}: stale home actions and an interrupted card press cannot act on a later page`,async()=>{
  const h=await harness(width,height);const oldPrimary=find(h,'primary');find(h,'library');tap(h,'library');h.draw();const before=baseline(h);
  oldPrimary.run();await idle();assert.equal(h.s.page,'library');unchanged(h,before);
  const region=find(h,'library-mobilize');h.v.down(7,region.x+region.w/2,region.y+region.h/2);
  h.s.page='settings';h.draw();h.v.up(7,region.x+region.w/2,region.y+region.h/2);h.draw();assert.equal(h.s.page,'settings');assert.equal(h.v.modal,null);unchanged(h,before);
});

for(const [width,height]of SIZES)test(`painted settings ${width}×${height}: failed resources retry without mutating any saved progress`,async()=>{
  const h=await harness(width,height),broken={drawImage(){throw new Error('decoded image lost');}} as unknown as CanvasRenderingContext2D;
  for(const id of Object.keys(ART_SOURCES))drawArt(broken,id as keyof typeof ART_SOURCES,0,0,10,10);
  let failing=true;await loadArt(factory(()=>failing));assert.equal(getArtStatus().failed,ART_COUNT);
  h.s.page='settings';h.s.returnPage='home';h.draw();const before=baseline(h);const seen=scan(h);
  assert.ok(seen.ids.has('retry-art'));assert.ok(seen.text.includes('部分画面未载入，可重新载入。'));assert.equal(seen.text.includes(`画面资源 ${ART_COUNT}/${ART_COUNT}`),false,'successful resource diagnostics do not occupy ordinary settings');
  find(h,'retry-art');tap(h,'retry-art');await idle();assert.equal(getArtStatus().failed,ART_COUNT);unchanged(h,before);
  failing=false;h.draw();find(h,'retry-art');tap(h,'retry-art');await idle();h.draw();assert.equal(getArtStatus().ready,ART_COUNT);assert.ok(!h.v.regions.some(r=>r.id==='retry-art'));unchanged(h,before);
  tap(h,'back');h.draw();assert.equal(h.s.page,'home');assert.ok(h.d.images.includes(ART_SOURCES.home));
});

for(const [width,height]of SIZES)test(`painted home ${width}×${height}: maximum rank, weekly wins and passive reward remain readable and reachable`,async()=>{
  const h=await harness(width,height),p=h.s.profile!,maximum=Number.MAX_SAFE_INTEGER;
  p.rankPoints=maximum;p.highestRankPoints=maximum;p.qualifiedArenaWins=maximum;p.passiveLevels.fortification=maximum;
  p.choice={choiceId:'max-painted-reward',matchId:'shown',kind:'mixed',grantQuantity:1,candidateIds:['fortification'],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'claimed',selected:'fortification'};
  h.v.present({kind:'passive-claim',choiceId:'max-painted-reward',cardId:'fortification',before:maximum-1,after:maximum});h.s.weekNotice=true;
  h.draw();const before=baseline(h),seen=scan(h);
  assert.ok(seen.text.includes(String(maximum-1)));assert.ok(seen.text.includes(String(maximum)));assert.ok(seen.text.includes('一级容量'));
  for(const id of ['primary','library','rank-card','dismiss-week'])assert.ok(seen.ids.has(id));
  h.v.wheel(-100000);h.draw();
  for(let i=0;i<30;i++){
    for(const mark of h.d.texts)if(mark.visible&&mark.y>=16&&mark.y<=height-12)assert.ok(mark.left>=0&&mark.right<=width,`text clips horizontally: ${mark.text} (${mark.left},${mark.right})`);
    h.v.wheel(64);h.draw();
  }
  unchanged(h,before);
});

for(const [width,height]of SIZES)test(`painted library ${width}×${height}: locked cards disclose lesson and pending choice remains accessible from home`,async()=>{
  const h=await harness(width,height),p=h.s.profile!;p.unlockedCardIds=['mobilize'];
  p.choice={choiceId:'pending-painted',matchId:'shown',kind:'mixed',grantQuantity:1,candidateIds:['mobilize'],unlockSnapshot:['mobilize'],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
  h.s.page='library';h.s.returnPage='home';h.draw();const before=baseline(h),seen=scan(h);assert.ok(!seen.ids.has('library-claim'));
  find(h,'library-fortification');tap(h,'library-fortification');h.draw();find(h,'card-rules');tap(h,'card-rules');h.draw();const detail=scan(h);
  assert.ok(detail.text.includes('通关「'));assert.ok(detail.text.includes('」解锁'));assert.ok(!detail.text.includes('本周累计'));assert.ok(detail.text.includes(CARDS.fortification.description));
  tap(h,'card-sheet-close');h.draw();tap(h,'back');h.draw();assert.equal(h.s.page,'home');assert.equal(find(h,'primary').label,'领取奖励');tap(h,'primary');h.draw();assert.equal(h.s.page,'choice');unchanged(h,before);
});

function choice(h:Harness,candidates:CardId[]){
  const p=h.s.profile!;
  // This is a display/input fixture. Successful reward transactions are exercised
  // by session tests; spy on the boundary so invalid fixture records cannot hide
  // an unintended attempt to claim from an old UI callback.
  p.choice={choiceId:'painted-choice',matchId:'shown',kind:'mixed',grantQuantity:1,candidateIds:[...candidates],unlockSnapshot:[...CARD_IDS],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
  const claims:CardId[]=[];h.s.claim=async id=>{claims.push(id);};h.s.page='choice';h.draw();return claims;
}

for(const [width,height]of SIZES)for(const count of [0,1,2,3])test(`painted choice ${width}×${height}: ${count} real candidates share a visible row and both bottom actions remain reachable`,async()=>{
  const h=await harness(width,height),candidates=(['mobilize','farming','logistics'] as CardId[]).slice(0,count),claims=choice(h,candidates),before=baseline(h);
  assert.equal(getArtStatus().ready,ART_COUNT);
  const regions=h.v.regions.filter(r=>r.id.startsWith('choice-'));
  assert.deepEqual(regions.map(r=>r.id),candidates.map(id=>`choice-${id}`),'never invent candidates');
  if(count){assert.ok(h.d.images.includes(ART_SOURCES.sample));assert.ok(!h.d.images.includes(ART_SOURCES.cards));assert.equal(new Set(regions.map(r=>r.y)).size,1,'candidates appear together rather than a vertical fallback list');}
  for(const r of regions){assert.ok(r.w>=44&&r.h>=44);assert.ok(r.x>=20-1e-9&&r.x+r.w<=width-20+1e-9);assert.ok(r.y>=h.v.viewport.top&&r.y+r.h<=height-h.v.viewport.bottom-137);}
  for(let i=1;i<regions.length;i++)assert.ok(regions[i-1]!.x+regions[i-1]!.w<regions[i]!.x,'cards do not overlap');
  tap(h,'claim');await idle();assert.deepEqual(claims,[],'unselected or empty choices cannot claim');unchanged(h,before);
  const seen=scan(h);assert.ok(seen.ids.has('claim'));assert.ok(seen.ids.has('abandon-choice'));
  tap(h,'abandon-choice');h.draw();assert.ok(h.v.modal);assert.ok(h.v.regions.some(r=>r.id==='modal-cancel'&&r.h>=44));tap(h,'modal-cancel');h.draw();assert.equal(h.v.modal,null);unchanged(h,before);
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: select and reselect all seven cards with complete before/after and active/passive effects`,async()=>{
  const h=await harness(width,height);
  for(const candidates of [CARD_IDS.slice(0,3),CARD_IDS.slice(3,6),CARD_IDS.slice(6)]){
    h.s.page='home';h.draw();const claims=choice(h,candidates),before=baseline(h);
    for(const id of candidates){
      find(h,`choice-${id}`);tap(h,`choice-${id}`);h.draw();assert.equal(h.v.selectedChoice,id);
      const seen=scan(h),card=CARDS[id],p=h.s.profile!,value=card.kind==='active'?p.activeInventory[id as keyof typeof p.activeInventory]:p.passiveLevels[id as keyof typeof p.passiveLevels];
      assert.ok(seen.text.includes(`${card.kind==='active'?'库存':'层数'} ${value} → ${value+1}`),`${id}: exact quantity`);
      if(card.kind==='active')assert.ok(seen.text.includes(card.description),`${id}: complete active effect`);
      else{
        assert.ok(seen.text.includes('本周每局自动，不消耗；重复领取递减提升。'));
        const expected=id==='farming'?'产兵 +10.00% → +11.11%':id==='logistics'?'移速 +8.33% → +9.00%':'容量 +12.00% → +12.73%';
        assert.ok(seen.text.includes(expected),`${id}: before/after passive bonus`);
      }
      const confirm=h.v.regions.find(r=>r.id==='claim')!;assert.equal(confirm.label,`确认领取${card.short}`);assert.ok(confirm.h>=44);unchanged(h,before);
    }
    assert.deepEqual(claims,[]);tap(h,'claim');await idle();assert.deepEqual(claims,[candidates[candidates.length-1]],'fresh confirmation delegates the last selection only');unchanged(h,before);
  }
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: maximum inventory and passive count cannot be selected or claimed`,async()=>{
  const h=await harness(width,height),p=h.s.profile!,maximum=Number.MAX_SAFE_INTEGER;p.activeInventory.mobilize=maximum;p.passiveLevels.farming=maximum;
  const claims=choice(h,['mobilize','farming','supply']),before=baseline(h);
  for(const id of ['mobilize','farming']){find(h,`choice-${id}`);tap(h,`choice-${id}`);h.draw();assert.equal(h.v.selectedChoice,null);tap(h,'claim');await idle();assert.deepEqual(claims,[]);}
  find(h,'choice-supply');tap(h,'choice-supply');h.draw();assert.equal(h.v.selectedChoice,'supply');
  find(h,'choice-mobilize');tap(h,'choice-mobilize');h.draw();assert.equal(h.v.selectedChoice,'supply','rejecting an overflowing card preserves the eligible selection');unchanged(h,before);
  p.activeInventory.mobilize=maximum-1;h.draw();find(h,'choice-mobilize');tap(h,'choice-mobilize');h.draw();const seen=scan(h);
  assert.ok(seen.text.includes(`库存 ${maximum-1} → ${maximum}`),'safe upper boundary remains exact');assert.deepEqual(claims,[]);
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: delayed retry changes no candidate, selection, inventory, passive levels or storage`,async()=>{
  const h=await harness(width,height),claims=choice(h,['mobilize','farming','logistics']);tap(h,'choice-farming');h.draw();const before=baseline(h);
  drawArt({drawImage(){throw new Error('image lost');}} as unknown as CanvasRenderingContext2D,'cards',0,0,10,10);let fails=true;await loadArt(factory(()=>fails));
  assert.equal(getArtStatus().failed,1);h.draw();unchanged(h,before);assert.equal(h.v.selectedChoice,'farming');assert.deepEqual(claims,[]);
  const retryImages:ArtImage[]=[];const ready=loadArt(()=>{const image:ArtImage={width:1448,height:1086,src:'',onload:null,onerror:null};retryImages.push(image);return image;});
  await Promise.resolve();h.draw();unchanged(h,before);assert.equal(getArtStatus().loading,1);assert.deepEqual(claims,[]);
  retryImages.forEach(image=>image.onload?.call(image as HTMLImageElement,new Event('load')));await ready;fails=false;h.draw();
  assert.equal(getArtStatus().ready,ART_COUNT);unchanged(h,before);assert.equal(h.v.selectedChoice,'farming');assert.deepEqual(claims,[]);
  assert.equal(new Set(h.v.regions.filter(r=>r.id.startsWith('choice-')).map(r=>r.y)).size,1,'recovered resources restore the shared candidate row');
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: previous confirmation callback expires after reselection`,async()=>{
  const h=await harness(width,height),claims=choice(h,['mobilize','farming']);tap(h,'choice-mobilize');h.draw();
  const oldConfirm=h.v.regions.find(r=>r.id==='claim')!;assert.equal(oldConfirm.label,'确认领取征兵');
  find(h,'choice-farming');tap(h,'choice-farming');h.draw();const before=baseline(h);
  oldConfirm.run();await idle();assert.deepEqual(claims,[],'old confirmation must not claim a card selected later');unchanged(h,before);
  tap(h,'claim');await idle();assert.deepEqual(claims,['farming']);
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: an image retry cancels a held press when the fallback list changes to a card row`,async()=>{
  const h=await harness(width,height),claims=choice(h,['mobilize','farming','logistics']);
  const paintedSecond=h.v.regions.find(r=>r.id==='choice-farming')!,x=paintedSecond.x+paintedSecond.w/2,y=paintedSecond.y+paintedSecond.h/2;
  drawArt({drawImage(){throw new Error('image unavailable');}} as unknown as CanvasRenderingContext2D,'cards',0,0,10,10);await loadArt(factory(()=>true));h.draw();
  const fallbackUnderFinger=h.v.regions.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);assert.equal(fallbackUnderFinger?.id,'choice-mobilize');
  const before=baseline(h);h.v.down(11,x,y);
  await loadArt(factory());h.draw();
  assert.equal(h.v.regions.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)?.id,'choice-farming','the same position now visibly belongs to a different card');
  h.v.up(11,x,y);h.draw();assert.equal(h.v.selectedChoice,null,'release cannot invoke the old fallback card after artwork changes the layout');
  assert.deepEqual(claims,[]);unchanged(h,before);tap(h,'choice-farming');h.draw();assert.equal(h.v.selectedChoice,'farming');
});

for(const [width,height]of SIZES)test(`painted choice ${width}×${height}: callbacks expire across loss and recovery while explicit selection and saved candidates survive`,async()=>{
  const h=await harness(width,height),claims=choice(h,['mobilize','farming','logistics']);tap(h,'choice-farming');h.draw();
  const paintedSelect=h.v.regions.find(r=>r.id==='choice-mobilize')!,paintedConfirm=h.v.regions.find(r=>r.id==='claim')!,before=baseline(h);
  drawArt({drawImage(){throw new Error('native artwork lost');}} as unknown as CanvasRenderingContext2D,'cards',0,0,10,10);
  // Art can complete or fail between animation frames. No redraw is necessary
  // for already exported callbacks to stop referring to obsolete hit regions.
  paintedSelect.run();paintedConfirm.run();await idle();assert.equal(h.v.selectedChoice,'farming');assert.deepEqual(claims,[]);unchanged(h,before);
  h.draw();paintedSelect.run();paintedConfirm.run();await idle();assert.equal(h.v.selectedChoice,'farming');assert.deepEqual(claims,[]);unchanged(h,before);
  find(h,'choice-mobilize');const fallbackSelect=h.v.regions.find(r=>r.id==='choice-mobilize')!,fallbackConfirm=h.v.regions.find(r=>r.id==='claim')!;
  const x=fallbackSelect.x+fallbackSelect.w/2,y=fallbackSelect.y+fallbackSelect.h/2;
  await loadArt(factory());
  fallbackSelect.run();fallbackConfirm.run();h.v.down(29,x,y);h.v.up(29,x,y);await idle();
  assert.equal(h.v.selectedChoice,'farming','unrendered art changes cannot clear or replace an explicit selection');assert.deepEqual(claims,[]);unchanged(h,before);
  h.draw();fallbackSelect.run();fallbackConfirm.run();paintedConfirm.run();await idle();
  assert.equal(h.v.selectedChoice,'farming');assert.deepEqual(claims,[]);unchanged(h,before);
  assert.equal(h.v.regions.find(r=>r.id==='claim')?.label,'确认领取屯田');tap(h,'claim');await idle();assert.deepEqual(claims,['farming'],'freshly rendered confirmation still works');unchanged(h,before);
});
