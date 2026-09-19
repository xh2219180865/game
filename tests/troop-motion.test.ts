import test from 'node:test';
import assert from 'node:assert/strict';
import { ART_SOURCES, loadArt, type ArtImage } from '../src/render/assets.ts';
import { soldier } from '../src/render/art.ts';
import { TROOP_MOTION_CROPS } from '../src/render/troop-motion-regions.ts';

async function loaded(){
  await loadArt(()=>{
    const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;let path='';
    Object.defineProperty(image,'src',{get(){return path;},set(value:string){path=value;queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
}

test('all three motion strips have six isolated finite UVs and keep a fixed canvas anchor',async()=>{
  await loaded();assert.equal(Object.keys(TROOP_MOTION_CROPS).length,18);
  for(const type of ['archer','cavalry','guard'] as const){
    const crops=new Set<string>(),destinations=new Set<string>();
    for(let frame=0;frame<6;frame++)for(const facing of [-1,1]){
      const calls:{op:string;args:unknown[]}[]=[];let depth=0;
      const ctx=new Proxy({},{get(_t,key){return (...args:unknown[])=>{calls.push({op:String(key),args});if(key==='save')depth++;if(key==='restore')assert.ok(--depth>=0);};}}) as CanvasRenderingContext2D;
      soldier(ctx,120,180,type,'P',.7,.8,0,facing,frame);assert.equal(depth,0);
      const images=calls.filter(c=>c.op==='drawImage');assert.equal(images.length,1);const args=images[0]!.args;
      assert.equal((args[0] as ArtImage).src,type==='cavalry'?ART_SOURCES.cavalry:ART_SOURCES.motion);
      const [x,y,w,h]=args.slice(1,5) as number[];
      assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(x!>=0&&y!>=0&&x!+w!<=1536+1e-10&&y!+h!<=1024+1e-10);
      crops.add(JSON.stringify(args.slice(1,5)));destinations.add(JSON.stringify(args.slice(5)));
      assert.deepEqual(calls.find(c=>c.op==='translate')?.args,[120,180]);assert.deepEqual(calls.find(c=>c.op==='scale')?.args,[.7*facing,.7]);
      assert.ok(!calls.some(c=>c.op==='rotate'||c.op==='fillText'));
    }
    assert.equal(crops.size,6);assert.equal(destinations.size,1,'no per-frame zoom or ground jitter');
  }
});

test('an unavailable motion atlas falls back to the existing painted troop instead of disappearing',async()=>{
  for(const type of ['archer','cavalry','guard'] as const){
    await loaded();const paths:string[]=[];let depth=0;
    const ctx=new Proxy({},{get(_t,key){return (...args:unknown[])=>{
      if(key==='save')depth++;if(key==='restore')depth--;
      if(key==='drawImage'){const path=(args[0] as ArtImage).src;paths.push(path);if(path!==ART_SOURCES.battlefield)throw Error('missing motion atlas');}
    };}}) as CanvasRenderingContext2D;
    soldier(ctx,120,180,type,'E1',1,.4,1,-1,4);
    assert.equal(depth,0);assert.deepEqual(paths,[type==='cavalry'?ART_SOURCES.cavalry:ART_SOURCES.motion,ART_SOURCES.battlefield]);
  }
});
