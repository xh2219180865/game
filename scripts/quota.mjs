import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const root='.tmp/polish-and-acceptance/quota';await mkdir(root,{recursive:true});
await build({entryPoints:['tests/browser-quota.ts'],outfile:`${root}/quota.js`,bundle:true,format:'esm',target:'es2022'});
await writeFile(`${root}/index.html`,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>谋定山河 · 独立配额验收</title><style>body{max-width:760px;margin:24px auto;padding:16px;font:16px system-ui;background:#f4e9d5;color:#233b43}button{padding:14px;font:inherit}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>浏览器配额验收</h1><p>仅向本页面新建的测试键写入有界填充，触发真实浏览器配额错误后验证完整保存与恢复。结束时清理本次测试键；不接触试玩或其他验收地址。不代表手机或微信配额。</p><button id="run">开始独立配额检查</button><pre id="report">尚未运行</pre><script type="module" src="/quota.js"></script></html>');
if(!process.argv.includes('--build-only'))createServer(async(req,res)=>{
  const file={'/':'index.html','/quota.js':'quota.js'}[new URL(req.url,'http://localhost').pathname];
  if(!file){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(await readFile(`${root}/${file}`));
}).listen(4177,'127.0.0.1',()=>console.log('独立浏览器配额验收：http://127.0.0.1:4177/'));
