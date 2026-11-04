import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ART_SOURCES, loadArt, type ArtImage } from '../src/render/assets.ts';
import { building, soldier } from '../src/render/art.ts';
import { infantryWalkFrame, infantryDistanceFrame, SAMPLE_SPRITE_CROPS } from '../src/render/sample-sprite-regions.ts';

type Call={op:string;args:unknown[]};
async function loaded(){
  await loadArt(()=>{
    let source='';const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{get(){return source;},set(value:string){source=value;queueMicrotask(()=>image.onload?.(new Event('load')));}});
    return image;
  });
}
function drawing(fail:'sample'|'all'|null=null){
  const calls:Call[]=[],initial={globalAlpha:.4,fillStyle:'pink',strokeStyle:'cyan',lineWidth:3};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_t,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      calls.push({op:String(key),args});
      if(key==='save')stack.push({...state});
      if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
      if(key==='drawImage'&&(fail==='all'||fail==='sample'&&(args[0] as ArtImage).src===ART_SOURCES.sample))throw Error('test image failure');
    };},set(_t,key,value){state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

test('infantry uses six timed foot poses, wraps at 720 ms and freezes in reduced or stationary mode',()=>{
  assert.deepEqual([0,119,120,239,240,359,360,479,480,599,600,719,720].map(t=>infantryWalkFrame(t)),[0,0,1,1,2,2,3,3,4,4,5,5,0]);
  assert.deepEqual([0,1,2,3,4].map(slot=>infantryWalkFrame(0,slot)),[0,2,4,0,2]);
  for(const time of [0,120,719,720,5000])for(const slot of [0,1,2,3])assert.equal(infantryWalkFrame(time,slot,false),0);
  for(const time of [-1,NaN,Infinity,-Infinity])assert.equal(infantryWalkFrame(time),0);
  for(const slot of [NaN,Infinity,-Infinity,Number.MAX_VALUE])assert.ok(Number.isInteger(infantryWalkFrame(0,slot)));
});

test('distance gait follows actual travel, keeping the base cadence while accelerated movement advances feet sooner',()=>{
  const times=[0,119,120,239,240,359,360,479,480,599,600,719,720,1440];
  for(const t of times)for(const slot of [0,1,2,3,4]){
    assert.equal(infantryDistanceFrame(t/1000*24,slot),infantryWalkFrame(t,slot));
  }
  assert.equal(infantryDistanceFrame(.1*24),0);
  assert.equal(infantryDistanceFrame(.1*48),1,'double-speed displacement advances the pose before 120 ms');
  assert.equal(infantryDistanceFrame(.18*24),1);
  assert.equal(infantryDistanceFrame(.18*48),3);
  assert.equal(infantryDistanceFrame(.36*48),0,'a double-speed stride completes after 360 ms');
  assert.equal(infantryDistanceFrame(2.88-0.000001),0,'the next pose does not anticipate movement');
  for(const distance of [0,2.88,7.2,17.28,69.12]){
    assert.deepEqual([0,1,2].map(slot=>infantryDistanceFrame(distance,slot)),[0,1,2].map(slot=>(infantryDistanceFrame(distance)+slot*2)%6));
  }
});

test('distance gait remains still for invalid or reduced movement, and optional phase never changes world motion',()=>{
  for(const distance of [-1,NaN,Infinity,-Infinity])assert.equal(infantryDistanceFrame(distance,2),0);
  for(const distance of [0,2.88,17.28,5000])for(const phase of [-1,.5,1,NaN]){
    assert.equal(infantryDistanceFrame(distance,2,false,phase),0);
  }
  for(const phase of [.5,1.5,-.5])assert.equal(infantryDistanceFrame(0,0,true,phase),3);
  for(const phase of [NaN,Infinity,-Infinity])assert.equal(infantryDistanceFrame(2.88,0,true,phase),1);
  for(const slot of [-1,.5,NaN,Infinity,Number.MAX_VALUE])assert.equal(infantryDistanceFrame(2.88,slot),1);
});

test('six infantry images change source poses while keeping scale, feet and world position unchanged',async()=>{
  await loaded();const sources=new Set<string>(),destinations=new Set<string>();
  for(const frame of [0,1,2,3,4,5])for(const scale of [.7,1])for(const facing of [-1,1]){
    const d=drawing();soldier(d.ctx,90,120,'infantry','P',scale,.8,0,facing,frame);d.balanced();
    const images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,1);const image=images[0]!;
    assert.equal((image.args[0] as ArtImage).src,ART_SOURCES.sample);sources.add(JSON.stringify(image.args.slice(1,5)));destinations.add(JSON.stringify(image.args.slice(5)));
    assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[90,120]);assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[scale*facing,scale]);
    assert.ok(!d.calls.some(c=>c.op==='rotate'),'pose animation does not rock the entire picture');
    const [x,y,w,h]=image.args.slice(5) as number[];assert.ok(Math.abs(x!+w!/2)<1e-10);assert.ok(Math.abs(y!+h!-9)<1e-10);
    assert.ok(w!<=24+1e-10&&h!<=36+1e-10);assert.ok(!d.calls.some(c=>c.op==='fillText'));
  }
  assert.equal(sources.size,6);assert.equal(destinations.size,1);
  const stationary=drawing();soldier(stationary.ctx,90,120,'infantry','P',1,0,0,1,0);
  for(const frame of [NaN,Infinity,-1]){
    const d=drawing();soldier(d.ctx,90,120,'infantry','P',1,0,0,1,frame);d.balanced();assert.deepEqual(d.calls,stationary.calls);
  }
});

test('three sample camp silhouettes use progressively wider footprints and the same bottom anchor',async()=>{
  await loaded();const crops=new Set<string>(),widths:number[]=[];
  for(const tier of [1,2,3] as const){
    const d=drawing();building(d.ctx,90,120,28,'barracks',tier,'P');d.balanced();
    const image=d.calls.find(c=>c.op==='drawImage')!;assert.equal((image.args[0] as ArtImage).src,ART_SOURCES.battlefield);
    crops.add(JSON.stringify(image.args.slice(1,5)));const [x,y,w,h]=image.args.slice(5) as number[];widths.push(w!);
    assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[90,120]);
    assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[1,1]);
    assert.ok(Math.abs(x!+w!/2)<1e-10);assert.ok(Math.abs(y!+h!-22)<1e-10);assert.ok(h!<=56);
  }
  assert.ok(widths[0]!<widths[1]!&&widths[1]!<widths[2]!&&widths[2]!<=66);assert.equal(crops.size,3);
});

test('missing infantry motion falls back to the new static sprite, while a missing city atlas uses complete Canvas architecture',async()=>{
  for(const kind of ['camp','troop'] as const)for(const fail of ['sample','all'] as const){
    await loaded();const d=drawing(fail);
    if(kind==='camp')building(d.ctx,90,120,28,'barracks',3,'P');else soldier(d.ctx,90,120,'infantry','P',1,.8,0,-1,5);
    d.balanced();const images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,kind==='camp'?1:2);
    assert.deepEqual(images.map(c=>(c.args[0] as ArtImage).src),kind==='camp'?[ART_SOURCES.battlefield]:[ART_SOURCES.sample,ART_SOURCES.battlefield]);
    if(fail==='all')assert.ok(d.calls.some(c=>c.op==='fillRect'),'unavailable atlases still produce a complete visible fallback');
    else assert.ok(!d.calls.some(c=>c.op==='ellipse'),'one motion failure retains the painted identity');
    assert.ok(!d.calls.some(c=>c.op==='fillText'),'fallback never invents troop counts');
  }
});

test('shipped sample is a compact RGBA PNG with nine valid windows and equal walking frame dimensions',async()=>{
  const bytes=await readFile(new URL(`../${ART_SOURCES.sample}`,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.toString('ascii',12,16),'IHDR');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);assert.equal(width/height,1.5);assert.ok(width>=768);
  assert.equal(bytes[24],8);assert.equal(bytes[25],6,'alpha-capable RGBA is required');assert.ok(bytes.length<512*1024);
  const entries=Object.entries(SAMPLE_SPRITE_CROPS);assert.equal(entries.length,9);assert.equal(new Set(entries.map(([,r])=>JSON.stringify(r))).size,9);
  const frameSizes=new Set<string>();
  for(const [id,[x,y,w,h]] of entries){assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1,id);if(id.startsWith('sample-infantry'))frameSizes.add(JSON.stringify([w,h]));}
  assert.equal(frameSizes.size,1);
});
