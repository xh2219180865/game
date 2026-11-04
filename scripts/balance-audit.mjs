import { createBattle, applyBattleAction, battleStats, factionOf } from '../src/core/battle.ts';
import { advanceSimulation, chooseAiAction } from '../src/core/ai.ts';
import { UPGRADE, campCapacity } from '../src/core/config.ts';

// Deterministic policy probes, not a player study or a win-rate estimate.
const report=[];
for(const map of ['A01','A02','A03'])for(const policy of ['idle','upgrade-only','late-attack','active']){
  const b=createBattle(map,{id:`audit:${map}:${policy}`,firstDragCompleted:true});
  let actions=0,captures=0,quietMs=0,fullCampMs=0,lastActionMs=null;
  for(let at=100;at<=240000&&b.status==='running';at+=100){
    const before=b.gameMs,events=advanceSimulation(b,at);
    captures+=events.filter(e=>e.type==='capture'&&e.faction==='P').length;
    quietMs+=b.gameMs-before;
    fullCampMs+=(b.gameMs-before)*b.camps.filter(c=>c.owner==='P'&&c.garrison>=campCapacity(c,factionOf(b,'P'))).length;
    if(b.status!=='running'||at<8000||(at-8000)%3500!==0)continue;
    let action=null;
    if(policy==='active'||policy==='late-attack'&&at>=210000)action=chooseAiAction(b,'P');
    else if(policy==='upgrade-only'||policy==='late-attack'){
      const c=b.camps.find(c=>c.owner==='P'&&c.tier<3&&c.garrison>=UPGRADE[c.tier].threshold);
      if(c)action={kind:'upgrade',faction:'P',sequence:factionOf(b,'P').lastActionSequence+1,targetId:c.id};
    }
    if(action){const r=applyBattleAction(b,action);if(r.ok){actions++;lastActionMs=b.gameMs;quietMs=0;}}
  }
  report.push({map,policy,rank:b.result?.playerRank,winner:b.result?.independentWinner,endedAtMs:b.gameMs,actions,captures,lastActionMs,endingQuietMs:quietMs,fullCampMs,stats:battleStats(b),rewardEligible:b.result?.independentWinner==='P'&&b.hasPlayerDispatch});
}
console.log(JSON.stringify({kind:'deterministic-policy-audit',ruleRevision:'1.6',limitations:'Each map/policy is one deterministic trajectory. No human input, touch measurement or retention evidence. No cards/passives, standard initial state and standard opposing AI. Late policy upgrades then uses the same public AI after 210 seconds.',cases:report},null,2));
