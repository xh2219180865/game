import test from 'node:test';
import assert from 'node:assert/strict';
import { drawTerrain } from '../src/render/terrain.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';

test('painted terrain: all six maps use stable environments without changing geometry or caller state',async()=>{
  await loadArt(()=>{
    let source='';
    const image:ArtImage={width:1024,height:1536,onload:null,onerror:null,
      get src(){return source;},set src(value:string){source=value;image.onload?.call(image as HTMLImageElement,new Event('load'));},
    };return image;
  });
  for(const [mapId,environment] of [['L01','plains'],['A01','plains'],['L02','snow'],['A02','snow'],['L03','desert'],['A03','desert'],['unknown','plains']]){
    for(const [width,height] of [[280,380],[320,430],[375,540],[430,660]]){
      const draws:unknown[][]=[],rectangles:number[][]=[];
      let state:Record<string,unknown>={globalAlpha:.65,fillStyle:'#112233',clipped:false,tx:0,ty:0,sx:1,sy:1};
      const initial={...state},stack:typeof state[]=[];
      const ctx=new Proxy({}, {get(_t,key){
        if(key in state)return state[String(key)];
        return(...args:unknown[])=>{
          for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v));
          if(key==='save')stack.push({...state});
          if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
          if(key==='translate'){state.tx=Number(state.tx)+Number(args[0])*Number(state.sx);state.ty=Number(state.ty)+Number(args[1])*Number(state.sy);}
          if(key==='scale'){state.sx=Number(state.sx)*Number(args[0]);state.sy=Number(state.sy)*Number(args[1]);}
          if(key==='rect')rectangles.push(args as number[]);
          if(key==='clip')state.clipped=true;
          if(key==='drawImage'){assert.ok(state.clipped);assert.equal(state.globalAlpha,.65*(mapId==='A01'?.86:.38),'A01 uses rich soil texture; other maps retain a pigment layer');draws.push(args);}
          if(key==='fill'||key==='stroke')assert.ok(state.clipped,'scenery retains the battlefield clip');
        };
      },set(_t,key,value){state[String(key)]=value;return true;}}) as CanvasRenderingContext2D;
      const camps=Object.freeze([Object.freeze({x:75,y:110}),Object.freeze({x:285,y:430})]);
      const before=JSON.stringify(camps);
      drawTerrain(ctx,width!,height!,camps,mapId!);
      assert.equal(draws.length,1);assert.equal((draws[0]![0] as ArtImage).src,environment==='plains'?'assets/art/warfront-ground.jpg':`assets/art/a-terrain-${environment}.jpg`);
      assert.deepEqual(draws[0]!.slice(5),[0,0,width,height]);
      assert.deepEqual(rectangles[0],[0,0,width,height]);
      assert.ok(rectangles.slice(1).every(r=>r[0]===0&&r[1]===0&&r[2]===32&&r[3]===40),'each added scenery vignette has its own local clip');
      assert.equal(stack.length,0);assert.deepEqual(state,initial);
      assert.equal(ctx.globalAlpha,.65);assert.equal(ctx.fillStyle,'#112233');assert.equal(JSON.stringify(camps),before);
      const previous=draws[0]!.slice();drawTerrain(ctx,width!,height!,camps,mapId!);assert.deepEqual(draws[1],previous);
    }
  }
});

test('painted terrain: invalid viewport never touches the canvas even after assets are ready',()=>{
  const ctx=new Proxy({}, {get(){throw new Error('invalid viewport accessed canvas');}}) as CanvasRenderingContext2D;
  for(const [width,height] of [[0,400],[-1,400],[NaN,400],[375,Infinity],[375,0]])drawTerrain(ctx,width!,height!,[],'A02');
});
