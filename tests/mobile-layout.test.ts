import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCampPopover } from '../src/render/mobile-layout.ts';
import { MAPS } from '../src/core/maps.ts';

type Rect={x:number;y:number;w:number;h:number};
const overlap=(a:Rect,b:Rect):number=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const gap=(a:Rect,p:{x:number;y:number}):number=>Math.hypot(Math.max(a.x-p.x,0,p.x-a.x-a.w),Math.max(a.y-p.y,0,p.y-a.y-a.h));
function inBounds(card:Rect,bounds:Rect):void{
  assert.ok(Object.values(card).every(Number.isFinite));
  assert.ok(card.w>=0&&card.h>=0);
  assert.ok(card.x>=bounds.x&&card.y>=bounds.y&&card.x+card.w<=bounds.x+bounds.w+1e-8&&card.y+card.h<=bounds.y+bounds.h+1e-8,JSON.stringify({card,bounds}));
}

for(const [width,height,top,bottom] of [[320,568,0,0],[375,812,44,34],[430,932,60,34]]){
  test(`popover keeps every actual map source draggable at ${width}×${height}`,()=>{
    const k=Math.min((width!-16)/360,(height!-top!-bottom!-124)/540);
    const boardTop=top!+52,boardHeight=height!-bottom!-72-boardTop;
    const board={x:(width!-360*k)/2,y:boardTop+(boardHeight-540*k)/2};
    const bounds={x:8,y:boardTop,w:width!-16,h:boardHeight};
    for(const map of Object.values(MAPS))for(const camp of map.camps){
      const anchor={x:board.x+camp.x*k,y:board.y+camp.y*k};
      const obstacles=map.camps.filter(c=>c!==camp).map(c=>({x:board.x+c.x*k-34,y:board.y+c.y*k-34,w:68,h:68}));
      const card=placeCampPopover(anchor,bounds,obstacles,{w:Math.min(248,bounds.w-16),h:124});
      inBounds(card,bounds);
      assert.equal(card.h,124);
      assert.equal(overlap(card,{x:anchor.x-42,y:anchor.y-42,w:84,h:84}),0,`${map.id} ${camp.id}: source and 8 px gap must remain clear`);
    }
  });
}

test('equal free placements prefer directly above, then below at the upper edge',()=>{
  const bounds={x:10,y:20,w:400,h:500};
  assert.deepEqual(placeCampPopover({x:210,y:270},bounds,[],{w:200,h:100}),{x:110,y:128,w:200,h:100});
  assert.deepEqual(placeCampPopover({x:210,y:35},bounds,[],{w:200,h:100}),{x:110,y:77,w:200,h:100});
});

test('a local card takes priority over a distant free pocket while its source remains draggable',()=>{
  const bounds={x:0,y:0,w:320,h:500},anchor={x:160,y:250};
  const obstacles=[{x:0,y:90,w:320,h:115},{x:110,y:290,w:210,h:90}];
  const card=placeCampPopover(anchor,bounds,obstacles,{w:180,h:80});
  assert.equal(overlap(card,{x:118,y:208,w:84,h:84}),0);
  assert.ok(gap(card,anchor)<=52);
  assert.ok(obstacles.reduce((sum,r)=>sum+overlap(card,r),0)>0,'only other camps may be partially covered instead of detaching the upgrade action');
  inBounds(card,bounds);
});

test('crowded local candidates minimize covered area without covering the source',()=>{
  const anchor={x:160,y:250},bounds={x:0,y:0,w:320,h:500};
  const obstacles=[{x:0,y:0,w:320,h:130},{x:0,y:130,w:320,h:60},{x:0,y:290,w:320,h:210}];
  const size={w:248,h:124},card=placeCampPopover(anchor,bounds,obstacles,size);
  const covered=obstacles.reduce((sum,r)=>sum+overlap(card,r),0);
  assert.equal(overlap(card,{x:118,y:208,w:84,h:84}),0);
  let best=Infinity;
  // Independent pixel-grid oracle for this integer geometry.
  for(let x=0;x<=bounds.w-size.w;x++)for(let y=0;y<=bounds.h-size.h;y++){
    const candidate={x,y,...size};
    if(gap(candidate,anchor)<=52&&overlap(candidate,{x:118,y:208,w:84,h:84})===0)best=Math.min(best,obstacles.reduce((sum,r)=>sum+overlap(candidate,r),0));
  }
  assert.equal(covered,best);
  assert.ok(gap(card,anchor)<=52);
  assert.ok(covered>0,'a crowded map must not be treated as unobstructed');
});

test('changing size and frozen inputs remain deterministic and leave all inputs intact',()=>{
  const anchor=Object.freeze({x:315,y:490}),bounds=Object.freeze({x:8,y:52,w:304,h:444});
  const obstacles=Object.freeze([Object.freeze({x:120,y:240,w:68,h:68})]);
  for(const size of [Object.freeze({w:248,h:124}),Object.freeze({w:120,h:180})]){
    const first=placeCampPopover(anchor,bounds,obstacles,size);
    inBounds(first,bounds);
    assert.deepEqual(placeCampPopover(anchor,bounds,obstacles,size),first);
    assert.deepEqual({anchor,bounds,obstacles,size},JSON.parse(JSON.stringify({anchor,bounds,obstacles,size})));
  }
});

test('extreme small areas return the largest fitting card without claiming source clearance',()=>{
  const bounds={x:4,y:7,w:50,h:30};
  const card=placeCampPopover({x:29,y:22},bounds,[],{w:248,h:124});
  assert.deepEqual(card,bounds);
  assert.ok(overlap(card,{x:-13,y:-20,w:84,h:84})>0);
});

test('invalid and unbounded numeric values never produce invalid layout coordinates',()=>{
  for(const n of [NaN,Infinity,-Infinity,-100,0,Number.MAX_VALUE]){
    const card=placeCampPopover({x:n,y:n},{x:n,y:n,w:n,h:n},[{x:NaN,y:0,w:8,h:8}],{w:n,h:n});
    assert.ok(Object.values(card).every(Number.isFinite));
    assert.ok(card.w>=0&&card.h>=0);
  }
});
