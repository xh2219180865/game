import type { Fraction } from './fraction.ts';

export type FactionId = 'P' | 'E' | 'E1' | 'E2' | 'E3';
export type CampType = 'barracks' | 'archery' | 'relay' | 'fort';
export type TroopType = 'infantry' | 'archer' | 'cavalry' | 'guard';
export type Tier = 1 | 2 | 3;
export type MapId = 'L01' | 'L02' | 'L03' | 'A01' | 'A02' | 'A03';
export type ActiveCardId = 'mobilize' | 'march' | 'supply' | 'feint';
export type PassiveCardId = 'farming' | 'logistics' | 'fortification';
export type CardId = ActiveCardId | PassiveCardId;
export type PassiveLevels = Record<PassiveCardId, number>;
export type ActiveInventory = Record<ActiveCardId, number>;
export interface Point { x: number; y: number }

export interface CampSeed extends Point {
  id: string;
  owner: FactionId | null;
  type: CampType;
  tier: Tier;
  garrison: number;
}

export interface Camp extends CampSeed {
  credit: Fraction;
  mobilizeUntil: number;
  bonusBudget: Fraction;
  feintUntil: number;
  nextShotAtMs: number | null;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  description: string;
  tutorial: boolean;
  camps: readonly CampSeed[];
  roads: readonly (readonly [string, string])[];
  aiFirstAt: number;
  aiInterval: number;
  aiMinimum: number;
  aiMargin: number;
}

export interface Faction {
  id: FactionId;
  eliminated: boolean;
  rank: number | null;
  passives: PassiveLevels;
  inventory: ActiveInventory;
  nextAiAtMs: number;
  lastActionSequence: number;
}

export interface Army {
  id: string;
  faction: FactionId;
  sourceId: string;
  targetId: string;
  troopType: TroopType;
  initialCount: number;
  remainingCount: number;
  from: Point;
  to: Point;
  departedAtMs: number;
  arrivalAtMs: number;
  speed: number;
  volleyCheckAtMs: number | null;
  volleyState: 'pending' | 'fired' | 'skipped' | null;
  volleySkipReason: 'friendly' | 'empty' | 'zeroDamage' | null;
}

export interface BattleResult {
  reason: 'last-camp' | 'deadline' | 'eliminated';
  playerRank: number;
  independentWinner: FactionId | null;
  ranks: Partial<Record<FactionId, number>>;
  stats: { faction: FactionId; camps: number; troops: number; rank: number | null }[];
  atMs: number;
}

export interface Battle {
  id: string;
  rulesetId: 'tc-v1';
  ruleRevision: '1.5' | '1.6';
  mapId: MapId;
  gameMs: number;
  deadlineMs: number | null;
  status: 'running' | 'paused' | 'finished';
  awaitingFirstDispatch: boolean;
  hasPlayerDispatch: boolean;
  camps: Camp[];
  factions: Faction[];
  armies: Army[];
  nextEntityId: number;
  nextEventId: number;
  result: BattleResult | null;
}

export interface BattleEvent {
  id: number;
  atMs: number;
  type: 'dispatch' | 'arrival' | 'capture' | 'tower-shot' | 'volley' | 'volley-skipped' | 'upgrade' | 'card' | 'eliminated' | 'result' | 'production' | 'garrison-loss' | 'army-loss' | 'garrison-change' | 'overflow';
  sourceId?: string;
  targetId?: string;
  faction?: FactionId;
  amount?: number;
  position?: Point;
  reason?: string;
}

export type BattleAction = {
  sequence: number;
  faction: FactionId;
} & (
  | { kind: 'dispatch'; sourceId: string; targetId: string; march?: boolean }
  | { kind: 'upgrade'; targetId: string }
  | { kind: 'card'; cardId: Exclude<ActiveCardId, 'march'>; targetId: string }
);

export type ActionResult = { ok: true; events: BattleEvent[] } | { ok: false; reason: string; events: [] };
