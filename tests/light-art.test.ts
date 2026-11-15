import test from 'node:test';
import assert from 'node:assert/strict';
import { campPennant } from '../src/render/art.ts';
import { displayFont } from '../src/render/typography.ts';
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

test('compact camp tallies keep exact integer text at 14 px, grow in width and preserve drawing state',()=>{
  let previous=0;
  for(const value of [0,9,10,99,100,9999,Number.MAX_SAFE_INTEGER])for(const selected of [false,true]){
    const calls=pennant(value,'P',selected),text=calls.filter(c=>c.op==='fillText');
    assert.equal(text.length,1);assert.equal(text[0]!.font,'500 14px Georgia, "Songti SC", serif');assert.deepEqual(text[0]!.args,[String(value),100,200.5]);
    const left=calls.find(c=>c.op==='moveTo')!.args as number[],right=calls.find(c=>c.op==='lineTo')!.args as number[],width=right[0]!-left[0]!+4;
    assert.equal(left[1],191);assert.equal(right[1],191);assert.ok(width>=26);assert.ok(width>=String(value).length*9+8);assert.ok(width>=previous);previous=width;
    assert.equal(calls.filter(c=>c.op==='stroke').length,selected?1:0,'only the selected tally has an outline');
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

test('engraved levels retain their own text space beside exact counts for every owner, tier and digit width',()=>{
  for(const owner of ['P','E1','E2','E3',null] as const)for(const tier of [1,2,3])for(const count of [0,30,9999,Number.MAX_SAFE_INTEGER]){
    const calls=pennant(count,owner,false,tier),text=calls.filter(c=>c.op==='fillText');
    assert.deepEqual(text[0]!.args,[String(count),100,200.5]);
    assert.equal(text[0]!.font,'500 14px Georgia, "Songti SC", serif');
    assert.equal(text[1]!.args[0],['一级','二级','三级'][tier-1]);
    assert.equal(text[1]!.font,`400 10px ${displayFont()}`);
    assert.ok(Number(text[1]!.args[1])+10<=100-Math.max(26,String(count).length*9+8)/2);
  }
});


test('timber tallies keep both precise numbers and engraved levels above 4.5 to 1 contrast for every owner',()=>{
  const lum=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i]!,0);
  for(const owner of ['P','E1','E2','E3',null] as const){
    const calls=pennant(30,owner,false,3),base=String(calls.find(c=>c.op==='fill')!.fill);
    for(const text of calls.filter(c=>c.op==='fillText')){const a=lum(String(text.fill)),b=lum(base);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);}
  }
});
