import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../src/core/battle.ts';
import {MAPS} from '../src/core/maps.ts';
import {drawRoads} from '../src/render/tactical-art.ts';

function drawing(){
  let state:Record<string,unknown>={fillStyle:'#123',strokeStyle:'#456',globalAlpha:.7,lineWidth:4,lineCap:'butt',lineJoin:'miter'},path:number[][]=[];
  const initial={...state},stack:typeof state[]=[],fills:{color:unknown;path:number[][]}[]=[],calls:string[]=[];
  const ctx=new Proxy({}, {get(_t,key){if(key in state)return state[String(key)];return (...args:unknown[])=>{
    calls.push(String(key));for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n));
    if(key==='save')stack.push({...state});if(key==='restore')state=stack.pop()!;
    if(key==='beginPath')path=[];if(key==='moveTo'||key==='lineTo')path.push(args as number[]);
    if(key==='fill')fills.push({color:state.fillStyle,path:[...path]});
  };},set(_t,key,value){state[String(key)]=value;return true;}}) as CanvasRenderingContext2D;
  return {ctx,fills,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

for(const id of Object.keys(MAPS) as (keyof typeof MAPS)[])test(`${id}: every real road has irregular earth edges and worn ground, with no invented branch or state mutation`,()=>{
  const b=createBattle(id,{id:'roads-art',firstDragCompleted:true}),before=JSON.stringify(b);
  for(const scale of [.6,1,1.15]){
    const d=drawing(),point=(p:{x:number;y:number})=>({x:p.x*scale,y:p.y*scale});drawRoads(d.ctx,b,point,null,scale);d.balanced();
    assert.equal(d.fills.length,MAPS[id].roads.length*3,'each authoritative road has soil edge, compacted earth and worn centre');
    for(let i=0;i<MAPS[id].roads.length;i++){
      const [a,z]=MAPS[id].roads[i]!,from=point(b.camps.find(c=>c.id===a)!),to=point(b.camps.find(c=>c.id===z)!);
      const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
      for(const layer of d.fills.slice(i*3,i*3+3)){
        assert.ok(layer.path.length>=10,'natural edges cannot be a four-corner diagram bar');
        const widths=new Set<number>();
        for(const [x,y]of layer.path){
          const along=((x!-from.x)*dx+(y!-from.y)*dy)/length,across=((x!-from.x)*-dy+(y!-from.y)*dx)/length;
          assert.ok(along>=15&&along<=length-15,'roads stop inside their own camp approach');
          assert.ok(Math.abs(across)<=7*scale+1e-8,'soil detail stays around the real straight army route');widths.add(Math.round(Math.abs(across)*100));
        }
        assert.ok(widths.size>3,'road edges vary without diverting the army centreline');
      }
    }
    assert.equal(JSON.stringify(b),before);assert.ok(!d.calls.includes('fillText')&&!d.calls.includes('drawImage'));
    const repeat=drawing();drawRoads(repeat.ctx,b,point,null,scale);assert.deepEqual(repeat.fills,d.fills,'redraw never flickers or changes road geometry');
  }
  const legacy=drawing();drawRoads(legacy.ctx,{...b,ruleRevision:'1.5'},p=>p,null);assert.equal(legacy.calls.length,0,'legacy unrestricted dispatch must not acquire a new road network');
});
