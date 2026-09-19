import { build } from 'esbuild';
import { mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { ART_SOURCES } from '../src/render/assets.ts';
import { syncArt, checkWechatPackageSize, WECHAT_PACKAGE_LIMIT } from './wechat-package.mjs';

for(const destination of ['dist/browser','dist/wechat']){
  await syncArt(destination,Object.values(ART_SOURCES));
}

await mkdir('dist/browser',{recursive:true});
await build({entryPoints:['src/platform/browser.ts'],outfile:'dist/browser/game.js',bundle:true,format:'esm',target:'es2022',sourcemap:true,minify:false});
await copyFile('index.html','dist/browser/index.html');
console.log('Browser build: dist/browser/');
await mkdir('dist/wechat',{recursive:true});
await build({entryPoints:['src/platform/wechat.ts'],outfile:'dist/wechat/game-core.js',bundle:true,format:'iife',target:'es2020',sourcemap:false,minify:true});
await build({entryPoints:['src/platform/wechat-boot.ts'],outfile:'dist/wechat/game.js',bundle:true,external:['./game-core.js'],format:'cjs',target:'es2015',sourcemap:false,minify:true});
for(const file of ['game.js.map','game-core.js.map'])await rm(`dist/wechat/${file}`,{force:true});
await writeFile('dist/wechat/game.json',JSON.stringify({deviceOrientation:'portrait',showStatusBar:false},null,2)+'\n');
await writeFile('dist/wechat/project.config.json',JSON.stringify({description:'谋定山河本地核心验证包；真实 AppID 与平台能力待验证',projectname:'four-banners',compileType:'game',miniprogramRoot:'./',setting:{es6:false,minified:false,urlCheck:true}},null,2)+'\n');
console.log('WeChat build: dist/wechat/ (AppID and device validation pending)');
const result=await checkWechatPackageSize('dist/wechat');
console.log(`WeChat package: ${result.bytes} / ${WECHAT_PACKAGE_LIMIT} bytes (${(result.bytes/1024/1024).toFixed(2)} MiB), ${result.files.length} files`);
