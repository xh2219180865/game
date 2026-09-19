import { add, ceil, compare, divide, floor, fraction, minimum, multiply, ONE, subtract, ZERO } from './fraction.ts';
import type { Fraction } from './fraction.ts';
import { CAMP_CONFIG, campCapacity, emptyInventory, emptyPassives, productionRate, SHOT_INTERVAL, TOWER_RANGE, movementSpeed, UPGRADE } from './config.ts';
import { armyPosition, distance, travelTime, volleyOffset } from './geometry.ts';
import { connected, MAPS } from './maps.ts';
import type { ActionResult, ActiveInventory, Army, Battle, BattleAction, BattleEvent, Camp, Faction, FactionId, MapId, PassiveLevels } from './types.ts';

export function createBattle(mapId: MapId, options: { id: string; firstDragCompleted?: boolean; passives?: PassiveLevels; inventory?: ActiveInventory; ruleRevision?: Battle['ruleRevision'] }): Battle {
  const map = MAPS[mapId];
  const ids = [...new Set(map.camps.flatMap(c => c.owner ? [c.owner] : []))];
  const ruleRevision=options.ruleRevision??'1.6';
  const aiIds: FactionId[]=ids.filter(id=>id!=='P');
  return { id: options.id, mapId, rulesetId: 'tc-v1', ruleRevision, gameMs: 0, deadlineMs: map.tutorial ? null : 240000,
    status: 'running', awaitingFirstDispatch: mapId === 'L01' && !options.firstDragCompleted, hasPlayerDispatch: false,
    camps: map.camps.map(c => ({ ...c, credit: ZERO, mobilizeUntil: 0, bonusBudget: ZERO, feintUntil: 0, nextShotAtMs: c.owner && c.type === 'fort' ? SHOT_INTERVAL[c.tier] : null })),
    factions: ids.map(id => ({ id, eliminated: false, rank: null, passives: !map.tutorial && id === 'P' ? { ...options.passives ?? emptyPassives() } : emptyPassives(),
      inventory: map.tutorial ? emptyInventory() : id === 'P' ? { ...options.inventory ?? emptyInventory() } : { ...emptyInventory(), supply: 1 },
      nextAiAtMs: ruleRevision==='1.5'?map.aiFirstAt:8000+Math.max(0,aiIds.indexOf(id))*700, lastActionSequence: 0 })), armies: [], nextEntityId: 1, nextEventId: 1, result: null };
}

export const factionOf = (battle: Battle, id: FactionId | null): Faction | undefined => battle.factions.find(f => f.id === id);
function emit(b: Battle, events: BattleEvent[], event: Omit<BattleEvent, 'id' | 'atMs'>): void {
  events.push({ ...event, id: b.nextEventId++, atMs: b.gameMs });
}
function cap(b: Battle, c: Camp): void {
  const capacity = campCapacity(c, factionOf(b, c.owner));
  c.garrison = Math.min(capacity, c.garrison);
  if (c.garrison === capacity) c.credit = ZERO;
}

export function applyBattleAction(b: Battle, action: BattleAction): ActionResult {
  const fail = (reason: string): ActionResult => ({ ok: false, reason, events: [] });
  const actor = factionOf(b, action.faction);
  if(!['dispatch','upgrade','card'].includes(action.kind)||(action.kind==='card'&&!['mobilize','supply','feint'].includes(action.cardId)))return fail('未知操作');
  if (b.status !== 'running' || !actor || actor.eliminated) return fail('当前不能行动');
  if (!Number.isSafeInteger(action.sequence) || action.sequence <= actor.lastActionSequence) return fail('重复或无效操作');
  const target = b.camps.find(c => c.id === action.targetId);
  if (!target) return fail('目标不存在');
  if (b.awaitingFirstDispatch && !(action.kind === 'dispatch' && action.faction === 'P' && action.sourceId === 'L01-P1' && action.targetId === 'L01-N1')) return fail('请先拖到提示的营地');
  const events: BattleEvent[] = [];
  if (action.kind === 'dispatch') {
    const source = b.camps.find(c => c.id === action.sourceId);
    if (!source || source.owner !== actor.id || source === target) return fail('请选择另一座营地');
    if (!connected(b,source.id,target.id)) return fail('两城没有相连道路，请先占领沿途营地');
    const count = Math.floor(source.garrison / 2);
    if (count < 1) return fail('至少需要 2 兵');
    const speed = movementSpeed(b,source, actor, action.march);
    const duration = travelTime(source, target, speed);
    if (action.march && (actor.inventory.march < 1 || duration >= travelTime(source, target, movementSpeed(b,source, actor)))) return fail('兼行未缩短到达时间，请另选路线');
    const archer = source.type === 'archery';
    const army: Army = { id: `${b.id}:army:${b.nextEntityId++}`, faction: actor.id, sourceId: source.id, targetId: target.id,
      troopType: CAMP_CONFIG[source.type].troop, initialCount: count, remainingCount: count, from: { x: source.x, y: source.y }, to: { x: target.x, y: target.y },
      departedAtMs: b.gameMs, arrivalAtMs: b.gameMs + duration, speed,
      volleyCheckAtMs: archer ? b.gameMs + volleyOffset(source, target, duration) : null, volleyState: archer ? 'pending' : null, volleySkipReason: null };
    source.garrison -= count;
    b.armies.push(army);
    if (action.march) actor.inventory.march--;
    if (actor.id === 'P') { b.hasPlayerDispatch = true; b.awaitingFirstDispatch = false; }
    emit(b, events, { type: 'dispatch', sourceId: source.id, targetId: target.id, faction: actor.id, amount: count, reason:action.march?'march':'normal' });
  } else if (action.kind === 'upgrade') {
    if (target.owner !== actor.id || target.tier === 3) return fail('该营地不能升级');
    const cost = UPGRADE[target.tier];
    if (target.garrison < cost.threshold) return fail(`驻军达到 ${cost.threshold} 才能升级`);
    target.garrison -= cost.cost;
    target.tier = target.tier === 1 ? 2 : 3;
    emit(b, events, { type: 'upgrade', targetId: target.id, faction: actor.id, amount: cost.cost });
  } else {
    if (actor.inventory[action.cardId] < 1) return fail('库存不足');
    const before=target.garrison;
    if (action.cardId === 'feint') {
      if (!target.owner || target.owner === actor.id) return fail('请选择敌方营地');
      target.feintUntil = Math.max(b.gameMs, target.feintUntil) + 4000;
    } else {
      if (target.owner !== actor.id) return fail('请选择己方营地');
      const room = campCapacity(target, actor) - target.garrison;
      if (room <= 0) return fail('该营地已满');
      if (action.cardId === 'supply') { target.garrison += Math.min(6, room); cap(b, target); }
      else {
        if (target.feintUntil > b.gameMs) return fail('停产期间不能征兵');
        target.mobilizeUntil = Math.max(b.gameMs, target.mobilizeUntil) + 6000;
        target.bonusBudget = add(target.bonusBudget, fraction(8));
      }
    }
    actor.inventory[action.cardId]--;
    emit(b, events, { type: 'card', targetId: target.id, faction: actor.id, reason: action.cardId, amount:target.garrison-before });
  }
  actor.lastActionSequence = action.sequence;
  return { ok: true, events };
}

interface ProductionProperties {rate:Fraction;capacity:number}
function nextProduction(b: Battle, c: Camp, properties:ProductionProperties): number {
  const {rate,capacity}=properties;
  if (c.garrison >= capacity || compare(rate, ZERO) === 0) return Infinity;
  const missing = subtract(ONE, c.credit);
  const bonus = c.mobilizeUntil > b.gameMs ? minimum(c.bonusBudget, divide(missing, fraction(2))) : ZERO;
  return b.gameMs + Math.max(1, ceil(multiply(divide(subtract(missing, bonus), rate), fraction(1000))));
}

function produce(b: Battle, toMs: number, events: BattleEvent[],properties:(c:Camp)=>ProductionProperties): void {
  const dt = fraction(toMs - b.gameMs, 1000);
  for (const c of b.camps) {
    const {rate,capacity}=properties(c);
    if (c.garrison >= capacity) { c.credit = ZERO; continue; }
    if(compare(rate,ZERO)===0)continue;
    const natural = multiply(rate, dt);
    const bonus = c.mobilizeUntil > b.gameMs ? minimum(natural, c.bonusBudget) : ZERO;
    c.bonusBudget = subtract(c.bonusBudget, bonus);
    c.credit = add(c.credit, add(natural, bonus));
    const count = floor(c.credit);
    c.credit = subtract(c.credit, fraction(count));
    c.garrison += count;
    c.garrison=Math.min(capacity,c.garrison);if(c.garrison===capacity)c.credit=ZERO;
    if (count) events.push({ id: b.nextEventId++, atMs: toMs, type: 'production', targetId: c.id, amount: count });
  }
  b.gameMs = toMs;
  for (const c of b.camps) {
    if (c.mobilizeUntil && c.mobilizeUntil <= toMs) { c.mobilizeUntil = 0; c.bonusBudget = ZERO; }
    if (c.feintUntil <= toMs) c.feintUntil = 0;
  }
}

function arrivals(b: Battle, events: BattleEvent[]): void {
  const due = b.armies.filter(a => a.arrivalAtMs === b.gameMs);
  if (!due.length) return;
  b.armies = b.armies.filter(a => a.arrivalAtMs !== b.gameMs);
  for (const c of b.camps) {
    const incoming = due.filter(a => a.targetId === c.id);
    if (!incoming.length) continue;
    const oldOwner = c.owner, oldGarrison=c.garrison, attackers = new Map<FactionId, number>();
    let defenders = c.garrison;
    for (const a of incoming) {
      if (a.faction === oldOwner) defenders += a.remainingCount;
      else attackers.set(a.faction, (attackers.get(a.faction) ?? 0) + a.remainingCount);
      emit(b, events, { type: 'arrival', sourceId: a.sourceId, targetId: c.id, faction: a.faction, amount: a.remainingCount, reason:a.faction===oldOwner?'friendly':'enemy' });
    }
    const total = [...attackers.values()].reduce((s, n) => s + n, 0);
    const majority = [...attackers].find(([, n]) => n > total - n);
    const strength = majority ? 2 * majority[1] - total : 0;
    if (majority && strength > defenders) {
      c.owner = majority[0]; c.garrison = strength - defenders;
      c.credit = ZERO; c.mobilizeUntil = 0; c.bonusBudget = ZERO; c.feintUntil = 0;
      c.nextShotAtMs = c.type === 'fort' ? b.gameMs + SHOT_INTERVAL[c.tier] : null;
      emit(b, events, { type: 'capture', targetId: c.id, faction: c.owner, amount: c.garrison });
    } else c.garrison = defenders - strength;
    const beforeCap=c.garrison;cap(b, c);
    if(beforeCap>c.garrison)emit(b,events,{type:'overflow',targetId:c.id,amount:beforeCap-c.garrison});
    if(c.owner===oldOwner&&c.garrison!==oldGarrison)emit(b,events,{type:'garrison-change',targetId:c.id,amount:c.garrison-oldGarrison,reason:'arrival'});
  }
  const live = b.factions.filter(f => !f.eliminated);
  const eliminated = live.filter(f => !b.camps.some(c => c.owner === f.id));
  for (const f of eliminated) {
    f.eliminated = true; f.rank = live.length - eliminated.length + 1;
    emit(b, events, { type: 'eliminated', faction: f.id });
  }
  b.armies = b.armies.filter(a => !factionOf(b, a.faction)!.eliminated);
}

function towerShots(b: Battle, events: BattleEvent[]): void {
  const armyDamage = new Map<string, number>(), campDamage = new Map<string, number>();
  for (const c of b.camps) {
    if (c.nextShotAtMs !== b.gameMs || !c.owner) continue;
    c.nextShotAtMs += SHOT_INTERVAL[c.tier];
    if (c.garrison < 1 || c.feintUntil > b.gameMs) continue;
    const armies = b.armies.filter(a => a.faction !== c.owner && distance(c, armyPosition(a, b.gameMs)) <= TOWER_RANGE);
    armies.sort((a, z) => {
      const ap = a.targetId === c.id, zp = z.targetId === c.id;
      return Number(zp) - Number(ap) || (ap ? a.arrivalAtMs - z.arrivalAtMs : distance(c, armyPosition(a, b.gameMs)) - distance(c, armyPosition(z, b.gameMs))) || a.id.localeCompare(z.id);
    });
    const targetArmy = armies[0];
    const targetCamp = targetArmy ? undefined : b.camps.filter(t => t.owner && t.owner !== c.owner && t.garrison > 0 && distance(c, t) <= TOWER_RANGE)
      .sort((a, z) => distance(c, a) - distance(c, z) || a.id.localeCompare(z.id))[0];
    const target = targetArmy ?? targetCamp;
    if (!target) continue;
    const damages = targetArmy ? armyDamage : campDamage;
    damages.set(target.id, (damages.get(target.id) ?? 0) + 1);
    emit(b, events, { type: 'tower-shot', sourceId: c.id, targetId: target.id, faction: c.owner, amount: 1, position: targetArmy ? armyPosition(targetArmy, b.gameMs) : { x: targetCamp!.x, y: targetCamp!.y } });
  }
  for (const a of b.armies){const loss=Math.min(a.remainingCount,armyDamage.get(a.id)??0);a.remainingCount-=loss;if(loss)emit(b,events,{type:'army-loss',targetId:a.id,amount:loss,position:armyPosition(a,b.gameMs),reason:'tower-shot'});}
  b.armies = b.armies.filter(a => a.remainingCount > 0);
  for (const c of b.camps){const loss=Math.min(c.garrison,campDamage.get(c.id)??0);c.garrison-=loss;if(loss)emit(b,events,{type:'garrison-loss',targetId:c.id,amount:loss,reason:'tower-shot'});}
}

function volleys(b: Battle, events: BattleEvent[]): void {
  const damages = new Map<string, number>();
  for (const a of b.armies) {
    if (a.volleyState !== 'pending' || a.volleyCheckAtMs !== b.gameMs) continue;
    const target = b.camps.find(c => c.id === a.targetId)!;
    const damage = Math.floor(3 * a.remainingCount / 10);
    const reason = target.owner === a.faction ? 'friendly' : target.garrison === 0 ? 'empty' : damage === 0 ? 'zeroDamage' : null;
    a.volleyState = reason ? 'skipped' : 'fired'; a.volleySkipReason = reason;
    if (!reason) damages.set(target.id, (damages.get(target.id) ?? 0) + damage);
    emit(b, events, { type: reason ? 'volley-skipped' : 'volley', sourceId: a.id, targetId: target.id, faction: a.faction, amount: reason ? 0 : damage, position: armyPosition(a, b.gameMs), ...(reason ? { reason } : {}) });
  }
  for (const c of b.camps){const loss=Math.min(c.garrison,damages.get(c.id)??0);c.garrison-=loss;if(loss)emit(b,events,{type:'garrison-loss',targetId:c.id,amount:loss,reason:'volley'});}
}

export function battleStats(b: Battle): { faction: FactionId; camps: number; troops: number; rank: number | null }[] {
  return b.factions.map(f => ({ faction: f.id, camps: b.camps.filter(c => c.owner === f.id).length,
    troops: b.camps.filter(c => c.owner === f.id).reduce((n, c) => n + c.garrison, 0) + b.armies.filter(a => a.faction === f.id).reduce((n, a) => n + a.remainingCount, 0), rank: f.rank }));
}

function terminal(b: Battle, events: BattleEvent[]): void {
  const player = factionOf(b, 'P')!, live = b.factions.filter(f => !f.eliminated);
  const deadline = b.deadlineMs !== null && b.gameMs >= b.deadlineMs;
  if (!player.eliminated && live.length > 1 && !deadline) return;
  if (live.length === 1) live[0]!.rank = 1;
  else if (deadline) {
    const stats = battleStats(b).filter(s => live.some(f => f.id === s.faction));
    for (const f of live) {
      const own = stats.find(s => s.faction === f.id)!;
      f.rank = 1 + stats.filter(s => s.camps > own.camps || (s.camps === own.camps && s.troops > own.troops)).length;
    }
  }
  const firsts = b.factions.filter(f => f.rank === 1);
  b.result = { reason: live.length === 1 ? 'last-camp' : deadline ? 'deadline' : 'eliminated', playerRank: player.rank!,
    independentWinner: firsts.length === 1 ? firsts[0]!.id : null, ranks: Object.fromEntries(b.factions.filter(f => f.rank !== null).map(f => [f.id, f.rank])), stats: battleStats(b), atMs: b.gameMs };
  b.status = 'finished';
  emit(b, events, { type: 'result', reason: b.result.reason, ...(b.result.independentWinner?{faction:b.result.independentWinner}:{}), amount:b.result.playerRank });
}

export function advanceBattle(b: Battle, toMs: number): BattleEvent[] {
  if (!Number.isSafeInteger(toMs) || toMs < b.gameMs) throw new RangeError('Time must advance in integer milliseconds');
  const events: BattleEvent[] = [];
  if (b.status !== 'running' || b.awaitingFirstDispatch) return events;
  const cached=new Map<Camp,{owner:Faction|undefined;tier:number;suppressed:boolean;properties:ProductionProperties}>();
  const properties=(c:Camp):ProductionProperties=>{
    const owner=factionOf(b,c.owner),suppressed=c.feintUntil>b.gameMs,old=cached.get(c);
    if(old&&old.owner===owner&&old.tier===c.tier&&old.suppressed===suppressed)return old.properties;
    const value={rate:productionRate(b,c,owner,b.gameMs),capacity:campCapacity(c,owner)};cached.set(c,{owner,tier:c.tier,suppressed,properties:value});return value;
  };
  while (b.gameMs < toMs && b.status === 'running') {
    let next = Math.min(toMs, b.deadlineMs ?? Infinity);
    for (const a of b.armies) next = Math.min(next, a.arrivalAtMs, a.volleyState === 'pending' ? a.volleyCheckAtMs! : Infinity);
    for (const c of b.camps) next = Math.min(next, nextProduction(b, c,properties(c)), c.nextShotAtMs ?? Infinity,
      c.mobilizeUntil > b.gameMs ? c.mobilizeUntil : Infinity, c.feintUntil > b.gameMs ? c.feintUntil : Infinity);
    if (next <= b.gameMs) throw new Error('Invalid overdue battle event');
    produce(b, next, events,properties);
    arrivals(b, events); towerShots(b, events); volleys(b, events); terminal(b, events);
  }
  return events;
}
