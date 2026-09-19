import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

export const WECHAT_PACKAGE_LIMIT=4*1024*1024;

/** assets/art in each build output is generated exclusively from this manifest. */
export async function syncArt(destination, sources){
  const directory=join(destination,'assets/art');
  await mkdir(directory,{recursive:true});
  const expected=new Set(sources.map(path=>basename(path)));
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isFile()&&/\.(jpg|png)$/.test(entry.name)&&!expected.has(entry.name))await rm(join(directory,entry.name));
  }
  for(const source of sources)await copyFile(source,join(directory,basename(source)));
}

/** Count all emitted bytes, without relying on IDE compression or exclusion rules. */
export async function checkWechatPackageSize(directory,limit=WECHAT_PACKAGE_LIMIT){
  const files=[];
  async function walk(relative){
    for(const entry of await readdir(join(directory,relative),{withFileTypes:true})){
      const path=join(relative,entry.name);
      if(entry.isSymbolicLink())throw new Error(`WeChat package must not contain a symbolic link: ${path}`);
      if(entry.isDirectory())await walk(path);
      else if(entry.isFile())files.push({path,bytes:(await stat(join(directory,path))).size});
    }
  }
  await walk('');
  const bytes=files.reduce((sum,file)=>sum+file.bytes,0);
  if(bytes>limit)throw new Error(`WeChat package ${bytes} bytes exceeds ${limit} bytes. Largest files: ${files.sort((a,b)=>b.bytes-a.bytes).slice(0,5).map(file=>`${file.path} (${file.bytes})`).join(', ')}`);
  return {bytes,files};
}
