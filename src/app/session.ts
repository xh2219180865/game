import { advanceSimulation } from '../core/ai.ts';
import { applyBattleAction, createBattle, factionOf } from '../core/battle.ts';
import { MAPS, nextFormalMap } from '../core/maps.ts';
import { claimChoice, freshProfile, lessonOpen, observeTime, settleMatch, weekIdAt } from '../core/progress.ts';
import type { Match, Profile } from '../core/progress.ts';
import type { BattleAction, BattleEvent, CardId, MapId, PassiveCardId } from '../core/types.ts';
import { SaveStore } from './storage.ts';
import type { Envelope, StoragePort } from './storage.ts';

export type Page='loading'|'home'|'battle'|'pause'|'result'|'lessons'|'prepare'|'choice'|'library'|'ranks'|'settings'|'about'|'leaderboard'|'recovery';
export type PlayerAction=BattleAction extends infer A ? A extends BattleAction ? Omit<A,'faction'|'sequence'> : never : never;
export type SessionPresentation={kind:'passive-start';matchId:string}|{kind:'passive-claim';choiceId:string;cardId:PassiveCardId;before:number;after:number};
export interface SessionOptions {storage:StoragePort;now:()=>number;random:()=>number;notify:(message:string)=>void;events:(events:BattleEvent[])=>void;present?:(event:SessionPresentation)=>void}
class ActionRejected extends Error {}
export class GameSession {
  profile:Profile|null=null;
  page:Page='loading';
  returnPage:Page='home';
  busy=0;
  error='';
  backup:Envelope|null=null;
  temporary:Match|null=null;
  weekNotice=false;
  savedAt:number|null=null;
  restorationVersion=0;
  private store:SaveStore;
  private options:SessionOptions;
  private queue:Promise<unknown>=Promise.resolve();
  private checkpoint=0;
  private timeCheck=0;
  private inputSequence=0;
  private generationCounter=0;
  private practiceVersion=0;
  private enteringBattle=0;
  private presentationVersion=0;
  private resetting=false;
  private maintenance=new Set<Promise<void>>();
  constructor(options:SessionOptions){this.options=options;this.store=new SaveStore(options.storage);}
  get match():Match|null{return this.temporary??this.profile?.activeMatch??null;}
  get expired():boolean{return !!this.match&&Math.max(this.options.now(),this.profile?.maxObservedTime??0)-this.match.realStartedAt>86400000;}
  private generation():string{return `${this.options.now().toString(36)}-${Math.floor(this.options.random()*4294967296).toString(36)}-${++this.generationCounter}`;}
  private trackMaintenance():()=>void {
    let done:()=>void=()=>{};const pending=new Promise<void>(resolve=>{done=resolve;});this.maintenance.add(pending);
    return ()=>{this.maintenance.delete(pending);done();};
  }
  async load():Promise<void>{
    if(this.resetting)return;
    this.presentationVersion++;
    const version=this.practiceVersion,done=this.trackMaintenance();
    this.busy++;this.error='';
    try{
      const loaded=await this.store.load();
      if(loaded.kind==='recovery'){this.backup=loaded.backup;throw new Error(loaded.reason);}
      if(loaded.kind==='empty'){
        const p=freshProfile(this.options.now(),this.generation());const e=await this.store.save(p,this.options.now());this.profile=e.data;this.savedAt=e.writtenAt;
      }else{this.profile=loaded.envelope.data;this.savedAt=loaded.envelope.writtenAt;}
      const p=this.profile!,changed=observeTime(p,this.options.now());
      if(changed==='backward')throw new Error('设备时间早于已记录周，请校准时间后重试。原记录已保留。');
      if(p.activeMatch){
        p.activeMatch.battle.status=p.activeMatch.battle.result?'finished':'paused';
        if(version===this.practiceVersion&&!this.temporary){this.checkpoint=p.activeMatch.battle.gameMs;this.inputSequence=factionOf(p.activeMatch.battle,'P')!.lastActionSequence;}
      }
      if(changed==='changed'){this.weekNotice=true;await this.store.save(p,this.options.now());}
      if(version===this.practiceVersion&&!this.temporary)this.page=p.latestResult&&!p.latestResult.resultAcknowledged?'result':p.activeMatch?'pause':'home';
      if(p.activeMatch?.battle.result)await this.finish([],p.activeMatch);
      if(version===this.practiceVersion&&!this.temporary)this.restorationVersion++;
    }catch(e){this.fail(e);}finally{done();this.busy--;}
  }
  private fail(e:unknown,match:Match|null=this.profile?.activeMatch??null):void {
    this.error=e instanceof Error?e.message:'操作未完成';if(match?.battle.status==='running')match.battle.status='paused';
    if(!this.temporary||match===this.temporary)this.page='recovery';
  }
  private transaction(work:(p:Profile)=>void,effectiveNow?:number):Promise<boolean>{
    if(this.resetting)return Promise.resolve(false);
    this.busy++;
    const task=this.queue.then(async()=>{
      if(!this.profile||this.error)throw new Error(this.error||'存档尚未载入');
      let p=JSON.parse(JSON.stringify(this.profile)) as Profile;
      const changed=observeTime(p,effectiveNow??this.options.now());
      if(changed==='backward')throw new Error('设备时间早于已记录周，请校准时间');
      const weekState=changed==='changed'?JSON.parse(JSON.stringify(p)) as Profile:null;
      let rejected:ActionRejected|null=null;
      try{work(p);}catch(e){if(!(e instanceof ActionRejected)||!weekState)throw e;p=weekState;rejected=e;}
      const e=await this.store.save(p,this.options.now());this.profile=e.data;this.savedAt=e.writtenAt;
      if(changed==='changed'){this.weekNotice=true;this.options.notify('新周已开始，旧锦囊到期，本局兵法保留');}
      if(weekIdAt(this.options.now())>this.profile.weekId){
        const rolled=JSON.parse(JSON.stringify(this.profile)) as Profile;observeTime(rolled,this.options.now());
        const next=await this.store.save(rolled,this.options.now());this.profile=next.data;this.savedAt=next.writtenAt;this.weekNotice=true;
        this.options.notify('新周已开始，旧锦囊到期，本局兵法保留');
      }
      if(rejected)throw rejected;
      return true;
    }).catch(e=>{if(e instanceof ActionRejected)this.options.notify(e.message);else this.fail(e);return false;}).finally(()=>{this.busy--;});
    this.queue=task;return task;
  }
  primary():void {
    if(this.error){this.page='recovery';return;}
    const p=this.profile;if(!p)return;
    if(p.latestResult&&!p.latestResult.resultAcknowledged){this.page='result';return;}
    if(p.choice?.state==='pending'){this.page='choice';return;}
    if(p.activeMatch){this.page='pause';return;}
    if(!p.tutorialFirstWins.includes('L01')){void this.start('L01');return;}
    this.page='prepare';
  }
  async start(mapId:MapId,temporary=false):Promise<boolean>{
    if(this.resetting)return false;
    const p=this.profile,map=MAPS[mapId];
    if(!p&&!temporary)return false;
    if(!map.tutorial&&(!p?.tutorialFirstWins.includes('L01')||p.activeMatch||p.choice?.state==='pending'||(p.latestResult&&!p.latestResult.resultAcknowledged))){this.primary();return false;}
    if(map.tutorial&&!temporary&&p&&!lessonOpen(p,mapId)){this.options.notify('请先通关上一课');return false;}
    if(map.tutorial&&(this.error||p?.activeMatch||p?.choice?.state==='pending'||(p?.latestResult&&!p.latestResult.resultAcknowledged)))temporary=true;
    if(temporary){
      this.practiceVersion++;
      const now=this.options.now();
      this.temporary={battle:createBattle(mapId,{id:`practice-${this.generation()}`,firstDragCompleted:p?.firstDragCompleted}),modeId:'tutorial',rankedCommitment:false,realStartedAt:now,startWeekId:weekIdAt(now)};
      this.inputSequence=0;this.page='battle';this.options.notify('临时练兵：不覆盖存档，不解锁、不计分');return true;
    }
    const version=this.practiceVersion,presentationVersion=this.presentationVersion;this.enteringBattle++;
    const ok=await this.transaction(d=>{
      if(d.activeMatch)throw new ActionRejected('已有对局，请先继续或放弃');
      const id=`${d.generation}:${d.nextMatchSequence++}`,now=d.maxObservedTime;
      d.activeMatch={battle:createBattle(mapId,{id,firstDragCompleted:d.firstDragCompleted,passives:d.passiveLevels,inventory:d.activeInventory}),
        modeId:map.tutorial?'tutorial':'arena-four',rankedCommitment:!map.tutorial,realStartedAt:now,startWeekId:d.weekId};
    });
    this.enteringBattle--;
    if(ok&&version===this.practiceVersion&&!this.temporary){this.inputSequence=0;this.checkpoint=0;this.page='battle';if(presentationVersion===this.presentationVersion)this.options.present?.({kind:'passive-start',matchId:this.match!.battle.id});}return ok;
  }
  async action(input:PlayerAction):Promise<boolean>{
    const match=this.match;if(!match||this.page!=='battle')return false;
    const action={...input,faction:'P' as const,sequence:++this.inputSequence} as BattleAction;
    if(this.temporary){const r=applyBattleAction(match.battle,action);if(r.ok)this.options.events(r.events);else this.options.notify(r.reason);return r.ok;}
    const id=match.battle.id,version=this.practiceVersion;let events:BattleEvent[]=[];
    const ok=await this.transaction(p=>{
      if(p.activeMatch?.battle.id!==id)throw new ActionRejected('对局已变化');
      const r=applyBattleAction(p.activeMatch.battle,action);if(!r.ok)throw new ActionRejected(r.reason);
      events=r.events;p.firstDragCompleted ||= p.activeMatch.battle.hasPlayerDispatch;
      if(p.activeMatch.modeId==='arena-four')p.activeInventory={...factionOf(p.activeMatch.battle,'P')!.inventory};
    });if(ok&&version===this.practiceVersion&&this.match?.battle.id===id&&this.page==='battle')this.options.events(events);return ok;
  }
  tick(deltaMs:number):void {
    if(this.busy||this.page!=='battle'||!this.match||(!this.temporary&&this.error))return;
    const now=this.options.now();
    if(!this.temporary&&now-this.timeCheck>=1000){this.timeCheck=now;
      if(weekIdAt(now)!==this.profile!.weekId){void this.transaction(()=>{});return;}
    }
    const b=this.match.battle;if(b.status!=='running')return;
    try{
      const before=b.gameMs;
      const events=advanceSimulation(b,b.gameMs+Math.max(0,Math.min(250,Math.floor(deltaMs))));this.options.events(events.filter(e=>e.type!=='result'));
      if(b.deadlineMs!==null&&before<210000&&b.gameMs>=210000)this.options.notify('还剩 30 秒：到时城多者胜，同城数比兵力');
      if(b.result){void this.finish(events.filter(e=>e.type==='result'));return;}
      if(!this.temporary&&b.gameMs-this.checkpoint>=5000){this.checkpoint=b.gameMs;void this.transaction(()=>{});}
    }catch(e){this.fail(e,this.match);}
  }
  private async finish(events:BattleEvent[]=[],match:Match|null=this.match):Promise<void>{
    if(!match)return;
    if(match===this.temporary){this.page='result';this.options.events(events);return;}
    const id=match.battle.id,version=this.practiceVersion;
    const settledAt=this.options.now();
    if(await this.transaction(p=>{settleMatch(p,id,settledAt,'natural',this.options.random);},settledAt)&&version===this.practiceVersion&&!this.temporary){this.page='result';this.options.events(events);}
  }
  async pause(destination:Page='pause'):Promise<void>{
    if(this.temporary){
      if(this.match?.battle.status==='running')this.match.battle.status='paused';
      if(destination==='home'){this.temporary=null;this.page=this.profile?'home':'recovery';}else this.page=destination;
      return;
    }
    if(this.error){this.page='recovery';return;}
    const version=this.practiceVersion;
    const hasMatchOrEntry=!!this.profile?.activeMatch||this.enteringBattle>0;
    if(hasMatchOrEntry)this.page='pause';
    if(hasMatchOrEntry){if(await this.transaction(p=>{if(p.activeMatch&&p.activeMatch.battle.status!=='finished')p.activeMatch.battle.status='paused';})&&version===this.practiceVersion&&!this.temporary)this.page=destination;}else this.page=destination;
  }
  async suspend():Promise<void>{this.presentationVersion++;if(this.page==='battle'||this.enteringBattle>0)await this.pause();}
  async resume():Promise<void>{
    if(!this.match)return;
    if(this.expired&&!this.temporary){this.options.notify('超过 24 小时不能续战，请确认放弃或保留待处理');return;}
    if(this.temporary){this.match.battle.status='running';this.page='battle';return;}
    const version=this.practiceVersion,id=this.match.battle.id;
    this.enteringBattle++;
    const ok=await this.transaction(p=>{
      if(p.activeMatch?.battle.id!==id||p.activeMatch.battle.result)throw new ActionRejected('对局已变化');
      if(Math.max(this.options.now(),p.maxObservedTime)-p.activeMatch.realStartedAt>86400000)throw new ActionRejected('超过 24 小时不能续战，请确认放弃或保留待处理');
      p.activeMatch.battle.status='running';
    });this.enteringBattle--;
    if(ok&&version===this.practiceVersion&&!this.temporary)this.page='battle';
  }
  async acknowledge(destination:Page='home'):Promise<void>{
    if(this.temporary){this.temporary=null;this.page=this.profile?destination:'recovery';return;}
    const version=this.practiceVersion;
    if(await this.transaction(p=>{if(p.latestResult)p.latestResult.resultAcknowledged=true;})&&version===this.practiceVersion&&!this.temporary)this.page=destination;
  }
  async claim(id:CardId):Promise<void>{
    const choiceId=this.profile?.choice?.choiceId;if(!choiceId)return;
    const version=this.practiceVersion,presentationVersion=this.presentationVersion;let before:number|null=null;
    if(await this.transaction(p=>{if(id in p.passiveLevels)before=p.passiveLevels[id as PassiveCardId];if(!claimChoice(p,choiceId,id,this.options.now()))throw new ActionRejected('本次选择已处理或已到期');})&&version===this.practiceVersion&&!this.temporary){
      this.options.notify('已领取，本次只获得这一张');this.page='home';
      const p=this.profile,after=p?.passiveLevels[id as PassiveCardId];
      if(presentationVersion===this.presentationVersion&&before!==null&&after===before+1&&p?.choice?.choiceId===choiceId&&p.choice.state==='claimed'&&p.choice.weekId===p.weekId)this.options.present?.({kind:'passive-claim',choiceId,cardId:id as PassiveCardId,before,after});
    }
  }
  async abandonChoice():Promise<void>{const version=this.practiceVersion;if(await this.transaction(p=>{if(p.choice?.state==='pending')p.choice.state='abandoned';if(p.latestResult)p.latestResult.resultAcknowledged=true;})&&version===this.practiceVersion&&!this.temporary)this.page='home';}
  async forfeit():Promise<void>{
    if(this.temporary){this.temporary=null;this.page=this.profile?'lessons':'recovery';return;}
    const id=this.match?.battle.id,version=this.practiceVersion;if(!id)return;
    let showResult=false;
    if(await this.transaction(p=>{const result=settleMatch(p,id,this.options.now(),'forfeit',this.options.random);showResult=result.settlementKind==='natural'&&!result.resultAcknowledged;})&&version===this.practiceVersion&&!this.temporary)this.page=showResult?'result':'home';
  }
  async setting(key:keyof Profile['settings']):Promise<void>{await this.transaction(p=>{p.settings[key]=!p.settings[key];});}
  async recover():Promise<void>{
    if(this.resetting||!this.backup)return;const done=this.trackMaintenance();this.busy++;
    try{await this.store.recoverBackup(this.backup,this.options.now());this.backup=null;this.error='';await this.load();}catch(e){this.fail(e);}finally{done();this.busy--;}
  }
  async reset():Promise<void>{
    if(this.resetting)return;this.resetting=true;this.busy++;await Promise.all(this.maintenance);await this.queue;this.temporary=null;
    try{const e=await this.store.reset(freshProfile(this.options.now(),this.generation()),this.options.now());this.profile=e.data;this.error='';this.backup=null;this.page='home';this.inputSequence=0;}
    catch(e){this.fail(new Error('清除未完成，请重新读取确认；部分本地记录可能已清除。',{cause:e}));}finally{this.resetting=false;this.busy--;}
  }
  get nextMap():MapId{return nextFormalMap(this.profile?.formalCompleted??0);}
}
