import { applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { SHOT_INTERVAL } from '../src/core/config.ts';
import { validateBattle } from '../src/app/validation.ts';
import type { BattleAction, BattleEvent, FactionId } from '../src/core/types.ts';

type UnsequencedAction<A=BattleAction> = A extends BattleAction ? Omit<A,'sequence'> : never;

// Historical v1.5 cross-map geometry is intentional; v1.6 road pressure is tested in tactical-rules.test.ts.
// Disposable initialization only: replenish sources before accepted departures, never during observation.
export function createMixedPressure(id='mixed-pressure'){
  const battle=createBattle('A01',{id,firstDragCompleted:true,ruleRevision:'1.5'}),events:BattleEvent[]=[];
  const owners:Record<string,FactionId>={'A01-N1':'E2','A01-N2':'P','A01-N3':'E3','A01-N4':'E2','A01-N5':'E2'};
  for(const camp of battle.camps){
    camp.owner=owners[camp.id]??camp.owner;
    camp.garrison=['A01-P1','A01-N1','A01-N5'].includes(camp.id)?40:20;
    camp.nextShotAtMs=camp.type==='fort'?SHOT_INTERVAL[camp.tier]:null;
  }
  for(const faction of battle.factions){faction.inventory={mobilize:128,march:128,supply:128,feint:128};faction.nextAiAtMs=10000;}
  const act=(action:UnsequencedAction)=>{
    const result=applyBattleAction(battle,{...action,sequence:factionOf(battle,action.faction)!.lastActionSequence+1});
    if(!result.ok)throw new Error(result.reason);events.push(...result.events);
  };
  const routes=[
    ['P','A01-N2','A01-E3',20,false],
    ['E1','A01-E1','A01-E2',2,false],
    ['E2','A01-E2','A01-N4',2,true],
    ['E3','A01-E3','A01-N3',2,false],
  ] as const;
  for(const [faction,sourceId,targetId,garrison,march]of routes)for(let i=0;i<64;i++){
    battle.camps.find(c=>c.id===sourceId)!.garrison=garrison;
    act({kind:'dispatch',faction,sourceId,targetId,march});
  }
  // These upgrades and repeated cards are accepted while all 256 armies already exist.
  act({kind:'upgrade',faction:'P',targetId:'A01-P1'});
  act({kind:'upgrade',faction:'E2',targetId:'A01-N5'});
  for(const camp of battle.camps){
    for(let i=0;i<2;i++)act({kind:'card',faction:camp.owner!,cardId:'mobilize',targetId:camp.id});
    for(let i=0;i<2;i++)act({kind:'card',faction:camp.owner!,cardId:'supply',targetId:camp.id});
  }
  for(let i=0;i<2;i++){
    act({kind:'card',faction:'E1',cardId:'feint',targetId:'A01-N2'});
    act({kind:'card',faction:'P',cardId:'feint',targetId:'A01-E1'});
  }
  validateBattle(battle);
  return {battle,events};
}
