import {SaveStore,type StoragePort} from '../src/app/storage.ts';
import {CARD_IDS,freshProfile,settleMatch,type Profile} from '../src/core/progress.ts';
import {applyBattleAction,advanceBattle,createBattle} from '../src/core/battle.ts';
import type {GameSession} from '../src/app/session.ts';
import type {GameView} from '../src/render/game.ts';

export type WechatAuditMode='cards'|'reward'|'reward-logistics'|'reward-fortification';
export function auditStorage(port:StoragePort,runId:string):StoragePort{
  if(!/^[a-zA-Z0-9-]{1,80}$/.test(runId))throw new Error('Invalid audit run ID');
  const prefix=`wechat-audit:v1:${runId}:`;
  return {read:key=>port.read(prefix+key),write:(key,value)=>port.write(prefix+key,value),remove:key=>port.remove(prefix+key)};
}
export function createWechatAuditProfile(mode:WechatAuditMode,now:number):Profile{
  if(!['cards','reward','reward-logistics','reward-fortification'].includes(mode))throw new Error('Unknown audit mode');
  const p=freshProfile(now,`wechat-audit-${mode}-${now}`);
  p.firstDragCompleted=true;p.tutorialFirstWins=['L01','L02','L03'];p.unlockedCardIds=[...CARD_IDS];
  p.activeInventory={mobilize:3,march:3,supply:3,feint:3};p.passiveLevels={farming:3,logistics:3,fortification:3};
  p.settings.sound=false;
  const b=createBattle('A01',{id:`${p.generation}:match:1`,firstDragCompleted:true,inventory:p.activeInventory,passives:p.passiveLevels});
  p.nextMatchSequence=2;p.activeMatch={battle:b,modeId:'arena-four',rankedCommitment:true,realStartedAt:now,startWeekId:p.weekId};
  if(mode==='cards'){
    // Controlled test opposition gives native touch checks time; standard maps and AI remain untouched.
    for(const f of b.factions)f.nextAiAtMs=240001;
    const bow=b.camps.find(c=>c.id==='A01-N2')!,tower=b.camps.find(c=>c.id==='A01-N5')!;
    bow.owner='P';bow.garrison=20;tower.owner='E1';tower.garrison=20;tower.nextShotAtMs=2000;
  }else{
    const sent=applyBattleAction(b,{kind:'dispatch',faction:'P',sequence:1,sourceId:'A01-P1',targetId:'A01-N2'});
    if(!sent.ok)throw new Error('Audit dispatch setup failed');
    for(const camp of b.camps)camp.owner='P';
    advanceBattle(b,240000);
    settleMatch(p,b.id,now,'natural',()=>mode==='reward-logistics'?.5:mode==='reward-fortification'?.9:.3);
  }
  return p;
}
export async function initializeWechatAudit(session:GameSession,storage:StoragePort,view:GameView,mode:WechatAuditMode):Promise<void>{
  if(!['cards','reward','reward-logistics','reward-fortification'].includes(mode))throw new Error('Unknown audit mode');
  const store=new SaveStore(storage),loaded=await store.load();
  if(loaded.kind==='empty')await store.save(createWechatAuditProfile(mode,Date.now()),Date.now());
  await session.load();
  let previous='';const draw=view.draw.bind(view);
  view.draw=now=>{
    draw(now);
    const c=(view as unknown as {ctx:CanvasRenderingContext2D}).ctx;
    const markerY=Math.max(0,view.viewport.top-19);
    c.save();c.fillStyle='#FFF5CC';c.fillRect(0,markerY,176,19);c.fillStyle='#593D1A';c.font='11px sans-serif';c.textAlign='left';c.textBaseline='middle';c.fillText('独立测试 · 不计玩家成绩',5,markerY+10);c.restore();
    const p=session.profile,b=session.match?.battle;
    const state={page:session.page,error:session.error,inventory:p?.activeInventory,passives:p?.passiveLevels,battlePassives:b?.factions.find(f=>f.id==='P')?.passives,choice:p?.choice?.state,selected:p?.choice?.selected,rank:p?.rankPoints};
    const signature=JSON.stringify(state);
    if(signature!==previous){previous=signature;console.log('[wechat-audit]',JSON.stringify({...state,gameMs:b?.gameMs,camps:b?.camps.map(c=>({id:c.id,owner:c.owner,count:c.garrison,mobilizeUntil:c.mobilizeUntil,feintUntil:c.feintUntil})),armies:b?.armies.map(a=>({id:a.id,count:a.remainingCount,arrival:a.arrivalAtMs}))}));}
  };
}
