import test from 'node:test';
import assert from 'node:assert/strict';
import { campPennant } from '../src/render/art.ts';
import type { FactionId } from '../src/core/types.ts';

type Call={op:string;args:unknown[];font:unknown;fill:unknown};
function pennant(value:number,faction:FactionId|null='P',selected=false,tier?:number){
  const calls:Call[]=[],initial={globalAlpha:.4,font:'11px serif',fillStyle:'#123',strokeStyle:'#456',lineWidth:4,textAlign:'left',textBaseline:'top'};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){
      if(key in state)return state[String(key)];
      if(key==='measureText')return (text:string)=>({width:text.length*9});
      return (...args:unknown[])=>{calls.push({op:String(key),args,font:state.font,fill:state.fillStyle});if(key==='save')stack.push({...state});if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}};
    },
    set(_target,key,value){state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  campPennant(ctx,100,200,value,faction,selected,tier);assert.equal(stack.length,0);assert.deepEqual(state,initial);
  return calls;
}

test('camp pennants keep exact integer text at 16 px, grow in width and preserve drawing state',()=>{
  let previous=0;
  for(const value of [0,9,10,99,100,9999,Number.MAX_SAFE_INTEGER])for(const selected of [false,true]){
    const calls=pennant(value,'P',selected),text=calls.filter(c=>c.op==='fillText');
    assert.equal(text.length,1);assert.equal(text[0]!.font,'600 16px Georgia, "Songti SC", serif');assert.deepEqual(text[0]!.args,[String(value),100,200.5]);
    const left=calls.find(c=>c.op==='moveTo')!.args as number[],right=calls.find(c=>c.op==='lineTo')!.args as number[],width=right[0]!-left[0]!+10;
    assert.equal(left[1],189);assert.equal(right[1],189);assert.ok(width>=34);assert.ok(width>=String(value).length*9+14);assert.ok(width>=previous);previous=width;
  }
});

test('camp plaques show five ownership colours without flag glyphs',()=>{
  const colors=new Set<unknown>();
  for(const faction of ['P','E1','E2','E3',null] as const){
    const calls=pennant(23,faction);assert.ok(!calls.some(c=>c.op==='translate'||c.op==='scale'));
    colors.add(calls.find(c=>c.op==='fill')!.fill);
  }
  assert.equal(colors.size,5);
});

test('invalid pennant values do not touch drawing state or silently round troop counts',()=>{
  for(const value of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.deepEqual(pennant(value),[]);
});

test('level plates stay separate from exact counts and readable for every owner, tier and digit width',()=>{
  for(const owner of ['P','E1','E2','E3',null] as const)for(const tier of [1,2,3])for(const count of [0,30,9999,Number.MAX_SAFE_INTEGER]){
    const calls=pennant(count,owner,false,tier),text=calls.filter(c=>c.op==='fillText');
    assert.deepEqual(text[0]!.args,[String(count),100,200.5]);
    assert.equal(text[0]!.font,'600 16px Georgia, "Songti SC", serif');
    assert.equal(text[1]!.args[0],['一级','二级','三级'][tier-1]);
    assert.equal(text[1]!.font,'600 11px "Songti SC", "SimSun", serif');
    assert.ok(Number(text[1]!.args[1])+11<=100-Math.max(34,String(count).length*9+14)/2);
  }
});


test('parchment tallies use dark readable ink and a quiet level tag, never a white-on-black badge',()=>{
  const calls=pennant(30,'P',false,3),text=calls.filter(c=>c.op==='fillText');
  assert.equal(text[0]!.fill,'#3E382B');assert.equal(text[1]!.fill,'#54432B');
  assert.ok(calls.some(c=>c.op==='fill'&&c.fill==='#D3D9BE'));
  assert.ok(!calls.some(c=>['#494238','#53412A','#624418','#286451'].includes(String(c.fill))));
});
