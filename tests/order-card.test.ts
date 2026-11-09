import test from 'node:test';
import assert from 'node:assert/strict';
import { drawOrderCard } from '../src/render/order-card.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';
import type { ActiveCardId } from '../src/core/types.ts';

type Call={op:string;args:unknown[];alpha:number};
function canvas(failImage=false){
  const initial={globalAlpha:.7,fillStyle:'#123',strokeStyle:'#456',lineWidth:4,lineCap:'butt',lineJoin:'miter',shadowBlur:8,shadowOffsetX:4,shadowOffsetY:-3};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const calls:Call[]=[],styles:unknown[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return(...args:unknown[])=>{
      calls.push({op:String(key),args,alpha:Number(state.globalAlpha)});
      if(key==='save')stack.push({...state});if(key==='restore')state=stack.pop()!;
      if(key==='drawImage'&&failImage)throw Error('image lost');
    };},
    set(_target,key,value){state[String(key)]=value;styles.push([key,value]);return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,styles,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
async function loaded(){
  await loadArt(()=>{
    const image={width:1600,height:800,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(value:string){Object.defineProperty(image,'src',{value,configurable:true});queueMicrotask(()=>image.onload?.(new Event('load')));},configurable:true});
    return image;
  });
}
const ids=['mobilize','march','supply','feint'] as const;

test('field cards use battlefield sprites without painting inventory or names',async()=>{
  await loaded();
  for(const id of ids)for(const w of [60,70,83.75,97.5]){
    const d=canvas();drawOrderCard(d.ctx,10,20,w,54,id,false,false,true);d.balanced();
    const images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,id==='supply'?3:1);
    assert.ok(images.every(c=>(c.args[0] as ArtImage).src===(id==='feint'?'assets/art/warfront-camps.png':'assets/art/warfront-infantry.png')));
    assert.ok(d.calls.some(c=>c.op==='rect'&&JSON.stringify(c.args)===JSON.stringify([14,38,w-8,32])),'illustration is clipped below the name slip');
    assert.ok(d.calls.some(c=>c.op==='clip'));
    assert.ok(d.calls.some(c=>c.op==='fillRect'&&c.args[1]===24&&c.args[3]===14),'reserves the upper name slip');
    assert.ok(!d.calls.some(c=>c.op==='fillText'||c.op==='strokeText'));
  }
});

test('selection remains geometric, pressing shifts the whole face, and unavailable cards retain their identity',async()=>{
  await loaded();const base=canvas(),selected=canvas(),pressed=canvas(),unavailable=canvas();
  drawOrderCard(base.ctx,10,20,70,54,'supply',false,false,true);
  drawOrderCard(selected.ctx,10,20,70,54,'supply',true,false,true);
  drawOrderCard(pressed.ctx,10,20,70,54,'supply',false,true,true);
  drawOrderCard(unavailable.ctx,10,20,70,54,'supply',false,false,false);
  for(const d of [base,selected,pressed,unavailable])d.balanced();
  assert.ok(selected.calls.filter(c=>c.op==='lineTo').length>base.calls.filter(c=>c.op==='lineTo').length,'selection adds a check seal, not only a color difference');
  const image=(d:ReturnType<typeof canvas>)=>d.calls.find(c=>c.op==='drawImage')!;
  const origin=(d:ReturnType<typeof canvas>)=>d.calls.find(c=>c.op==='translate')!.args;
  assert.equal(Number(origin(pressed)[1]),Number(origin(base)[1])+2);
  assert.deepEqual(image(unavailable).args,image(base).args);
  assert.equal(image(unavailable).alpha,.7*.52);assert.equal(image(base).alpha,.7);
  assert.notDeepEqual(pressed.styles,base.styles);
});

test('lost artwork falls back in the same frame, keeps distinct props and restores Canvas state',async()=>{
  const shapes=new Set<string>();
  for(const id of ids){
    await loaded();const d=canvas(true);drawOrderCard(d.ctx,10,20,70,54,id,false,false,true);d.balanced();
    assert.ok(d.calls.some(c=>c.op==='drawImage'));
    assert.ok(d.calls.some(c=>c.op==='translate'),'a failed image draws the existing prop immediately');
    const fallback=canvas();drawOrderCard(fallback.ctx,10,20,70,54,id,false,false,true);fallback.balanced();
    assert.ok(!fallback.calls.some(c=>c.op==='drawImage'));
    shapes.add(JSON.stringify(fallback.calls));
  }
  assert.equal(shapes.size,4);
});

test('invalid geometry or a foreign card cannot produce a malformed field order',()=>{
  for(const geometry of [[NaN,0,70,54],[0,Infinity,70,54],[0,0,-1,54],[0,0,70,0],[0,0,39,54],[0,0,70,39],[0,0,70,Infinity],[Number.MAX_VALUE,0,Number.MAX_VALUE,54]]){
    const d=canvas();drawOrderCard(d.ctx,geometry[0]!,geometry[1]!,geometry[2]!,geometry[3]!,'supply',false,false,true);assert.equal(d.calls.length,0);d.balanced();
  }
  const d=canvas();drawOrderCard(d.ctx,0,0,70,54,'unknown' as ActiveCardId,false,false,true);assert.equal(d.calls.length,0);d.balanced();
});
