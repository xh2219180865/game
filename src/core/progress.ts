import { emptyInventory, emptyPassives } from './config.ts';
import type { ActiveCardId, ActiveInventory, Battle, BattleResult, CardId, MapId, PassiveCardId, PassiveLevels } from './types.ts';

export const ACTIVE_IDS: ActiveCardId[] = ['mobilize','march','supply','feint'];
export const PASSIVE_IDS: PassiveCardId[] = ['farming','logistics','fortification'];
export const CARD_IDS: CardId[] = [...ACTIVE_IDS,...PASSIVE_IDS];
export const CARDS: Record<CardId,{ name:string; short:string; kind:'active'|'passive'; lesson:MapId; description:string }> = {
  mobilize:{name:'鸣鼓征兵',short:'征兵',kind:'active',lesson:'L01',description:'己营增募 6 秒，额外增加一倍自然产速，每张最多增募 8 点额度。'},
  march:{name:'倍道兼行',short:'兼行',kind:'active',lesson:'L03',description:'本次出征速度 ×1.4；只有实际到达更快时才消耗。'},
  supply:{name:'征召乡勇',short:'乡勇',kind:'active',lesson:'L01',description:'己营立即补充最多 6 兵，受容量限制。'},
  feint:{name:'火袭粮营',short:'火袭',kind:'active',lesson:'L02',description:'敌营停产 4 秒；塔营同时停射，现有驻军不受伤。'},
  farming:{name:'屯田积谷',short:'屯田',kind:'passive',lesson:'L01',description:'本周每局自动提高自然产速，重复领取获得递减增益。'},
  logistics:{name:'兵贵神速',short:'神速',kind:'passive',lesson:'L03',description:'本周每局自动提高新出征速度，不改变已在途部队。'},
  fortification:{name:'扩营增垒',short:'扩营',kind:'passive',lesson:'L02',description:'本周每局自动增加驻军容量，不免费补兵或减伤。'},
};
export interface Choice {
  choiceId:string; matchId:string; kind:'mixed'; grantQuantity:1; candidateIds:CardId[]; unlockSnapshot:CardId[]; poolVersion:'first-seven-v1';
  weekId:string; state:'pending'|'claimed'|'abandoned'|'expired'; selected:CardId|null;
}
export interface Match {
  battle:Battle; modeId:'arena-four'|'tutorial'; realStartedAt:number; startWeekId:string; rankedCommitment:boolean;
  meritPolicy?:'growth-v1';
}
export interface Settlement {
  matchId:string; mapId:MapId; modeId:Match['modeId']; settledAt:number; settlementWeek:string; settlementKind:'natural'|'forfeit'|'technical_void';
  result:BattleResult|null; qualified:boolean; rankDeltaRequested:number; rankDeltaApplied:number; rankPointsBefore:number; rankPointsAfter:number;
  highestRankPointsAfter:number; winsBefore:number; winsAfter:number; formalCompletedBefore:number; formalCompletedAfter:number;
  fixedChoices:CardId[]; resultAcknowledged:boolean;
  meritPolicy?:'growth-v1';
}
export interface WeeklyRecord {
  archivedWeeks:number; totalWins:number; bestWins:number; lastWeekId:string; lastWeekWins:number;
}
export interface Profile {
  generation:string; nextMatchSequence:number; rankPoints:number; highestRankPoints:number; tutorialFirstWins:MapId[]; unlockedCardIds:CardId[];
  firstDragCompleted:boolean; formalCompleted:number; weekId:string; activeInventory:ActiveInventory; passiveLevels:PassiveLevels; qualifiedArenaWins:number;
  maxObservedWeek:string; maxObservedTime:number; activeMatch:Match|null; latestResult:Settlement|null; choice:Choice|null;
  settings:{sound:boolean;vibration:boolean;reducedMotion:boolean};
  weeklyRecord?:WeeklyRecord;
  leaderboard:{optedIn:boolean;pendingWins:number|null;syncStatus:'off'|'pending'|'synced'|'error';lastSuccessAt:number|null};
}
export function weekIdAt(now:number):string {
  if(!Number.isSafeInteger(now)||now<0)throw new RangeError('Invalid wall time');
  const d=new Date(now+8*3600000);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  return d.toISOString().slice(0,10);
}
export function nextWeekAt(weekId:string):number { return Date.parse(`${weekId}T00:00:00+08:00`)+7*86400000; }
export function freshProfile(now:number,generation:string):Profile {
  const weekId=weekIdAt(now);
  return {generation,nextMatchSequence:1,rankPoints:0,highestRankPoints:0,tutorialFirstWins:[],unlockedCardIds:[],firstDragCompleted:false,formalCompleted:0,
    weekId,activeInventory:emptyInventory(),passiveLevels:emptyPassives(),qualifiedArenaWins:0,maxObservedWeek:weekId,maxObservedTime:now,
    activeMatch:null,latestResult:null,choice:null,settings:{sound:true,vibration:false,reducedMotion:false},
    leaderboard:{optedIn:false,pendingWins:null,syncStatus:'off',lastSuccessAt:null}};
}
export function observeTime(p:Profile,now:number):'same'|'changed'|'backward' {
  const week=weekIdAt(now);
  if(week<p.maxObservedWeek)return 'backward';
  p.maxObservedTime=Math.max(p.maxObservedTime,now);p.maxObservedWeek=week;
  if(week===p.weekId)return 'same';
  const previous=p.weeklyRecord;
  p.weeklyRecord={archivedWeeks:increment(previous?.archivedWeeks??0),totalWins:increment(previous?.totalWins??0,p.qualifiedArenaWins),
    bestWins:Math.max(previous?.bestWins??0,p.qualifiedArenaWins),lastWeekId:p.weekId,lastWeekWins:p.qualifiedArenaWins};
  p.weekId=week;p.activeInventory=emptyInventory();p.passiveLevels=emptyPassives();p.qualifiedArenaWins=0;
  if(p.choice?.state==='pending')p.choice.state='expired';
  if(p.activeMatch)for(const f of p.activeMatch.battle.factions)f.inventory=emptyInventory();
  p.leaderboard.pendingWins=p.leaderboard.optedIn?0:null;p.leaderboard.syncStatus=p.leaderboard.optedIn?'pending':'off';
  return 'changed';
}
export function lessonOpen(p:Profile,id:MapId):boolean {
  return id==='L01'||(id==='L02'&&p.tutorialFirstWins.includes('L01'))||(id==='L03'&&p.tutorialFirstWins.includes('L02'));
}
function increment(n:number,amount=1):number {
  if(!Number.isSafeInteger(n+amount))throw new RangeError('记录数值超出安全范围，请恢复存档');
  return n+amount;
}
function sample<T>(source:T[],count:number,random:()=>number):T[] {
  const pool=[...source],out:T[]=[];
  while(out.length<count&&pool.length){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw new RangeError('Invalid random sample');out.push(pool.splice(Math.floor(r*pool.length),1)[0]!);}
  return out;
}
export function mixedCandidates(unlocked:CardId[],random:()=>number):CardId[] {
  const pool=CARD_IDS.filter(id=>unlocked.includes(id));
  if(!pool.length)throw new Error('已解锁卡池为空，请恢复进度');
  const picked=[...sample(pool.filter(id=>CARDS[id].kind==='active'),2,random),...sample(pool.filter(id=>CARDS[id].kind==='passive'),1,random)];
  return [...picked,...sample(pool.filter(id=>!picked.includes(id)),3-picked.length,random)];
}
export function settleMatch(p:Profile,matchId:string,now:number,kind:Settlement['settlementKind'],random:()=>number):Settlement {
  if(p.latestResult?.matchId===matchId)return p.latestResult;
  const match=p.activeMatch;
  if(!match||match.battle.id!==matchId)throw new Error('对局已变化');
  if(observeTime(p,now)==='backward')throw new Error('设备时间早于已记录周，请校准时间');
  const b=match.battle;
  if(b.result)kind='natural';
  if(kind==='natural'&&!b.result)throw new Error('对局尚未结束');
  const formal=match.modeId==='arena-four'&&match.rankedCommitment;
  const qualified=formal&&kind==='natural'&&b.result?.independentWinner==='P'&&b.hasPlayerDispatch;
  const rank=b.result?.playerRank??0;
  const delta=!formal||kind==='technical_void'?0:match.meritPolicy==='growth-v1'?(qualified?30:0):kind==='forfeit'?-10:qualified?30:rank===2?-5:rank===3?-8:rank===4?-10:0;
  const candidates=qualified?mixedCandidates(p.unlockedCardIds,random):[];
  const points=Math.max(0,increment(p.rankPoints,delta));
  const completion=formal&&kind==='natural'&&b.hasPlayerDispatch?increment(p.formalCompleted):p.formalCompleted;
  const wins=qualified?increment(p.qualifiedArenaWins):p.qualifiedArenaWins;
  const result:Settlement={matchId,mapId:b.mapId,modeId:match.modeId,settledAt:now,settlementWeek:p.weekId,settlementKind:kind,result:b.result,
    qualified,rankDeltaRequested:delta,rankDeltaApplied:points-p.rankPoints,rankPointsBefore:p.rankPoints,rankPointsAfter:points,highestRankPointsAfter:Math.max(p.highestRankPoints,points),
    winsBefore:p.qualifiedArenaWins,winsAfter:wins,formalCompletedBefore:p.formalCompleted,formalCompletedAfter:completion,fixedChoices:candidates,resultAcknowledged:kind!=='natural'};
  if(match.meritPolicy)result.meritPolicy=match.meritPolicy;
  if(match.modeId==='tutorial'&&kind==='natural'&&b.result?.independentWinner==='P'){
    if(!p.tutorialFirstWins.includes(b.mapId))p.tutorialFirstWins.push(b.mapId);
    p.unlockedCardIds=CARD_IDS.filter(id=>p.tutorialFirstWins.includes(CARDS[id].lesson));
  }
  if(qualified)p.choice={choiceId:`${matchId}:choice`,matchId,kind:'mixed',grantQuantity:1,candidateIds:candidates,unlockSnapshot:[...p.unlockedCardIds],poolVersion:'first-seven-v1',weekId:p.weekId,state:'pending',selected:null};
  p.rankPoints=points;p.highestRankPoints=result.highestRankPointsAfter;p.formalCompleted=completion;p.qualifiedArenaWins=wins;
  if(qualified&&p.leaderboard.optedIn){p.leaderboard.pendingWins=wins;p.leaderboard.syncStatus='pending';}
  p.latestResult=result;p.activeMatch=null;
  return result;
}
export function claimChoice(p:Profile,id:string,cardId:CardId,now:number):boolean {
  if(observeTime(p,now)==='backward')throw new Error('请先校准设备时间');
  const c=p.choice;
  if(!c||c.choiceId!==id||c.state!=='pending'||c.weekId!==p.weekId||!c.candidateIds.includes(cardId))return false;
  if(CARDS[cardId].kind==='active')p.activeInventory[cardId as ActiveCardId]=increment(p.activeInventory[cardId as ActiveCardId]);
  else p.passiveLevels[cardId as PassiveCardId]=increment(p.passiveLevels[cardId as PassiveCardId]);
  c.selected=cardId;c.state='claimed';if(p.latestResult?.matchId===c.matchId)p.latestResult.resultAcknowledged=true;
  return true;
}
export function rankName(points:number):string {
  const level=Math.floor(points/30);
  if(level===0)return '新卒';
  if(level>=36)return `大将军 · ${level-35} 级`;
  return `${['军司马','都尉','校尉','中郎将','偏将军','车骑将军','骠骑将军'][Math.floor((level-1)/5)]} · ${(level-1)%5+1} 级`;
}
