import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBrowserFont,loadWechatFont} from '../src/platform/fonts.ts';
import {displayFont,FONT_SOURCE,getFontRevision} from '../src/render/typography.ts';

test('optional display font: unsupported, null and failing WeChat loaders preserve fallback',()=>{
  const before=getFontRevision();
  loadWechatFont({});loadWechatFont({loadFont:()=>null});loadWechatFont({loadFont:()=>{throw new Error('unsupported');}});
  assert.equal(getFontRevision(),before);assert.match(displayFont(),/KaiTi/);
  loadWechatFont({loadFont:path=>{assert.equal(path,FONT_SOURCE);return 'wx-local-wenkai';}});
  assert.equal(getFontRevision(),before+1);assert.ok(displayFont().startsWith('"wx-local-wenkai"'));
  loadWechatFont({loadFont:()=> 'wx-local-wenkai'});assert.equal(getFontRevision(),before+1);
});

test('browser font: failure is optional; only a loaded face is installed',async t=>{
  const before=getFontRevision(),added:unknown[]=[];
  const original=new Map(['document','FontFace'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor]of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
  const replace=(key:string,value:unknown)=>Object.defineProperty(globalThis,key,{value,configurable:true});
  replace('document',{fonts:{add:(face:unknown)=>added.push(face)}} as unknown as Document);
  class Failure {async load(){throw new Error('local asset unavailable');}}
  replace('FontFace',Failure as unknown as typeof FontFace);
  await loadBrowserFont();assert.equal(added.length,0);assert.equal(getFontRevision(),before);
  class Loaded {
    family:string;
    constructor(family:string,source:string){this.family=`"${family}"`;assert.equal(source,`url("${FONT_SOURCE}")`);}
    async load(){return this;}
  }
  replace('FontFace',Loaded as unknown as typeof FontFace);
  await loadBrowserFont();assert.equal(added.length,1);assert.ok(displayFont().startsWith('"Shanhe WenKai"'));
});
