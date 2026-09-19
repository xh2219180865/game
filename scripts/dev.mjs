import { context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { ART_SOURCES } from '../src/render/assets.ts';

await mkdir('dist/browser',{recursive:true});await copyFile('index.html','dist/browser/index.html');
const ctx=await context({entryPoints:['src/platform/browser.ts'],outfile:'dist/browser/game.js',bundle:true,format:'esm',target:'es2022',sourcemap:true});
await ctx.watch();await ctx.rebuild();
const root=resolve('dist/browser');
const server=createServer(async(req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(Object.values(ART_SOURCES).some(path=>pathname==='/'+path)){
    try{const body=await readFile(resolve(pathname.slice(1)));res.writeHead(200,{'Content-Type':pathname.endsWith('.png')?'image/png':'image/jpeg','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Art not found');}return;
  }
  const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(path!==root&&!path.startsWith(root+'/')){res.writeHead(403);res.end();return;}
  try{const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.map':'application/json'})[extname(path)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('本地试玩：http://127.0.0.1:4173'));
async function stop(){server.close();await ctx.dispose();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
