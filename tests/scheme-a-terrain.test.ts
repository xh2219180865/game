import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {drawTerrain} from '../src/render/terrain.ts';
import {loadArt,type ArtImage} from '../src/render/assets.ts';

type Command={op:string;args:unknown[];fill:string;stroke:string;clipped:boolean};
function canvas(failImage=false){
  let state={fillStyle:'#123456',strokeStyle:'#654321',lineWidth:9,globalAlpha:.72,clipped:false};
  const initial={...state},stack:typeof state[]=[],commands:Command[]=[];
  const record=(op:string)=>(...args:unknown[])=>{commands.push({op,args,fill:state.fillStyle,stroke:state.strokeStyle,clipped:state.clipped});};
  const ctx={
    get fillStyle(){return state.fillStyle;},set fillStyle(v:string){state.fillStyle=v;},
    get strokeStyle(){return state.strokeStyle;},set strokeStyle(v:string){state.strokeStyle=v;},
    get lineWidth(){return state.lineWidth;},set lineWidth(v:number){state.lineWidth=v;},
    get globalAlpha(){return state.globalAlpha;},set globalAlpha(v:number){state.globalAlpha=v;},
    save(){stack.push({...state});},restore(){assert.ok(stack.length);state=stack.pop()!;},
    clip(){state.clipped=true;},drawImage(...args:unknown[]){if(failImage)throw new Error('image decode failure');record('drawImage')(...args);},
    translate:record('translate'),scale:record('scale'),beginPath:record('beginPath'),rect:record('rect'),fillRect:record('fillRect'),moveTo:record('moveTo'),lineTo:record('lineTo'),
    ellipse:record('ellipse'),bezierCurveTo:record('bezierCurveTo'),quadraticCurveTo:record('quadraticCurveTo'),closePath:record('closePath'),fill:record('fill'),stroke:record('stroke'),
  } as unknown as CanvasRenderingContext2D;
  return{ctx,commands,check(){assert.deepEqual(state,initial);assert.equal(stack.length,0);}};
}

test('scheme A terrain: three original portrait PNGs are local production assets',()=>{
  const signatures=new Set<string>();
  for(const climate of ['plains','snow','desert']){
    const data=readFileSync(new URL(`../assets/art/a-terrain-${climate}.png`,import.meta.url));
    assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(data.readUInt32BE(16),1024);assert.equal(data.readUInt32BE(20),1536);
    signatures.add(data.subarray(-512).toString('hex'));
  }
  assert.equal(signatures.size,3);
});

test('courtyard terrain: missing-art fallback keeps three light climates and leaves central grass marks clear',()=>{
  const fills=new Set<string>();
  for(const [lesson,formal] of [['L01','A01'],['L02','A02'],['L03','A03']]){
    for(const width of [320,375,430]){
      const camps=Object.freeze([Object.freeze({x:width*.25,y:400}),Object.freeze({x:width*.75,y:110})]);
      const before=JSON.stringify(camps),p=canvas();drawTerrain(p.ctx,width,540,camps,formal!);p.check();
      const base=p.commands.find(c=>c.op==='fillRect')!.fill;fills.add(base);
      assert.ok([1,3,5].every(i=>parseInt(base.slice(i,i+2),16)>=160),'earth, snow and sand grounds remain light');
      assert.equal(JSON.stringify(camps),before);
      assert.ok(p.commands.filter(c=>['fillRect','fill','stroke','drawImage'].includes(c.op)).every(c=>c.clipped));
      assert.ok(p.commands.every(c=>c.args.filter(a=>typeof a==='number').every(Number.isFinite)));
      const l=canvas();drawTerrain(l.ctx,width,540,camps,lesson!);l.check();
      assert.equal(l.commands.find(c=>c.op==='fillRect')!.fill,base);
      // Identify the original grass brush by its palette and exact three-segment path;
      // pine branches and river ripples now have their own independent local paths.
      for(let i=0;i<p.commands.length;i++)if(p.commands[i]!.op==='stroke'){
        const segment=p.commands.slice(Math.max(0,i-7),i);
        if(!['#9DA991','#B1B7A1','#A3B2AC','#B8C4BC','#AFA58D','#C0B69F'].includes(p.commands[i]!.stroke))continue;
        assert.deepEqual(segment.map(c=>c.op),['beginPath','moveTo','lineTo','moveTo','lineTo','moveTo','lineTo']);
        const [x,y]=segment.find(c=>c.op==='moveTo')!.args as number[];
        assert.ok(x!+3<=width*.1||x!+3>=width*.9||y!-2<=54||y!-2>=486);
      }
    }
  }
  assert.equal(fills.size,3);
});

test('scheme A terrain: decoded and failed images preserve caller paint state and never change map input',async()=>{
  await loadArt(()=>{
    let src='';const image:ArtImage={width:1024,height:1536,onload:null,onerror:null,
      get src(){return src;},set src(value:string){src=value;image.onload?.call(image as HTMLImageElement,new Event('load'));},
    };return image;
  });
  const camps=Object.freeze([Object.freeze({x:90,y:180})]);
  for(const id of ['A01','A02','A03']){
    const ready=canvas();drawTerrain(ready.ctx,375,540,camps,id);ready.check();
    assert.equal(ready.commands.filter(c=>c.op==='drawImage').length,1);assert.equal(ready.commands.filter(c=>c.op==='fillRect').length,1,'existing landscape pigments sit over a warm grey earth base');
    const failed=canvas(true);drawTerrain(failed.ctx,375,540,camps,id);failed.check();
    assert.ok(failed.commands.some(c=>c.op==='fillRect'),'failed art immediately has readable fallback');
    assert.deepEqual(camps,[{x:90,y:180}]);
  }
  const untouched=new Proxy({},{get(){throw new Error('invalid viewport touched canvas');}}) as CanvasRenderingContext2D;
  for(const [w,h]of [[NaN,540],[375,Infinity],[0,540],[375,-1]])drawTerrain(untouched,w!,h!,camps,'A01');
});
