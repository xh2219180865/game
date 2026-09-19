import { add, asNumber, fraction, multiply, ONE } from './fraction.ts';
import type { Fraction } from './fraction.ts';
import type { Battle, Camp, CampType, Faction, PassiveLevels, ActiveInventory, Tier, TroopType } from './types.ts';

export const CAMP_CONFIG: Record<CampType, { name: string; troop: TroopType; troopName: string; rate: Fraction; speed: number }> = {
  barracks: { name: '步兵营', troop: 'infantry', troopName: '步兵', rate: fraction(6, 5), speed: 1 },
  archery: { name: '弓营', troop: 'archer', troopName: '弓兵', rate: fraction(4, 5), speed: 1 },
  relay: { name: '骑营', troop: 'cavalry', troopName: '骑兵', rate: fraction(4, 5), speed: 1.4 },
  fort: { name: '塔营', troop: 'guard', troopName: '守备兵', rate: fraction(2, 5), speed: 1 },
};

export const BASE_CAPACITY: Record<Tier, number> = { 1: 50, 2: 90, 3: 140 };
export const TIER_RATE: Record<Tier, Fraction> = { 1: ONE, 2: fraction(13, 10), 3: fraction(8, 5) };
export const SHOT_INTERVAL: Record<Tier, number> = { 1: 2000, 2: 1700, 3: 1500 };
export const UPGRADE: Record<1 | 2, { threshold: number; cost: number }> = { 1: { threshold: 30, cost: 10 }, 2: { threshold: 70, cost: 25 } };
export const TOWER_RANGE = 120;
export const VOLLEY_RANGE = 70;
export const VOLLEY_PREPARATION_MS = 500;
export const CAMP_RADIUS = 18;
export const emptyPassives = (): PassiveLevels => ({ farming: 0, logistics: 0, fortification: 0 });
export const emptyInventory = (): ActiveInventory => ({ mobilize: 0, march: 0, supply: 0, feint: 0 });

export function passiveBonus(percent: number, layers: number): Fraction {
  if (!Number.isSafeInteger(layers) || layers < 0) throw new RangeError('Invalid passive layers');
  const n = BigInt(layers);
  return fraction(BigInt(percent) * n, 100n * (n + 4n));
}

export function campCapacity(camp: Pick<Camp,'tier'>, owner?: Pick<Faction,'passives'>): number {
  const n = BigInt(owner?.passives.fortification ?? 0);
  return Number(BigInt(BASE_CAPACITY[camp.tier]) * (120n * n + 400n) / (100n * (n + 4n)));
}

export function naturalRate(camp: Camp, owner: Faction | undefined, atMs: number): Fraction {
  if (!camp.owner || !owner || owner.eliminated || camp.feintUntil > atMs) return fraction(0);
  return multiply(multiply(CAMP_CONFIG[camp.type].rate, TIER_RATE[camp.tier]), add(ONE, passiveBonus(20, owner.passives.farming)));
}

export function troopSpeed(camp: Camp, owner: Faction, march = false): number {
  return Math.min(160, 80 * CAMP_CONFIG[camp.type].speed * (1 + asNumber(passiveBonus(15, owner.passives.logistics))) * (march ? 1.4 : 1));
}

export function movementSpeed(b: Pick<Battle,'ruleRevision'>, camp: Camp, owner: Faction, march = false): number {
  if (b.ruleRevision==='1.5') return troopSpeed(camp,owner,march);
  return Math.min(48,24*CAMP_CONFIG[camp.type].speed*(1+asNumber(passiveBonus(15,owner.passives.logistics)))*(march?1.4:1));
}

export function productionRate(b: Pick<Battle,'ruleRevision'>, camp: Camp, owner: Faction | undefined, atMs: number): Fraction {
  const rate=naturalRate(camp,owner,atMs);
  return b.ruleRevision==='1.5'?rate:multiply(rate,fraction(3,4));
}
