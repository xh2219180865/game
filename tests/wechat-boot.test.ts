import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';

const boot=buildSync({entryPoints:['src/platform/wechat-boot.ts'],bundle:true,external:['./game-core.js'],format:'cjs',target:'es2015',write:false}).outputFiles[0]!.text;
test('WeChat boot loads the exact core once without allocating another screen canvas',()=>{
  const paths:string[]=[];runInNewContext(boot,{BigInt,require:(p:string)=>paths.push(p),wx:{createCanvas(){throw new Error('unexpected screen');}}});
  assert.deepEqual(paths,['./game-core.js']);assert.doesNotMatch(boot,/\b\d+n\b/);
});
test('WeChat boot displays a bounded unsupported message without touching storage or parsing the core',()=>{
  for(const width of [280,320,375,430]){
    const labels:string[]=[],canvas={width:0,height:0,getContext:()=>new Proxy({fillText(text:string,x:number){labels.push(text);assert.equal(x,width/2);}},{get:(o,k)=>k in o?o[k as keyof typeof o]:()=>{}})};
    runInNewContext(boot,{BigInt:undefined,require(){throw new Error('unsupported core loaded');},wx:{createCanvas:()=>canvas,getSystemInfoSync:()=>({windowWidth:width,windowHeight:812,pixelRatio:2})}});
    assert.equal(canvas.width,width*2);assert.ok(labels.includes('请更新微信后重试'));assert.ok(labels.includes('本地记录保持不变'));
  }
});
