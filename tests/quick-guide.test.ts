import {installDisplayFont} from '../src/render/typography.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {GameView,type Region} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';
import {applyBattleAction,createBattle} from '../src/core/battle.ts';
import {UPGRADE} from '../src/core/config.ts';
import {CAMP_COUNT_FONT} from '../src/render/art.ts';

const NOW=Date.parse('2026-09-13T12:00:00+08:00'),SIZES=[[320,568],[375,812],[430,932],[280,454]] as const;
async function idle(s:GameSession){for(let i=0;i<60&&s.busy;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(s.busy,0);}
async function harness(width:number,height:number,origin:'home'|'pause'='home',reduced=false){
  let writes=0,frame=0;const data=new Map<string,string>(),labels:{text:string;y:number}[]=[],calls:unknown[]=[],state:Record<string,unknown>={globalAlpha:1};
  const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    return (...args:unknown[])=>{
      calls.push([String(key),...args.map(a=>typeof a==='object'?'object':a)]);
      if(key==='save'){stack.push({...state});return;}
      if(key==='restore'){const saved=stack.pop();if(saved){for(const key of Object.keys(state))delete state[key];Object.assign(state,saved);}return;}
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
  return {s,v,ctx,draw,find,tap,seek,scan,snapshot,labels,calls};
}

test('manual chapter change fades only the new illustration and instructions for 120 ms with stable controls',async()=>{
  for(const reduced of [false,true]){
    const h=await harness(375,812,'pause',reduced);h.draw(50000);const before=h.snapshot(),alpha:number[]=[],titles:number[]=[];
    const original=h.ctx.fillText;h.ctx.fillText=(label,x,y)=>{if(label.startsWith('1.'))alpha.push(h.ctx.globalAlpha);if(label==='玩法与关于')titles.push(h.ctx.globalAlpha);original.call(h.ctx,label,x,y);};
    const rects=()=>h.v.regions.map(({run,...r})=>r);
    h.tap(h.find('about-chapter-2'));h.draw(50000);const controls=rects();h.draw(50060);h.draw(50120);
    assert.deepEqual(alpha,reduced?[1,1,1]:[.55,.775,1]);assert.deepEqual(titles,[1,1,1]);assert.deepEqual(rects(),controls);assert.deepEqual(h.snapshot(),before);
    h.draw(51000);assert.equal(alpha.at(-1),1,'the chapter never loops');
  }
});

test('upgrade illustrations pair each required garrison with its real post-upgrade remainder',async()=>{
  const h=await harness(375,812),before=h.snapshot(),counts:string[]=[],levels:string[]=[];
  const original=h.ctx.fillText;h.ctx.fillText=(label,x,y)=>{if(h.ctx.font===CAMP_COUNT_FONT)counts.push(label);if(['一级','二级','三级'].includes(label))levels.push(label);original.call(h.ctx,label,x,y);};
  h.tap(h.find('about-chapter-1'));h.draw(100000);
  const expected:string[]=[];
  for(const tier of [1,2] as const){
    const b=createBattle('L01',{id:'manual-upgrade-check',firstDragCompleted:true}),c=b.camps.find(c=>c.owner==='P')!;c.tier=tier;c.garrison=UPGRADE[tier].threshold;expected.push(String(c.garrison));
    assert.ok(applyBattleAction(b,{kind:'upgrade',faction:'P',sequence:1,targetId:c.id}).ok);expected.push(String(c.garrison));
  }
  assert.deepEqual(counts,expected);assert.deepEqual(levels,['一级','二级','二级','三级']);assert.deepEqual(h.snapshot(),before);
});

for(const [width,height]of SIZES){
  test(`quick guide ${width}×${height}: default diagrams and their rules are reachable through read-only scrolling`,async()=>{
    const h=await harness(width,height),before=h.snapshot();
    const fixed=['back','about-guide','about-rules'].map(id=>{const {x,y,w,h:rh}=h.find(id);assert.ok(w>=44&&rh>=44);assert.ok(y>=48&&y+rh<=height-12);return {id,x,y,w,h:rh};});
    assert.ok(!h.v.regions.some(r=>r.id.startsWith('about-section-')));
    let text='';for(const chapter of [0,1,2]){h.tap(h.find(`about-chapter-${chapter}`));h.draw();text+=h.scan();}for(const term of ['一半','升级','锦囊','兼行'])assert.ok(text.includes(term),`visible guide retains ${term}`);assert.match(text,/邻城|相邻/);
    assert.ok(h.v.regions.every(r=>['back','about-guide','about-rules','about-chapter-0','about-chapter-1','about-chapter-2','about-replay','about-lessons'].includes(r.id)),'demonstration figures never register real battle targets');
    assert.deepEqual(['back','about-guide','about-rules'].map(id=>{const {x,y,w,h:rh}=h.find(id);return {id,x,y,w,h:rh};}),fixed);
    h.v.down(9,2,height/2);h.v.up(9,2,height/2);h.draw();assert.equal(h.s.page,'about');assert.deepEqual(h.snapshot(),before);
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

for(const reduced of [false,true])test(`quick guide motion reduced=${reduced}: static until explicit replay, then stops without changing player state`,async()=>{
  const h=await harness(375,812,'home',reduced),before=h.snapshot();
  h.draw(100000);const idle=JSON.stringify(h.calls);h.draw(101000);assert.equal(JSON.stringify(h.calls),idle,'idle guide does not auto-loop');
  h.tap(h.find('about-replay'));h.draw(101100);const first=JSON.stringify(h.calls),regions=h.v.regions.map(({run,...r})=>r);
  h.draw(101900);if(reduced)assert.equal(JSON.stringify(h.calls),first);else assert.notEqual(JSON.stringify(h.calls),first);
  h.draw(105000);const ended=JSON.stringify(h.calls);h.draw(106000);assert.equal(JSON.stringify(h.calls),ended,'storyboard stops on its final frame');
  assert.deepEqual(h.v.regions.map(({run,...r})=>r),regions);assert.deepEqual(h.snapshot(),before);
});

test('manual: chapter selection and explicit replay stay read-only and invalidate stale replay callbacks',async()=>{
  const h=await harness(375,812,'pause'),before=h.snapshot();
  h.find('about-chapter-0');h.find('about-chapter-1');h.find('about-chapter-2');
  const old=h.seek('about-replay');h.tap(old);h.draw(2000);
  h.tap(h.find('about-chapter-1'));h.draw();old.run();
  assert.ok(h.labels.some(l=>l.text.includes('三级')));
  assert.equal(h.s.match!.battle.gameMs,250);assert.deepEqual(h.snapshot(),before);
});


test('late font readiness cancels held input and stale callbacks without changing the paused match',async()=>{
  const h=await harness(375,812,'pause'),before=h.snapshot(),back=h.find('back'),x=back.x+back.w/2,y=back.y+back.h/2;
  h.v.down(12,x,y);installDisplayFont('late-local-font-test');h.draw();h.v.up(12,x,y);back.run();h.draw();
  assert.equal(h.s.page,'about');assert.deepEqual(h.snapshot(),before);assert.equal(h.s.match!.battle.gameMs,250);
  h.tap(h.find('back'));h.draw();assert.equal(h.s.page,'settings');
});
