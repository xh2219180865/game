import { campCapacity } from '../core/config.ts';
import { compare, fraction, isFraction, ONE, ZERO } from '../core/fraction.ts';
import { travelTime, volleyOffset } from '../core/geometry.ts';
import { connected, LEGACY_A01_CAMPS, MAPS } from '../core/maps.ts';
import { ACTIVE_IDS, CARD_IDS, CARDS, PASSIVE_IDS, weekIdAt } from '../core/progress.ts';
import type { Profile } from '../core/progress.ts';
import type { Battle, MapId } from '../core/types.ts';

function requireValue(ok:unknown,reason:string):asserts ok { if(!ok)throw new Error(reason); }
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const week=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&weekIdAt(Date.parse(`${v}T00:00:00+08:00`))===v;
function counts(value:unknown,ids:readonly string[]):boolean {return record(value)&&Object.keys(value).length===ids.length&&ids.every(id=>integer(value[id]));}

export function validateBattle(value:unknown):asserts value is Battle {
  requireValue(record(value),'战场格式不完整');const b=value as unknown as Battle;
  requireValue(text(b.id)&&b.rulesetId==='tc-v1'&&(b.ruleRevision==='1.5'||b.ruleRevision==='1.6')&&Object.hasOwn(MAPS,b.mapId),'战场规则不兼容');
  const map=MAPS[b.mapId];
  requireValue(integer(b.gameMs)&&integer(b.nextEntityId)&&b.nextEntityId>0&&integer(b.nextEventId)&&b.nextEventId>0,'战场时钟或序号异常');
  requireValue(['running','paused','finished'].includes(b.status)&&typeof b.awaitingFirstDispatch==='boolean'&&typeof b.hasPlayerDispatch==='boolean','战场状态异常');
  requireValue(b.deadlineMs===(map.tutorial?null:240000)&&(b.deadlineMs===null||b.gameMs<=b.deadlineMs),'战场截止时间异常');
  requireValue(!b.awaitingFirstDispatch||(b.mapId==='L01'&&b.gameMs===0&&!b.hasPlayerDispatch),'练兵引导状态异常');
  requireValue(Array.isArray(b.camps)&&b.camps.length===map.camps.length&&Array.isArray(b.factions)&&Array.isArray(b.armies),'战场实体异常');
  const ids=[...new Set(map.camps.flatMap(c=>c.owner?[c.owner]:[]))];
  requireValue(b.factions.length===ids.length&&new Set(b.factions.map(f=>f.id)).size===ids.length,'阵营重复或缺失');
  for(const f of b.factions){
    requireValue(ids.includes(f.id)&&typeof f.eliminated==='boolean'&&counts(f.passives,PASSIVE_IDS)&&counts(f.inventory,ACTIVE_IDS),'阵营资产异常');
    requireValue(integer(f.lastActionSequence)&&integer(f.nextAiAtMs)&&(f.rank===null||(integer(f.rank)&&f.rank>=1&&f.rank<=ids.length)),'阵营序号或名次异常');
    if(f.id!=='P'&&!f.eliminated&&b.status!=='finished')requireValue(f.nextAiAtMs>b.gameMs,'电脑事件已过期');
  }
  requireValue(new Set(b.camps.map(c=>c.id)).size===b.camps.length,'营地 ID 重复');
  const campSeeds=b.mapId==='A01'&&LEGACY_A01_CAMPS.every(seed=>b.camps.some(c=>c.id===seed.id&&c.x===seed.x&&c.y===seed.y))
    ?LEGACY_A01_CAMPS:map.camps;
  for(const c of b.camps){
    const seed=campSeeds.find(s=>s.id===c.id);requireValue(seed,'未知营地');
    requireValue(c.x===seed.x&&c.y===seed.y&&c.type===seed.type&&[1,2,3].includes(c.tier),'营地配置异常');
    requireValue(c.owner===null||ids.includes(c.owner),'营地归属异常');
    const owner=b.factions.find(f=>f.id===c.owner);
    requireValue(integer(c.garrison)&&c.garrison<=campCapacity(c,owner),'驻军数量异常');
    requireValue(isFraction(c.credit)&&compare(c.credit,ZERO)>=0&&compare(c.credit,ONE)<0,'生产余量异常');
    requireValue(isFraction(c.bonusBudget)&&compare(c.bonusBudget,ZERO)>=0,'增募预算异常');
    requireValue(integer(c.mobilizeUntil)&&integer(c.feintUntil),'效果时刻异常');
    requireValue((c.mobilizeUntil===0||c.mobilizeUntil>b.gameMs)&&(c.feintUntil===0||c.feintUntil>b.gameMs),'效果已过期');
    requireValue(c.mobilizeUntil>0||compare(c.bonusBudget,ZERO)===0,'无鼓令却存在预算');
    requireValue(c.garrison<campCapacity(c,owner)||compare(c.credit,ZERO)===0,'满营不应保留生产额度');
    requireValue(c.owner!==null||(compare(c.credit,ZERO)===0&&c.mobilizeUntil===0&&c.feintUntil===0),'中立营地不能生产或携带效果');
    requireValue(c.type==='fort'&&c.owner ? integer(c.nextShotAtMs)&&c.nextShotAtMs>b.gameMs : c.nextShotAtMs===null,'塔射节拍异常');
  }
  for(const f of b.factions)requireValue(f.eliminated===!b.camps.some(c=>c.owner===f.id)&&(!f.eliminated||f.rank!==null),'阵营存活状态异常');
  requireValue(new Set(b.armies.map(a=>a.id)).size===b.armies.length,'兵团 ID 重复');
  for(const a of b.armies){
    const source=b.camps.find(c=>c.id===a.sourceId),target=b.camps.find(c=>c.id===a.targetId),f=b.factions.find(f=>f.id===a.faction);
    requireValue(source&&target&&source!==target&&f&&!f.eliminated&&text(a.id),'在途兵团归属异常');
    requireValue(connected(b,source.id,target.id),'在途道路不相连');
    requireValue(integer(a.initialCount)&&integer(a.remainingCount)&&a.remainingCount>0&&a.remainingCount<=a.initialCount,'在途人数异常');
    requireValue(record(a.from)&&record(a.to)&&a.from.x===source.x&&a.from.y===source.y&&a.to.x===target.x&&a.to.y===target.y,'在途路径异常');
    const minimumSpeed=b.ruleRevision==='1.6'?24:80,maximumSpeed=b.ruleRevision==='1.6'?48:160;
    requireValue(Number.isFinite(a.speed)&&a.speed>=minimumSpeed&&a.speed<=maximumSpeed&&integer(a.departedAtMs)&&a.departedAtMs<=b.gameMs&&integer(a.arrivalAtMs)&&a.arrivalAtMs>b.gameMs,'在途时间或速度异常');
    const troop={barracks:'infantry',archery:'archer',relay:'cavalry',fort:'guard'}[source.type];
    requireValue(a.troopType===troop&&a.arrivalAtMs-a.departedAtMs===travelTime(source,target,a.speed),'在途兵种或旅时异常');
    if(a.troopType==='archer'){
      requireValue(a.volleyCheckAtMs===a.departedAtMs+volleyOffset(source,target,a.arrivalAtMs-a.departedAtMs),'齐射时刻异常');
      requireValue(a.volleyState==='pending'||a.volleyState==='fired'||a.volleyState==='skipped','齐射状态异常');
      requireValue(a.volleyState==='pending'?a.volleyCheckAtMs>b.gameMs:a.volleyCheckAtMs<=b.gameMs,'齐射阶段异常');
      requireValue(a.volleyState==='skipped'?['friendly','empty','zeroDamage'].includes(a.volleySkipReason!):a.volleySkipReason===null,'齐射跳过原因异常');
    }else requireValue(a.volleyCheckAtMs===null&&a.volleyState===null&&a.volleySkipReason===null,'非弓兵携带齐射状态');
  }
  requireValue((b.status==='finished')===(b.result!==null),'终局状态不一致');
  if(b.result)requireValue(integer(b.result.playerRank)&&b.result.playerRank>=1&&b.result.playerRank<=ids.length&&b.result.atMs===b.gameMs&&['last-camp','deadline','eliminated'].includes(b.result.reason),'终局记录异常');
}

export function validateProfile(value:unknown):asserts value is Profile {
  requireValue(record(value),'存档数据格式异常');const p=value as unknown as Profile;
  requireValue(text(p.generation)&&integer(p.nextMatchSequence)&&p.nextMatchSequence>0,'本地会话编号异常');
  requireValue(integer(p.rankPoints)&&integer(p.highestRankPoints)&&p.highestRankPoints>=p.rankPoints&&integer(p.formalCompleted),'永久军功或进度异常');
  requireValue(Array.isArray(p.tutorialFirstWins)&&p.tutorialFirstWins.every(id=>['L01','L02','L03'].includes(id))&&new Set(p.tutorialFirstWins).size===p.tutorialFirstWins.length,'练兵进度异常');
  requireValue(!p.tutorialFirstWins.includes('L03')||p.tutorialFirstWins.includes('L02'),'练兵解锁顺序异常');
  requireValue(!p.tutorialFirstWins.includes('L02')||p.tutorialFirstWins.includes('L01'),'练兵解锁顺序异常');
  requireValue(typeof p.firstDragCompleted==='boolean'&&(!p.tutorialFirstWins.length||p.firstDragCompleted),'拖拽教学记录异常');
  const unlocked=CARD_IDS.filter(id=>p.tutorialFirstWins.includes(CARDS[id].lesson));
  requireValue(Array.isArray(p.unlockedCardIds)&&p.unlockedCardIds.length===unlocked.length&&new Set(p.unlockedCardIds).size===unlocked.length&&p.unlockedCardIds.every(id=>unlocked.includes(id)),'永久卡池与练兵记录不一致');
  requireValue(week(p.weekId)&&week(p.maxObservedWeek)&&p.weekId===p.maxObservedWeek&&integer(p.maxObservedTime)&&weekIdAt(p.maxObservedTime)===p.weekId,'周与时钟记录异常');
  requireValue(counts(p.activeInventory,ACTIVE_IDS)&&counts(p.passiveLevels,PASSIVE_IDS)&&integer(p.qualifiedArenaWins),'本周资产异常');
  for(const id of ACTIVE_IDS)requireValue(p.activeInventory[id]===0||unlocked.includes(id),'未解锁主动存在库存');
  for(const id of PASSIVE_IDS)requireValue(p.passiveLevels[id]===0||unlocked.includes(id),'未解锁被动存在层数');
  requireValue(record(p.settings)&&['sound','vibration','reducedMotion'].every(k=>typeof (p.settings as unknown as Record<string,unknown>)[k]==='boolean'),'设置异常');
  requireValue(record(p.leaderboard)&&typeof p.leaderboard.optedIn==='boolean'&&['off','pending','synced','error'].includes(p.leaderboard.syncStatus)
    &&(p.leaderboard.pendingWins===null||integer(p.leaderboard.pendingWins))&&(p.leaderboard.lastSuccessAt===null||integer(p.leaderboard.lastSuccessAt)),'榜单偏好异常');
  if(p.activeMatch!==null){
    requireValue(record(p.activeMatch),'单局封套异常');const m=p.activeMatch;validateBattle(m.battle);
    requireValue(integer(m.realStartedAt)&&m.realStartedAt<=p.maxObservedTime&&week(m.startWeekId)&&weekIdAt(m.realStartedAt)===m.startWeekId,'单局现实时间异常');
    requireValue(m.modeId===(MAPS[m.battle.mapId].tutorial?'tutorial':'arena-four')&&m.rankedCommitment===(m.modeId==='arena-four'),'单局模式异常');
    if(m.modeId==='arena-four')requireValue(JSON.stringify(m.battle.factions.find(f=>f.id==='P')!.inventory)===JSON.stringify(p.activeInventory),'主动库存与战场不一致');
  }
  if(p.latestResult!==null){
    requireValue(record(p.latestResult),'结果格式异常');const r=p.latestResult;
    requireValue(text(r.matchId)&&Object.hasOwn(MAPS,r.mapId)&&integer(r.settledAt)&&week(r.settlementWeek)&&typeof r.resultAcknowledged==='boolean'&&typeof r.qualified==='boolean','结果基础字段异常');
    requireValue(['natural','forfeit','technical_void'].includes(r.settlementKind)&&['arena-four','tutorial'].includes(r.modeId),'结果分类异常');
    requireValue([r.rankPointsBefore,r.rankPointsAfter,r.highestRankPointsAfter,r.winsBefore,r.winsAfter,r.formalCompletedBefore,r.formalCompletedAfter].every(integer)
      &&Number.isSafeInteger(r.rankDeltaRequested)&&r.rankDeltaApplied===r.rankPointsAfter-r.rankPointsBefore&&r.rankPointsAfter===Math.max(0,r.rankPointsBefore+r.rankDeltaRequested),'结果军功异常');
    requireValue(Array.isArray(r.fixedChoices)&&r.fixedChoices.every(id=>CARD_IDS.includes(id))&&r.fixedChoices.length<=3,'结果候选异常');
  }
  if(p.choice!==null){
    requireValue(record(p.choice),'奖励格式异常');const c=p.choice;
    requireValue(text(c.choiceId)&&text(c.matchId)&&c.kind==='mixed'&&c.grantQuantity===1&&c.poolVersion==='first-seven-v1'&&week(c.weekId),'奖励标识异常');
    requireValue(['pending','claimed','abandoned','expired'].includes(c.state)&&Array.isArray(c.candidateIds)&&c.candidateIds.length>=1&&c.candidateIds.length<=3
      &&new Set(c.candidateIds).size===c.candidateIds.length&&Array.isArray(c.unlockSnapshot)&&c.unlockSnapshot.every(id=>unlocked.includes(id))&&c.candidateIds.every(id=>c.unlockSnapshot.includes(id)),'固定候选异常');
    requireValue(c.state==='claimed'?c.selected!==null&&c.candidateIds.includes(c.selected):c.selected===null,'领取状态异常');
    requireValue(c.state!=='pending'||c.weekId===p.weekId,'旧周奖励未到期');
  }
}
