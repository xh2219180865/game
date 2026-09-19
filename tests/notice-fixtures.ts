import { applyBattleAction, createBattle } from '../src/core/battle.ts';

/** Saved-v1.5 geometry. Test-only ordinary loss followed by a threat to the remaining camp. */
export function createLastCampNotice(id='last-camp-notice'){
  const battle=createBattle('A01',{id,firstDragCompleted:true,ruleRevision:'1.5'});
  const outpost=battle.camps.find(c=>c.id==='A01-N1')!;outpost.owner='P';outpost.garrison=1;
  for(const faction of battle.factions)faction.nextAiAtMs=10000;
  const events=[];
  for(const [faction,sourceId,targetId]of [['E2','A01-E2','A01-N1'],['E1','A01-E1','A01-P1']] as const){
    const result=applyBattleAction(battle,{kind:'dispatch',faction,sequence:1,sourceId,targetId});
    if(!result.ok)throw new Error(result.reason);events.push(...result.events);
  }
  return {battle,events};
}
