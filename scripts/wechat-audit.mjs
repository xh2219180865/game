import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {ART_SOURCES} from '../src/render/assets.ts';
import {syncArt,checkWechatPackageSize} from './wechat-package.mjs';

const mode=process.argv[2]??'cards';
if(!['cards','reward','reward-logistics','reward-fortification'].includes(mode))throw new Error('Use: node scripts/wechat-audit.mjs cards|reward|reward-logistics|reward-fortification [run-id]');
const runId=process.argv[3]??`${mode}-${Date.now()}`;
if(!/^[a-zA-Z0-9-]{1,80}$/.test(runId))throw new Error('Invalid audit run ID');
const destination='.tmp/first-version/wechat-audit';await mkdir(destination,{recursive:true});
await syncArt(destination,Object.values(ART_SOURCES));
await build({entryPoints:['src/platform/wechat.ts'],outfile:`${destination}/game.js`,bundle:true,format:'iife',target:'es2020',minify:true,plugins:[{
  name:'isolated-wechat-audit',setup(builder){builder.onLoad({filter:/src\/platform\/wechat\.ts$/},async args=>{
    let source=await readFile(args.path,'utf8');
    for(const token of ['const storage:StoragePort={','const audio=new GameAudio','void session.load();'])if(source.split(token).length!==2)throw new Error(`Audit entry changed: ${token}`);
    source=source.replace('const storage:StoragePort={','const nativeStorage:StoragePort={').replace('const audio=new GameAudio',`const storage=auditStorage(nativeStorage,${JSON.stringify(runId)});\nconst audio=new GameAudio`).replace('void session.load();',`void initializeWechatAudit(session,storage,view,${JSON.stringify(mode)});`);
    source+='\nconsole.log("[wechat-audit-viewport]",JSON.stringify({window:wx.getWindowInfo?.(),menu:wx.getMenuButtonBoundingClientRect?.(),viewport:view.viewport}));';
    for(const kind of ['Start','End','Cancel']){
      const token=`wx.onTouch${kind}(e=>{`;
      if(source.split(token).length!==2)throw new Error(`Audit touch entry changed: ${kind}`);
      source=source.replace(token,`${token}console.log('[wechat-audit-touch]',JSON.stringify({kind:${JSON.stringify(kind)},touches:e.changedTouches.map(t=>({id:t.identifier,x:t.clientX,y:t.clientY}))}));`);
    }
    return {contents:`import {auditStorage,initializeWechatAudit} from ${JSON.stringify(resolve('tests/wechat-audit-fixture.ts'))};\n${source}`,loader:'ts',resolveDir:dirname(args.path)};
  });builder.onLoad({filter:/src\/platform\/audio\.ts$/},async args=>{
    const source=await readFile(args.path,'utf8'),token='osc.start(start);osc.stop(voice.end);';
    if(source.split(token).length!==2)throw new Error('Audit audio entry changed');
    return {contents:source.replace(token,`${token}console.log('[wechat-audit-audio]',JSON.stringify({state:ctx.state,key:sound.key,duration:sound.duration}));`),loader:'ts',resolveDir:dirname(args.path)};
  });},
}]});
const {appid}=JSON.parse(await readFile('project.config.json','utf8'));
await writeFile(`${destination}/game.json`,JSON.stringify({deviceOrientation:'portrait',showStatusBar:false}));
await writeFile(`${destination}/project.config.json`,JSON.stringify({appid,projectname:'four-banners-local-audit',description:'独立本机测试，不上传，不计玩家成绩',compileType:'game',miniprogramRoot:'./',setting:{es6:false,minified:false,urlCheck:true}},null,2));
const result=await checkWechatPackageSize(destination);
console.log(`Local audit: ${resolve(destination)}\nMode: ${mode}; isolated run: ${runId}\nPackage: ${result.bytes} bytes`);
