import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/core/battle.ts';
import { MAPS, neighbors } from '../src/core/maps.ts';
import { drawRoads, marchTrail, roadSegment, shotAccent, tacticalAccent, tacticalDuration } from '../src/render/tactical-art.ts';

type Call={op:string;args:unknown[];style:Record<string,unknown>};
function drawing(){
  const calls:Call[]=[],initial={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:7,lineCap:'butt',lineJoin:'miter',globalAlpha:.8};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),'all canvas coordinates remain finite');
      calls.push({op:String(key),args,style:{...state}});
      if(key==='save')stack.push({...state});
      if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
    };},
    set(_target,key,value){state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

test('roads expose only the selected real exits, stay under cities and leave legacy games unchanged',()=>{
  for(const id of Object.keys(MAPS) as (keyof typeof MAPS)[])for(const scale of [.6,.997,1.15]){
    const b=createBattle(id,{id:'roads',firstDragCompleted:true}),before=JSON.stringify(b),source=b.camps.find(c=>c.owner==='P')!;
    const d=drawing();drawRoads(d.ctx,b,p=>({x:p.x*scale,y:p.y*scale}),source.id,scale);d.balanced();
    assert.equal(d.calls.filter(c=>c.op==='stroke'&&c.style.lineWidth===3&&c.style.strokeStyle==='#6D6654').length,neighbors(b,source.id).length);
    assert.equal(d.calls.filter(c=>c.op==='fill'&&['#67543848','#71807845','#7B654343'].includes(String(c.style.fillStyle))).length,MAPS[id].roads.length,'one irregular soil envelope for each real route');
    for(const [a,z]of MAPS[id].roads){
      const from=b.camps.find(c=>c.id===a)!,to=b.camps.find(c=>c.id===z)!;
      const segment=roadSegment(from,to,28)!;
      assert.ok(Math.abs(Math.hypot(segment.from.x-from.x,segment.from.y-from.y)-28)<1e-8);
      assert.ok(Math.abs(Math.hypot(segment.to.x-to.x,segment.to.y-to.y)-28)<1e-8);
    }
    assert.equal(JSON.stringify(b),before,'rendering cannot mutate roads, ownership, armies or game clock');
    const legacy=drawing();drawRoads(legacy.ctx,{...b,ruleRevision:'1.5'},p=>p,source.id);assert.equal(legacy.calls.length,0);
  }
  assert.equal(roadSegment({x:0,y:0},{x:0,y:0},28),null);
  assert.equal(roadSegment({x:0,y:0},{x:40,y:0},28),null);
});

for(const kind of ['dispatch','arrival','capture'] as const)for(const reduced of [false,true])for(const crowded of [false,true])test(`${kind} feedback survives 300 ms, expires and preserves drawing state; reduced=${reduced}, crowded=${crowded}`,()=>{
  const d=drawing();tacticalAccent(d.ctx,kind,{x:120,y:220},{x:50,y:330},'P',300,reduced,crowded);d.balanced();
  assert.ok(d.calls.some(c=>c.op==='stroke'),'the meaningful marker remains visible beyond the old 160 ms window');
  assert.equal(d.calls.filter(c=>c.op==='fillText').length,0,'decorative feedback invents no damage or troop numbers');
  if(reduced||crowded)assert.ok(!d.calls.some(c=>c.op==='arc'&&c.args[2]===4),'dust is not required for meaning');
  const expired=drawing();tacticalAccent(expired.ctx,kind,{x:120,y:220},null,'P',tacticalDuration(kind),reduced,crowded);assert.equal(expired.calls.length,0);
  const early=drawing();tacticalAccent(early.ctx,kind,{x:120,y:220},null,'P',-1,reduced,crowded);assert.equal(early.calls.length,0);
});

test('reduced motion fixes phase while normal feedback moves with the game clock',()=>{
  const draw=(age:number,reduced:boolean)=>{const d=drawing();tacticalAccent(d.ctx,'arrival',{x:120,y:220},{x:50,y:330},'P',age,reduced,false);return d.calls;};
  assert.deepEqual(draw(80,true),draw(300,true));assert.notDeepEqual(draw(80,false),draw(300,false));
});

test('marching keeps a direction chevron in reduced and crowded modes while removing dust',()=>{
  for(const reduced of [false,true])for(const crowded of [false,true]){
    const d=drawing();marchTrail(d.ctx,{x:180,y:300},1.7,'E2',1300,reduced,crowded);d.balanced();
    assert.equal(d.calls.filter(c=>c.op==='stroke').length,2);
    assert.equal(d.calls.filter(c=>c.op==='ellipse').length,reduced||crowded?0:3);
  }
});

test('projectiles remain short, legible and bounded on both axes, with static reduced-motion direction',()=>{
  for(const volley of [false,true])for(const reduced of [false,true])for(const crowded of [false,true])for(const to of [{x:30,y:260},{x:230,y:40},{x:30,y:40}]){
    const draw=(age:number)=>{const d=drawing();shotAccent(d.ctx,{x:30,y:40},to,'P',age,volley,reduced,crowded);d.balanced();return d.calls;};
    const calls=draw(160),shaftCount=volley&&!crowded?3:1;
    assert.equal(calls.filter(c=>c.op==='stroke').length,shaftCount*2);
    assert.deepEqual(draw(300),[]);
    if(reduced)assert.deepEqual(draw(80),draw(160));
    for(let i=0;i<calls.length;i++)if(calls[i]!.op==='lineTo'&&calls[i-1]?.op==='moveTo'){
      const a=calls[i-1]!.args as number[],z=calls[i]!.args as number[];
      assert.ok(Math.hypot(z[0]!-a[0]!,z[1]!-a[1]!)<=24+1e-8,'arrows cannot become full-route beams');
    }
  }
});
