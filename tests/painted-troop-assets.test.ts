import test from 'node:test';
import assert from 'node:assert/strict';
import { soldier, factionColor } from '../src/render/art.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';
import { TROOP_MOTION_CROPS } from '../src/render/troop-motion-regions.ts';
import { SAMPLE_SPRITE_CROPS } from '../src/render/sample-sprite-regions.ts';
import type { TroopType } from '../src/core/types.ts';

type Call={op:string;args:unknown[]};
const kinds=['infantry','archer','cavalry','guard'] as const;
const imageWidth=2048,imageHeight=1536;
function draw(type:TroopType,step=0,bowLift=0,faction:'P'|'E2'='P',scale=.7,facing=1,failImage=false,x=80,y=90){
  const calls:Call[]=[],colors:unknown[]=[],initial={globalAlpha:.6,fillStyle:'#123',strokeStyle:'#456',lineWidth:4,lineCap:'butt',lineJoin:'miter'};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{calls.push({op:String(key),args});if(key==='save')stack.push({...state});if(key==='restore')state=stack.pop()!;if(key==='drawImage'&&failImage)throw Error('GPU image unavailable');};},
    set(_target,key,value){state[String(key)]=value;if(key==='fillStyle')colors.push(value);return true;},
  }) as CanvasRenderingContext2D;
  soldier(ctx,x,y,type,faction,scale,step,bowLift,facing);
  assert.equal(stack.length,0);assert.deepEqual(state,initial);
  return {calls,colors};
}
async function loaded(){
  await loadArt(()=>{
    const image={width:imageWidth,height:imageHeight,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
}

test('painted troops use independent crops and retain runtime faction sashes and world anchors',async()=>{
  await loaded();const crops=new Set<string>();
  for(const type of kinds){
    const d=draw(type),images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,1);
    const crop=type==='infantry'?SAMPLE_SPRITE_CROPS['sample-infantry-0']:TROOP_MOTION_CROPS[`motion-${type}-0`];
    assert.ok(crop.every(Number.isFinite));assert.ok(crop[0]>=0&&crop[1]>=0&&crop[2]>0&&crop[3]>0&&crop[0]+crop[2]<=1&&crop[1]+crop[3]<=1);
    assert.deepEqual(images[0]!.args.slice(1,5),[crop[0]*imageWidth,crop[1]*imageHeight,crop[2]*imageWidth,crop[3]*imageHeight]);
    crops.add(JSON.stringify(images[0]!.args.slice(1,5)));
    assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[80,90]);
    assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[.7,.7]);
    const enemy=draw(type,0,0,'E2');assert.deepEqual(enemy.calls,d.calls,'ownership does not change world geometry or crop');
    assert.ok(d.colors.includes(factionColor('P')));assert.ok(enemy.colors.includes(factionColor('E2')));
    assert.ok(!d.calls.some(c=>c.op==='fillText'||c.op==='strokeText'),'soldiers never supply army counts');
    assert.deepEqual(draw(type,-1),draw(type,1),'all framed troops keep the torso stable instead of leaning the entire image');
    for(const step of [NaN,Infinity,-Infinity])assert.deepEqual(draw(type,step),d,'invalid phase renders stationary');
    assert.deepEqual(draw(type,-100),draw(type,-1));assert.deepEqual(draw(type,100),draw(type,1));
  }
  assert.equal(crops.size,4);
});

test('all framed troops stay level with equal facing bounds and fixed bottom anchors',async()=>{
  await loaded();
  for(const type of kinds)for(const scale of [.35,.7,1.2])for(const step of [-1,0,1]){
    const right=draw(type,step,0,'P',scale,1),left=draw(type,step,0,'P',scale,-1);
    assert.deepEqual(left.calls.filter(c=>c.op!=='scale'),right.calls.filter(c=>c.op!=='scale'),'mirroring preserves the same crop and local animation');
    assert.deepEqual(left.calls.filter(c=>c.op==='translate').map(c=>c.args),[[80,90]],'walking does not move the real army anchor');
    assert.deepEqual(left.calls.find(c=>c.op==='scale')?.args,[-scale,scale]);
    assert.deepEqual(right.calls.find(c=>c.op==='scale')?.args,[scale,scale]);
    const rotation=Number(right.calls.find(c=>c.op==='rotate')?.args[0]??0);assert.ok(Math.abs(rotation)<=.04);
    assert.equal(right.calls.filter(c=>c.op==='rotate').length,0);
    const sprite=right.calls.find(c=>c.op==='drawImage')!,[x,y,w,h]=sprite.args.slice(5) as number[];
    assert.ok(Math.abs(x!+w!/2)<1e-10,'sprite remains centered on the anchor');
    assert.ok(y!>=-30-1e-10&&Math.abs(y!+h!-9)<1e-10,'all six poses retain the same bottom');
    assert.ok(w!<=(type==='cavalry'?38:30)+1e-10&&h!<=(type==='cavalry'?39:36)+1e-10);
    const points=[[x!,y!],[x!+w!,y!],[x!,y!+h!],[x!+w!,y!+h!]];
    for(const c of right.calls.filter(c=>c.op==='moveTo'||c.op==='lineTo'))points.push(c.args as number[]);
    for(const side of [-1,1])for(const [px,py] of points){
      const worldX=80+side*scale*(px!*Math.cos(rotation)-py!*Math.sin(rotation)),worldY=90+scale*(px!*Math.sin(rotation)+py!*Math.cos(rotation));
      assert.ok(Math.abs(worldX-80)<=21*scale&&worldY>=90-36*scale&&worldY<=90+11*scale,'both mirrored silhouettes stay inside one anchored envelope');
    }
  }
  for(const facing of [0,NaN,Infinity,-Infinity])assert.deepEqual(draw('infantry',0,0,'P',.7,facing),draw('infantry'));
});

test('painted archers add only a bow highlight and other troops ignore bow lift',async()=>{
  await loaded();
  for(const step of [-1,0,1])for(const facing of [-1,1]){
    const base=draw('archer',step,0,'P',.7,facing);assert.equal(base.calls.filter(c=>c.op==='arc').length,0);
    for(const lift of [1,2]){
      const d=draw('archer',step,lift,'P',.7,facing),arcIndex=d.calls.findIndex(c=>c.op==='arc');
      assert.ok(arcIndex>0);assert.deepEqual(d.calls[arcIndex]!.args,[7,-6-lift,9,-Math.PI/2,Math.PI/2]);
      assert.equal(d.calls[arcIndex-1]!.op,'beginPath');assert.equal(d.calls[arcIndex+1]!.op,'stroke');
      assert.deepEqual(d.calls.filter((_c,i)=>i<arcIndex-1||i>arcIndex+1),base.calls,'lift leaves sprite crop, bob, sash and actual anchor unchanged');assert.deepEqual(d.colors,base.colors);
    }
    for(const lift of [-20,NaN,Infinity,-Infinity])assert.deepEqual(draw('archer',step,lift,'P',.7,facing),base);
    assert.deepEqual(draw('archer',step,20,'P',.7,facing),draw('archer',step,2,'P',.7,facing));
  }
  for(const type of ['infantry','cavalry','guard'] as const)for(const lift of [-20,0,2,20,NaN,Infinity])assert.deepEqual(draw(type,1,lift),draw(type,1));
});

test('failed troop images immediately render Canvas fallback with current faction and mirrored anchor',async()=>{
  const shapes=new Set<string>();
  for(const type of kinds)for(const facing of [-1,1]){
    await loaded();const failed=draw(type,1,1,'E2',.7,facing,true),fallback=draw(type,1,1,'E2',.7,facing);
    assert.equal(failed.calls.filter(c=>c.op==='drawImage').length,2);
    assert.deepEqual(failed.calls.filter(c=>c.op!=='drawImage'),fallback.calls);
    assert.deepEqual(failed.colors,fallback.colors);assert.ok(fallback.colors.includes(factionColor('E2')));
    assert.deepEqual(fallback.calls.find(c=>c.op==='translate')?.args,[80,90]);assert.deepEqual(fallback.calls.find(c=>c.op==='scale')?.args,[.7*facing,.7]);
    assert.ok(fallback.calls.some(c=>c.op==='lineTo'),'missing images still render a visible troop');
    if(facing===1)shapes.add(JSON.stringify(fallback.calls));
  }
  assert.equal(shapes.size,4);
  for(const step of [-1,1]){
    const d=draw('archer',step,2),arc=d.calls.find(c=>c.op==='arc'&&c.args[0]===7&&c.args[2]===9);
    assert.deepEqual(arc?.args,[7,-8,9,-Math.PI/2,Math.PI/2],'fallback retains the movable bow');
  }
});

test('invalid troop coordinates or scales never touch canvas state',()=>{
  for(const scale of [0,-1,NaN,Infinity])assert.equal(draw('infantry',0,0,'P',scale).calls.length,0);
  for(const [x,y]of [[NaN,90],[80,Infinity],[-Infinity,90]])assert.equal(draw('infantry',0,0,'P',.7,1,false,x!,y!).calls.length,0);
});
