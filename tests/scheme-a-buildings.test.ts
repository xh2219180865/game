import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSchemeABuilding} from '../src/render/scheme-a-buildings.ts';
import type {CampType} from '../src/core/types.ts';

type Call={op:string;args:number[];fill:string;stroke:string;lineWidth:number};
function canvas(){
  const initial={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:4,lineJoin:'miter',lineCap:'butt',globalAlpha:.61,tx:0,ty:0,sx:1,sy:1};
  let state={...initial};const stack:typeof state[]=[],calls:Call[]=[],points:number[][]=[];
  const point=(x:number,y:number)=>points.push([state.tx+x*state.sx,state.ty+y*state.sy]);
  const ctx=new Proxy({}, {
    get(_target,key){
      if(key in state)return state[key as keyof typeof state];
      return(...args:number[])=>{
        calls.push({op:String(key),args,fill:state.fillStyle,stroke:state.strokeStyle,lineWidth:state.lineWidth});
        if(key==='save')stack.push({...state});
        else if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
        else if(key==='translate'){state.tx+=args[0]!*state.sx;state.ty+=args[1]!*state.sy;}
        else if(key==='scale'){state.sx*=args[0]!;state.sy*=args[1]!;}
        else if(key==='moveTo'||key==='lineTo')point(args[0]!,args[1]!);
        else if(key==='fillRect'||key==='rect'){point(args[0]!,args[1]!);point(args[0]!+args[2]!,args[1]!+args[3]!);}
        else if(key==='ellipse'){point(args[0]!-args[2]!,args[1]!-args[3]!);point(args[0]!+args[2]!,args[1]!+args[3]!);}
      };
    },
    set(_target,key,value){(state as Record<string,unknown>)[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  return{ctx,calls,points,check(){assert.deepEqual(state,initial);assert.equal(stack.length,0);}};
}
const types:CampType[]=['barracks','archery','relay','fort'];

test('scheme A buildings: twelve distinct geometry silhouettes retain paint state and the existing body bounds',()=>{
  const silhouettes=new Set<string>();
  for(const type of types)for(const tier of [1,2,3]){
    const p=canvas();drawSchemeABuilding(p.ctx,0,0,28,type,tier,'P');p.check();
    silhouettes.add(JSON.stringify(p.calls.filter(c=>['moveTo','lineTo','fillRect','ellipse'].includes(c.op)).map(c=>[c.op,c.args])));
    assert.ok(p.calls.every(c=>c.args.every(Number.isFinite)));
    for(const [x,y] of p.points){assert.ok(x!>=-31&&x!<=31,`${type}/${tier} x=${x}`);assert.ok(y!>=-32&&y!<=25,`${type}/${tier} y=${y}`);}
    assert.ok(p.calls.length<420,'bounded vector operations without an offscreen canvas');
    assert.ok(!p.calls.some(c=>['drawImage','fillText','strokeText','rotate'].includes(c.op)));
  }
  assert.equal(silhouettes.size,12);
});

test('scheme A buildings: scale and position affect only rendering and flags remain caller-owned',()=>{
  for(const type of types)for(const tier of [1,2,3])for(const size of [2,28,56])for(const owner of ['P','E1','E2','E3',null] as const){
    const p=canvas();drawSchemeABuilding(p.ctx,93,117,size,type,tier,owner);p.check();
    for(const [x,y]of p.points){
      assert.ok(x!>=93-32*size/28&&x!<=93+32*size/28);assert.ok(y!>=117-34*size/28&&y!<=117+26*size/28);
    }
    assert.equal(p.calls.filter(c=>c.op==='translate').length,1,'body does not move or generate the external ownership flag');
    assert.deepEqual(p.calls.find(c=>c.op==='translate')?.args,[93,117]);
  }
});

test('scheme A buildings: tower aim preserves the original endpoint and invalid aim falls back safely',()=>{
  for(const tier of [1,2,3])for(const aim of [undefined,NaN,Infinity,0,Math.PI/2,Math.PI,-Math.PI/2,.43]){
    const p=canvas();drawSchemeABuilding(p.ctx,0,0,28,'fort',tier,'P',aim);p.check();
    const cannon=p.calls.findIndex(c=>c.op==='stroke'&&c.lineWidth===3);
    assert.ok(cannon>0);const endpoint=p.calls[cannon-1]!.args;
    assert.equal(p.calls[cannon-1]!.lineWidth,1.8,'the firing endpoint retains the original barrel probe width');
    assert.equal(p.calls.filter((c,i)=>c.op==='lineTo'&&p.calls[i-1]?.op==='moveTo'&&p.calls[i-1]!.args.every(n=>n===0)).length,1,'both stroke colours reuse one direction path');
    const length=Math.hypot(24,5),expected=aim!==undefined&&Number.isFinite(aim)?[Math.cos(aim)*length,Math.sin(aim)*length]:[24,-5];
    assert.deepEqual(endpoint,expected);
    for(const [x,y]of p.points){assert.ok(x!>=-31&&x!<=31);assert.ok(y!>=-32&&y!<=25);}
  }
});

test('scheme A fallback buildings retain five ownership roof colours even in the archer camp',()=>{
  for(const type of types)for(const tier of [1,2,3]){
    const roofs=new Set<string>();
    for(const owner of ['P','E1','E2','E3',null] as const){
      const d=canvas();drawSchemeABuilding(d.ctx,0,0,28,type,tier,owner);d.check();
      const expected=owner==='P'?'#568C78':owner==='E1'?'#B96A55':owner==='E2'?'#BC9C50':owner==='E3'?'#837798':'#7D858D';
      assert.ok(d.calls.filter(c=>c.op==='fill'&&c.fill===expected).length>=2,'both tiled faces show ownership');
      roofs.add(expected);
    }
    assert.equal(roofs.size,5);
  }
});

test('neutral fallback has grey stone and tile shadows without leaking its palette to captured camps',()=>{
  for(const type of types)for(const tier of [1,2,3]){
    const d=canvas();drawSchemeABuilding(d.ctx,0,0,28,type,tier,null);d.check();
    assert.ok(d.calls.some(c=>['fill','fillRect'].includes(c.op)&&c.fill==='#D9DCDE'));
    assert.ok(d.calls.some(c=>c.op==='fill'&&c.fill==='#535E68'));
    const start=d.calls.length;drawSchemeABuilding(d.ctx,0,0,28,type,tier,'P');d.check();
    const p=canvas();drawSchemeABuilding(p.ctx,0,0,28,type,tier,'P');p.check();
    assert.deepEqual(d.calls.slice(start),p.calls);
    assert.ok(p.calls.some(c=>['fill','fillRect'].includes(c.op)&&c.fill==='#F5EFDB'),'non-neutral stone retains original warm material');
  }
});

test('scheme A buildings: invalid positions never touch canvas and invalid levels use a finite first tier',()=>{
  for(const [x,y,size]of [[NaN,0,28],[0,Infinity,28],[0,0,0],[0,0,-1],[0,0,Infinity]]){
    const p=canvas();drawSchemeABuilding(p.ctx,x!,y!,size!,'barracks',1,'P');assert.equal(p.calls.length,0);p.check();
  }
  for(const tier of [NaN,Infinity,-1,0]){
    const p=canvas(),one=canvas();drawSchemeABuilding(p.ctx,0,0,28,'barracks',tier,null);drawSchemeABuilding(one.ctx,0,0,28,'barracks',1,null);p.check();
    assert.deepEqual(p.calls,one.calls);
  }
});
