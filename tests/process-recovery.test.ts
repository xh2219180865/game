import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { advanceSimulation } from '../src/core/ai.ts';
import type { Profile } from '../src/core/progress.ts';
import type { Scenario, Barrier, WorkerReport } from './process-recovery-worker.ts';

const RETURNED=Date.parse('2026-09-11T13:00:00+08:00');
async function folders(t:TestContext){
  const base=resolve('.tmp/polish-and-acceptance/process-recovery');await mkdir(base,{recursive:true});const root=await mkdtemp(`${base}/case-`);
  t.after(()=>rm(root,{recursive:true,force:true}));const baseline=resolve(root,'baseline'),interrupted=resolve(root,'interrupted');await mkdir(baseline);await mkdir(interrupted);return {baseline,interrupted};
}
function worker<K extends WorkerReport['kind']>(t:TestContext,mode:'start'|'restore',directory:string,scenario:Scenario,barrier:Barrier,kind:K){
  const child=fork(new URL('./process-recovery-worker.ts',import.meta.url),[mode,directory,scenario,barrier],{stdio:['ignore','ignore','pipe','ipc'],execArgv:[]});
  let stderr='';child.stderr!.on('data',chunk=>{stderr+=String(chunk);});
  const exit=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(done=>child.once('exit',(code,signal)=>done({code,signal})));
  const report=new Promise<Extract<WorkerReport,{kind:K}>>((done,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`Worker timed out: ${scenario}/${barrier}\n${stderr}`)),10000);
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',(code,signal)=>{clearTimeout(timeout);reject(new Error(`Worker exited before ${kind}: ${code}/${signal}\n${stderr}`));});
    child.on('message',(message:WorkerReport|{kind:'error';message:string})=>{
      if(message.kind==='error'){clearTimeout(timeout);reject(new Error(message.message));}
      else if(message.kind===kind){clearTimeout(timeout);done(message as Extract<WorkerReport,{kind:K}>);}
    });
  });
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exit;}});
  return {child,report,exit,stderr:()=>stderr};
}
async function complete<K extends 'complete'|'restored'>(t:TestContext,mode:'start'|'restore',directory:string,scenario:Scenario,kind:K){
  const running=worker(t,mode,directory,scenario,'none',kind),report=await running.report;
  assert.equal(report.pid,running.child.pid);assert.deepEqual(await running.exit,{code:0,signal:null});assert.equal(running.stderr(),'');return report;
}
function onReturn(profile:Profile){const expected=structuredClone(profile);expected.maxObservedTime=RETURNED;if(expected.activeMatch)expected.activeMatch.battle.status='paused';return expected;}

const cases:{scenario:Scenario;barrier:Barrier;title:string}[]=[
  {scenario:'periodic',barrier:'committed',title:'S02 Q11: SIGKILL after a five-second checkpoint restores only the saved game time'},
  ...(['mobilize','supply','feint','march'] as const).map(scenario=>({scenario,barrier:'committed' as const,title:`S03 Q11: SIGKILL immediately after committed ${scenario} restores one cost with the complete effect or army`})),
  ...(['upgrade','tower','volley'] as const).map(scenario=>({scenario,barrier:'committed' as const,title:`N09 N32 N60: SIGKILL after saved ${scenario} restores the complete battle without repeating cost or damage`})),
  ...(['win','loss'] as const).flatMap(scenario=>(['before-write','after-write'] as const).map(barrier=>({scenario,barrier,title:`S07 Q11: SIGKILL at ${scenario} settlement ${barrier} preserves the fixed score and highest rank`}))),
];
for(const {scenario,barrier,title}of cases)test(title,{timeout:20000},async t=>{
  const directories=await folders(t),baseline=await complete(t,'start',directories.baseline,scenario,'complete');
  const running=worker(t,'start',directories.interrupted,scenario,barrier,'checkpoint'),checkpoint=await running.report;
  assert.equal(checkpoint.pid,running.child.pid);assert.notEqual(checkpoint.pid,baseline.pid);assert.equal(running.child.exitCode,null);assert.equal(running.child.signalCode,null);
  assert.equal(running.child.kill('SIGKILL'),true);const death=await running.exit;assert.deepEqual(death,{code:null,signal:'SIGKILL'});
  t.diagnostic(`Killed only owned worker pid=${checkpoint.pid}; exit code=${death.code}, signal=${death.signal}, checkpoint=${checkpoint.stage}`);
  assert.equal(running.stderr(),'');
  const expected=barrier==='before-write'?baseline.beforeOperation:scenario==='periodic'?baseline.saved:baseline.profile;
  assert.deepEqual(barrier==='before-write'?checkpoint.previous:checkpoint.candidate,expected);
  if(scenario==='periodic'){assert.equal(checkpoint.current.activeMatch!.battle.gameMs,6000);assert.equal(expected.activeMatch!.battle.gameMs,5000);}
  const restored=await complete(t,'restore',directories.interrupted,scenario,'restored');assert.notEqual(restored.pid,checkpoint.pid);
  assert.deepEqual(restored.loaded,onReturn(expected));assert.deepEqual(restored.eventsOnLoad,[]);assert.deepEqual(restored.diskOnLoad,checkpoint.disk);
  assert.deepEqual(restored.paused,restored.loaded,'one hour away and a paused tick cannot settle, consume or advance');
  assert.equal(restored.loaded.highestRankPoints,expected.highestRankPoints);
  if(expected.activeMatch){
    assert.equal(restored.page,'pause');assert.equal(restored.rejectedAnotherFormal,true);assert.deepEqual(restored.blocked,restored.loaded);assert.equal(restored.loaded.rankPoints,60);
    const resumed=structuredClone(restored.loaded);resumed.activeMatch!.battle.status='running';assert.deepEqual(restored.manualResume,resumed);
    if(scenario==='win'||scenario==='loss'){
      const finished=onReturn(baseline.profile);finished.latestResult!.settledAt=RETURNED;
      assert.deepEqual(restored.continued,finished);assert.equal(restored.events.filter(e=>e.type==='result').length,1);
    }else{
      const continued=structuredClone(resumed);advanceSimulation(continued.activeMatch!.battle,continued.activeMatch!.battle.gameMs+1);continued.activeMatch!.battle.status='paused';
      assert.deepEqual(restored.continued,continued);
    }
  }else{
    assert.equal(restored.page,'result');assert.equal(restored.manualResume,null);assert.deepEqual(restored.continued,restored.loaded);assert.deepEqual(restored.events,[]);
  }
  assert.deepEqual(restored.reloaded,restored.continued,'a second read cannot grant or charge again');
  if(scenario==='win'||scenario==='loss'){
    assert.equal(restored.reloaded.rankPoints,scenario==='win'?90:60);assert.equal(restored.reloaded.highestRankPoints,90);assert.equal(restored.reloaded.qualifiedArenaWins,scenario==='win'?1:0);
  }else if(scenario==='upgrade'){
    const source=restored.loaded.activeMatch!.battle.camps.find(c=>c.id==='A01-P1')!;
    assert.equal(source.tier,2);assert.equal(source.garrison,20);assert.deepEqual(restored.loaded.activeInventory,baseline.beforeOperation.activeInventory);
  }else if(scenario==='tower'||scenario==='volley'){
    const battle=restored.loaded.activeMatch!.battle,target=battle.camps.find(c=>c.id==='A01-N5')!;
    assert.equal(battle.gameMs,scenario==='tower'?2000:battle.armies[0]!.volleyCheckAtMs!);assert.equal(target.nextShotAtMs,scenario==='tower'?4000:2000);
    if(scenario==='volley'){assert.equal(battle.armies.length,1);assert.equal(battle.armies[0]!.volleyState,'fired');assert.equal(battle.armies[0]!.volleyCheckAtMs,675);assert.equal(target.garrison,17);}
    assert.equal(restored.events.filter(e=>e.type==='tower-shot'||e.type==='volley').length,0,'load and the next millisecond cannot replay saved shooting');
    assert.deepEqual(restored.loaded.activeInventory,baseline.beforeOperation.activeInventory);
  }else if(scenario!=='periodic'){
    assert.equal(restored.reloaded.activeInventory[scenario],1);const battle=restored.loaded.activeMatch!.battle;
    if(scenario==='mobilize'){const c=battle.camps.find(c=>c.id==='A01-P1')!;assert.equal(c.mobilizeUntil,6000);assert.deepEqual(c.bonusBudget,{numerator:'8',denominator:'1'});}
    if(scenario==='supply')assert.equal(battle.camps.find(c=>c.id==='A01-P1')!.garrison,36);
    if(scenario==='feint')assert.equal(battle.camps.find(c=>c.id==='A01-E1')!.feintUntil,4000);
    if(scenario==='march'){assert.equal(battle.camps.find(c=>c.id==='A01-P1')!.garrison,15);assert.equal(battle.armies.length,1);assert.equal(battle.armies[0]!.initialCount,15);}
  }
});
