import test from 'node:test';
import assert from 'node:assert/strict';
import { drawArmyPennant } from '../src/render/army-pennant.ts';
import type { FactionId, Point } from '../src/core/types.ts';

function draw(count=23,hit=0,anchor:Point={x:80,y:112},rect={x:100,y:100,w:49,h:24},faction:FactionId='P'){
  const initial={fillStyle:'blue',strokeStyle:'red',globalAlpha:.7,lineWidth:9,lineCap:'butt',lineJoin:'miter',shadowBlur:4,shadowOffsetX:3,shadowOffsetY:2};
  let state:Record<string,unknown>={...initial},position={x:0,y:0},dash=[2,3],path:Point[]=[];
  const stack:{state:typeof state;position:Point;dash:number[]}[]=[],paints:{path:Point[];kind:string;color:unknown;lineWidth:number}[]=[],texts:{value:string;x:number;y:number;width:number;align:unknown;font:unknown}[]=[];
  let calls=0;
  const point=(x:number,y:number)=>({x:x+position.x,y:y+position.y});
  const ctx=new Proxy({}, {
    get(_t,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      calls++;const n=args as number[];
      switch(key){
        case 'save':stack.push({state:{...state},position:{...position},dash:[...dash]});break;
        case 'restore':assert.ok(stack.length);({state,position,dash}=stack.pop()!);break;
        case 'setLineDash':dash=args[0] as number[];break;
        case 'translate':position={x:position.x+n[0]!,y:position.y+n[1]!};break;
        case 'beginPath':path=[];break;
        case 'moveTo':case 'lineTo':path.push(point(n[0]!,n[1]!));break;
        case 'arc':for(let i=0;i<16;i++){const a=i*Math.PI/8;path.push(point(n[0]!+Math.cos(a)*n[2]!,n[1]!+Math.sin(a)*n[2]!));}break;
        case 'rect':path.push(point(n[0]!,n[1]!),point(n[0]!+n[2]!,n[1]!+n[3]!));break;
        case 'closePath':break;
        case 'fill':case 'stroke':
          assert.deepEqual(dash,[]);assert.equal(state.shadowBlur,0);assert.equal(state.shadowOffsetX,0);assert.equal(state.shadowOffsetY,0);
          paints.push({path:[...path],kind:String(key),color:state[key==='fill'?'fillStyle':'strokeStyle'],lineWidth:Number(state.lineWidth)});break;
        case 'fillText':texts.push({value:String(args[0]),x:n[1]!,y:n[2]!,width:n[3]!,align:state.textAlign,font:state.font});break;
        default:assert.fail(`Unexpected canvas operation ${String(key)}`);
      }
    };},set(_t,key,value){calls++;state[String(key)]=value;return true;},
  }) as CanvasRenderingContext2D;
  drawArmyPennant(ctx,rect,anchor,faction,count,hit);
  assert.deepEqual(state,initial);assert.deepEqual(position,{x:0,y:0});assert.deepEqual(dash,[2,3]);assert.equal(stack.length,0);
  return {paints,texts,calls};
}

test('banner retains exact whole-army count, including the storage boundary, without inventing loss text',()=>{
  for(const count of [0,1,23,999,Number.MAX_SAFE_INTEGER]){
    const {texts}=draw(count,7);assert.equal(texts.length,1);assert.equal(texts[0]!.value,String(count));
    assert.ok(texts[0]!.width>0);assert.equal(texts[0]!.align,'right');assert.match(String(texts[0]!.font),/monospace/);
    assert.ok(texts[0]!.x-texts[0]!.width>=117);assert.ok(texts[0]!.x<=145);
  }
  assert.notEqual(draw().paints[1]!.color,draw(23,1).paints[1]!.color);
});

test('four faction shapes stay inside the banner and a bounded staff points at the nearby leader shoulder',()=>{
  const shapes=[];
  for(const faction of ['P','E1','E2','E3'] as const)for(const anchor of [{x:80,y:112},{x:1000,y:1000},{x:120,y:90},{x:120,y:112}]){
    const {paints}=draw(23,0,anchor,{x:100,y:100,w:49,h:24},faction);
    const body=paints.filter(p=>p.color!=='#728373');
    for(const p of body)for(const point of p.path){
      const r=p.kind==='stroke'?p.lineWidth/2:0;
      assert.ok(point.x-r>=100&&point.x+r<=149&&point.y-r>=100&&point.y+r<=124);
    }
    const tail=paints.find(p=>p.color==='#728373');
    if(tail){
      assert.equal(tail.path.length,2);assert.ok(Math.hypot(tail.path[1]!.x-tail.path[0]!.x,tail.path[1]!.y-tail.path[0]!.y)<=18+1e-8);
      const shoulder={x:anchor.x,y:anchor.y-20},near=tail.path[1]!,far=tail.path[0]!;
      assert.ok(Math.hypot(near.x-shoulder.x,near.y-shoulder.y)<Math.hypot(far.x-shoulder.x,far.y-shoulder.y));
    }
    if(anchor.x===1000)assert.equal(tail,undefined,'a misplaced remote banner cannot draw a disconnected map-wide pointer');
    if(anchor.x===80)shapes.push(JSON.stringify(body.at(-1)!.path));
  }
  assert.equal(new Set(shapes).size,4);
});

test('invalid counts, effects and geometry never touch the canvas',()=>{
  for(const n of [-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){assert.equal(draw(n).calls,0);assert.equal(draw(20,n).calls,0);}
  for(const n of [NaN,Infinity,-Infinity]){
    assert.equal(draw(20,0,{x:n,y:1}).calls,0);assert.equal(draw(20,0,{x:1,y:n}).calls,0);
    assert.equal(draw(20,0,{x:1,y:1},{x:n,y:0,w:49,h:24}).calls,0);
  }
  assert.equal(draw(20,0,{x:1,y:1},{x:0,y:0,w:27,h:24}).calls,0);
  assert.equal(draw(20,0,{x:1,y:1},{x:0,y:0,w:49,h:15}).calls,0);
  assert.equal(draw(20,0,{x:1,y:1},{x:Number.MAX_VALUE,y:0,w:Number.MAX_VALUE,h:24}).calls,0);
});

// Casualty transitions keep the units column in place inside the pre-reserved banner.
test('count updates use the same right edge and baseline without replacing real remaining troops',()=>{
  const samples=[100,99,10,9,1].map(n=>draw(n).texts[0]!);
  assert.deepEqual(samples.map(t=>t.value),['100','99','10','9','1']);
  assert.equal(new Set(samples.map(t=>t.x)).size,1);assert.equal(new Set(samples.map(t=>t.y)).size,1);
});
