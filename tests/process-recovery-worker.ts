import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { GameSession } from '../src/app/session.ts';
import type { Page } from '../src/app/session.ts';
import { decodeEnvelope, SLOT_KEYS } from '../src/app/storage.ts';
import type { StoragePort } from '../src/app/storage.ts';
import { CARD_IDS } from '../src/core/progress.ts';
import type { Profile } from '../src/core/progress.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { fraction } from '../src/core/fraction.ts';

export type Scenario='periodic'|'mobilize'|'supply'|'feint'|'march'|'upgrade'|'tower'|'volley'|'win'|'loss';
export type Barrier='none'|'committed'|'before-write'|'after-write';
type Disk=[string,string|null][];
export type WorkerReport=
  | {kind:'checkpoint';pid:number;stage:string;previous:Profile;candidate:Profile;current:Profile;disk:Disk}
  | {kind:'complete';pid:number;profile:Profile;saved:Profile;beforeOperation:Profile;disk:Disk}
  | {kind:'restored';pid:number;loaded:Profile;page:Page;eventsOnLoad:BattleEvent[];diskOnLoad:Disk;blocked:Profile|null;paused:Profile;manualResume:Profile|null;continued:Profile;reloaded:Profile;rejectedAnotherFormal:boolean|null;events:BattleEvent[]};

const NOW=Date.parse('2026-09-11T12:00:00+08:00'),RETURNED=NOW+3600000;
const [mode,directory,scenarioArg,barrierArg]=process.argv.slice(2);
assert.ok(mode==='start'||mode==='restore');assert.ok(directory);
assert.ok(['periodic','mobilize','supply','feint','march','upgrade','tower','volley','win','loss'].includes(scenarioArg!));
assert.ok(['none','committed','before-write','after-write'].includes(barrierArg!));
const scenario=scenarioArg as Scenario,barrier=barrierArg as Barrier;
const root=resolve(directory),allowed=resolve('.tmp/polish-and-acceptance/process-recovery')+sep;
assert.ok(root.startsWith(allowed),'worker storage must stay inside its dedicated test directory');
assert.ok(process.send,'the worker must be spawned with a private IPC channel');
process.on('message',()=>{});
const send=(report:WorkerReport|{kind:'error';message:string})=>new Promise<void>((done,reject)=>process.send!(report,error=>error?reject(error):done()));
const copy=<T>(value:T):T=>structuredClone(value);
const filename=(key:string)=>{const index=SLOT_KEYS.indexOf(key as typeof SLOT_KEYS[number]);assert.ok(index>=0);return resolve(root,`slot-${index}.json`);};
async function read(key:string):Promise<string|null>{try{return await readFile(filename(key),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
const disk=async():Promise<Disk>=>Promise.all(SLOT_KEYS.map(async key=>[key,await read(key)] as [string,string|null]));
let now=mode==='restore'?RETURNED:NOW,armed=false,saved:Profile|null=null,session:GameSession;
const events:BattleEvent[]=[];
async function stop(stage:string,previous:Profile,candidate:Profile){
  await send({kind:'checkpoint',pid:process.pid,stage,previous:copy(previous),candidate:copy(candidate),current:copy(session.profile!),disk:await disk()});
  // The parent kills only this worker after receiving the exact disk boundary.
  await new Promise<never>(()=>{});
}
const storage:StoragePort={read,async write(key,value){
  const candidate=decodeEnvelope(value).data,previous=saved;
  if(armed&&barrier==='before-write'){assert.ok(previous);await stop('before-write',previous,candidate);}
  await writeFile(filename(key),value);saved=copy(candidate);
  if(armed&&barrier==='after-write'){assert.ok(previous);await stop('after-write',previous,candidate);}
},async remove(){throw new Error('These process-recovery scenarios never delete a save');}};
const make=()=>new GameSession({storage,now:()=>now,random:()=>.2,notify:()=>{},events:batch=>events.push(...batch)});
async function idle(s:GameSession){for(let i=0;s.busy&&i<2000;i++)await new Promise(done=>setTimeout(done,1));assert.equal(s.busy,0);assert.equal(s.error,'');}
async function tickTo(at:number){while(session.match!.battle.gameMs<at){session.tick(Math.min(250,at-session.match!.battle.gameMs));await idle(session);}}

async function start(){
  session=make();await session.load();assert.equal(session.error,'');const p=session.profile!;
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];p.activeInventory={mobilize:2,march:2,supply:2,feint:2};p.passiveLevels={farming:2,logistics:2,fortification:2};p.rankPoints=60;p.highestRankPoints=scenario==='win'?80:90;
  assert.equal(await session.start('A01'),true);const b=session.match!.battle;
  b.camps.find(c=>c.id==='A01-P1')!.garrison=30;
  for(const f of b.factions)f.nextAiAtMs=10000;
  if(scenario==='tower'||scenario==='volley'){
    const source=b.camps.find(c=>c.id==='A01-N2')!,target=b.camps.find(c=>c.id==='A01-N5')!;
    source.owner='P';source.garrison=20;target.owner='E1';target.garrison=20;target.nextShotAtMs=2000;
  }
  if(scenario==='win'||scenario==='loss'){
    b.gameMs=239999;b.hasPlayerDispatch=true;
    for(const f of b.factions)f.nextAiAtMs=240001;
    for(const c of b.camps){
      if(c.owner===null)c.owner=scenario==='win'?'P':'E1';
      c.garrison=c.owner==='P'?30:c.owner==='E1'&&scenario==='loss'?50:0;c.credit=fraction(0);
      if(c.type==='fort')c.nextShotAtMs=240001;
    }
  }
  await session.pause();await session.resume();const beforeOperation=copy(session.profile!);
  if(scenario==='periodic'){
    assert.equal(await session.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4'}),true);
    await tickTo(5000);assert.equal(saved!.activeMatch!.battle.gameMs,5000);await tickTo(6000);
    assert.equal(saved!.activeMatch!.battle.gameMs,5000);
    if(barrier!=='none')await stop('periodic-5000',saved!,saved!);
  }else if(scenario==='win'||scenario==='loss'){
    armed=true;session.tick(1);await idle(session);
    assert.equal(session.profile!.latestResult!.result!.playerRank,scenario==='win'?1:2);
  }else if(scenario==='upgrade'){
    assert.equal(await session.action({kind:'upgrade',targetId:'A01-P1'}),true);
    if(barrier==='committed')await stop('committed-upgrade',beforeOperation,session.profile!);
  }else if(scenario==='tower'||scenario==='volley'){
    assert.equal(await session.action({kind:'dispatch',sourceId:'A01-N2',targetId:'A01-N5'}),true);
    await tickTo(scenario==='tower'?2000:session.match!.battle.armies[0]!.volleyCheckAtMs!);await session.pause();
    assert.equal(events.filter(e=>e.type=== (scenario==='tower'?'tower-shot':'volley')).length,1);
    assert.deepEqual(saved,session.profile,'the shooting batch must be durably saved before interruption');
    if(barrier==='committed')await stop(`saved-${scenario}`,beforeOperation,session.profile!);
  }else{
    const accepted=scenario==='march'?await session.action({kind:'dispatch',sourceId:'A01-P1',targetId:'A01-N4',march:true}):await session.action({kind:'card',cardId:scenario,targetId:scenario==='feint'?'A01-E1':'A01-P1'});
    assert.equal(accepted,true);assert.equal(session.profile!.activeInventory[scenario],1);
    if(barrier==='committed')await stop('committed',beforeOperation,session.profile!);
  }
  assert.ok(saved);await send({kind:'complete',pid:process.pid,profile:copy(session.profile!),saved:copy(saved),beforeOperation,disk:await disk()});
}

async function restore(){
  session=make();await session.load();assert.equal(session.error,'');const loaded=copy(session.profile!),page=session.page,eventsOnLoad=copy(events),diskOnLoad=await disk();
  let blocked:Profile|null=null,manualResume:Profile|null=null,rejectedAnotherFormal:boolean|null=null;
  if(session.match){
    rejectedAnotherFormal=!(await session.start('A02'));blocked=copy(session.profile!);assert.equal(rejectedAnotherFormal,true);
  }
  session.tick(250);await idle(session);const paused=copy(session.profile!);
  if(session.match){
    await session.resume();manualResume=copy(session.profile!);session.tick(1);await idle(session);
    if(session.match)await session.pause();
  }
  const continued=copy(session.profile!);await session.load();assert.equal(session.error,'');const reloaded=copy(session.profile!);
  await send({kind:'restored',pid:process.pid,loaded,page,eventsOnLoad,diskOnLoad,blocked,paused,manualResume,continued,reloaded,rejectedAnotherFormal,events:copy(events)});
}
try{if(mode==='start')await start();else await restore();process.disconnect();}
catch(error){await send({kind:'error',message:error instanceof Error?error.stack??error.message:String(error)});process.exitCode=1;process.disconnect();}
