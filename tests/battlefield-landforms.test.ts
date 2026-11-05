import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/core/battle.ts';
import { MAPS } from '../src/core/maps.ts';
import { battlefieldLandforms, drawBattlefieldBridges, drawBattlefieldLandforms, planBattlefieldLandforms } from '../src/render/battlefield-landforms.ts';
import type { SceneryPoint } from '../src/render/battlefield-scenery.ts';

function distance(p:SceneryPoint,a:SceneryPoint,b:SceneryPoint):number {
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function geometry(id:keyof typeof MAPS,width:number,height:number,top=16,bottom=16){
  const b=createBattle(id,{id:'geography',firstDragCompleted:true}),k=Math.min((width-16)/360,(height-top-bottom-124)/540);
  const boardTop=top+52,boardHeight=height-bottom-72-boardTop;
  const camps=b.camps.map(c=>({x:(width-360*k)/2+c.x*k,y:boardTop+(boardHeight-540*k)/2+c.y*k}));
  const routes=MAPS[id].roads.map(([a,z])=>({from:camps[b.camps.findIndex(c=>c.id===a)]!,to:camps[b.camps.findIndex(c=>c.id===z)]!}));
  return {b,camps,routes,height:height-bottom-72};
}
function riverDistance(p:SceneryPoint,points:readonly SceneryPoint[]):number {return Math.min(...points.slice(1).map((z,i)=>distance(p,points[i]!,z)));}

for(const [width,height]of [[280,508],[320,568],[375,812],[430,932]] as const)test(`landforms ${width}: safe camp footprints, road-aligned crossings, deterministic map geometry`,()=>{
  for(const id of Object.keys(MAPS) as (keyof typeof MAPS)[]){
    const g=geometry(id,width,height),before=JSON.stringify(g),plan=planBattlefieldLandforms(width,g.height,g.camps,g.routes,id);
    assert.deepEqual(plan,planBattlefieldLandforms(width,g.height,g.camps,g.routes,id));assert.equal(JSON.stringify(g),before);
    assert.ok(plan.mountains.length>0&&plan.mountains.length<=5,`${id} retains visible ridges`);
    if(plan.river){
      assert.ok(plan.river.points[0]!.x<0&&plan.river.points.at(-1)!.x>width,'river continues offscreen, no isolated strip');
      for(const c of g.camps)assert.ok(riverDistance(c,plan.river.points)>=43*plan.scale+plan.river.width/2+plan.river.bank-1e-6,'no camp becomes an island under its own garrison plate');
      assert.ok(plan.bridges.length>=1&&plan.bridges.length<=5);
      for(const bridge of plan.bridges){
        const route=g.routes[bridge.routeIndex]!;assert.ok(distance(bridge,route.from,route.to)<1e-6,'bridge must be on an actual route');
        assert.ok(riverDistance(bridge,plan.river.points)<1e-6,'bridge must cross actual water');
        assert.ok(Math.abs(Math.sin(bridge.angle-Math.atan2(route.to.y-route.from.y,route.to.x-route.from.x)))<1e-6);
      }
      for(const [i,route]of g.routes.entries())for(let t=0;t<=1;t+=.005){
        const p={x:route.from.x+(route.to.x-route.from.x)*t,y:route.from.y+(route.to.y-route.from.y)*t};
        if(riverDistance(p,plan.river.points)<plan.river.width/2+plan.river.bank)
          assert.ok(plan.bridges.some(bridge=>bridge.routeIndex===i&&Math.hypot(p.x-bridge.x,p.y-bridge.y)<=bridge.length/2+2*plan.scale),`${id} route ${i} has no unbridged water`);
      }
    }else assert.equal(plan.bridges.length,0);
    for(const mountain of plan.mountains){
      const l=mountain.x-mountain.width/2,r=mountain.x+mountain.width/2,t=mountain.y-mountain.height,z=mountain.y;
      for(const c of g.camps)assert.ok(Math.hypot(Math.max(l-c.x,0,c.x-r),Math.max(t-c.y,0,c.y-z))>=43*plan.scale-1e-6);
      for(const route of g.routes)for(let f=0;f<=1;f+=.01){const x=route.from.x+(route.to.x-route.from.x)*f,y=route.from.y+(route.to.y-route.from.y)*f;assert.ok(x<l-13*plan.scale||x>r+13*plan.scale||y<t-13*plan.scale||y>z+13*plan.scale,'ridge cannot block a valid dispatch corridor');}
    }
  }
});

test('landforms: A01 has a visible cross-board river in the regular battle viewport, with no hidden travel changes',()=>{
  const g=geometry('A01',375,812),before=JSON.stringify(g.b),p=planBattlefieldLandforms(375,g.height,g.camps,g.routes,'A01');
  assert.ok(p.river);assert.equal(p.bridges.length,3);assert.equal(JSON.stringify(g.b),before);
});

test('landforms: minimap supplies the same graph, and unsafe or unknown geometry fails closed',()=>{
  const map=MAPS.A01,width=335,height=180,k=Math.min((375-56)/360,height/540),x=(375-360*k)/2;
  const camps=map.camps.map(c=>({x:x+c.x*k-20,y:c.y*k})),routes=map.roads.map(([a,z])=>({from:camps[map.camps.findIndex(c=>c.id===a)]!,to:camps[map.camps.findIndex(c=>c.id===z)]!}));
  const p=planBattlefieldLandforms(width,height,camps,routes,map.id);assert.ok(p.mountains.length<=5);
  for(const [w,h]of [[NaN,400],[375,Infinity],[0,400],[100,100]])assert.equal(planBattlefieldLandforms(w!,h!,camps,routes,'A01').river,null);
  for(const point of [{x:NaN,y:0},{x:0,y:Infinity}])assert.deepEqual(planBattlefieldLandforms(375,540,[point],routes,'A01').mountains,[]);
  assert.equal(planBattlefieldLandforms(375,540,camps,[],'A01').river,null);
});

test('landforms: geometry cache does not retain ownership, troop counts, settings or clocks',()=>{
  const g=geometry('A03',375,812),a=battlefieldLandforms(375,g.height,g.camps,g.routes,'A03');
  g.b.gameMs=4000;g.b.camps[0]!.garrison=1;g.b.camps[0]!.owner=null;
  assert.equal(battlefieldLandforms(375,g.height,g.camps,g.routes,'A03'),a);
  assert.notEqual(battlefieldLandforms(375,g.height,g.camps.map(p=>({...p,y:p.y+1})),g.routes,'A03'),a);
});

test('landforms: layered drawings restore canvas state, use finite coordinates and never draw UI or consume random state',()=>{
  const g=geometry('A01',375,812),plan=planBattlefieldLandforms(375,g.height,g.camps,g.routes,'A01');
  let state:Record<string,unknown>={fillStyle:'red',strokeStyle:'blue',lineWidth:9,lineCap:'butt',lineJoin:'miter'},stack:typeof state[]=[],ops:string[]=[];const initial={...state};
  const ctx=new Proxy({}, {get(_t,key){if(key in state)return state[String(key)];return(...args:unknown[])=>{ops.push(String(key));for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg));if(key==='save')stack.push({...state});if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}};},set(_t,key,v){state[String(key)]=v;return true;}}) as CanvasRenderingContext2D;
  drawBattlefieldLandforms(ctx,plan,'A01');drawBattlefieldBridges(ctx,plan);assert.equal(stack.length,0);assert.deepEqual(state,initial);
  assert.ok(!ops.includes('fillText'));assert.ok(ops.length<1300,'bounded number of geography objects');
});
