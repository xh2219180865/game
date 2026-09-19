import { applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { fraction } from '../src/core/fraction.ts';
import type { BattleAction, BattleEvent, FactionId } from '../src/core/types.ts';

// Historical v1.5 cross-map geometry is intentional; v1.6 road pressure is tested in tactical-rules.test.ts.
// Disposable pressure data: replenish source troops only during setup; all actions use production rules.
export function createStatePressure(id='state-pressure'){
  const battle=createBattle('A01',{id,firstDragCompleted:true,ruleRevision:'1.5'}),events:BattleEvent[]=[];
  const act=(action:Omit<Extract<BattleAction,{kind:'card'}>,'sequence'>|Omit<Extract<BattleAction,{kind:'dispatch'}>,'sequence'>)=>{
    const result=applyBattleAction(battle,{...action,sequence:factionOf(battle,action.faction)!.lastActionSequence+1});
    if(!result.ok)throw new Error(result.reason);events.push(...result.events);
  };
  const routes=[['P','A01-P1','A01-E3'],['E1','A01-E1','A01-E2'],['E2','A01-E2','A01-E1'],['E3','A01-E3','A01-P1']] as const;
  for(const [faction,sourceId,targetId]of routes)for(let i=0;i<64;i++){
    battle.camps.find(c=>c.id===sourceId)!.garrison=2;act({kind:'dispatch',faction,sourceId,targetId});
  }
  const owners:Record<string,FactionId>={'A01-N1':'P','A01-N2':'P','A01-N3':'E2','A01-N4':'E3','A01-N5':'E1'};
  for(const f of battle.factions){f.inventory={mobilize:40,march:40,supply:40,feint:40};f.nextAiAtMs=10000;}
  for(const c of battle.camps){c.owner=owners[c.id]??c.owner;c.garrison=20;c.credit=fraction(0);if(c.type==='fort')c.nextShotAtMs=2000;
    act({kind:'card',faction:c.owner!,cardId:'mobilize',targetId:c.id});
    act({kind:'card',faction:c.owner!,cardId:'supply',targetId:c.id});
    act({kind:'card',faction:c.owner==='P'?'E1':'P',cardId:'feint',targetId:c.id});
  }
  return {battle,events};
}
