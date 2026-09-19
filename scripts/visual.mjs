import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { ART_SOURCES } from '../src/render/assets.ts';

const root='.tmp/first-version/visual';await mkdir(root,{recursive:true});
await build({entryPoints:['tests/visual-fixtures.ts'],outfile:`${root}/game.js`,bundle:true,format:'esm',target:'es2022'});
await build({entryPoints:['tests/browser-acceptance.ts'],outfile:`${root}/acceptance.js`,bundle:true,format:'esm',target:'es2022'});
await build({entryPoints:['tests/browser-benchmark.ts'],outfile:`${root}/benchmark.js`,bundle:true,format:'esm',target:'es2022'});
await writeFile(`${root}/index.html`,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>谋定山河 · 布局测试（不保存）</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#253b45;display:grid;place-items:center}canvas{display:block;width:100vw;max-width:480px;height:100vh;touch-action:none}</style><canvas aria-label="布局测试画布"></canvas><script type="module" src="/game.js"></script></html>');
await writeFile(`${root}/acceptance.html`,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>谋定山河 · 内存交互验收</title><style>body{margin:16px;background:#253b45;color:white;font:14px system-ui;display:flex;gap:24px}canvas{width:375px;height:812px;flex-shrink:0;touch-action:none}aside{width:420px}button{font:14px system-ui;padding:10px;margin:4px}pre{white-space:pre-wrap;line-height:1.5}#controls{border-top:1px solid #829398;margin-top:16px;padding-top:8px}</style><div style="position:fixed;top:0;left:16px;z-index:5;background:#fffdf7;color:#253b45;font:12px system-ui;padding:2px 6px;pointer-events:none">测试对局 · 不计入玩家军功或周榜</div><canvas aria-label="交互测试画布"></canvas><aside><h1>仅内存交互验收</h1><p>预设用于输入与恢复检查，不代表真实玩家通关。</p><button id="lesson">载入教学测试</button><button id="formal">载入有卡正式测试</button><button id="step">推进 3 游戏秒</button><button id="read">重新读取内存存档</button><button id="fail-before">下次写入前失败</button><button id="fail-after">下次写入后丢回调</button><pre id="status" aria-live="polite"></pre><div id="controls" aria-label="当前游戏按钮"></div></aside><script type="module" src="/acceptance.js"></script></html>');
await writeFile(`${root}/benchmark.html`,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>谋定山河 · 浏览器渲染基准</title><style>body{margin:16px;background:#253b45;color:white;font:14px system-ui;display:flex;gap:24px}canvas{width:375px;height:812px;flex-shrink:0}aside{max-width:650px}button{font:16px system-ui;padding:12px}pre{white-space:pre-wrap;font-size:12px}</style><canvas aria-label="渲染基准画布"></canvas><aside><h1>连续 20 局渲染与资源检查</h1><p>自动操作，每帧推进 250 游戏毫秒，三图轮流。仅内存数据；音频节点静音输出。记录实际浏览器帧间隔与绘制耗时，不代表正常速度手机性能或玩家平衡测试。</p><button>开始 20 局检查</button><p id="status" role="status">尚未开始</p><pre id="report"></pre></aside><script type="module" src="/benchmark.js"></script></html>');
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(Object.values(ART_SOURCES).some(file=>path==='/'+file)){
    try{const body=await readFile(path.slice(1));res.writeHead(200,{'Content-Type':path.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end();}return;
  }
  const routes={'/':'index.html','/game.js':'game.js','/acceptance':'acceptance.html','/acceptance.js':'acceptance.js','/benchmark':'benchmark.html','/benchmark.js':'benchmark.js'};
  const filename=routes[path];if(!filename){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(await readFile(`${root}/${filename}`));
});
server.listen(4174,'127.0.0.1',()=>console.log('布局测试：http://127.0.0.1:4174/?screen=choice （固定测试数据，不写入真实存档）'));
