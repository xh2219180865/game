import test from 'node:test';
import assert from 'node:assert/strict';
import {GameView,type Region} from '../src/render/game.ts';
import {GameSession} from '../src/app/session.ts';

const NOW=Date.parse('2026-09-13T12:00:00+08:00');
async function idle(s:GameSession){for(let i=0;i<60&&s.busy;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(s.busy,0);}
async function harness(width:number,height:number,origin:'home'|'pause'='home'){
  let writes=0,frame=0,previews=0;const data=new Map<string,string>(),state:Record<string,unknown>={globalAlpha:1};
  const ctx=new Proxy(state,{get(t,key){
    if(key in t)return t[String(key)];
    if(key==='measureText')return (s:string)=>({width:[...s].length*8});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
  },set(t,key,value){t[String(key)]=value;return true;}}) as unknown as CanvasRenderingContext2D;
  const s=new GameSession({storage:{async read(k){return data.get(k)??null;},async write(k,v){writes++;data.set(k,v);},async remove(k){writes++;data.delete(k);}},now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});
  const v=new GameView(ctx,s);v.viewport={width,height,top:48,bottom:12};v.soundPreview=()=>{previews++;};await s.load();
  if(origin==='pause'){
    await s.start('L01');assert.equal(await s.action({kind:'dispatch',sourceId:'L01-P1',targetId:'L01-N1'}),true);
    for(let i=0;i<4;i++){s.tick(250);await idle(s);}await s.pause();
  }
  const draw=()=>v.draw(++frame*200);
  const find=(id:string)=>{const r=v.regions.find(r=>r.id===id);assert.ok(r,`missing ${id} at ${width}×${height}`);return r;};
  const tapRegion=(r:Region)=>{v.down(1,r.x+r.w/2,r.y+r.h/2);v.up(1,r.x+r.w/2,r.y+r.h/2);};
  const tap=(id:string)=>tapRegion(find(id));
  const seek=(id:string)=>{v.wheel(-10000);draw();for(let i=0;i<100;i++){const r=v.regions.find(r=>r.id===id);if(r)return r;v.wheel(12);draw();}assert.fail(`unreachable ${id}`);};
  const snapshot=()=>({profile:JSON.stringify(s.profile),battle:JSON.stringify(s.match?.battle),data:[...data],writes});
  draw();tap(origin==='home'?'settings':'pause-settings');await idle(s);draw();assert.equal(s.page,'settings');assert.equal(s.returnPage,origin);
  return {s,v,draw,find,tap,tapRegion,seek,snapshot,previews:()=>previews};
}

for(const [width,height]of [[320,568],[375,812],[430,932]] as const){
  test(`settings sheet ${width}: fixed close and done stay reachable while the middle scrolls without activating controls`,async()=>{
    const h=await harness(width,height),before=h.snapshot(),close=h.find('back'),done=h.find('settings-done');
    const fixed=[close,done].map(({id,x,y,w,h})=>({id,x,y,w,h}));
    for(const r of [close,done]){assert.ok(r.w>=44&&r.h>=44);assert.ok(r.y>=48&&r.y+r.h<=height-12);}
    for(const id of ['setting-sound','setting-vibration','setting-reducedMotion','about','reset']){
      const r=h.seek(id);assert.ok(r.w>=44&&r.h>=44);assert.ok(r.x>=16&&r.x+r.w<=width-16);
      assert.ok(r.y>=close.y+close.h&&r.y+r.h<=done.y,'middle controls remain between the fixed sheet header and footer');
      assert.deepEqual([h.find('back'),h.find('settings-done')].map(({id,x,y,w,h})=>({id,x,y,w,h})),fixed);
      h.v.down(7,r.x+r.w/2,r.y+r.h/2);h.v.move(7,r.x+r.w/2,r.y-48);h.v.up(7,r.x+r.w/2,r.y-48);h.draw();
      assert.equal(h.s.page,'settings');assert.deepEqual(h.snapshot(),before,'scrolling cannot toggle a setting or open a secondary action');
    }
  });

  for(const origin of ['home','pause'] as const)test(`settings sheet ${width} from ${origin}: background is inert and both exits preserve its state`,async()=>{
    for(const exit of ['back','settings-done']){
      const h=await harness(width,height,origin),before=h.snapshot();
      assert.ok(h.v.regions.every(r=>['back','settings-done','setting-sound','setting-vibration','setting-reducedMotion','test-sound','about','reset','retry-art'].includes(r.id)),'no underlying home or battlefield actions remain registered');
      for(const [x,y]of [[2,height/2],[width-2,height/2],[width/2,50]]){h.v.down(9,x!,y!);h.v.up(9,x!,y!);h.draw();}
      assert.equal(h.s.page,'settings');assert.deepEqual(h.snapshot(),before);
      for(let i=0;i<4;i++){h.s.tick(250);h.draw();}assert.deepEqual(h.snapshot(),before,'a settings overlay cannot advance the paused battle');
      h.tap(exit);h.draw();assert.equal(h.s.page,origin);assert.equal(h.s.returnPage,origin);assert.deepEqual(h.snapshot(),before);
      if(origin==='pause'){assert.equal(h.s.match!.battle.status,'paused');assert.equal(h.s.match!.battle.gameMs,1000);}
    }
  });

  test(`settings sheet ${width}: audition, about return and cancelled reset retain the paused session`,async()=>{
    const h=await harness(width,height,'pause');if(!h.s.profile!.settings.sound){await h.s.setting('sound');h.draw();}
    const before=h.snapshot(),preview=h.seek('test-sound');assert.ok(preview.w>=44&&preview.h>=44);h.tapRegion(preview);h.draw();
    assert.equal(h.previews(),1);assert.equal(h.s.profile!.settings.sound,true);assert.deepEqual(h.snapshot(),before);
    h.tapRegion(h.seek('about'));h.draw();assert.equal(h.s.page,'about');h.tap('back');h.draw();assert.equal(h.s.page,'settings');assert.equal(h.s.returnPage,'pause');h.find('settings-done');
    h.tapRegion(h.seek('reset'));h.draw();assert.ok(h.v.modal);assert.deepEqual(h.snapshot(),before);h.tap('modal-cancel');h.draw();assert.equal(h.v.modal,null);assert.deepEqual(h.snapshot(),before);
    h.tap('settings-done');h.draw();assert.equal(h.s.page,'pause');assert.equal(h.s.match!.battle.status,'paused');assert.deepEqual(h.snapshot(),before);
  });
}

test('settings sheet reduced motion: scenery does not expose hidden home controls or change a saved preference',async()=>{
  const h=await harness(320,568);await h.s.setting('reducedMotion');h.draw();const before=h.snapshot();
  for(let i=0;i<10;i++)h.draw();assert.deepEqual(h.snapshot(),before);assert.equal(h.s.profile!.settings.reducedMotion,true);
  assert.ok(!h.v.regions.some(r=>['primary','lessons','library','leaderboard','rank-card'].includes(r.id)));h.tap('settings-done');assert.equal(h.s.page,'home');
});
