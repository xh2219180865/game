import test from 'node:test';
import assert from 'node:assert/strict';
import { StableArmyLabels, placeArmyLabels, type Rect } from '../src/render/battle-presentation.ts';

const bounds={x:0,y:0,w:375,h:600};
const army=(id='a',x=150,y=200,width=36)=>({id,point:{x,y},width});
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
function nearby(r:Rect,p:{x:number;y:number}){
  assert.ok(Math.hypot(Math.max(r.x-p.x-10,0,p.x-10-r.x-r.w),Math.max(r.y-p.y-9,0,p.y-27-r.y-r.h))<=24);
}

test('continuous army motion preserves its local offset without switching sides',()=>{
  const labels=new StableArmyLabels(),first=labels.layout([army()],bounds,[]).get('a')!;
  for(let step=1;step<=100;step++){
    const item=army('a',150+step*.5,200+step*.7),r=labels.layout([item],bounds,[]).get('a')!;
    assert.ok(Math.abs(r.x-item.point.x-(first.x-150))<1e-8);
    assert.ok(Math.abs(r.y-item.point.y-(first.y-200))<1e-8);
    nearby(r,item.point);
  }
});

test('digit width changes retain the near edge on either side of the army',()=>{
  for(const left of [false,true]){
    const labels=new StableArmyLabels(),obstacles=left?[{x:163,y:150,w:60,h:70}]:[];
    const first=labels.layout([army()],bounds,obstacles).get('a')!;
    assert.equal(first.x<150,left);
    for(const width of [44,60,28,36]){
      const r=labels.layout([army('a',150,200,width)],bounds,[]).get('a')!;
      assert.equal(r.w,width);assert.equal(r.y,first.y);
      assert.equal(left?r.x+r.w:r.x,left?first.x+first.w:first.x);
    }
  }
});

test('new army priority cannot unnecessarily displace an already visible label',()=>{
  const labels=new StableArmyLabels(),original=army(),first=labels.layout([original],bounds,[]).get('a')!;
  const newcomer=army('new',150,230);
  const result=labels.layout([newcomer,original],bounds,[]);
  assert.deepEqual(result.get('a'),first);
  assert.ok(!result.get('new')||!overlap(result.get('new')!,first));
});

test('new obstacles trigger a nearby detour, whose side remains stable when obstruction clears',()=>{
  const labels=new StableArmyLabels(),item=army(),initial=labels.layout([item],bounds,[]).get('a')!;
  const blocked=labels.layout([item],bounds,[initial]).get('a')!;
  assert.notDeepEqual(blocked,initial);assert.ok(!overlap(blocked,initial));nearby(blocked,item.point);
  assert.deepEqual(labels.layout([item],bounds,[]).get('a'),blocked);
});

test('a nearby city permits a count above the leader’s visible helmet when side space is blocked',()=>{
  const labels=new StableArmyLabels(),item=army(),city={x:75,y:165,w:160,h:150};
  const visible=labels.layout([item],bounds,[city]).get('a')!;
  assert.ok(visible);assert.ok(visible.y+visible.h<=city.y-3);assert.ok(!overlap(visible,city));nearby(visible,item.point);
  assert.deepEqual(labels.layout([item],bounds,[]).get('a'),visible,'the local overhead count remains stable when the camp clears');
});

test('ordinary tower approach finds the narrow local roof gap, including collision padding at the side edge',()=>{
  const labels=new StableArmyLabels(),obstacles=[
    {x:48.107,y:229.346,w:66,h:70},{x:128,y:242,w:66,h:70},{x:146.077,y:127.867,w:66,h:70},
  ];
  for(const point of [{x:130.325,y:271.300},{x:133.065,y:271.734},{x:135.786,y:272.165}]){
    const item={id:'approaching',point,width:40},rect=labels.layout([item],bounds,obstacles).get(item.id);
    assert.ok(rect,'one ordinary army must retain its count between nearby camp avoidance boxes');
    for(const obstacle of obstacles)assert.ok(!overlap(rect,obstacle));
    nearby(rect,point);
    assert.deepEqual(labels.layout([item],bounds,obstacles).get(item.id),rect,'redrawing the same rules position preserves the label');
  }
});

test('labels stay inside small viewport edges and never move to remote board space',()=>{
  for(const size of [{x:8,y:52,w:304,h:420},{x:0,y:0,w:430,h:740}]){
    for(const point of [{x:size.x+4,y:size.y+4},{x:size.x+size.w-4,y:size.y+4},
      {x:size.x+4,y:size.y+size.h-4},{x:size.x+size.w-4,y:size.y+size.h-4}]){
      const labels=new StableArmyLabels(),item={id:'edge',point,width:44},result=labels.layout([item],size,[]);
      assert.ok(result.size,'a corner has room for a label beside the army');
      const r=result.get('edge')!;
      assert.ok(r.x>=size.x&&r.y>=size.y&&r.x+r.w<=size.x+size.w&&r.y+r.h<=size.y+size.h);
      nearby(r,point);
    }
  }
  const labels=new StableArmyLabels(),item=army();
  assert.equal(labels.layout([item],bounds,[{x:80,y:110,w:160,h:180}]).size,0,'empty distant space must not attract this label');
  assert.equal(labels.layout([army('outside',-500,-500)],bounds,[]).size,0);
  for(const width of [0,-1,NaN,Infinity,400])assert.equal(labels.layout([army('invalid',150,200,width)],bounds,[]).size,0);
  for(const value of [NaN,Infinity,-Infinity]){
    assert.equal(labels.layout([army('invalid',value,200)],bounds,[]).size,0);
    assert.equal(labels.layout([army()],{...bounds,y:value},[]).size,0);
  }
});

test('leaving a camp restores a nearby banner without covering the camp garrison or a neighboring army',()=>{
  const labels=new StableArmyLabels(),camp={x:117,y:165,w:66,h:70};
  let visible=0;
  for(let distance=0;distance<=90;distance+=3){
    const items=[army('leaving',150+distance,200),army('neighbor',210,240)];
    const result=labels.layout(items,bounds,[camp]);
    for(const item of items){const r=result.get(item.id);if(r){assert.ok(!overlap(r,camp));nearby(r,item.point);}}
    if(result.has('leaving'))visible++;
    if(result.size===2)assert.ok(!overlap(result.get('leaving')!,result.get('neighbor')!));
  }
  assert.ok(visible>20,'the army regains its count promptly once the camp no longer occupies nearby space');
});

test('departure cleans offsets and reset creates a fresh placement for reused IDs',()=>{
  for(const clear of [(l:StableArmyLabels)=>l.reset(),(l:StableArmyLabels)=>l.layout([],bounds,[])]){
    const labels=new StableArmyLabels(),item=army(),rightBlock={x:163,y:180,w:60,h:40};
    const left=labels.layout([item],bounds,[{x:125,y:145,w:55,h:29},rightBlock]).get('a')!;assert.ok(left.x<150);
    assert.deepEqual(labels.layout([item],bounds,[]).get('a'),left);
    clear(labels);const fresh=labels.layout([item],bounds,[]).get('a')!;
    assert.equal(fresh.x,item.point.x+14);assert.equal(fresh.y,item.point.y-26,'new flags stay beside the leader’s shoulder');
  }
});

test('crowded armies retain separate IDs and non-overlapping local labels with bounded cache',()=>{
  const labels=new StableArmyLabels();
  for(let frame=0;frame<20;frame++){
    const items=Array.from({length:256},(_,i)=>army(`${frame}-${i}`,60+(i%16)*16,100+Math.floor(i/16)*16));
    const result=labels.layout(items,bounds,[]),rects=[...result.values()];
    assert.ok(result.size<items.length,'crowding omits labels instead of merging counts or scanning the map');
    for(const [id,r] of result){const item=items.find(i=>i.id===id)!;assert.equal(r.w,item.width);nearby(r,item.point);}
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.ok(!overlap(rects[i]!,rects[j]!));
    const cache=Object.getOwnPropertyDescriptor(labels,'offsets')!.value as Map<string,unknown>;
    assert.ok(cache.size<=items.length);assert.ok([...cache.keys()].every(id=>id.startsWith(`${frame}-`)));
  }
  labels.layout([],bounds,[]);
  assert.equal((Object.getOwnPropertyDescriptor(labels,'offsets')!.value as Map<string,unknown>).size,0);
});

test('existing stateless placement remains available for legacy callers',()=>{
  assert.ok(placeArmyLabels([army()],bounds,[]).has('a'));
});

test('a narrow-screen volley receipt uses free roof-side space before drifting beneath another front',()=>{
  const target={x:240.889,y:152.741},city={x:208.889,y:118.741,w:66,h:70};
  const armyCount={x:175,y:94,w:40,h:24};
  const result=placeArmyLabels([{id:'volley',point:target,width:62}],{x:8,y:68,w:304,h:416},[city,armyCount],true);
  const r=result.get('volley')!;assert.ok(r);
  assert.ok(r.y+r.h<=city.y-3,'a free upper corner is preferable to a remote lower callout');
  assert.ok(r.x>=8&&r.x+r.w<=312);assert.ok(!overlap(r,city)&&!overlap(r,armyCount));
});
