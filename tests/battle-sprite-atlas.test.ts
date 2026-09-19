import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {BATTLE_SPRITE_CROPS} from '../src/render/battle-sprite-regions.ts';
import {ART_SOURCES} from '../src/render/assets.ts';
import {SAMPLE_SPRITE_CROPS} from '../src/render/sample-sprite-regions.ts';
import {TROOP_MOTION_CROPS} from '../src/render/troop-motion-regions.ts';

// Decode the shipped PNG, so a painted checkerboard or opaque RGBA cannot pass as transparency.
async function pixels(source:string=ART_SOURCES.battlefield){
  const file=await readFile(new URL(`../${source}`,import.meta.url));
  assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  let width=0,height=0;const chunks:Buffer[]=[];
  for(let p=8;p<file.length;){const n=file.readUInt32BE(p),kind=file.toString('ascii',p+4,p+8),data=file.subarray(p+8,p+8+n);
    if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6,'runtime sprite must be RGBA');assert.equal(data[12],0);}
    if(kind==='IDAT')chunks.push(data);p+=n+12;
  }
  const raw=inflateSync(Buffer.concat(chunks)),stride=width*4,out=Buffer.alloc(height*stride);
  assert.equal(raw.length,height*(stride+1));
  for(let y=0;y<height;y++)for(let x=0;x<stride;x++){
    const filter=raw[y*(stride+1)]!,a=x>=4?out[y*stride+x-4]!:0,b=y?out[(y-1)*stride+x]!:0,c=y&&x>=4?out[(y-1)*stride+x-4]!:0;
    const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predict=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
    assert.ok(filter<=4);out[y*stride+x]=(raw[y*(stride+1)+x+1]!+predict)&255;
  }
  return{width,height,out,bytes:file.length};
}

test('production battle atlas has real transparency, crisp alpha edges and fits its package budget',async()=>{
  const {width,height,out,bytes}=await pixels();assert.ok(width<=1024&&height<=1024);assert.ok(bytes<1.15*1024*1024);
  // Resampling retains near-opaque painted pixels (often alpha 254), not only exact 255.
  let clear=0,solid=0,edge=0;for(let p=3;p<out.length;p+=4){if(out[p]===0)clear++;else if(out[p]!>=240)solid++;else edge++;}
  assert.ok(clear>width*height*.3,'empty space must actually be transparent');assert.ok(solid>width*height*.2);assert.ok(edge>0,'retain antialiased edges');
});

test('sample atlas has actual transparent gutters and distinct lifted-foot silhouettes',async()=>{
  const {width,height,out,bytes}=await pixels(ART_SOURCES.sample);
  assert.ok(bytes<450*1024);let clear=0,solid=0;
  for(let p=3;p<out.length;p+=4){if(out[p]===0)clear++;if(out[p]!>=240)solid++;}
  assert.ok(clear>width*height*.5,'background is empty alpha, not a painted checkerboard');
  assert.ok(solid>width*height*.15,'artwork remains visibly opaque');
  const footprints:number[][]=[];
  for(let frame=0;frame<6;frame++){
    const [x,y,w,h]=SAMPLE_SPRITE_CROPS[`sample-infantry-${frame as 0|1|2|3|4|5}`],mask:number[]=[];
    for(let row=0;row<30;row++)for(let col=0;col<30;col++){
      const px=Math.floor((x+w*(col+.5)/30)*width),py=Math.floor((y+h*(.67+.33*(row+.5)/30))*height);
      mask.push(out[(py*width+px)*4+3]!>180?1:0);
    }
    footprints.push(mask);
  }
  assert.ok(footprints[0]!.filter((p,i)=>p!==footprints[1]![i]).length>50,'contact and raised-knee frames must move visible feet, not only shift the torso');
  assert.ok(new Set(footprints.map(mask=>mask.join(''))).size>=4,'the walk sequence contains multiple independent foot silhouettes');
});

test('all sixteen sprite windows are unique, finite and contain usable nontransparent artwork',async()=>{
  const {width,height,out}=await pixels(),entries=Object.entries(BATTLE_SPRITE_CROPS);assert.equal(entries.length,16);assert.equal(new Set(entries.map(([,r])=>JSON.stringify(r))).size,16);
  for(const [id,[x,y,w,h]]of entries){
    assert.ok([x,y,w,h].every(Number.isFinite));assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1&&y+h<=1,id);
    assert.ok(w*width>90&&h*height>90,`${id} retains enough source detail`);
    let opaque=0;for(let py=Math.ceil(y*height);py<Math.floor((y+h)*height);py++)for(let px=Math.ceil(x*width);px<Math.floor((x+w)*width);px++)if(out[(py*width+px)*4+3]!>200)opaque++;
    assert.ok(opaque>w*width*h*height*.2,`${id} is not an empty gutter`);
  }
});

test('new motion atlases have real alpha, clear crop boundaries and distinct feet in every strip',async()=>{
  const atlases={motion:await pixels(ART_SOURCES.motion),cavalry:await pixels(ART_SOURCES.cavalry)};
  for(const {width,height,out,bytes}of Object.values(atlases)){
    assert.ok(bytes<400*1024);let clear=0,solid=0;
    for(let p=3;p<out.length;p+=4){if(out[p]===0)clear++;if(out[p]!>=240)solid++;}
    assert.ok(clear>width*height*.5,'the background is transparent alpha, not a checkerboard');assert.ok(solid>width*height*.1);
  }
  for(const type of ['archer','cavalry','guard'] as const){
    const {width,height,out}=type==='cavalry'?atlases.cavalry:atlases.motion,masks:string[]=[];
    for(const frame of [0,1,2,3,4,5] as const){
      const [x,y,w,h]=TROOP_MOTION_CROPS[`motion-${type}-${frame}`];
      const left=Math.ceil(x*width),right=Math.floor((x+w)*width)-1,top=Math.ceil(y*height),bottom=Math.floor((y+h)*height)-1;
      let opaque=0,edge=0;for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++)if(out[(py*width+px)*4+3]!>=180){opaque++;if(px===left||px===right||py===top||py===bottom)edge++;}
      assert.ok(opaque>(right-left)*(bottom-top)*.18,`${type} ${frame} contains usable art`);
      assert.equal(edge,0,`${type} ${frame} does not clip into the next character`);
      const mask:number[]=[];
      for(let row=0;row<30;row++)for(let col=0;col<30;col++){
        const px=Math.floor((x+w*(col+.5)/30)*width),py=Math.floor((y+h*(.67+.33*(row+.5)/30))*height);
        mask.push(out[(py*width+px)*4+3]!>180?1:0);
      }
      masks.push(mask.join(''));
    }
    assert.ok(new Set(masks).size>=4,`${type} has independent foot silhouettes`);
    assert.ok([...masks[0]!].filter((p,i)=>p!==masks[2]![i]).length>30,`${type} has visible passing-leg articulation`);
  }
});
