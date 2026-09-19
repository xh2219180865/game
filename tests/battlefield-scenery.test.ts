import test from 'node:test';
import assert from 'node:assert/strict';
import {planBattlefieldScenery,drawBattlefieldScenery} from '../src/render/battlefield-scenery.ts';
import {drawTerrain} from '../src/render/terrain.ts';
import {loadArt,type ArtImage} from '../src/render/assets.ts';
import {MAPS} from '../src/core/maps.ts';

function probe(){
  const calls:{op:string;args:unknown[]}[]=[],colors:string[]=[];let state:Record<string,unknown>={fillStyle:'red',strokeStyle:'blue',lineWidth:3};const initial={...state},stack:typeof state[]=[];
  const ctx=new Proxy({}, {get(_t,k){if(k in state)return state[String(k)];return(...args:unknown[])=>{calls.push({op:String(k),args});for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a));if(k==='save')stack.push({...state});if(k==='restore'){assert.ok(stack.length);state=stack.pop()!;}};},set(_t,k,v){state[String(k)]=v;if(k==='fillStyle'||k==='strokeStyle')colors.push(String(v));return true;}}) as CanvasRenderingContext2D;
  return {ctx,calls,colors,check(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

for(const width of [280,320,375,430])test(`scenery ${width}: perimeter bounds, deterministic placement, camp and route clearance`,()=>{
  const height=width*1.5,scale=Math.min(1,width/375,height/400);
  for(const map of Object.values(MAPS)){
    const camps=map.camps.map(p=>({x:p.x*width/360,y:p.y*height/540}));
    const routes=map.roads.map(([a,b])=>({from:camps[map.camps.findIndex(p=>p.id===a)]!,to:camps[map.camps.findIndex(p=>p.id===b)]!}));
    const before=JSON.stringify({camps,routes}),items=planBattlefieldScenery(width,height,camps,routes);
    assert.deepEqual(items,planBattlefieldScenery(width,height,camps,routes));assert.equal(JSON.stringify({camps,routes}),before);
    assert.ok(items.length>=2,`${map.id} still has visible scenery`);
    for(const p of items){
      assert.ok(p.x>=0&&p.y>=0&&p.x+p.width<=width&&p.y+p.height<=height);
      if(p.kind==='water')assert.ok(p.x===0||Math.abs(p.x+p.width-width)<1e-8,'river bays reach an outer screen edge instead of forming isolated capsules');
      for(const camp of camps)assert.ok(Math.hypot(Math.max(p.x-camp.x,0,camp.x-p.x-p.width),Math.max(p.y-camp.y,0,camp.y-p.y-p.height))>=46*scale);
      // Independently sample every map corridor, including both endpoints. The planner
      // uses exact line/box clipping; this assertion checks the resulting open corridor.
      for(const r of routes)for(let i=0;i<=1000;i++){
        const x=r.from.x+(r.to.x-r.from.x)*i/1000,y=r.from.y+(r.to.y-r.from.y)*i/1000;
        assert.ok(x<p.x-18*scale||x>p.x+p.width+18*scale||y<p.y-18*scale||y>p.y+p.height+18*scale);
      }
    }
  }
});

test('routes reject complete scenery including water, and invalid route geometry is fail closed',()=>{
  const first=planBattlefieldScenery(375,540,[]),water=first.find(p=>p.kind==='water')!;assert.ok(water);
  const route={from:{x:0,y:water.y+water.height/2},to:{x:375,y:water.y+water.height/2}};
  assert.ok(!planBattlefieldScenery(375,540,[],[route]).some(p=>p.kind==='water'&&p.x===water.x&&p.y===water.y));
  for(const n of [NaN,Infinity])assert.deepEqual(planBattlefieldScenery(375,540,[],[{from:{x:n,y:0},to:{x:20,y:20}}]),[]);
  for(const [w,h]of [[0,400],[NaN,400],[375,Infinity],[80,100]])assert.deepEqual(planBattlefieldScenery(w!,h!,[]),[]);
});

test('three surface palettes remain stable and restore Canvas state without labels or new images',()=>{
  const palettes:string[][]=[];
  for(const id of ['A01','A02','A03']){
    const a=probe(),b=probe();drawBattlefieldScenery(a.ctx,320,480,[],id);drawBattlefieldScenery(b.ctx,320,480,[],id);a.check();b.check();
    assert.deepEqual(a.calls,b.calls);assert.deepEqual(a.colors,b.colors);assert.ok(!a.calls.some(c=>['fillText','drawImage'].includes(c.op)));palettes.push(a.colors);
  }
  assert.notDeepEqual(palettes[0],palettes[1]);assert.notDeepEqual(palettes[1],palettes[2]);
});

test('successful terrain images still receive the same scenery as the fallback, with routes respected',async()=>{
  const routes=[{from:{x:10,y:0},to:{x:10,y:540}}],fallback=probe();drawTerrain(fallback.ctx,375,540,[],'A01',routes);
  await loadArt(()=>{const image={width:1024,height:1536,onload:null,onerror:null} as unknown as ArtImage;Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;});
  const ready=probe();drawTerrain(ready.ctx,375,540,[],'A01',routes);ready.check();fallback.check();
  assert.equal(ready.calls.filter(c=>c.op==='drawImage').length,1);
  const positions=(p:ReturnType<typeof probe>)=>p.calls.filter(c=>c.op==='translate');
  assert.ok(positions(ready).length>=2);assert.deepEqual(positions(ready),positions(fallback));
  assert.ok(ready.calls.findIndex(c=>c.op==='translate')>ready.calls.findIndex(c=>c.op==='drawImage'),'scenery is above the loaded ground image');
});

 test('river bays continue off both screen edges and pine roots have no solid ellipse shadow',()=>{
  const items=planBattlefieldScenery(375,540,[]),water=items.filter(p=>p.kind==='water');
  assert.equal(water.length,2);assert.equal(water[0]!.x,0);assert.equal(water[1]!.x+water[1]!.width,375);
  const p=probe();drawBattlefieldScenery(p.ctx,375,540,[],'A01');p.check();
  assert.ok(p.calls.some(c=>c.op==='scale'&&c.args[0]===-1),'right river bay mirrors its inland shore');
  assert.ok(p.calls.filter(c=>c.op==='moveTo'&&c.args[0]===0&&c.args[1]===0).length===2,'both banks start at the screen edge');
  assert.ok(!p.calls.some(c=>c.op==='ellipse'&&c.args[0]===17&&c.args[1]===36),'pine roots are broken branches, not a solid oval');
});
