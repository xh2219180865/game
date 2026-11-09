import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCourtyardPanel, drawCourtyardHeading, drawSettingSeal } from '../src/render/courtyard-ui.ts';

type Draw=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number)=>void;
const drawings:Draw[]=[
  (c,x,y,w,h)=>drawCourtyardPanel(c,x,y,w,h),
  (c,x,y,w,h)=>drawCourtyardPanel(c,x,y,w,h,'panel',true),
  (c,x,y,w,h)=>drawCourtyardPanel(c,x,y,w,h,'tile'),
  (c,x,y,w,h)=>drawCourtyardPanel(c,x,y,w,h,'tile',true),
  drawCourtyardHeading,
  (c,x,y,w,h)=>drawSettingSeal(c,x,y,w,h,false),
  (c,x,y,w,h)=>drawSettingSeal(c,x,y,w,h,true),
];
function capture(draw:Draw,x=12,y=20,w=300,h=200){
  const initial={fillStyle:'#123456',strokeStyle:'#234567',lineWidth:3,lineCap:'round',lineJoin:'round',shadowBlur:4,shadowOffsetX:2,shadowOffsetY:-2,globalAlpha:.6};
  let state:Record<string,unknown>={...initial},dash=[2,3],offset=[0,0],calls=0;
  const stack:{state:typeof state;dash:number[];offset:number[]}[]=[],paints:unknown[]=[];
  let path:number[][]=[];
  const point=(px:number,py:number)=>{
    assert.ok(Number.isFinite(px)&&Number.isFinite(py));
    const xx=px+offset[0]!,yy=py+offset[1]!;
    assert.ok(xx>=x-1e-7&&xx<=x+w+1e-7&&yy>=y-1e-7&&yy<=y+h+1e-7,`point ${xx},${yy} outside ${w}x${h}`);
  };
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      calls++;const n=args as number[];
      switch(key){
        case 'save':stack.push({state:{...state},dash:[...dash],offset:[...offset]});break;
        case 'restore':assert.ok(stack.length);({state,dash,offset}=stack.pop()!);break;
        case 'translate':offset=[offset[0]!+n[0]!,offset[1]!+n[1]!];break;
        case 'setLineDash':dash=args[0] as number[];break;
        case 'beginPath':path=[];break;
        case 'moveTo':case 'lineTo':path.push(n);break;
        case 'stroke':{
          const r=Number(state.lineWidth)/2;
          for(const [px,py] of path){point(px!-r,py!-r);point(px!+r,py!+r);}
          assert.deepEqual(dash,[]);assert.equal(state.shadowBlur,0);
          paints.push({path,style:state.strokeStyle});break;
        }
        case 'fillRect':
          assert.ok(n[2]!>=0&&n[3]!>=0);point(n[0]!,n[1]!);point(n[0]!+n[2]!,n[1]!+n[3]!);
          assert.equal(state.shadowBlur,0);assert.equal(state.shadowOffsetX,0);assert.equal(state.shadowOffsetY,0);
          paints.push({rect:n,style:state.fillStyle});break;
        case 'createLinearGradient':{
          assert.ok(n.every(Number.isFinite));const stops:unknown[]=[];
          return {stops,addColorStop(at:number,color:string){assert.ok(at>=0&&at<=1);stops.push([at,color]);}};
        }
        default:assert.fail(`Unsupported Canvas operation ${String(key)}`);
      }
    };},
    set(_target,key,value){state[String(key)]=value;calls++;return true;},
  }) as CanvasRenderingContext2D;
  draw(ctx,x,y,w,h);
  assert.deepEqual(state,initial);assert.deepEqual(offset,[0,0]);assert.deepEqual(dash,[2,3]);assert.equal(stack.length,0);
  return {paints,calls};
}

test('courtyard materials stay inside supplied rectangles and restore caller state',()=>{
  for(const draw of drawings)for(const [w,h] of [[1,1],[20,5],[52,24],[54,108],[240,360],[390,600]]){
    assert.ok(capture(draw,12,20,w!,h!).paints.length>0);
  }
});

test('invalid courtyard rectangles do not touch Canvas',()=>{
  for(const draw of drawings){
    for(const invalid of [NaN,Infinity,-Infinity])for(let i=0;i<4;i++){
      const r=[0,0,120,80];r[i]=invalid;assert.equal(capture(draw,r[0],r[1],r[2],r[3]).calls,0);
    }
    for(const bad of [0,-1]){assert.equal(capture(draw,0,0,bad,80).calls,0);assert.equal(capture(draw,0,0,120,bad).calls,0);}
    assert.equal(capture(draw,Number.MAX_VALUE,0,Number.MAX_VALUE,80).calls,0);
  }
});

test('panel, tile and muted states have distinct material treatments',()=>{
  const paints=drawings.slice(0,4).map(draw=>JSON.stringify(capture(draw).paints));
  assert.equal(new Set(paints).size,4);
  assert.ok(capture(drawings[0]!).paints.length>capture(drawings[2]!).paints.length);
});

test('the setting seal keeps its bounds and changes its ink treatment',()=>{
  const off=capture(drawings[5]!,0,0,50,30).paints;
  const on=capture(drawings[6]!,0,0,50,30).paints;
  assert.deepEqual(off[0]!.rect,on[0]!.rect);
  assert.notEqual(off[0]!.style,on[0]!.style);
});
