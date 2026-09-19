import test from 'node:test';
import assert from 'node:assert/strict';
import { cardAccent,cardSymbol } from '../src/render/art.ts';

function canvas(){
  const initial={tx:0,ty:0,sx:1,sy:1,globalAlpha:.7,lineWidth:1,fillStyle:'#111111',strokeStyle:'#222222',lineCap:'butt',lineJoin:'miter'};
  let state:Record<string,string|number>={...initial};const stack:typeof state[]=[],calls:unknown[]=[],points:{x:number;y:number}[]=[],scales:number[]=[];
  function point(x:number,y:number){points.push({x:Number(state.tx)+x*Number(state.sx),y:Number(state.ty)+y*Number(state.sy)});}
  const ctx=new Proxy({}, {
    get(_target,key){if(key in state)return state[String(key)];return (...a:number[])=>{
      calls.push([String(key),...a]);if(key==='save')stack.push({...state});else if(key==='restore')state=stack.pop()!;
      else if(key==='translate'){state.tx=Number(state.tx)+a[0]!*Number(state.sx);state.ty=Number(state.ty)+a[1]!*Number(state.sy);}
      else if(key==='scale'){state.sx=Number(state.sx)*a[0]!;state.sy=Number(state.sy)*a[1]!;scales.push(a[0]!);}
      else if(['moveTo','lineTo','quadraticCurveTo','bezierCurveTo'].includes(String(key)))for(let i=0;i<a.length;i+=2)point(a[i]!,a[i+1]!);
      else if(['fillRect','strokeRect'].includes(String(key))){point(a[0]!,a[1]!);point(a[0]!+a[2]!,a[1]!+a[3]!);}
      else if(key==='arc'||key==='ellipse'){const rx=a[2]!,ry=key==='arc'?rx:a[3]!;point(a[0]!-rx,a[1]!-ry);point(a[0]!+rx,a[1]!+ry);}
    };},set(_target,key,value){state[String(key)]=value;calls.push([String(key),value]);return true;},
  }) as CanvasRenderingContext2D;
  return{ctx,calls,points,scales,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

test('G4: reduced card effects are the same static prop at every phase, with no recruitment figures or extra particles',()=>{
  for(const id of ['mobilize','march','supply','feint'] as const){const expected=canvas();cardSymbol(expected.ctx,90,120,10,id);expected.balanced();
    for(const duration of [160,220])for(const age of [0,80,160,220,5000]){const actual=canvas();cardAccent(actual.ctx,90,120,id,'infantry','P',20,age,true,duration);actual.balanced();assert.deepEqual(actual.calls,expected.calls);assert.ok(!actual.scales.includes(.55));}
  }
});

test('G4: painted card accents stay local through both durations and recruitment never draws more than three soldiers',()=>{
  for(const id of ['mobilize','march','supply','feint'] as const)for(const troop of ['infantry','archer','cavalry','guard'] as const)for(const duration of [160,220])for(const age of [0,80,160,220])for(const amount of [0,1,2,3,20]){
    const d=canvas();cardAccent(d.ctx,90,120,id,troop,'P',amount,age,false,duration);d.balanced();
    assert.equal(d.scales.filter(s=>s===.55).length,id==='supply'?Math.min(3,amount):0);
    for(const p of d.points)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x-90)<=24&&Math.abs(p.y-120)<=24,`${id} ${troop} ${age} leaves its local 48 px box at ${p.x},${p.y}`);
  }
});
