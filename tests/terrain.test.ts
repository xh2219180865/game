import test from 'node:test';
import assert from 'node:assert/strict';
import {planBattlefieldScenery} from '../src/render/battlefield-scenery.ts';
import {drawTerrain} from '../src/render/terrain.ts';

type Command={op:string;args:number[];color:string;clipped:boolean};
function probe(){
  let state={fillStyle:'#123456',strokeStyle:'#abcdef',lineWidth:7,globalAlpha:1,clipped:false};
  const initial={...state},stack:typeof state[]=[],commands:Command[]=[];
  const record=(op:string)=>(...args:number[])=>commands.push({op,args,color:state.fillStyle,clipped:state.clipped});
  const ctx={
    get fillStyle(){return state.fillStyle;},set fillStyle(v:string){state.fillStyle=v;},
    get strokeStyle(){return state.strokeStyle;},set strokeStyle(v:string){state.strokeStyle=v;},
    get lineWidth(){return state.lineWidth;},set lineWidth(v:number){state.lineWidth=v;},
    get globalAlpha(){return state.globalAlpha;},set globalAlpha(v:number){state.globalAlpha=v;},
    save(){stack.push({...state});},restore(){assert.ok(stack.length);state=stack.pop()!;},
    clip(){state.clipped=true;},
    translate:record('translate'),scale:record('scale'),beginPath:record('beginPath'),rect:record('rect'),fillRect:record('fillRect'),moveTo:record('moveTo'),lineTo:record('lineTo'),
    bezierCurveTo:record('bezierCurveTo'),quadraticCurveTo:record('quadraticCurveTo'),ellipse:record('ellipse'),closePath:record('closePath'),fill:record('fill'),stroke:record('stroke'),
  } as unknown as CanvasRenderingContext2D;
  return{ctx,commands,check(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}

test('terrain: stable drawing clips every painted layer and restores caller state without mutating camp coordinates',()=>{
  for(const [width,height]of [[280,380],[320,430],[375,540],[430,660]]){
    const camps=Object.freeze([Object.freeze({x:width*.2,y:height*.25}),Object.freeze({x:width*.8,y:height*.7}),Object.freeze({x:0,y:0})]);
    const before=JSON.stringify(camps),first=probe(),second=probe();
    drawTerrain(first.ctx,width!,height!,camps,'A01');drawTerrain(second.ctx,width!,height!,camps,'A01');
    first.check();second.check();assert.deepEqual(first.commands,second.commands);assert.equal(JSON.stringify(camps),before);
    assert.deepEqual(first.commands.find(c=>c.op==='rect')?.args,[0,0,width,height]);
    assert.ok(first.commands.filter(c=>['fill','stroke','fillRect'].includes(c.op)).every(c=>c.clipped));
    assert.ok(first.commands.every(c=>c.args.every(Number.isFinite)));
    const colors=new Set(first.commands.filter(c=>c.op==='fill'||c.op==='fillRect').map(c=>c.color));
    for(const color of ['#D6D1BE','#C8CBB7','#DEDACE','#CDD0BE','#C3BEAA'])assert.ok(colors.has(color),`missing terrain colour plane ${color}`);
    assert.ok(first.commands.length<1800,'fixed scenery budget includes seven needle clusters per pine and detailed river banks, independent of pixel resolution');
    for(const p of camps)assert.ok(first.commands.some(c=>c.op==='ellipse'&&c.color==='#C3BEAA'&&c.args[0]===p.x-1&&c.args[1]===p.y+5),'every original camp receives its soil court');
  }
});

test('terrain: dimensional scenery remains at the edge and respects the camp exclusion area',()=>{
  const width=375,height=540,empty=planBattlefieldScenery(width,height,[]);
  assert.ok(empty.filter(p=>p.kind==='pine').length>=6);
  for(const p of empty)assert.ok(p.x+p.width<=width*.2||p.x>=width*.8,'scenery keeps the central battlefield open');
  const first=empty[0]!,camp={x:first.x+first.width/2,y:first.y+first.height/2};
  const occupied=planBattlefieldScenery(width,height,[camp]);assert.ok(!occupied.some(p=>p.kind===first.kind&&p.x===first.x&&p.y===first.y),'occupied decoration is removed even if nearby smaller scenery becomes available');
  for(const p of occupied)assert.ok(Math.hypot(Math.max(p.x-camp.x,0,camp.x-p.x-p.width),Math.max(p.y-camp.y,0,camp.y-p.y-p.height))>=46);
  const snow=probe(),sand=probe();drawTerrain(snow.ctx,width,height,[],'A02');drawTerrain(sand.ctx,width,height,[],'A03');
  assert.notDeepEqual(snow.commands,sand.commands,'each terrain uses its own scenery palette');
});

test('terrain: invalid viewports are no-ops and invalid camp coordinates cannot poison drawing',()=>{
  for(const [width,height]of [[0,400],[-1,400],[375,0],[NaN,400],[375,Infinity]]){
    const p=probe();drawTerrain(p.ctx,width!,height!,[],'A01');p.check();assert.equal(p.commands.length,0);
  }
  const valid=probe(),invalid=probe();drawTerrain(valid.ctx,320,430,[],'A01');drawTerrain(invalid.ctx,320,430,[{x:NaN,y:3},{x:4,y:Infinity}],'A01');
  assert.deepEqual(invalid.commands,valid.commands);invalid.check();
});
