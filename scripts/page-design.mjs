// Independent design workbench. Never included by browser/wechat build entrypoints.
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';
import { ART_SOURCES } from '../src/render/assets.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const design=resolve(root,'artifacts/ui-direction-v2/page-design');
const output=resolve(root,'.tmp/first-version/page-design/render.js');
await mkdir(resolve(root,'.tmp/first-version/page-design'),{recursive:true});
await build({entryPoints:[resolve(design,'render.ts')],outfile:output,bundle:true,format:'esm',target:'es2022'});
const direct=new Set(['index.html','design.js','design.css','scenes/drill-yard.png','scenes/war-table.png','scenes/order-archive.png',...(await readdir(resolve(design,'fonts'))).map(name=>'fonts/'+name)]);
const docs=['docs/04-界面与交互设计.md','docs/05-美术与动效设计.md','artifacts/strategy-design-v1/icon-art-direction.png'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  try{
    let path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
    const prefix='artifacts/ui-direction-v2/page-design/';
    if(path.startsWith(prefix))path=path.slice(prefix.length);
    if(!path)path='index.html';
    const file=path==='render.js'?output:direct.has(path)?resolve(design,path):[...Object.values(ART_SOURCES),...docs].includes(path)?resolve(root,path):null;
    if(!file){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT??4188),'127.0.0.1',()=>console.log('逐页设计：http://127.0.0.1:'+(process.env.PORT??4188)+'/ · 独立预览，不写玩家记录'));
