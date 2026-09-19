import test from 'node:test';
import assert from 'node:assert/strict';
import {GameView,type Region} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';

const NOW=Date.parse('2026-09-13T12:00:00+08:00'),SIZES=[[320,568],[375,812],[430,932],[280,454]] as const;
async function idle(s:GameSession){for(let i=0;i<60&&s.busy;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(s.busy,0);}
async function harness(width:number,height:number,origin:'home'|'pause'='home',reduced=false){
  let writes=0,frame=0;const data=new Map<string,string>(),labels:{text:string;y:number}[]=[],calls:unknown[]=[],state:Record<string,unknown>={globalAlpha:1};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    return (...args:unknown[])=>{
      calls.push([String(key),...args.map(a=>typeof a==='object'?'object':a)]);
      if(key==='measureText')return {width:[...String(args[0])].length*8};
      if(key==='fillText')labels.push({text:String(args[0]),y:Number(args[2])});
      if(key==='createLinearGradient'||key==='createRadialGradient')return {addColorStop:(...stops:unknown[])=>calls.push(['stop',...stops])};
    };
  },set(t,key,value){t[String(key)]=value;calls.push([String(key),typeof value==='object'?'object':value]);return true;}}) as unknown as CanvasRenderingContext2D;
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  const v=new GameView(ctx,s);v.viewport={width,height,top:48,bottom:12};await s.load();
  if(reduced)await s.setting('reducedMotion');
  if(origin==='pause'){await s.start('L01');await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'});s.tick(250);await idle(s);await s.pause();}
  const draw=(at?:number)=>{labels.length=0;calls.length=0;v.draw(at??++frame*200);};
  const find=(id:string)=>{const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id} at ${width}×${height}`);return r;};
  const tap=(r:Region)=>{v.down(1,r.x+r.w/2,r.y+r.h/2);v.up(1,r.x+r.w/2,r.y+r.h/2);};
  const seek=(id:string)=>{v.wheel(-10000);draw();for(let i=0;i<150;i++){const r=v.regions.find(r=>r.id===id);if(r)return r;v.wheel(12);draw();}assert.fail(`unreachable ${id}`);};
  const scan=()=>{const visible=new Set<string>();v.wheel(-10000);for(let i=0;i<150;i++){draw();const tabsBottom=Math.max(find('about-guide').y+find('about-guide').h,find('about-rules').y+find('about-rules').h);for(const l of labels)if(l.y>=tabsBottom&&l.y<=height-12)visible.add(l.text);v.wheel(12);}return [...visible].join('');};
  const snapshot=()=>({profile:JSON.stringify(s.profile),data:[...data],writes});
  draw();tap(find(origin==='home'?'settings':'pause-settings'));await idle(s);draw();tap(seek('about'));draw();assert.equal(s.page,'about');
  return {s,v,draw,find,tap,seek,scan,snapshot,labels,calls};
}

for(const [width,height]of SIZES){
  test(`quick guide ${width}×${height}: default diagrams and their rules are reachable through read-only scrolling`,async()=>{
    const h=await harness(width,height),before=h.snapshot();
    const fixed=['back','about-guide','about-rules'].map(id=>{const {x,y,w,h:rh}=h.find(id);assert.ok(w>=44&&rh>=44);assert.ok(y>=48&&y+rh<=height-12);return {id,x,y,w,h:rh};});
    assert.ok(!h.v.regions.some(r=>r.id.startsWith('about-section-')));
    const text=h.scan();for(const term of ['一半','升级','锦囊','兼行'])assert.ok(text.includes(term),`visible guide retains ${term}`);assert.match(text,/邻城|相邻/);
    assert.ok(h.v.regions.every(r=>['back','about-guide','about-rules'].includes(r.id)),'demonstration figures never register real battle targets');
    assert.deepEqual(['back','about-guide','about-rules'].map(id=>{const {x,y,w,h:rh}=h.find(id);return {id,x,y,w,h:rh};}),fixed);
    h.v.down(9,width/2,height-65);h.v.up(9,width/2,height-65);h.draw();assert.equal(h.s.page,'about');assert.deepEqual(h.snapshot(),before);
  });
  test(`quick guide ${width}×${height}: all nine detailed sections remain accessible and switching resets their expansion and scroll`,async()=>{
    const h=await harness(width,height),before=h.snapshot();h.v.wheel(10000);h.draw();h.tap(h.find('about-rules'));h.draw();
    const scroll=h.v as unknown as {scroll:number};assert.equal(scroll.scroll,0);h.find('about-section-0');
    for(let i=0;i<9;i++){const r=h.seek(`about-section-${i}`);assert.ok(r.w>=44&&r.h>=44);h.tap(r);h.draw();assert.equal(h.s.page,'about');}
    h.v.wheel(10000);h.draw();h.tap(h.find('about-guide'));h.draw();assert.equal(scroll.scroll,0);assert.ok(!h.v.regions.some(r=>r.id.startsWith('about-section-')));
    h.tap(h.find('about-rules'));h.draw();assert.equal(scroll.scroll,0);assert.match(h.find('about-section-0').label,/\+$/);
    for(let i=0;i<9;i++)assert.match(h.seek(`about-section-${i}`).label,/\+$/,'returning to details clears the old expanded section');
    assert.deepEqual(h.snapshot(),before);
  });
}

for(const origin of ['home','pause'] as const)test(`quick guide from ${origin}: stale detail callbacks cannot cross tabs or pages and return never resumes battle`,async()=>{
  const h=await harness(320,568,origin),before=h.snapshot();h.tap(h.find('about-rules'));h.draw();const stale=h.find('about-section-0');
  h.tap(h.find('about-guide'));h.draw();stale.run();
  h.tap(h.find('about-rules'));h.draw();assert.match(h.find('about-section-0').label,/\+$/,'the stale callback cannot invalidate the current tab controls or reopen a section');
  h.tap(h.find('back'));h.draw();assert.equal(h.s.page,'settings');assert.equal(h.s.returnPage,origin);stale.run();assert.equal(h.s.page,'settings');
  h.tap(h.find('settings-done'));h.draw();assert.equal(h.s.page,origin);assert.deepEqual(h.snapshot(),before);if(origin==='pause'){assert.equal(h.s.match!.battle.status,'paused');assert.equal(h.s.match!.battle.gameMs,250);}
});

for(const reduced of [false,true])test(`quick guide motion reduced=${reduced}: frame changes affect only the demonstration, never saved state or touch targets`,async()=>{
  const h=await harness(375,812,'home',reduced),before=h.snapshot();h.draw(2000);const first=JSON.stringify(h.calls),regions=h.v.regions.map(({run,...r})=>r),words=h.labels.map(l=>l.text);
  h.draw(3100);if(reduced)assert.equal(JSON.stringify(h.calls),first,'reduced motion freezes the Canvas instruction sequence');else assert.notEqual(JSON.stringify(h.calls),first,'normal render time changes the demonstrated hand gesture');
  assert.deepEqual(h.v.regions.map(({run,...r})=>r),regions);assert.deepEqual(h.labels.map(l=>l.text),words);assert.deepEqual(h.snapshot(),before);
});
