import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStrategyIllustration } from '../src/render/strategy-illustration.ts';
import { building, soldier } from '../src/render/art.ts';
import { loadArt, ART_SOURCES, type ArtImage } from '../src/render/assets.ts';
import type { CardId } from '../src/core/types.ts';

type Call={op:string;args:unknown[]};
function canvas(failImage=false){
  const initial={globalAlpha:.6,fillStyle:'#123',strokeStyle:'#456',lineWidth:4};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];const calls:Call[]=[],styles:{key:string;value:unknown}[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return(...args:unknown[])=>{
      calls.push({op:String(key),args});
      if(key==='save')stack.push({...state});if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
      if(key==='drawImage'&&failImage)throw Error('image lost');
    };},set(_target,key,value){state[String(key)]=value;styles.push({key:String(key),value});return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,styles,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
async function loaded(){
  await loadArt(()=>{
    const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(value:string){Object.defineProperty(image,'src',{value,configurable:true});queueMicrotask(()=>image.onload?.(new Event('load')));},configurable:true});return image;
  });
}
const ids=['mobilize','march','supply','feint','farming','logistics','fortification'] as const;
const crops=(d:ReturnType<typeof canvas>)=>d.calls.filter(c=>c.op==='drawImage').map(c=>[(c.args[0] as ArtImage).src,...c.args.slice(1,5)]);

test('all seven cards draw the same camp or troop crops as the battlefield, never the old card characters',async()=>{
  await loaded();
  for(const id of ids){
    const d=canvas(),reference=canvas();drawStrategyIllustration(d.ctx,10,20,70,34,id);d.balanced();
    if(id==='mobilize')soldier(reference.ctx,0,0,'infantry','P');
    else if(id==='march')soldier(reference.ctx,0,0,'infantry','P',1,0,0,1,2);
    else if(id==='supply'){soldier(reference.ctx,0,0,'infantry','P');soldier(reference.ctx,0,0,'infantry','P');soldier(reference.ctx,0,0,'infantry','P');}
    else if(id==='logistics')soldier(reference.ctx,0,0,'cavalry','P',1,0,0,1,2);
    else if(id!=='farming')building(reference.ctx,0,0,28,'barracks',id==='fortification'?3:1,id==='feint'?'E1':'P');
    assert.deepEqual(crops(d),crops(reference),id);
    assert.ok(crops(d).every(c=>c[0]!==ART_SOURCES.cards));
    assert.ok(!d.calls.some(c=>c.op==='fillText'),'the caller retains inventory and labels');
  }
});

test('small and album illustrations are clipped, static and restore caller Canvas state',async()=>{
  await loaded();
  for(const [w,h]of [[66,34],[93,34],[44,44],[60,60],[72,64],[112,112],[150,210]])for(const id of ids){
    const a=canvas(),b=canvas();drawStrategyIllustration(a.ctx,9,17,w!,h!,id);drawStrategyIllustration(b.ctx,9,17,w!,h!,id);a.balanced();b.balanced();
    assert.deepEqual(a.calls,b.calls,'no time, random pose or mutable presentation state');
    assert.deepEqual(a.calls.find(c=>c.op==='rect')?.args,[9,17,w,h]);
    assert.ok(a.calls.some(c=>c.op==='clip'));
    assert.equal(crops(a).length,id==='farming'?0:id==='supply'?3:1,'all sizes keep only the intended close subject, without extra background camps');
    for(const c of a.calls)for(const arg of c.args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));
  }
});

test('lost camp and troop textures keep seven distinct Canvas vignettes with no external artwork dependency',async()=>{
  const shapes=new Set<string>();
  for(const id of ids){
    await loaded();const fail=canvas(true);drawStrategyIllustration(fail.ctx,0,0,70,34,id);fail.balanced();
    if(id==='farming')assert.equal(crops(fail).length,0,'grain props use Canvas without an image');
    else assert.ok(crops(fail).length>0);
    const fallback=canvas();drawStrategyIllustration(fallback.ctx,0,0,70,34,id);fallback.balanced();
    assert.equal(crops(fallback).length,0);assert.ok(fallback.calls.some(c=>c.op==='fill'));
    shapes.add(JSON.stringify(fallback.calls));
  }
  assert.equal(shapes.size,7);
});

test('square emblems center their subject while field orders leave room for inventory',async()=>{
  await loaded();
  for(const [w,h]of [[44,44],[60,60],[66,34],[93,34]]){
    const d=canvas();drawStrategyIllustration(d.ctx,9,17,w!,h!,'march');d.balanced();
    const field=h!<=48&&w!/h!>1.4;
    assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[9+w!*(field?.36:.5),17+h!*.5]);
    const firstImage=d.calls.findIndex(c=>c.op==='drawImage');
    assert.ok(firstImage>0);
    assert.ok(!d.calls.slice(0,firstImage).some(c=>c.op==='fillRect'),'the vignette does not repaint a rectangular landscape over the caller’s material');
  }
});

test('invalid rectangles and card ids draw nothing',()=>{
  for(const box of [[NaN,0,70,34],[0,Infinity,70,34],[0,0,0,34],[0,0,70,-1],[0,0,Infinity,34],[Number.MAX_VALUE,0,Number.MAX_VALUE,34],[0,Number.MAX_VALUE,70,Number.MAX_VALUE]]){
    const d=canvas();drawStrategyIllustration(d.ctx,box[0]!,box[1]!,box[2]!,box[3]!,'supply');assert.equal(d.calls.length,0);d.balanced();
  }
  const d=canvas();drawStrategyIllustration(d.ctx,0,0,70,34,'unknown' as CardId);assert.equal(d.calls.length,0);d.balanced();
});

test('locked strategies use distinct grey material drawings without image or pixel dependencies',async()=>{
  await loaded();
  for(const [w,h]of [[66,34],[44,44],[60,60],[150,210]]){
    const shapes=new Set<string>();
    for(const id of ids){
      const a=canvas(true),b=canvas(true);
      drawStrategyIllustration(a.ctx,9,17,w!,h!,id,true);drawStrategyIllustration(b.ctx,9,17,w!,h!,id,true);a.balanced();b.balanced();
      assert.deepEqual(a.calls,b.calls,'locked subjects are static');
      assert.ok(!a.calls.some(c=>['drawImage','getImageData','putImageData','fillText'].includes(c.op)));
      assert.ok(!a.styles.some(s=>s.key==='filter'||s.key==='globalAlpha'),'grey is a palette, not an opacity or filter effect');
      const colors=a.styles.filter(s=>s.key==='fillStyle'||s.key==='strokeStyle').map(s=>String(s.value));assert.ok(colors.length>5);
      for(const color of colors){assert.match(color,/^#[0-9a-f]{6}([0-9a-f]{2})?$/i);assert.equal(color.slice(1,3),color.slice(3,5));assert.equal(color.slice(3,5),color.slice(5,7));}
      assert.ok(new Set(colors).size>=4,'light, midtone and dark material details remain visible');
      shapes.add(JSON.stringify(a.calls));
    }
    assert.equal(shapes.size,7,'all locked strategies retain a different physical subject');
  }
});

test('optional muted argument preserves the existing unlocked drawing contract',async()=>{
  await loaded();
  for(const id of ids){
    const a=canvas(),b=canvas();drawStrategyIllustration(a.ctx,0,0,60,60,id);drawStrategyIllustration(b.ctx,0,0,60,60,id,false);
    a.balanced();b.balanced();assert.deepEqual(a.calls,b.calls);assert.deepEqual(a.styles,b.styles);
  }
});
