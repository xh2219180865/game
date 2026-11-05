import test from 'node:test';
import assert from 'node:assert/strict';
import { ART_SOURCES, type ArtImage } from '../src/render/assets.ts';

const ART_COUNT=Object.keys(ART_SOURCES).length;

let sequence=0;
const fresh=()=>import(`../src/render/assets.ts?test=${sequence++}`) as Promise<typeof import('../src/render/assets.ts')>;
function imageFactory(images:ArtImage[],mode:'manual'|'success'|'failure'|'invalid'='manual'){
  return ()=>{
    const image:ArtImage={width:800,height:600,onload:null,onerror:null,
      get src(){return source;},set src(value:string){source=value;if(mode==='success')image.onload?.call(image as HTMLImageElement,new Event('load'));if(mode==='failure')image.onerror?.call(image as HTMLImageElement,new Event('error'));if(mode==='invalid'){image.width=0;image.onload?.call(image as HTMLImageElement,new Event('load'));}},
    };let source='';images.push(image);return image;
  };
}
function succeed(image:ArtImage){image.onload?.call(image as HTMLImageElement,new Event('load'));}
function fail(image:ArtImage){image.onerror?.call(image as HTMLImageElement,new Event('error'));}

test('art: current source manifest adds the polished atlas without reviving retired atlases',async()=>{
  const art=await fresh(),images:ArtImage[]=[];await art.loadArt(imageFactory(images,'success'));
  assert.deepEqual(images.map(image=>image.src),[
    'assets/art/home-courtyard.jpg','assets/art/warfront-ground.jpg','assets/art/a-terrain-snow.jpg','assets/art/a-terrain-desert.jpg','assets/art/a-cards.jpg','assets/art/warfront-camps.png','assets/art/warfront-infantry.png','assets/art/warfront-foot.png','assets/art/warfront-cavalry.png','assets/art/warfront-landforms.png',
  ]);
  let draws=0;const ctx={drawImage(){draws++;}} as unknown as CanvasRenderingContext2D;
  for(const id of ['buildings','troops','building-barracks-1','building-archery-2','building-relay-3','building-fort-3','troop-infantry-0','troop-archer-1','troop-cavalry-0','troop-guard-1']){
    assert.equal(art.drawArt(ctx,id as never,0,0,40,40),false,id);
  }
  assert.equal(draws,0);assert.equal(images.length,ART_COUNT);
});

test('art: unavailable, invalid IDs and nonfinite destinations never draw',async()=>{
  const art=await fresh();let draws=0;
  const ctx={drawImage(){draws++;}} as unknown as CanvasRenderingContext2D;
  assert.equal(art.drawArt(ctx,'home',0,0,100,100),false);
  await art.loadArt(imageFactory([],'success'));
  for(const input of [[NaN,0,10,10],[0,Infinity,10,10],[0,0,0,10],[0,0,-1,10],[0,0,10,Infinity]])assert.equal(art.drawArt(ctx,'home',...input as [number,number,number,number]),false);
  assert.equal(art.drawArt(ctx,'card-unknown' as never,0,0,10,10),false);
  assert.equal(art.drawArt(ctx,'building-fort-4' as never,0,0,10,10),false);
  assert.equal(draws,0);
});

test('art: overlapping loads share every registered request, partial successes survive explicit retry',async()=>{
  const art=await fresh(),images:ArtImage[]=[];
  const first=art.loadArt(imageFactory(images)),overlap=art.loadArt(imageFactory(images));
  await Promise.resolve();assert.equal(images.length,ART_COUNT);assert.equal(art.getArtStatus().loading,ART_COUNT);
  assert.deepEqual(images.map(i=>i.src),Object.values(art.ART_SOURCES));
  const failedPaths=new Set<string>([ART_SOURCES.home,ART_SOURCES.cards]);
  images.forEach(image=>failedPaths.has(image.src)?fail(image):succeed(image));
  await Promise.all([first,overlap]);assert.deepEqual(art.getArtStatus(),{ready:ART_COUNT-2,loading:0,failed:2,total:ART_COUNT});
  const retry=art.retryArt();await Promise.resolve();assert.equal(images.length,ART_COUNT+2);
  assert.deepEqual(images.slice(ART_COUNT).map(image=>image.src),[...failedPaths],'only the two failed sources are requested again');
  images.slice(ART_COUNT).forEach(succeed);await retry;
  assert.deepEqual(art.getArtStatus(),{ready:ART_COUNT,loading:0,failed:0,total:ART_COUNT});
  await art.retryArt();assert.equal(images.length,ART_COUNT+2);
  assert.ok(images.every(i=>i.onload===null&&i.onerror===null),'handlers released after settling');
});

test('art: factories throwing, src setters throwing and invalid decoded images remain retryable',async()=>{
  const art=await fresh();await art.loadArt(()=>{throw new Error('factory unavailable');});assert.equal(art.getArtStatus().failed,ART_COUNT);
  await art.loadArt(()=>({width:10,height:10,onload:null,onerror:null,get src(){return '';},set src(_value:string){throw new Error('source unavailable');}}));
  assert.equal(art.getArtStatus().failed,ART_COUNT);
  await art.loadArt(imageFactory([],'invalid'));assert.equal(art.getArtStatus().failed,ART_COUNT);
  await art.loadArt(imageFactory([],'success'));assert.equal(art.getArtStatus().ready,ART_COUNT);
});

test('art: a hung request times out, late events cannot overwrite a successful retry',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const art=await fresh(),images:ArtImage[]=[];
  const loading=art.loadArt(imageFactory(images));await Promise.resolve();
  const oldLoad=images[0]!.onload!;
  t.mock.timers.tick(15000);await loading;assert.equal(art.getArtStatus().failed,ART_COUNT);
  await art.loadArt(imageFactory([],'success'));oldLoad.call(images[0] as HTMLImageElement,new Event('load'));
  assert.deepEqual(art.getArtStatus(),{ready:ART_COUNT,loading:0,failed:0,total:ART_COUNT});
});

test('art: contain/cover crop atlas cells without spilling adjacent artwork or changing ctx state',async()=>{
  const art=await fresh(),draws:unknown[][]=[];
  const factory=imageFactory([],'success');await art.loadArt(()=>{const image=factory();image.width=1448;image.height=1086;return image;});
  const ctx={globalAlpha:.3,fillStyle:'red',drawImage(...args:unknown[]){draws.push(args);}} as unknown as CanvasRenderingContext2D;
  assert.ok(art.drawArt(ctx,'card-mobilize',10,20,100,50));
  const cardWidth=362*(50/543);
  assert.deepEqual(draws.pop()!.slice(1),[0,0,362,543,10+(100-cardWidth)/2,20,cardWidth,50]);
  assert.ok(art.drawArt(ctx,'card-march',0,0,100,50,'cover'));
  assert.deepEqual(draws.pop()!.slice(1),[362,181,362,181,0,0,100,50]);
  assert.ok(art.drawArt(ctx,'card-fortification',0,0,100,100,'cover'));
  assert.deepEqual(draws.pop()!.slice(1),[724,633.5,362,362,0,0,100,100]);
  assert.equal(ctx.globalAlpha,.3);assert.equal(ctx.fillStyle,'red');
});

test('art: a draw failure requests fallback and can recover without a restart',async()=>{
  const art=await fresh();await art.loadArt(imageFactory([],'success'));
  const ctx={drawImage(){throw new Error('native image invalidated');}} as unknown as CanvasRenderingContext2D;
  assert.equal(art.drawArt(ctx,'home',0,0,100,100),false);assert.equal(art.getArtStatus().failed,1);
  await art.retryArt();assert.equal(art.getArtStatus().ready,ART_COUNT);
});

test('art: seven card UVs stay in their own cells at original and scaled resolutions',async()=>{
  const frames=[
    ['card-mobilize',0,0],['card-march',1,0],['card-supply',2,0],['card-feint',3,0],
    ['card-farming',0,1],['card-logistics',1,1],['card-fortification',2,1],
  ] as const;
  for(const factor of [.5,1,2]){
    const art=await fresh(),factory=imageFactory([],'success'),draws:unknown[][]=[];
    await art.loadArt(()=>{const image=factory();image.width=1448*factor;image.height=1086*factor;return image;});
    const ctx={drawImage(...args:unknown[]){draws.push(args);}} as unknown as CanvasRenderingContext2D;
    for(const [id,column,row]of frames){
      const bx=column*362,by=row*543,bw=362,bh=543;
      assert.ok(art.drawArt(ctx,id,12,18,40,40));const draw=draws.pop()!;
      assert.equal((draw[0] as ArtImage).src,ART_SOURCES.cards);
      assert.deepEqual(draw.slice(1,5),[bx*factor,by*factor,bw*factor,bh*factor]);
      const [sx,sy,sw,sh,dx,dy,dw,dh]=draw.slice(1) as number[];
      assert.ok(sx!>=0&&sy!>=0&&sx!+sw!<=1448*factor&&sy!+sh!<=1086*factor,'UV remains within source image');
      assert.ok(sx!>=column*362*factor&&sx!+sw!<=(column+1)*362*factor&&sy!>=row*543*factor&&sy!+sh!<=(row+1)*543*factor,'source does not cross card cells');
      assert.ok(dx!>=12&&dy!>=18&&dx!+dw!<=52&&dy!+dh!<=58,'contain remains in requested bounds');
      assert.ok(Math.abs(dw!/dh!-bw/bh)<1e-12,'contain preserves card proportions');
      assert.ok(art.drawArt(ctx,id,12,18,40,20,'cover'));const cover=draws.pop()!;
      assert.deepEqual(cover.slice(1,5),[bx*factor,(by+(bh-bw/2)/2)*factor,bw*factor,bw*factor/2]);
      assert.deepEqual(cover.slice(5),[12,18,40,20]);
    }
    assert.equal(draws.length,0);
  }
});

test('art: invalid troop types or frame numbers cannot draw any neighboring sprite',async()=>{
  const art=await fresh();await art.loadArt(imageFactory([],'success'));let draws=0;
  const ctx={drawImage(){draws++;}} as unknown as CanvasRenderingContext2D;
  for(const id of ['troop-infantry--1','troop-infantry-2','troop-infantry-01','troop-archer-1.5','troop-cavalry-','troop-guard-10','troop-fort-0','troop-infantry-0-extra'])assert.equal(art.drawArt(ctx,id as never,0,0,40,40),false,id);
  assert.equal(draws,0);
});
