import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {GameSession} from '../src/app/session.ts';
import type {GameView} from '../src/render/game.ts';
import {SLOT_KEYS,envelopeFor,decodeEnvelope,type StoragePort} from '../src/app/storage.ts';
import {validateProfile} from '../src/app/validation.ts';
import {freshProfile} from '../src/core/progress.ts';
import {auditStorage,createWechatAuditProfile,initializeWechatAudit,type WechatAuditMode} from './wechat-audit-fixture.ts';

const NOW=Date.now();
function memory(){
  const player=freshProfile(NOW,'real-player-kept');
  const data=new Map<string,string>(SLOT_KEYS.map((key,i)=>[key,JSON.stringify(envelopeFor(player,i+1,NOW))]));
  const calls:{kind:string;key:string}[]=[];
  const port:StoragePort={async read(key){calls.push({kind:'read',key});return data.get(key)??null;},async write(key,value){calls.push({kind:'write',key});data.set(key,value);},async remove(key){calls.push({kind:'remove',key});data.delete(key);}};
  return {data,calls,port,original:SLOT_KEYS.map(key=>[key,data.get(key)] as const)};
}
function session(storage:StoragePort){return new GameSession({storage,now:()=>NOW,random:()=>.3,notify:()=>{},events:()=>{}});}
function view():GameView{return {draw(){}} as unknown as GameView;}
function originalsUnchanged(m:ReturnType<typeof memory>){assert.deepEqual(SLOT_KEYS.map(key=>[key,m.data.get(key)]),m.original);}

for(const mode of ['cards','reward','reward-logistics','reward-fortification'] as const)test(`WeChat audit ${mode}: preset passes real profile and envelope validation`,()=>{
  const p=createWechatAuditProfile(mode,NOW);validateProfile(p);
  assert.deepEqual(decodeEnvelope(JSON.stringify(envelopeFor(p,1,NOW))).data,p);
  assert.deepEqual(p.activeInventory,{mobilize:3,march:3,supply:3,feint:3});
  if(mode==='cards'){
    assert.equal(p.activeMatch?.battle.mapId,'A01');assert.ok(p.activeMatch!.battle.factions.every(f=>f.nextAiAtMs>240000));
  }else{
    assert.equal(p.activeMatch,null);assert.equal(p.latestResult?.qualified,true);assert.equal(p.latestResult?.result?.independentWinner,'P');assert.equal(p.choice?.state,'pending');assert.equal(p.choice?.grantQuantity,1);
  }
});

test('WeChat audit storage: read, write and remove consistently scope every key and cannot touch player slots or another run',async()=>{
  const m=memory(),a=auditStorage(m.port,'cards-run-1'),z=auditStorage(m.port,'reward-run-2');
  for(const key of [...SLOT_KEYS,'arbitrary-key']){
    assert.equal(await a.read(key),null);await a.write(key,'audit-value');assert.equal(await a.read(key),'audit-value');assert.equal(await z.read(key),null);
    await a.remove(key);assert.equal(await a.read(key),null);
  }
  assert.deepEqual(new Set(m.calls.map(c=>c.kind)),new Set(['read','write','remove']));
  assert.ok(m.calls.every(c=>c.key.startsWith('wechat-audit:v1:cards-run-1:')||c.key.startsWith('wechat-audit:v1:reward-run-2:')));originalsUnchanged(m);
});

test('WeChat audit rejects invalid run IDs and unknown preset modes before storage writes',async()=>{
  const m=memory();
  for(const runId of ['', 'a'.repeat(81),'../player','a:b','two words','中文','abc\n'])assert.throws(()=>auditStorage(m.port,runId),/Invalid audit run ID/);
  const bad='unknown' as WechatAuditMode;assert.throws(()=>createWechatAuditProfile(bad,NOW),/Unknown audit mode/);
  for(const existing of [false,true]){
    const scoped=auditStorage(m.port,existing?'unknown-existing':'unknown-empty');
    if(existing)await scoped.write(SLOT_KEYS[1],JSON.stringify(envelopeFor(createWechatAuditProfile('cards',NOW),1,NOW)));
    const before=[...m.data];await assert.rejects(initializeWechatAudit(session(scoped),scoped,view(),bad),/Unknown audit mode/);assert.deepEqual([...m.data],before);
  }
  originalsUnchanged(m);
});

for(const mode of ['cards','reward','reward-logistics','reward-fortification'] as const)test(`WeChat audit ${mode}: empty scoped slots initialize once and survive reload without overwriting`,async()=>{
  const m=memory(),scoped=auditStorage(m.port,`init-${mode}`),s=session(scoped);
  await initializeWechatAudit(s,scoped,view(),mode);assert.equal(s.error,'');assert.equal(s.page,mode==='cards'?'pause':'result');validateProfile(s.profile);
  const generation=s.profile!.generation,bytes=[...m.data],writes=m.calls.filter(c=>c.kind==='write').length;
  const restored=session(scoped);await initializeWechatAudit(restored,scoped,view(),mode==='cards'?'reward':'cards');
  assert.equal(restored.profile!.generation,generation);assert.deepEqual(restored.profile,s.profile);assert.deepEqual([...m.data],bytes);assert.equal(m.calls.filter(c=>c.kind==='write').length,writes);originalsUnchanged(m);
});

for(const [mode,card]of [['reward','farming'],['reward-logistics','logistics'],['reward-fortification','fortification']] as const)test(`WeChat audit ${card}: actual claim persists once and reaches the next player battle snapshot`,async()=>{
  const m=memory(),scoped=auditStorage(m.port,`claim-${card}`),s=session(scoped);
  await initializeWechatAudit(s,scoped,view(),mode);assert.ok(s.profile!.choice!.candidateIds.includes(card));
  await s.acknowledge('choice');await s.claim(card);assert.equal(s.page,'home');assert.equal(s.profile!.passiveLevels[card],4);
  assert.equal(s.profile!.choice!.state,'claimed');const saved=[...m.data];
  const restored=session(scoped);await initializeWechatAudit(restored,scoped,view(),mode);
  assert.deepEqual([...m.data],saved);assert.equal(restored.profile!.passiveLevels[card],4);assert.equal(restored.page,'home');
  await restored.claim(card);assert.deepEqual([...m.data],saved);assert.equal(restored.profile!.passiveLevels[card],4);
  assert.equal(await restored.start('A01'),true);const factions=restored.match!.battle.factions;
  assert.deepEqual(factions.find(f=>f.id==='P')!.passives,restored.profile!.passiveLevels);
  assert.ok(factions.filter(f=>f.id!=='P').every(f=>Object.values(f.passives).every(n=>n===0)));
  originalsUnchanged(m);
});

for(const backup of [false,true])test(`WeChat audit corruption with backup ${backup}: preserves bytes and enters explicit recovery`,async()=>{
  const m=memory(),scoped=auditStorage(m.port,`corrupt-${backup}`);
  if(backup)await scoped.write(SLOT_KEYS[0],JSON.stringify(envelopeFor(createWechatAuditProfile('cards',NOW),2,NOW)));
  await scoped.write(SLOT_KEYS[1],'{damaged-record');const before=[...m.data],writes=m.calls.filter(c=>c.kind==='write').length,s=session(scoped);
  await initializeWechatAudit(s,scoped,view(),'reward');assert.equal(s.page,'recovery');assert.ok(s.error);assert.equal(!!s.backup,backup);assert.deepEqual([...m.data],before);assert.equal(m.calls.filter(c=>c.kind==='write').length,writes);originalsUnchanged(m);
});

test('WeChat audit fixture is absent from production sources and the normal build entry',()=>{
  const walk=(url:URL):URL[]=>readdirSync(url,{withFileTypes:true}).flatMap(e=>{const file=new URL(e.name+(e.isDirectory()?'/':''),url);return e.isDirectory()?walk(file):e.name.endsWith('.ts')?[file]:[];});
  for(const file of [...walk(new URL('../src/',import.meta.url)),new URL('../scripts/build.mjs',import.meta.url)])assert.doesNotMatch(readFileSync(file,'utf8'),/wechat-audit-fixture|initializeWechatAudit|createWechatAuditProfile|auditStorage/,file.pathname);
});
