import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOrnament } from '../src/render/art.ts';

type Command={op:string;args:number[]};
type Stroke={commands:Command[];color:string;width:number};
function draw(w:number,h:number,architecture?:boolean){
  const strokes:Stroke[]=[],initial={strokeStyle:'#123456',lineWidth:7,globalAlpha:.6,fillStyle:'#654321'};
  let state={...initial},path:Command[]=[];const stack:typeof state[]=[];
  const ctx={
    get strokeStyle(){return state.strokeStyle;},set strokeStyle(v:string){state.strokeStyle=v;},
    get lineWidth(){return state.lineWidth;},set lineWidth(v:number){state.lineWidth=v;},
    save(){stack.push({...state});},restore(){assert.ok(stack.length);state=stack.pop()!;},
    beginPath(){path=[];},moveTo(...args:number[]){path.push({op:'moveTo',args});},lineTo(...args:number[]){path.push({op:'lineTo',args});},
    quadraticCurveTo(...args:number[]){path.push({op:'quadraticCurveTo',args});},closePath(){path.push({op:'closePath',args:[]});},
    stroke(){strokes.push({commands:structuredClone(path),color:state.strokeStyle,width:state.lineWidth});},
    strokeRect(x:number,y:number,width:number,height:number){strokes.push({commands:[{op:'moveTo',args:[x,y]},{op:'lineTo',args:[x+width,y]},{op:'lineTo',args:[x+width,y+height]},{op:'lineTo',args:[x,y+height]},{op:'closePath',args:[]}],color:state.strokeStyle,width:state.lineWidth});},
  } as CanvasRenderingContext2D;
  pageOrnament(ctx,w,h,architecture);assert.equal(stack.length,0);assert.deepEqual(state,initial);return strokes;
}
const sizes=[[280,508],[320,568],[375,812],[430,932]] as const;

test('G2.1.1: optional architecture preserves the exact original four corner drawing',()=>{
  for(const [w,h]of sizes){
    const expected=[8,w-8].map(x=>({color:'#D7C8AA',width:1,commands:[
      {op:'moveTo',args:[x,18]},{op:'lineTo',args:[x,8]},{op:'lineTo',args:[x+(x<w/2?22:-22),8]},
      {op:'moveTo',args:[x,h-18]},{op:'lineTo',args:[x,h-8]},{op:'lineTo',args:[x+(x<w/2?22:-22),h-8]},
    ]}));
    assert.deepEqual(draw(w,h),expected);assert.deepEqual(draw(w,h,false),expected);
  }
});

test('G2.1.1: architecture adds a curved roof ridge, roof tiles and staggered wall joints only inside the edge bands',()=>{
  for(const [w,h]of sizes){
    const original=draw(w,h),all=draw(w,h,true),extra=all.slice(original.length);assert.deepEqual(all.slice(0,original.length),original);assert.ok(extra.length>=3,'roof, tile lines and wall are additional components');
    const points=extra.flatMap(s=>s.commands.flatMap(c=>Array.from({length:c.args.length/2},(_,i)=>({x:c.args[i*2]!,y:c.args[i*2+1]!,half:s.width/2}))));
    assert.ok(points.length>16);for(const p of points){assert.ok(p.x-p.half>=0&&p.x+p.half<=w);assert.ok((p.y-p.half>=4&&p.y+p.half<=18)||(p.y-p.half>=h-18&&p.y+p.half<=h-4),`decoration leaves its edge band at ${p.x},${p.y}`);}
    const roof=extra.filter(s=>s.commands.some(c=>c.args[1]!==undefined&&c.args[1]!<h/2));assert.ok(roof.some(s=>s.commands.some(c=>c.op==='quadraticCurveTo')),'eaves use the existing curved roof language');
    assert.ok(roof.some(s=>s.commands.some(c=>c.op==='lineTo'&&c.args[1]===5)),'roof has a level ridge');
    const wall=extra.filter(s=>s.commands.some(c=>(c.args[1]??0)>h/2));assert.ok(wall.length>0);
    const joints=wall.flatMap(s=>s.commands.flatMap((c,i)=>c.op==='lineTo'&&s.commands[i-1]?.op==='moveTo'&&s.commands[i-1]!.args[0]===c.args[0]?[{x:c.args[0]!,from:s.commands[i-1]!.args[1]!,to:c.args[1]!}]:[]));
    const upper=joints.filter(j=>j.from===h-16&&j.to===h-11),lower=joints.filter(j=>j.from===h-11&&j.to===h-6);assert.ok(upper.length>=3&&lower.length>=3);assert.ok(upper.some(a=>!lower.some(z=>a.x===z.x)),'brick joints are staggered');
    assert.ok(extra.every(s=>s.width<=1&&['#BBC3B6','#D2C4A9'].includes(s.color)),'decoration uses thin low-contrast tile and wall lines');
  }
});
