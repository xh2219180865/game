import test from 'node:test';
import assert from 'node:assert/strict';
import { soldierHit } from '../src/render/art.ts';
import type { TroopType } from '../src/core/types.ts';

type Matrix=[number,number,number,number,number,number];
function drawing(type:TroopType,age:number,reduced=false){
  const initial={globalAlpha:.7,fillStyle:'#123',strokeStyle:'#456',lineWidth:5,lineCap:'butt',lineJoin:'miter'};
  let state:Record<string,unknown>={...initial},matrix:Matrix=[1,0,0,1,0,0];
  const stack:{state:Record<string,unknown>;matrix:Matrix}[]=[],points:{x:number;y:number}[]=[],calls:unknown[][]=[];
  function point(x:number,y:number){assert.ok(Number.isFinite(x)&&Number.isFinite(y));points.push({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});}
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...a:number[])=>{
      calls.push([String(key),...a]);
      if(key==='save')stack.push({state:{...state},matrix:[...matrix]});
      else if(key==='restore'){assert.ok(stack.length);({state,matrix}=stack.pop()!);}
      else if(key==='translate'){matrix[4]+=matrix[0]*a[0]!+matrix[2]*a[1]!;matrix[5]+=matrix[1]*a[0]!+matrix[3]*a[1]!;}
      else if(key==='scale'){matrix[0]*=a[0]!;matrix[1]*=a[0]!;matrix[2]*=a[1]!;matrix[3]*=a[1]!;}
      else if(key==='rotate'){const c=Math.cos(a[0]!),s=Math.sin(a[0]!),[m,n,o,p]=matrix;matrix[0]=m*c+o*s;matrix[1]=n*c+p*s;matrix[2]=o*c-m*s;matrix[3]=p*c-n*s;}
      else if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo'].includes(String(key)))for(let i=0;i<a.length;i+=2)point(a[i]!,a[i+1]!);
      else if(['fillRect','strokeRect'].includes(String(key))){point(a[0]!,a[1]!);point(a[0]!+a[2]!,a[1]!+a[3]!);}
      else if(key==='arc'||key==='ellipse'){const rx=a[2]!,ry=key==='arc'?rx:a[3]!;for(const dx of [-rx,rx])for(const dy of [-ry,ry])point(a[0]!+dx,a[1]!+dy);}
    };},
    set(_target,key,value){state[String(key)]=value;calls.push([String(key),value]);return true;},
  }) as CanvasRenderingContext2D;
  soldierHit(ctx,100,200,type,'P',age,reduced);
  assert.equal(stack.length,0);assert.deepEqual(state,initial);assert.deepEqual(matrix,[1,0,0,1,0,0]);
  return {points,calls};
}

test('confirmed casualty accent stays local, uses one decorative figure and expires at 300 ms',()=>{
  for(const type of ['infantry','archer','cavalry','guard'] as const)for(const age of [0,80,150,240,299]){
    const d=drawing(type,age);
    assert.equal(d.calls.filter(c=>c[0]==='scale').length,1,'one representative casualty, never one figure per lost soldier');
    assert.equal(d.calls.filter(c=>c[0]==='fillText'||c[0]==='drawImage').length,0,'no fake number and no image dependency');
    for(const p of d.points)assert.ok(Math.abs(p.x-100)<=32&&Math.abs(p.y-200)<=32,`${type} at ${age}: ${p.x},${p.y}`);
    const opacity=d.calls.filter(c=>c[0]==='globalAlpha').map(c=>Number(c[1]));assert.ok(opacity.every(v=>v>=0&&v<=.7));
  }
  for(const age of [-1,300,301,99999,NaN,Infinity])assert.deepEqual(drawing('infantry',age).calls,[]);
  assert.notDeepEqual(drawing('infantry',0).points,drawing('infantry',150).points);
});

test('reduced casualty feedback is identical static short lines with no soldier or movement',()=>{
  const first=drawing('infantry',0,true);
  for(const type of ['infantry','archer','cavalry','guard'] as const)for(const age of [0,80,150,299]){
    const d=drawing(type,age,true);assert.deepEqual(d,first);
    assert.equal(d.calls.filter(c=>['scale','translate','rotate','fillText'].includes(String(c[0]))).length,0);
  }
  assert.deepEqual(drawing('infantry',300,true).calls,[]);
});
