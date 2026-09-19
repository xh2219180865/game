import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { ART_SOURCES } from '../src/render/assets.ts';

const root='.tmp/polish-and-acceptance/runtime';await mkdir(root,{recursive:true});
await build({entryPoints:['src/platform/browser.ts'],outfile:`${root}/game.js`,bundle:true,format:'esm',target:'es2022',plugins:[{
  name:'runtime-observer',setup(builder){builder.onLoad({filter:/src\/platform\/browser\.ts$/},async args=>({
    contents:`import { observeRuntime, runtimeStorage } from ${JSON.stringify(resolve('tests/browser-runtime.ts'))};\nconst localStorage=runtimeStorage(window.localStorage);\n${await readFile(args.path,'utf8')}\nobserveRuntime(session,audio,view,localStorage);`,loader:'ts',resolveDir:dirname(args.path),
  }));},
}]});
const html=(await readFile('index.html','utf8')).replace('</head>','<style>body{display:flex;gap:24px;align-items:flex-start;justify-content:flex-start;padding:16px;overflow:auto}main{flex:0 0 375px;height:calc(100vh - 32px);min-height:508px}#runtime-audit{flex:0 0 600px;color:#fffdf7}#runtime-audit button,#runtime-audit a{display:inline-block;font:14px system-ui;padding:12px;margin:4px;background:#fffdf7;color:#253b45;border:0}#runtime-audit pre{white-space:pre-wrap;font:12px monospace;line-height:1.4}</style></head>').replace('</body>','<div style="position:fixed;top:0;left:16px;z-index:5;background:#fffdf7;color:#253b45;font:12px system-ui;padding:2px 6px;pointer-events:none">测试对局 · 不计入玩家军功或周榜</div><aside id="runtime-audit"><h1>正式入口生命周期验收</h1><p>仅 4176 测试记录，独立于试玩进度。原始平台代码、正常游戏时钟与真实 Web Audio；不要作为玩家成绩或手机验收。</p><button id="runtime-seed">载入有卡测试局</button><button id="runtime-read">重新读取测试存档</button><a href="/away">离开测试页（实际 pagehide）</a><label><input type="checkbox" id="runtime-leave-drag">拖拽未松手时离页（测试中断）</label><label><input type="checkbox" id="runtime-track-input">记录自然帧跟手（仅观察）</label><pre id="runtime-report"></pre></aside></body>');
await writeFile(`${root}/index.html`,html);
await writeFile(`${root}/away.html`,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>生命周期验收 · 已离开</title><h1>已离开游戏页面</h1><p>本页不运行游戏，测试存档和中断记录保留在 4176。</p><a href="/">返回验收页面</a></html>');
if(!process.argv.includes('--build-only'))createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(Object.values(ART_SOURCES).some(path=>pathname==='/'+path)){
    try{const body=await readFile(pathname.slice(1));res.writeHead(200,{'Content-Type':pathname.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}return;
  }
  const routes={'/':'index.html','/game.js':'game.js','/away':'away.html'},file=routes[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(await readFile(`${root}/${file}`));
}).listen(4176,'127.0.0.1',()=>console.log('正式入口生命周期验收：http://127.0.0.1:4176 （独立测试存档）'));
