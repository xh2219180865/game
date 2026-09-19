import test from 'node:test';
import assert from 'node:assert/strict';
import { drawRankStandard, drawIvoryLandscape, drawRewardFan, drawGateSeal } from '../src/render/scheme-a.ts';

type Matrix=[number,number,number,number,number,number];
type Position={x:number;y:number};
function trace(draw:(ctx:CanvasRenderingContext2D)=>void){
  const initial={fillStyle:'#123',strokeStyle:'#456',globalAlpha:.6,lineWidth:8,lineJoin:'miter',lineCap:'butt',shadowBlur:12,shadowOffsetX:4,shadowOffsetY:6};
  let state:Record<string,unknown>={...initial},matrix:Matrix=[1,0,0,1,0,0],dash=[3,2];
  const stack:{state:Record<string,unknown>;matrix:Matrix;dash:number[]}[]=[],points:Position[]=[],calls:{op:string;args:unknown[]}[]=[];
  let path:Position[]=[];
  const point=(x:number,y:number):Position=>{
    assert.ok(Number.isFinite(x)&&Number.isFinite(y),'all drawing coordinates are finite');
    return {x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]};
  };
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...a:number[])=>{
      calls.push({op:String(key),args:a});
      if(key==='save')stack.push({state:{...state},matrix:[...matrix],dash:[...dash]});
      else if(key==='restore'){assert.ok(stack.length,'balanced restore');({state,matrix,dash}=stack.pop()!);}
      else if(key==='setLineDash')dash=[...(a[0] as unknown as number[])];
      else if(key==='translate'){matrix[4]+=matrix[0]*a[0]!+matrix[2]*a[1]!;matrix[5]+=matrix[1]*a[0]!+matrix[3]*a[1]!;}
      else if(key==='scale'){matrix[0]*=a[0]!;matrix[1]*=a[0]!;matrix[2]*=a[1]!;matrix[3]*=a[1]!;}
      else if(key==='rotate'){const c=Math.cos(a[0]!),s=Math.sin(a[0]!),[m,n,o,p]=matrix;matrix[0]=m*c+o*s;matrix[1]=n*c+p*s;matrix[2]=o*c-m*s;matrix[3]=p*c-n*s;}
      else if(key==='beginPath')path=[];
      else if(['moveTo','lineTo'].includes(String(key)))path.push(point(a[0]!,a[1]!));
      else if(key==='fill')points.push(...path);
      else if(key==='stroke'){
        assert.deepEqual(dash,[],'inherited route dashes cannot break decorative metal edges');
        const radius=Number(state.lineWidth)*Math.hypot(matrix[0],matrix[1])/2;
        for(const p of path)for(const dx of [-radius,radius])for(const dy of [-radius,radius])points.push({x:p.x+dx,y:p.y+dy});
      }else if(key==='fillRect'){points.push(point(a[0]!,a[1]!),point(a[0]!+a[2]!,a[1]!+a[3]!));}
      else if(['fillText','strokeText','drawImage'].includes(String(key)))assert.fail('helpers must not paint text, buttons or external images');
      else if(key!=='closePath')assert.fail(`Untracked drawing operation: ${String(key)}`);
    };},
    set(_target,key,value){state[String(key)]=value;calls.push({op:String(key),args:[value]});return true;},
  }) as CanvasRenderingContext2D;
  draw(ctx);assert.equal(stack.length,0);assert.deepEqual(state,initial,'all painter state restored');assert.deepEqual(matrix,[1,0,0,1,0,0]);assert.deepEqual(dash,[3,2]);
  return {points,calls};
}
function bounds(points:Position[],x:number,y:number,w:number,h:number){
  assert.ok(points.length>0,'actual painted output exists');
  for(const p of points)assert.ok(p.x>=x-w/2-1e-8&&p.x<=x+w/2+1e-8&&p.y>=y-h/2-1e-8&&p.y<=y+h/2+1e-8,`painted coordinate ${p.x},${p.y} exceeds ${w}×${h}`);
}

test('rank standards keep their total height and narrow centered width for every merit boundary',()=>{
  for(const size of [1,32,128,240])for(const points of [0,29,30,108,9999,Number.MAX_SAFE_INTEGER]){
    const d=trace(ctx=>drawRankStandard(ctx,100,200,size,points));bounds(d.points,100,200,size*.75,size);
  }
  assert.deepEqual(trace(ctx=>drawRankStandard(ctx,100,200,128,0)),trace(ctx=>drawRankStandard(ctx,100,200,128,9999)),'rank name and threshold remain the caller’s authority');
});

test('reward fan paints the actual clamped number of separate card backs inside the total width',()=>{
  for(const size of [1,48,144,280])for(const count of [-5,0,1,1.9,2,3,99,Number.MAX_SAFE_INTEGER]){
    const d=trace(ctx=>drawRewardFan(ctx,100,200,size,count));bounds(d.points,100,200,size,size*.7);
    assert.equal(d.calls.filter(c=>c.op==='rotate').length,Math.max(1,Math.min(3,Math.floor(count))));
  }
  assert.notDeepEqual(trace(ctx=>drawRewardFan(ctx,100,200,100,1)).points,trace(ctx=>drawRewardFan(ctx,100,200,100,3)).points);
});

test('gate seal stays inside the specified centered square and does not leak shadows',()=>{
  for(const size of [.5,24,60,160])bounds(trace(ctx=>drawGateSeal(ctx,-15,43,size)).points,-15,43,size,size);
});

test('landscape keeps all mountains below the reading area across three portrait dimensions',()=>{
  for(const [w,h] of [[320,568],[375,667],[430,932]]){
    const d=trace(ctx=>drawIvoryLandscape(ctx,w!,h!));bounds(d.points,w!/2,h!/2,w!,h!);
    const decoration=d.points.slice(2);assert.ok(decoration.length>20);assert.ok(decoration.every(p=>p.y>=h!*.8));
    const alphas=d.calls.filter(c=>c.op==='globalAlpha').map(c=>Number(c.args[0]));assert.ok(alphas.every(a=>a<=.6*.28));
  }
});

test('invalid coordinates, dimensions and nonfinite merit or card count do not affect the canvas',()=>{
  for(const bad of [NaN,Infinity,-Infinity]){
    for(const draw of [
      (ctx:CanvasRenderingContext2D)=>drawRankStandard(ctx,bad,0,100,0),
      (ctx:CanvasRenderingContext2D)=>drawRankStandard(ctx,0,0,100,bad),
      (ctx:CanvasRenderingContext2D)=>drawRewardFan(ctx,0,bad,100,2),
      (ctx:CanvasRenderingContext2D)=>drawRewardFan(ctx,0,0,100,bad),
      (ctx:CanvasRenderingContext2D)=>drawGateSeal(ctx,0,0,bad),
      (ctx:CanvasRenderingContext2D)=>drawIvoryLandscape(ctx,320,bad),
    ])assert.deepEqual(trace(draw).calls,[]);
  }
  for(const size of [-100,0]){
    assert.deepEqual(trace(ctx=>drawRankStandard(ctx,0,0,size,0)).calls,[]);
    assert.deepEqual(trace(ctx=>drawRewardFan(ctx,0,0,size,2)).calls,[]);
    assert.deepEqual(trace(ctx=>drawGateSeal(ctx,0,0,size)).calls,[]);
    assert.deepEqual(trace(ctx=>drawIvoryLandscape(ctx,size,100)).calls,[]);
  }
  assert.deepEqual(trace(ctx=>drawRankStandard(ctx,0,0,100,-1)).calls,[]);
  assert.deepEqual(trace(ctx=>drawRankStandard(ctx,Number.MAX_VALUE,0,Number.MAX_VALUE,0)).calls,[]);
  assert.deepEqual(trace(ctx=>drawRewardFan(ctx,0,Number.MAX_VALUE,Number.MAX_VALUE,2)).calls,[]);
  assert.deepEqual(trace(ctx=>drawGateSeal(ctx,Number.MAX_VALUE,0,Number.MAX_VALUE)).calls,[]);
});
