import test from 'node:test';
import assert from 'node:assert/strict';
import { building } from '../src/render/art.ts';

test('painted camp footprints preserve the existing label clearance at every level and aim',()=>{
  for(const type of ['barracks','archery','relay','fort'] as const)for(const tier of [1,2,3])for(const aim of [undefined,0,Math.PI/2,Math.PI,-Math.PI/2])for(const size of [14,28,42]){
    const initial={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:7,lineCap:'butt',lineJoin:'miter',globalAlpha:.7,tx:0,ty:0,sx:1,sy:1,clipped:false};let state:Record<string,unknown>={...initial};const stack:typeof state[]=[];let clips=0;
    function point(x:number,y:number){
      assert.ok(Number.isFinite(x)&&Number.isFinite(y));
      const k=size/28,px=(Number(state.tx)+x*Number(state.sx)-100)/k,py=(Number(state.ty)+y*Number(state.sy)-100)/k;
      assert.ok(px>=-33-1e-8&&px<=33+1e-8&&py>=-34-1e-8&&py<=26+1e-8,`${type} ${tier} exceeds its transformed footprint at ${px},${py}`);
      if(!state.clipped){assert.equal(type,'fort','only the tower aiming cue may leave the art clip');assert.ok(Math.hypot(px,py)<=Math.hypot(24,5)+1e-8,'unclipped shaft stays at its original anchor and length');}
    }
    const ctx=new Proxy({}, {
      get(_target,key){if(key in state)return state[String(key)];return (...a:number[])=>{
        if(key==='save')stack.push({...state});else if(key==='restore')state=stack.pop()!;
        else if(key==='translate'){state.tx=Number(state.tx)+a[0]!*Number(state.sx);state.ty=Number(state.ty)+a[1]!*Number(state.sy);}
        else if(key==='scale'){state.sx=Number(state.sx)*a[0]!;state.sy=Number(state.sy)*a[1]!;}
        else if(key==='rect'){assert.deepEqual(a,[-33,-34,66,56]);assert.equal(state.tx,100);assert.equal(state.ty,100);assert.equal(state.sx,size/28);assert.equal(state.sy,size/28);}
        else if(key==='clip'){state.clipped=true;clips++;}
        else if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo'].includes(String(key)))for(let i=0;i<a.length;i+=2)point(a[i]!,a[i+1]!);
        else if(['fillRect','strokeRect'].includes(String(key))){point(a[0]!,a[1]!);point(a[0]!+a[2]!,a[1]!+a[3]!);}
        else if(key==='arc'||key==='ellipse'){const rx=a[2]!,ry=key==='arc'?rx:a[3]!;point(a[0]!-rx,a[1]!-ry);point(a[0]!+rx,a[1]!+ry);}
      };},set(_target,key,value){state[String(key)]=value;return true;},
    }) as CanvasRenderingContext2D;
    building(ctx,100,100,size,type,tier,'P',aim);assert.equal(clips,1);assert.equal(stack.length,0);assert.deepEqual(state,initial);
  }
});
