import test from 'node:test';
import assert from 'node:assert/strict';
import { drawCampArchitecture } from '../src/render/camp-architecture.ts';
import { loadArt, type ArtImage } from '../src/render/assets.ts';
import type { CampType } from '../src/core/types.ts';

const kinds=['barracks','archery','relay','fort'] as const;
type Call={op:string;args:unknown[];fill:unknown;alpha:unknown};
function drawing(failImage=false){
  const calls:Call[]=[],initial={globalAlpha:.35,fillStyle:'pink',strokeStyle:'cyan',lineWidth:4,lineCap:'butt',lineJoin:'miter'};
  let state:Record<string,unknown>={...initial};const stack:Record<string,unknown>[]=[];
  const ctx=new Proxy({}, {get(_t,key){if(key in state)return state[String(key)];return(...args:unknown[])=>{
    calls.push({op:String(key),args,fill:state.fillStyle,alpha:state.globalAlpha});
    for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));
    if(key==='save')stack.push({...state});
    if(key==='restore'){assert.ok(stack.length);state=stack.pop()!;}
    if(key==='drawImage'&&failImage)throw Error('image unavailable');
  };},set(_t,key,value){state[String(key)]=value;return true;}}) as CanvasRenderingContext2D;
  return {ctx,calls,balanced(){assert.equal(stack.length,0);assert.deepEqual(state,initial);}};
}
async function loaded(){
  await loadArt(()=>{
    const image={width:1536,height:1024,onload:null,onerror:null} as unknown as ArtImage;
    Object.defineProperty(image,'src',{set(){queueMicrotask(()=>image.onload?.(new Event('load')));}});return image;
  });
}

for(const type of kinds)test(`${type} grows from open camp to a court and full-height twin towers without relying on text`,async()=>{
  await loaded();
  for(const size of [14,28,42]){
    const widths:number[]=[],topEdges:number[]=[];
    for(const tier of [1,2,3]){
      const d=drawing();drawCampArchitecture(d.ctx,80,90,size,type,tier,'P');d.balanced();
      assert.deepEqual(d.calls.find(c=>c.op==='translate')?.args,[80,90]);
      assert.deepEqual(d.calls.find(c=>c.op==='scale')?.args,[size/28,size/28]);
      assert.deepEqual(d.calls.find(c=>c.op==='rect')?.args,[-33,-34,66,56]);
      const images=d.calls.filter(c=>c.op==='drawImage');assert.equal(images.length,type!=='barracks'&&tier>1?2:1);
      const [x,y,w,h]=images[0]!.args.slice(5) as number[];
      assert.ok(x!>=-33&&x!+w!<=33);assert.ok(y!>=-34&&y!+h!<=22+1e-10);
      assert.ok(Math.abs(x!+w!/2)<1e-10&&Math.abs(y!+h!-22)<1e-10);
      widths.push(w!);
      topEdges.push(Math.min(...images.map(c=>Number(c.args[6]))));
      assert.ok(!d.calls.some(c=>c.op==='stroke'||c.op==='fillRect'),'normal artwork never adds flat Canvas pillars');
      assert.ok(d.calls.some(c=>c.op==='fill'&&Number(c.alpha)<.35),'roof colour is translucent over the painted tiles');
      if(tier>1&&type!=='barracks'){
        const [fx,fy,fw,fh]=images[1]!.args.slice(5) as number[];
        assert.ok(fw!<w!-10,'forecourt leaves the two painted side towers visible');
        assert.ok(fx!>=-33&&fx!+fw!<=33&&fy!>=-34&&fy!+fh!<=22+1e-10);
        assert.ok(Math.abs(fy!+fh!-22)<1e-10,'both layers meet the same ground');
      }
      assert.ok(!d.calls.some(c=>/Text/.test(c.op)));
      const other=drawing();drawCampArchitecture(other.ctx,80,90,size,type,tier,'E1');other.balanced();
      assert.deepEqual(other.calls.map(c=>[c.op,c.args]),d.calls.map(c=>[c.op,c.args]),'ownership changes colour without changing tier geometry');
      assert.notDeepEqual(other.calls.filter(c=>c.op==='fill'),d.calls.filter(c=>c.op==='fill'));
    }
    assert.ok(widths[1]!>widths[0]!&&widths[2]!>widths[1]!);
    assert.ok(topEdges[2]!<topEdges[0]!-10,'fortress adds both height and width to the starting camp');
  }
});

test('all factions use distinct roof colours without compositing across map pixels or adding flags',async()=>{
  await loaded();
  for(const type of kinds)for(const tier of [1,2,3]){
    const colours=new Set<unknown>();
    for(const owner of ['P','E1','E2','E3',null] as const){
      const d=drawing();drawCampArchitecture(d.ctx,0,0,28,type,tier,owner);d.balanced();
      const fills=d.calls.filter(c=>c.op==='fill');assert.ok(fills.length);colours.add(fills[0]!.fill);
      assert.ok(fills.every(c=>Number(c.alpha)>0&&Number(c.alpha)<.35));
      assert.ok(!d.calls.some(c=>['fillRect','stroke','filter','createImageData','getImageData','putImageData'].includes(c.op)));
      for(const c of d.calls.filter(c=>c.op==='moveTo'||c.op==='lineTo')){
        const [x,y]=c.args as number[];assert.ok(x!>=-33&&x!<=33&&y!>=-34&&y!<=22);
      }
    }
    assert.equal(colours.size,5,`${type}/${tier} has five distinct ownership colours`);
    const legacy=drawing(),enemy=drawing();drawCampArchitecture(legacy.ctx,0,0,28,type,tier,'E');drawCampArchitecture(enemy.ctx,0,0,28,type,tier,'E1');
    assert.deepEqual(legacy.calls,enemy.calls,'legacy enemy uses red as in the current enemy faction');
  }
});

test('raster failure renders the complete clipped Canvas fallback on the same frame',async()=>{
  const geometries=new Set<string>();
  for(const type of kinds)for(const tier of [1,2,3]){
    await loaded();const d=drawing(true);drawCampArchitecture(d.ctx,0,0,28,type,tier,'P');d.balanced();
    assert.equal(d.calls.filter(c=>c.op==='drawImage').length,type==='barracks'||tier>1?2:1);
    assert.ok(d.calls.some(c=>c.op==='fillRect'));
    assert.ok(!d.calls.some(c=>/Text/.test(c.op)));
    const second=drawing();drawCampArchitecture(second.ctx,0,0,28,type,tier,'P');second.balanced();
    assert.ok(!second.calls.some(c=>c.op==='drawImage'));
    geometries.add(JSON.stringify(second.calls));
  }
  assert.equal(geometries.size,12);
});

test('neutral painted camps use cool grey roofs and local stone washes; capture clears both immediately',async()=>{
  await loaded();
  for(const type of kinds)for(const tier of [1,2,3]){
    const d=drawing();drawCampArchitecture(d.ctx,0,0,28,type,tier,null);d.balanced();
    const roofs=d.calls.filter(c=>c.op==='fill'&&c.fill==='#858B90');
    const walls=d.calls.filter(c=>c.op==='fill'&&c.fill==='#A5A8AA');
    assert.ok(roofs.length>0&&walls.length>0,`${type}/${tier} has both grey tiles and stone`);
    assert.ok(roofs.every(c=>Number(c.alpha)<=.35*.78)&&walls.every(c=>Number(c.alpha)<=.35*.42),'original painted texture remains under translucent washes');
    assert.ok(!d.calls.some(c=>c.op==='fillRect'),'neutral stone follows small faces, not a rectangular tint over the whole image');
    const start=d.calls.length;drawCampArchitecture(d.ctx,0,0,28,type,tier,'P');d.balanced();
    const captured=d.calls.slice(start),fresh=drawing();drawCampArchitecture(fresh.ctx,0,0,28,type,tier,'P');fresh.balanced();
    assert.deepEqual(captured,fresh.calls,'the next render uses the new owner without cached grey overlays');
    assert.ok(captured.some(c=>c.op==='fill'&&c.fill==='#49A28D'));
    assert.ok(!captured.some(c=>c.op==='fill'&&['#858B90','#A5A8AA'].includes(String(c.fill))));
  }
});

test('neutral architecture keeps grey court and tower walls when all images fail',async()=>{
  for(const type of kinds)for(const tier of [1,2,3]){
    await loaded();const d=drawing(true);drawCampArchitecture(d.ctx,0,0,28,type,tier,null);d.balanced();
    assert.ok(d.calls.some(c=>c.op==='fill'&&c.fill==='#7D858D'),'fallback main roof is grey');
    assert.ok(d.calls.some(c=>['fill','fillRect'].includes(c.op)&&c.fill==='#D9DCDE'),'fallback walls are grey');
    if(tier>1)assert.ok(d.calls.some(c=>c.op==='fill'&&c.fill==='#68727B'),'outer court roofs share the neutral palette');
  }
});

test('valid tower aim keeps its world direction and length at each tier, with assets or fallback',async()=>{
  for(const fail of [false,true])for(const tier of [1,2,3])for(const aim of [0,.37,Math.PI/2,Math.PI,-Math.PI/2]){
    await loaded();const d=drawing(fail);drawCampArchitecture(d.ctx,80,90,28,'fort',tier,'P',aim);d.balanced();
    const end=d.calls.filter(c=>c.op==='lineTo').at(-1)!.args as number[];
    assert.ok(Math.abs(end[0]!-Math.cos(aim)*Math.hypot(24,5))<1e-10);
    assert.ok(Math.abs(end[1]!-Math.sin(aim)*Math.hypot(24,5))<1e-10);
    assert.equal(d.calls.filter((c,i)=>c.op==='lineTo'&&d.calls[i-1]?.op==='moveTo'&&d.calls[i-1]!.args.every(value=>value===0)).length,1,'fallback does not paint a second, scaled aim shaft');
  }
});

test('fallback tower has one default shaft for absent and non-finite aim',async()=>{
  for(const tier of [1,2,3])for(const aim of [undefined,NaN,Infinity,-Infinity]){
    await loaded();const d=drawing(true);drawCampArchitecture(d.ctx,0,0,28,'fort',tier,'P',aim);d.balanced();
    const shafts=d.calls.filter((c,i)=>c.op==='lineTo'&&d.calls[i-1]?.op==='moveTo'&&d.calls[i-1]!.args.every(value=>value===0));
    assert.equal(shafts.length,1);const [x,y]=shafts[0]!.args as number[];
    assert.ok(Math.abs(x!-24)<1e-10&&Math.abs(y!+5)<1e-10);
  }
});

test('invalid positions, sizes and types do not partially paint; unsupported tiers clamp deterministically',async()=>{
  await loaded();
  for(const [x,y,size]of [[NaN,0,28],[0,Infinity,28],[0,0,0],[0,0,-1],[0,0,Infinity]]){
    const d=drawing();drawCampArchitecture(d.ctx,x!,y!,size!,'fort',1,'P');assert.deepEqual(d.calls,[]);d.balanced();
  }
  const invalid=drawing();drawCampArchitecture(invalid.ctx,0,0,28,'unknown' as CampType,1,'P');assert.deepEqual(invalid.calls,[]);
  for(const [tier,expected]of [[NaN,1],[Infinity,1],[-1,1],[1.9,1],[4,3]]){
    const a=drawing(),b=drawing();drawCampArchitecture(a.ctx,0,0,28,'archery',tier!,'P');drawCampArchitecture(b.ctx,0,0,28,'archery',expected!,'P');
    a.balanced();b.balanced();assert.deepEqual(a.calls,b.calls);
  }
});
