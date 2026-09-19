import test from 'node:test';
import assert from 'node:assert/strict';
import { building, soldier } from '../src/render/art.ts';
import type { CampType, TroopType } from '../src/core/types.ts';

type Call={op:string;args:unknown[]};
function drawing(){
  const calls:Call[]=[],initial={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:7,lineCap:'butt',lineJoin:'miter',globalAlpha:.8};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {
    get(_target,key){
      if(key in state)return state[String(key)];
      return (...args:unknown[])=>{
        calls.push({op:String(key),args});
        if(key==='save')stack.push({...state});
        if(key==='restore'){assert.ok(stack.length,'restore must have a matching save');state=stack.pop()!;}
      };
    },
    set(_target,key,value){state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  return {ctx,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
function drawBuilding(type:CampType,tier:number,size:number,aim?:number){const d=drawing();building(d.ctx,70,90,size,type,tier,'P',aim);d.balanced();return d.calls;}
function drawSoldier(type:TroopType,lift?:number){const d=drawing();soldier(d.ctx,70,90,type,'E1',.7,.4,lift);d.balanced();return d.calls;}
function shaft(calls:Call[]):number{
  const i=calls.findIndex((c,i)=>c.op==='lineTo'&&calls[i-1]?.op==='moveTo'&&calls[i-1]!.args.every(n=>n===0));
  assert.ok(i>=0,'tower has a shaft starting at its unchanged local anchor');return i;
}
function close(actual:number,expected:number){assert.ok(Math.abs(actual-expected)<1e-10,`${actual} should equal ${expected}`);}

test('F09: tower aim points in four directions without rotating buildings or changing the shaft length',()=>{
  const directions=[[0,1,0],[Math.PI/2,0,1],[Math.PI,-1,0],[-Math.PI/2,0,-1]] as const;
  for(const tier of [1,2,3])for(const size of [17,26,28]){
    const base=drawBuilding('fort',tier,size),index=shaft(base);assert.deepEqual(base[index]!.args,[24,-5]);
    for(const [aim,dx,dy]of directions){
      const drawn=drawBuilding('fort',tier,size,aim),end=drawn[index]!.args as number[],length=Math.hypot(24,5);
      close(end[0]!,dx*length);close(end[1]!,dy*length);close(Math.hypot(...end),length);
      assert.ok(Math.abs(end[0]!)<=31&&Math.abs(end[1]!)<=31,'shaft stays in the existing local building footprint');
      assert.deepEqual(drawn.filter((_,i)=>i!==index),base.filter((_,i)=>i!==index),'only the tower shaft endpoint changes');
    }
  }
});

test('F09: optional or invalid aim preserves the original tower and never affects other camp types',()=>{
  for(const type of ['barracks','archery','relay','fort'] as const)for(const tier of [1,2,3]){
    const base=drawBuilding(type,tier,26);
    for(const aim of [undefined,NaN,Infinity,-Infinity])assert.deepEqual(drawBuilding(type,tier,26,aim),base);
    if(type!=='fort')for(const aim of [0,Math.PI/2,Math.PI,-Math.PI/2])assert.deepEqual(drawBuilding(type,tier,26,aim),base);
  }
});

test('F12: zero, one and two pixels of bow lift move only the archer bow and string',()=>{
  const moving=(c:Call,i:number,calls:Call[])=>i>=calls.findIndex(v=>v.op==='arc'&&v.args[0]===7&&v.args[2]===9)&&(c.op==='arc'&&c.args[0]===7&&c.args[2]===9||['moveTo','lineTo'].includes(c.op)&&c.args[0]===7);
  const base=drawSoldier('archer');
  for(const lift of [0,1,2]){
    const drawn=drawSoldier('archer',lift);
    assert.deepEqual(drawn.filter(moving).map(c=>c.args),[[7,-6-lift,9,-Math.PI/2,Math.PI/2],[7,-15-lift],[7,3-lift]]);
    assert.deepEqual(drawn.filter((c,i,calls)=>!moving(c,i,calls)),base.filter((c,i,calls)=>!moving(c,i,calls)),'body, feet, head and drawing transform stay fixed');
  }
});

test('F12: bow lift is bounded and non-archers retain identical drawing at every lift',()=>{
  for(const lift of [-20,-.01,NaN,Infinity,-Infinity])assert.deepEqual(drawSoldier('archer',lift),drawSoldier('archer',0));
  for(const lift of [2.01,20])assert.deepEqual(drawSoldier('archer',lift),drawSoldier('archer',2));
  for(const type of ['infantry','cavalry','guard'] as const)for(const lift of [0,1,2,-20,20,NaN,Infinity])assert.deepEqual(drawSoldier(type,lift),drawSoldier(type));
});
