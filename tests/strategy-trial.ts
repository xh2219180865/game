import { advanceBattle, applyBattleAction, createBattle, factionOf } from '../src/core/battle.ts';
import { movementSpeed, SHOT_INTERVAL } from '../src/core/config.ts';
import { travelTime } from '../src/core/geometry.ts';
import { connected } from '../src/core/maps.ts';
import type { BattleEvent, Camp, FactionId } from '../src/core/types.ts';

export const campNames: Record<string, string> = {
  'A01-P1': '前军步营', 'A01-N2': '左翼弓营', 'A01-N4': '前哨步营',
  'A01-N5': '敌军箭塔', 'A01-E1': '敌军步营',
};
export type TrialOrder = 'commit' | 'recall' | 'rally';

export class StrategyTrial {
  readonly battle = createBattle('A01', { id: 'strategy-trial' });
  readonly stock = { commit: 1, recall: 1, rally: 1 };
  private returned = new Set<string>();

  constructor() {
    const b = this.battle;
    b.deadlineMs = null;
    b.camps = b.camps.filter(c => Object.hasOwn(campNames, c.id));
    b.factions = b.factions.filter(f => f.id === 'P' || f.id === 'E1');
    for (const c of b.camps) {
      c.owner = c.id === 'A01-N5' || c.id === 'A01-E1' ? 'E1' : 'P';
      c.nextShotAtMs = c.type === 'fort' ? SHOT_INTERVAL[c.tier] : null;
      c.garrison = c.id === 'A01-P1' ? 40 : c.id === 'A01-N4' ? 10 : 32;
    }
  }

  dispatch(source: string, target: string, allIn = false, faction: FactionId = 'P') {
    if (allIn && !this.stock.commit) return null;
    const b = this.battle;
    const result = applyBattleAction(b, { kind: 'dispatch', faction, sourceId: source, targetId: target,
      sequence: factionOf(b, faction)!.lastActionSequence + 1 });
    if (!result.ok) return null;
    const camp = b.camps.find(c => c.id === source)!;
    const army = b.armies.at(-1)!;
    if (allIn) {
      const count = Math.floor((camp.garrison + army.initialCount) * 3 / 4);
      camp.garrison -= count - army.initialCount;
      army.initialCount = army.remainingCount = count;
      this.stock.commit--;
    }
    return army;
  }

  canRecall(id: string) {
    const b = this.battle;
    return b.status === 'running' && this.stock.recall > 0 && b.armies.some(a =>
      a.id === id && a.faction === 'P' && b.gameMs > a.departedAtMs && !this.returned.has(id));
  }

  recall(id: string) {
    if (!this.canRecall(id)) return null;
    const b = this.battle;
    const army = b.armies.find(a => a.id === id)!;
    const { departedAtMs, arrivalAtMs } = army;
    // Reverse the same edge at the same speed, preserving its current position.
    [army.from, army.to] = [army.to, army.from];
    [army.sourceId, army.targetId] = [army.targetId, army.sourceId];
    army.departedAtMs = b.gameMs - (arrivalAtMs - b.gameMs);
    army.arrivalAtMs = b.gameMs + (b.gameMs - departedAtMs);
    if (army.volleyState === 'pending') {
      army.volleyState = null;
      army.volleyCheckAtMs = null;
    }
    this.returned.add(id);
    this.stock.recall--;
    return army;
  }

  plan(target: Camp) {
    const b = this.battle;
    if (b.status !== 'running' || !this.stock.rally || target.owner !== 'P') return [];
    return b.camps.filter(c => c.owner === 'P' && c.garrison >= 2 && connected(b, c.id, target.id))
      .map(c => ({ source: c.id, count: Math.floor(c.garrison / 2),
        eta: travelTime(c, target, movementSpeed(b, c, factionOf(b, 'P')!)) }));
  }

  rally(target: Camp) {
    const plan = this.plan(target);
    if (!plan.length) return [];
    const armies = plan.map(row => this.dispatch(row.source, target.id)!);
    this.stock.rally--;
    return armies;
  }

  advance(ms: number): BattleEvent[] {
    return advanceBattle(this.battle, this.battle.gameMs + ms);
  }
}
