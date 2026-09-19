import test from 'node:test';
import assert from 'node:assert/strict';
import { building, flag } from '../src/render/art.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';
import { BATTLE_SPRITE_CROPS } from '../src/render/battle-sprite-regions.ts';
import { SAMPLE_SPRITE_CROPS } from '../src/render/sample-sprite-regions.ts';

type Call={op:string;args:unknown[]};
const kinds=['barracks','archery','relay','fort'] as const,tiers=[1,2,3] as const;
const imageWidth=2048,imageHeight=1536;
function canvas(failImage=false){
  const calls:Call[]=[],initial={globalAlpha:.6,fillStyle:'#123',strokeStyle:'#456',lineWidth:4,lineCap:'butt',lineJoin:'miter'};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{calls.push({op:String(key),args});if(key==='save')stack.push({...state});if(key==='restore')state=stack.pop()!;if(key==='drawImage'&&failImage)throw Error('GPU image unavailable');};},
    set(_target,key,value){state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
async function loaded(){
  await loadArt(()=>{
    const image={width:imageWidth,height:imageHeight,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
}

test('twelve painted camps use independent crops inside the original label clearance and retain geometry across factions',async()=>{
  await loaded();const crops=new Set<string>();
  for(const type of kinds)for(const tier of tiers){
    const source=type==='barracks'?SAMPLE_SPRITE_CROPS[`sample-barracks-${tier}`]:BATTLE_SPRITE_CROPS[`camp-${type}-${tier}`];
    assert.ok(source.every(Number.isFinite));
    assert.ok(source[0]>=0&&source[1]>=0&&source[2]>0&&source[3]>0&&source[0]+source[2]<=1&&source[1]+source[3]<=1);
    for(const size of [14,28,42]){
      const d=canvas();building(d.ctx,80,90,size,type,tier,'P');d.balanced();
      const images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,type==='barracks'||tier===1?1:2);
      const image=images.at(-1)!;
      assert.deepEqual(image.args.slice(1,5),[source[0]*imageWidth,source[1]*imageHeight,source[2]*imageWidth,source[3]*imageHeight]);
      crops.add(JSON.stringify(image.args.slice(1,5)));
      const [localX,localY,localW,localH]=image.args.slice(5) as number[],k=size/28;
      assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[80,90]);
      assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[k,k]);
      const x=80+localX!*k,y=90+localY!*k,w=localW!*k,h=localH!*k;
      const halfWidth=type==='barracks'?33:31;
      assert.ok(x!>=80-halfWidth*k-1e-10&&x!+w!<=80+halfWidth*k+1e-10,'architecture stays inside horizontal clearance');
      assert.ok(y!>=90-34*k-1e-10&&y!+h!<=90+22*k+1e-10,'architecture stays above the troop label');
      assert.ok(Math.abs(y!+h!-(90+22*k))<1e-10,'sprite bottom remains anchored to the camp');
      if(type==='barracks')assert.ok(Math.abs(w!-[40,54,66][tier-1]!*k)<1e-10,'the painted court grows with the level');
      assert.ok(!d.calls.some(c=>c.op==='fillText'||c.op==='strokeText'),'buildings never paint troop counts');
      const enemy=canvas();building(enemy.ctx,80,90,size,type,tier,'E2');enemy.balanced();
      assert.deepEqual(enemy.calls,d.calls,'ownership colours never change the painting crop or architecture geometry');
    }
  }
  assert.equal(crops.size,12);
  const playerFlag=canvas(),enemyFlag=canvas();flag(playerFlag.ctx,100,66,5,'P');flag(enemyFlag.ctx,100,66,5,'E2');
  playerFlag.balanced();enemyFlag.balanced();assert.notDeepEqual(playerFlag.calls,enemyFlag.calls);
});

test('painted towers keep the actual aim endpoint and restore state at every level and scale',async()=>{
  await loaded();
  for(const tier of tiers)for(const size of [14,28,42])for(const aim of [0,Math.PI/2,Math.PI,-Math.PI/2,.37]){
    const d=canvas();building(d.ctx,80,90,size,'fort',tier,'P',aim);d.balanced();
    assert.equal(d.calls.filter(c=>c.op==='drawImage').length,tier===1?1:2);
    assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[80,90]);
    assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[size/28,size/28]);
    const shaft=d.calls.find((c,i)=>c.op==='lineTo'&&d.calls[i-1]?.op==='moveTo'&&d.calls[i-1]!.args.every(v=>v===0));
    assert.ok(shaft);assert.ok(Math.abs(Number(shaft.args[0])-Math.cos(aim)*Math.hypot(24,5))<1e-10);assert.ok(Math.abs(Number(shaft.args[1])-Math.sin(aim)*Math.hypot(24,5))<1e-10);
  }
  for(const aim of [NaN,Infinity,-Infinity]){
    const d=canvas(),base=canvas();building(d.ctx,80,90,28,'fort',1,'P',aim);building(base.ctx,80,90,28,'fort',1,'P');d.balanced();assert.deepEqual(d.calls,base.calls);
  }
});

test('a failed camp draw falls back immediately to twelve distinct Canvas buildings without touching labels or state',async()=>{
  const silhouettes=new Set<string>();
  for(const type of kinds)for(const tier of tiers){
    await loaded();const d=canvas(true);building(d.ctx,80,90,28,type,tier,'P');d.balanced();
    assert.equal(d.calls.filter(c=>c.op==='drawImage').length,type==='barracks'||tier>1?2:1);
    const fallback=canvas();building(fallback.ctx,80,90,28,type,tier,'P');fallback.balanced();
    assert.deepEqual(d.calls.slice(d.calls.findLastIndex(c=>c.op==='translate')),fallback.calls.slice(fallback.calls.findLastIndex(c=>c.op==='translate')),'the same frame renders the complete Canvas core after the failed sprite restores its clip');
    assert.ok(!fallback.calls.some(c=>c.op==='fillText'||c.op==='strokeText'));
    const geometry=fallback.calls.filter(c=>['moveTo','lineTo','fillRect','ellipse'].includes(c.op));
    silhouettes.add(JSON.stringify(geometry));assert.ok(geometry.length>0);
    for(const c of geometry){
      const [x,y,w,h]=c.args as number[];
      const points=c.op==='ellipse'?[[x!-w!,y!-h!],[x!+w!,y!+h!]]:c.op==='fillRect'?[[x!,y!],[x!+w!,y!+h!]]:[[x!,y!]];
      for(const [px,py]of points){assert.ok(px!>=-33&&px!<=33);assert.ok(py!>=-34&&py!<=26);}
    }
  }
  assert.equal(silhouettes.size,12);
});

test('invalid camp positions and sizes draw nothing while out-of-range levels resolve to supported artwork',async()=>{
  await loaded();
  for(const [x,y,size]of [[NaN,0,28],[0,Infinity,28],[0,0,0],[0,0,-1],[0,0,NaN],[0,0,Infinity]]){
    const d=canvas();building(d.ctx,x!,y!,size!,'fort',1,'P');assert.equal(d.calls.length,0);d.balanced();
  }
  for(const [level,expected]of [[-1,1],[0,1],[1.9,1],[4,3],[NaN,1],[Infinity,1]]){
    const d=canvas(),base=canvas();building(d.ctx,80,90,28,'barracks',level!,'P');building(base.ctx,80,90,28,'barracks',expected!,'P');d.balanced();assert.deepEqual(d.calls,base.calls);
  }
});
