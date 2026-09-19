import test from 'node:test';
import assert from 'node:assert/strict';
import { drawMobileIcon, type MobileIcon } from '../src/render/mobile-icons.ts';

const icons:MobileIcon[]=['settings','lessons','cards','leaderboard','rank','close','back','info','upgrade','home','replay','play','pause','chevron'];
type Point={x:number;y:number};
function trace(x:number,y:number,size:number,icon:MobileIcon,color?:string){
  const initial={fillStyle:'#fff',strokeStyle:'#000',lineWidth:2,lineJoin:'miter',lineCap:'butt',shadowBlur:5,shadowOffsetX:3,shadowOffsetY:2};
  let state:Record<string,unknown>={...initial},position={x:0,y:0,scale:1},dash=[2,3];
  const stack:{state:Record<string,unknown>;position:typeof position;dash:number[]}[]=[],painted:Point[]=[],paths:unknown[]=[];
  let path:Point[]=[],calls=0;
  const point=(px:number,py:number):Point=>({x:position.x+px*position.scale,y:position.y+py*position.scale});
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
      calls++;
      const numbers=args as number[];
      switch(key){
        case 'save':stack.push({state:{...state},position:{...position},dash:[...dash]});break;
        case 'restore':assert.ok(stack.length>0);({state,position,dash}=stack.pop()!);break;
        case 'translate':position.x+=numbers[0]!*position.scale;position.y+=numbers[1]!*position.scale;break;
        case 'scale':assert.equal(numbers[0],numbers[1]);position.scale*=numbers[0]!;break;
        case 'setLineDash':dash=[...(args[0] as number[])];break;
        case 'beginPath':path=[];break;
        case 'moveTo':case 'lineTo':path.push(point(numbers[0]!,numbers[1]!));paths.push([key,...args]);break;
        case 'arc':{
          const [cx,cy,r,start,end]=numbers as [number,number,number,number,number];
          assert.ok(r>=0);paths.push([key,...args]);
          for(let step=0;step<=128;step++){const a=start+(end-start)*step/128;path.push(point(cx+Math.cos(a)*r,cy+Math.sin(a)*r));}
          break;
        }
        case 'closePath':paths.push([key]);break;
        case 'fill':case 'stroke':{
          assert.deepEqual(dash,[],'inherited dashes cannot break the icon');
          assert.equal(state.shadowBlur,0);assert.equal(state.shadowOffsetX,0);assert.equal(state.shadowOffsetY,0);
          assert.equal(state[key==='fill'?'fillStyle':'strokeStyle'],color??'#286C5C');
          const radius=key==='stroke'?Number(state.lineWidth)*position.scale/2:0;
          if(key==='stroke')assert.ok(Number(state.lineWidth)>=.07,'strokes remain readable at mobile icon sizes');
          for(const p of path)for(const dx of [-radius,radius])for(const dy of [-radius,radius])painted.push({x:p.x+dx,y:p.y+dy});
          break;
        }
        default:assert.fail(`Unexpected canvas operation: ${String(key)}`);
      }
    };},
    set(_target,key,value){state[String(key)]=value;calls++;return true;},
  }) as CanvasRenderingContext2D;
  drawMobileIcon(ctx,x,y,size,icon,color);
  assert.equal(stack.length,0);assert.deepEqual(state,initial);assert.deepEqual(position,{x:0,y:0,scale:1});assert.deepEqual(dash,[2,3]);
  return {painted,paths,calls};
}

test('all fourteen mobile icons have distinct actual geometry without text or images',()=>{
  const drawings=icons.map(icon=>trace(0,0,32,icon));
  assert.ok(drawings.every(d=>d.painted.length>0));
  assert.equal(new Set(drawings.map(d=>JSON.stringify(d.paths))).size,icons.length);
});

test('centered glyphs include their strokes inside the requested square at small and large sizes',()=>{
  for(const icon of icons)for(const size of [.1,1,16,24,32,44,128,1000])for(const [x,y] of [[0,0],[71,123],[-55,-29]]){
    const d=trace(x!,y!,size,icon);
    for(const p of d.painted){
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(Math.abs(p.x-x!)<=size/2+1e-8&&Math.abs(p.y-y!)<=size/2+1e-8,`${icon} exceeds ${size} square`);
    }
  }
});

test('every glyph accepts scheme A colors and restores the caller’s canvas state',()=>{
  for(const color of ['#286C5C','#FFFCF3','#C6533B'])for(const icon of icons)trace(30,40,28,icon,color);
});

test('nonfinite positions, nonpositive sizes and overflowing extents are harmless no-ops',()=>{
  for(const icon of icons){
    for(const bad of [NaN,Infinity,-Infinity]){
      assert.equal(trace(bad,0,32,icon).calls,0);
      assert.equal(trace(0,bad,32,icon).calls,0);
      assert.equal(trace(0,0,bad,icon).calls,0);
    }
    for(const size of [0,-1,-100])assert.equal(trace(0,0,size,icon).calls,0);
    assert.equal(trace(Number.MAX_VALUE,0,Number.MAX_VALUE,icon).calls,0);
    assert.equal(trace(0,-Number.MAX_VALUE,Number.MAX_VALUE,icon).calls,0);
  }
});
