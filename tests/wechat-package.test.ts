import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm, symlink, open } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ART_SOURCES } from '../src/render/assets.ts';
import { checkWechatPackageSize, WECHAT_PACKAGE_LIMIT } from '../scripts/wechat-package.mjs';

const run=promisify(execFile),root=resolve('.');
async function temporary(t:test.TestContext){
  const parent=join(root,'.tmp/first-version/preview-size');await mkdir(parent,{recursive:true});
  const directory=await mkdtemp(join(parent,'regression-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));return directory;
}

test('WeChat package: counts every file and rejects one byte beyond 4 MiB before preview',async t=>{
  const directory=await temporary(t);await mkdir(join(directory,'assets'));
  const file=await open(join(directory,'assets/large.jpg'),'w');await file.truncate(WECHAT_PACKAGE_LIMIT);await file.close();
  assert.equal((await checkWechatPackageSize(directory)).bytes,WECHAT_PACKAGE_LIMIT);
  await writeFile(join(directory,'extra.js'),'x');
  await assert.rejects(checkWechatPackageSize(directory),/4194305 bytes exceeds 4194304 bytes.*assets\/large.jpg/);
});

test('WeChat package: rejects links instead of following files outside the output directory',async t=>{
  const directory=await temporary(t);await symlink(join(root,'readme.md'),join(directory,'external.md'));
  await assert.rejects(checkWechatPackageSize(directory),/symbolic link/);
});

test('real repeated builds remove retired images and maps, retain current art, and stay below the preview limit',async t=>{
  const directory=await temporary(t);
  for(const name of ['src','assets'])await symlink(join(root,name),join(directory,name),'dir');
  await writeFile(join(directory,'index.html'),await readFile(join(root,'index.html')));
  const accountConfig='{"appid":"test-preserve-account-config"}\n';await writeFile(join(directory,'project.config.json'),accountConfig);
  const output=join(directory,'dist/wechat');await mkdir(join(output,'assets/art'),{recursive:true});
  for(let pass=0;pass<2;pass++){
    for(const file of ['home.jpg','cards.jpg','buildings.png','troops.png','terrain-plains.jpg'])await writeFile(join(output,'assets/art',file),'retired output');
    for(const file of ['game.js.map','game-core.js.map'])await writeFile(join(output,file),'old debug map');
    const result=await run(process.execPath,[join(root,'scripts/build.mjs')],{cwd:directory});
    assert.match(result.stdout,/WeChat package: \d+ \/ 4194304 bytes/);
    assert.deepEqual((await readdir(join(output,'assets/art'))).sort(),Object.values(ART_SOURCES).map(path=>basename(path)).sort());
    const report=await checkWechatPackageSize(output);
    assert.ok(report.bytes<3.5*1024*1024,'all troop strips fit while retaining at least 512 KiB of headroom');
    assert.ok(!report.files.some(file=>file.path.endsWith('.map')));
    for(const source of Object.values(ART_SOURCES))assert.deepEqual(await readFile(join(output,source)),await readFile(join(root,source)),'no reduction of artwork quality');
    for(const name of ['game.js','game-core.js'])assert.doesNotMatch(await readFile(join(output,name),'utf8'),/sourceMappingURL/);
    assert.equal(await readFile(join(directory,'project.config.json'),'utf8'),accountConfig);
    assert.ok((await readFile(join(directory,'dist/browser/game.js.map'))).length>0,'browser debugging remains available');
  }
});
