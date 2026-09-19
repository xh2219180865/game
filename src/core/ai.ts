import { advanceBattle, applyBattleAction, factionOf } from './battle.ts';
import { campCapacity, productionRate, movementSpeed, UPGRADE } from './config.ts';
import { asNumber } from './fraction.ts';
import { distance, travelTime } from './geometry.ts';
import { connected, MAPS, neighbors } from './maps.ts';
import type { Battle, BattleAction, BattleEvent, Camp, FactionId } from './types.ts';

export const cloneBattle = (b: Battle): Battle => JSON.parse(JSON.stringify(b)) as Battle;
function forecast(b: Battle, at: number, action?: BattleAction): { battle: Battle; events: BattleEvent[] } {
  const battle = cloneBattle(b);
  if (action) applyBattleAction(battle, action);
  return { battle, events: advanceBattle(battle, at) };
}
function campAt(b: Battle, id: string): Camp { return b.camps.find(c => c.id === id)!; }
type Threat = { camp: Camp; at: number; future: Battle };

function chooseFromSnapshot(b: Battle, id: FactionId, predictions:Map<number,Battle>): BattleAction | null {
  const actor = factionOf(b, id);
  if (!actor || actor.eliminated || b.status !== 'running' || b.awaitingFirstDispatch) return null;
  const map = MAPS[b.mapId], owned = b.camps.filter(c => c.owner === id).sort((a,z)=>a.id.localeCompare(z.id));
  const base = { faction: id, sequence: actor.lastActionSequence + 1 };
  const future = (at: number): Battle => {
    if (!predictions.has(at)) predictions.set(at, forecast(b, at).battle);
    return predictions.get(at)!;
  };
  const horizon=b.ruleRevision==='1.5'?4000:8000;
  const threats: Threat[] = [];
  for (const camp of owned) {
    const times = [...new Set(b.armies.filter(a => a.faction !== id && a.targetId === camp.id).flatMap(a => [a.arrivalAtMs, ...(a.volleyState === 'pending' ? [a.volleyCheckAtMs!] : [])]))]
      .filter(t => t <= b.gameMs + horizon).sort((a,z)=>a-z);
    const at = times.find(t => { const predicted = campAt(future(t), camp.id); return predicted.owner !== id || predicted.garrison === 0; });
    if (at !== undefined) {
      threats.push({camp,at,future:future(at)});
      // A clearing volley leaves ownership intact; reinforcements may still beat the later capture.
      if (campAt(future(at),camp.id).owner === id) {
        const captureAt=times.find(t=>t>at && campAt(future(t),camp.id).owner!==id);
        if(captureAt!==undefined)threats.push({camp,at:captureAt,future:future(captureAt)});
      }
    }
  }
  threats.sort((a,z)=>a.at-z.at || a.camp.id.localeCompare(z.camp.id));
  const sources = owned.filter(c => Math.ceil(c.garrison/2) >= Math.max(4,Math.ceil(campCapacity(c,actor)*.1)) && !threats.some(t=>t.camp.id===c.id));
  const marchFor = (s: Camp,t: Camp): boolean => actor.inventory.march>0 && travelTime(s,t,movementSpeed(b,s,actor,true))<travelTime(s,t,movementSpeed(b,s,actor));
  const dispatch = (s: Camp,t: Camp): BattleAction => ({...base,kind:'dispatch',sourceId:s.id,targetId:t.id,march:marchFor(s,t)});
  if (actor.inventory.supply > 0) for (const threat of threats) {
    if (campAt(threat.future,threat.camp.id).owner === id) continue;
    const action: BattleAction = {...base,kind:'card',cardId:'supply',targetId:threat.camp.id};
    if (campAt(forecast(b,threat.at,action).battle,threat.camp.id).owner === id) return action;
  }
  if (actor.inventory.feint > 0) {
    for (const a of b.armies.filter(a=>a.faction===id && a.arrivalAtMs<=b.gameMs+horizon).sort((a,z)=>a.arrivalAtMs-z.arrivalAtMs || a.id.localeCompare(z.id))) {
      const target = campAt(b,a.targetId);
      if (!target.owner || target.owner===id) continue;
      const action: BattleAction = {...base,kind:'card',cardId:'feint',targetId:target.id};
      const original = campAt(future(a.arrivalAtMs),target.id), changed = campAt(forecast(b,a.arrivalAtMs,action).battle,target.id);
      if (changed.owner===id && (original.owner!==id || changed.garrison>original.garrison)) return action;
    }
  }
  for (const threat of threats) {
    const candidates = sources.filter(s=>connected(b,s.id,threat.camp.id)).map(s=>({s,t:travelTime(s,threat.camp,movementSpeed(b,s,actor,marchFor(s,threat.camp)))}))
      .filter(c=>b.gameMs+c.t<=threat.at).sort((a,z)=>a.t-z.t || Math.floor(z.s.garrison/2)-Math.floor(a.s.garrison/2) || a.s.id.localeCompare(z.s.id));
    for (const candidate of candidates) {
      const action=dispatch(candidate.s,threat.camp);
      const predicted=campAt(forecast(b,threat.at,action).battle,threat.camp.id);
      if(predicted.owner===id && predicted.garrison>0)return action;
    }
  }
  const attacks: { action: BattleAction; score: number; t: number; targetId: string; sourceId: string }[] = [];
  for (const s of sources.filter(c=>c.garrison>=map.aiMinimum)) for (const target of b.camps.filter(c=>c.owner!==id && connected(b,s.id,c.id))) {
    const action=dispatch(s,target), t=travelTime(s,target,movementSpeed(b,s,actor,marchFor(s,target))), at=b.gameMs+t;
    const baseline=campAt(future(at),target.id);
    if(baseline.owner===id && baseline.garrison>=map.aiMargin)continue;
    const predicted=campAt(forecast(b,at,action).battle,target.id);
    let coordinated=false;
    if(predicted.owner!==id || predicted.garrison<map.aiMargin){
      if(b.ruleRevision==='1.5')continue;
      // A second real dispatch is forecast at the next decision, after production,
      // tower fire and the first column's movement have advanced normally.
      const nextDecision=b.gameMs+3500,staged=forecast(b,nextDecision,action).battle;
      const stagedActor=factionOf(staged,id);
      if(staged.status==='running'&&stagedActor&&!stagedActor.eliminated){
        for(const helper of sources.filter(c=>c.id!==s.id&&connected(b,c.id,target.id))){
          const from=campAt(staged,helper.id),to=campAt(staged,target.id);
          if(from.owner!==id||from.garrison<map.aiMinimum)continue;
          const follow:BattleAction={kind:'dispatch',faction:id,sequence:stagedActor.lastActionSequence+1,sourceId:from.id,targetId:to.id};
          const finish=Math.max(at,nextDecision+travelTime(from,to,movementSpeed(staged,from,stagedActor)));
          const outcome=campAt(forecast(staged,finish,follow).battle,target.id);
          if(outcome.owner===id&&outcome.garrison>=map.aiMargin){coordinated=true;break;}
        }
      }
      if(!coordinated){
        const sent=Math.floor(s.garrison/2),casualties=baseline.garrison-predicted.garrison;
        const rear=sources.some(c=>c.id!==s.id&&connected(b,c.id,s.id)&&c.garrison>=campCapacity(c,actor)*.5);
        const advantage=owned.length>b.camps.filter(c=>c.owner===target.owner).length;
        // A supplied, full frontier may trade troops efficiently while its larger
        // road network replenishes it. Never launch an unsupported losing column.
        if(!target.owner||!advantage||!rear||s.garrison<campCapacity(s,actor)*.8||casualties<sent*.8)continue;
      }
    }
    const last=target.owner!==null && b.camps.filter(c=>c.owner===target.owner).length===1;
    const rate=asNumber(productionRate(b,{...target,owner:id},actor,b.gameMs));
    const capture=predicted.owner===id&&predicted.garrison>=map.aiMargin;
    attacks.push({action,score:100*Number(target.owner===null)+120*Number(last)+20*rate-8*t/1000-.25*baseline.garrison-(capture?0:coordinated?30:150),t,targetId:target.id,sourceId:s.id});
  }
  attacks.sort((a,z)=>z.score-a.score || a.t-z.t || a.targetId.localeCompare(z.targetId) || a.sourceId.localeCompare(z.sourceId));
  if(attacks[0])return attacks[0].action;
  const safety=forecast(b,b.gameMs+8000);
  const upgrades=owned.filter(c=>c.tier<3 && c.garrison>=UPGRADE[c.tier as 1|2].threshold && c.garrison-UPGRADE[c.tier as 1|2].cost>=10
    && !safety.events.some(e=>e.targetId===c.id && ((e.type==='arrival' && e.faction!==id) || e.type==='tower-shot' || (e.type==='volley' && (e.amount??0)>0))))
    .sort((a,z)=>asNumber(productionRate(b,z,actor,b.gameMs)) / (z.tier===1?1:1.3)-asNumber(productionRate(b,a,actor,b.gameMs))/(a.tier===1?1:1.3) || a.id.localeCompare(z.id));
  if(upgrades[0])return {...base,kind:'upgrade',targetId:upgrades[0].id};
  const enemies=b.camps.filter(c=>c.owner && c.owner!==id);
  const nearEnemy=(c:Camp):number=>{
    if(b.ruleRevision==='1.5')return Math.min(...enemies.map(e=>distance(c,e)));
    const seen=new Set([c.id]),queue:[string,number][]=[[c.id,0]];
    for(let i=0;i<queue.length;i++) {
      const [current,hops]=queue[i]!;
      for(const neighbor of neighbors(b,current)) {
        if(seen.has(neighbor))continue;
        if(campAt(b,neighbor).owner!==id)return (hops+1)*100;
        seen.add(neighbor);queue.push([neighbor,hops+1]);
      }
    }
    return Infinity;
  };
  const transfers: {action:BattleAction;gain:number;t:number;sourceId:string;targetId:string}[]=[];
  for(const s of sources.filter(c=>c.garrison>=campCapacity(c,actor)*(b.ruleRevision==='1.5'?.8:.5))) for(const target of owned.filter(c=>connected(b,s.id,c.id))) {
    const gain=nearEnemy(s)-nearEnemy(target);
    const queued=b.armies.filter(a=>a.faction===id && a.targetId===target.id).reduce((n,a)=>n+a.remainingCount,0);
    if(gain<40 || target.garrison+queued+Math.floor(s.garrison/2)>campCapacity(target,actor))continue;
    transfers.push({action:dispatch(s,target),gain,t:travelTime(s,target,movementSpeed(b,s,actor,marchFor(s,target))),sourceId:s.id,targetId:target.id});
  }
  transfers.sort((a,z)=>z.gain-a.gain || a.t-z.t || a.targetId.localeCompare(z.targetId) || a.sourceId.localeCompare(z.sourceId));
  if(transfers[0])return transfers[0].action;
  if(actor.inventory.mobilize>0) {
    const safe=forecast(b,b.gameMs+horizon);
    const target=owned.filter(c=>campCapacity(c,actor)-c.garrison>=8 && c.mobilizeUntil<=b.gameMs+2000 && c.feintUntil<=b.gameMs
      && !safe.events.some(e=>e.targetId===c.id && (e.type==='tower-shot'||e.type==='volley'||(e.type==='arrival'&&e.faction!==id))))
      .sort((a,z)=>asNumber(productionRate(b,z,actor,b.gameMs))-asNumber(productionRate(b,a,actor,b.gameMs))||a.id.localeCompare(z.id))[0];
    if(target)return {...base,kind:'card',cardId:'mobilize',targetId:target.id};
  }
  return null;
}

export function chooseAiAction(b:Battle,id:FactionId):BattleAction|null{return chooseFromSnapshot(b,id,new Map());}

export function advanceSimulation(b: Battle,toMs:number):BattleEvent[] {
  if(!Number.isSafeInteger(toMs)||toMs<b.gameMs)throw new RangeError('Invalid simulation time');
  const events:BattleEvent[]=[];
  if(b.status!=='running'||b.awaitingFirstDispatch)return events;
  while(b.gameMs<toMs && b.status==='running') {
    const ai=b.factions.filter(f=>f.id!=='P'&&!f.eliminated);
    const next=Math.min(toMs,...ai.map(f=>f.nextAiAtMs));
    events.push(...advanceBattle(b,next));
    if(b.status!=='running')break;
    const due=ai.filter(f=>f.nextAiAtMs===b.gameMs);
    const predictions=new Map<number,Battle>();
    const actions=due.map(f=>chooseFromSnapshot(b,f.id,predictions));
    for(const f of due)f.nextAiAtMs+=b.ruleRevision==='1.5'?MAPS[b.mapId].aiInterval:3500;
    for(const action of actions)if(action)events.push(...applyBattleAction(b,action).events);
  }
  return events;
}
