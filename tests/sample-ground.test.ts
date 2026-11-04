import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/core/battle.ts';
import { drawSampleGround } from '../src/render/sample-ground.ts';
import { building } from '../src/render/art.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';

function drawing(){
  const calls:{op:string;args:unknown[]}[]=[],colors:string[]=[],initial={globalAlpha:.6,lineWidth:3,fillStyle:'pink',strokeStyle:'cyan',lineCap:'square'};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {get(_t,key){if(key in state)return state[String(key)];return(...args:unknown[])=>{
    calls.push({op:String(key),args});
    for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value),`${String(key)} received a non-finite number`);
    if(key==='save')stack.push({...state});
    if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
  };},set(_t,key,value){state[String(key)]=value;if(key==='fillStyle'||key==='strokeStyle')colors.push(String(value));return true;}}) as CanvasRenderingContext2D;
  return {ctx,calls,colors,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

for(const id of ['A01','A02','A03'] as const)test(`${id} courts restore Canvas state, remain deterministic and never change battle state`,()=>{
  const battle=createBattle(id,{id:'ground'}),before=structuredClone(battle);
  for(const scale of [.5,320/360,375/360,430/360,2]){
    const a=drawing(),b=drawing(),point=(p:{x:number;y:number})=>({x:10+p.x*scale,y:50+p.y*scale});
    drawSampleGround(a.ctx,battle,point,scale);drawSampleGround(b.ctx,battle,point,scale);
    a.balanced();b.balanced();assert.deepEqual(a.calls,b.calls);
    assert.equal(a.calls.filter(c=>c.op==='translate').length,battle.camps.length);
    assert.equal(a.calls.filter(c=>c.op==='clip').length,1,'only the central objective has a complete stone plaza');
    assert.ok(!a.calls.some(c=>['fillText','drawImage'].includes(c.op)),'ground adds no labels or asset dependency');
    // All local paths are contained within the 54 × 32 map-unit outer court bounds,
    // including Bezier controls. That leaves space between every adjacent settlement.
    for(const c of a.calls.filter(c=>['moveTo','lineTo','quadraticCurveTo'].includes(c.op))){
      const v=c.args as number[];for(let i=0;i<v.length;i+=2){assert.ok(Math.abs(v[i]!)<=61);assert.ok(Math.abs(v[i+1]!)<=36);}
    }
    let origin={x:0,y:0};
    for(const c of a.calls){
      if(c.op==='translate')origin={x:c.args[0] as number,y:c.args[1] as number};
      if(!['moveTo','lineTo','quadraticCurveTo'].includes(c.op))continue;
      const values=c.args as number[];
      for(let i=0;i<values.length;i+=2){
        const x=origin.x+values[i]!*scale,y=origin.y+values[i+1]!*scale;
        assert.ok(x>=10&&x<=10+360*scale,`${id} ground exceeds battlefield width at ${scale}`);
        assert.ok(y>=50&&y<=50+540*scale,`${id} ground exceeds battlefield height at ${scale}`);
      }
    }
  }
  assert.deepEqual(battle,before);
});

test('formal maps use separate worn stone palettes that match the courtyard, snow and sand backgrounds',()=>{
  const palettes=(['A01','A02','A03'] as const).map(id=>{
    const d=drawing();drawSampleGround(d.ctx,createBattle(id,{id:'palette'}),p=>p,1);
    return new Set(d.colors);
  });
  const centerColors=['#B8AE96CC','#CCD7D29C','#CDBFA29C'];
  for(let i=0;i<palettes.length;i++){
    assert.ok(palettes[i]!.has(centerColors[i]!));
    for(let j=0;j<palettes.length;j++)if(i!==j)assert.ok(!palettes[j]!.has(centerColors[i]!));
  }
  const rgb=(color:string)=>[1,3,5].map(start=>parseInt(color.slice(start,start+2),16));
  const snow=rgb(centerColors[1]!),sand=rgb(centerColors[2]!);
  assert.ok(snow[1]!>=snow[0]!&&Math.max(...snow)-Math.min(...snow)<16,'snow paving stays cool and close to neutral');
  assert.ok(sand[0]!>sand[1]!&&sand[1]!>sand[2]!+20,'sandstone paving has a warm ochre tone');
});

for(const id of ['A01','A02','A03'] as const)test(`${id} invalid scale or projected points produce no partial ground`,()=>{
  const b=createBattle(id,{id:'ground'});
  for(const scale of [0,-1,NaN,Infinity,-Infinity]){const d=drawing();drawSampleGround(d.ctx,b,p=>p,scale);assert.equal(d.calls.length,0);}
  for(const bad of [NaN,Infinity,-Infinity]){const d=drawing();drawSampleGround(d.ctx,b,p=>({...p,x:bad}),1);assert.equal(d.calls.length,0);}
  const laterBad=drawing();drawSampleGround(laterBad.ctx,b,p=>({...p,y:p===b.camps.at(-1)?NaN:p.y}),1);assert.equal(laterBad.calls.length,0);
});

test('all tutorial maps retain their existing ground',()=>{
  for(const id of ['L01','L02','L03'] as const){const d=drawing();drawSampleGround(d.ctx,createBattle(id,{id:'other'}),p=>p,1);assert.equal(d.calls.length,0);}
});

test('resized camp art keeps feet anchored, readable tier heights and valid size boundaries',async()=>{
  await loadArt(()=>{
    const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;let src='';
    Object.defineProperty(image,'src',{get(){return src;},set(value:string){src=value;queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
  for(const size of [14,28,42]){
    const heights:number[]=[];
    for(const tier of [1,2,3]){
      const d=drawing();building(d.ctx,100,200,size,'barracks',tier,'P');d.balanced();
      const [x,y,w,h]=d.calls.find(c=>c.op==='drawImage')!.args.slice(5) as number[],k=size/28;
      assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[100,200]);
      assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[k,k]);
      assert.ok(Math.abs(x!+w!/2)<1e-8);assert.ok(Math.abs(y!+h!-22)<1e-8);
      assert.ok(w!<=66+1e-8&&h!<=56+1e-8);heights.push(h!);
    }
    assert.ok(heights[0]!>=20,'the intentionally smaller first tier retains its painted timber silhouette');
    assert.ok(heights[1]!>heights[0]!+6&&heights[2]!>heights[1]!+6,'court and towers have visibly distinct heights');
  }
  for(const [x,y,size]of [[NaN,10,28],[10,Infinity,28],[10,10,0],[10,10,-1],[10,10,NaN]]){
    const d=drawing();building(d.ctx,x!,y!,size!,'barracks',1,'P');assert.equal(d.calls.length,0);
  }
});
