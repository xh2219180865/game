import type { Battle, CampSeed, CampType, FactionId, MapDefinition, MapId, Tier } from './types.ts';

type NodeRow = [string, number, number, FactionId | null, CampType, Tier, number];
const roadRows: Record<MapId, readonly (readonly [string,string])[]> = {
  L01: [['P1','N1'],['N1','E1']],
  L02: [['P1','N1'],['N1','E1'],['E1','N2'],['N2','P1'],['N1','N3'],['N3','N2']],
  L03: [['P1','P2'],['P2','N2'],['N2','E1'],['E1','E2'],['E2','N1'],['N1','P1'],['N1','N3'],['N3','N2']],
  A01: [['P1','N4'],['N4','E1'],['E1','N3'],['N3','E3'],['E3','N1'],['N1','E2'],['E2','N2'],['N2','P1'],['N5','N1'],['N5','N2'],['N5','N3'],['N5','N4']],
  A02: [['P1','N2'],['N2','E1'],['E1','N4'],['N4','E3'],['E3','N1'],['N1','E2'],['E2','N3'],['N3','P1'],['N5','N1'],['N5','N2'],['N5','N3'],['N5','N4']],
  A03: [['P1','N4'],['N4','E1'],['E1','N3'],['N3','E3'],['E3','N1'],['N1','E2'],['E2','N2'],['N2','P1'],['N5','N1'],['N5','N2'],['N5','N3'],['N5','N4']],
};
function map(id: MapId, name: string, description: string, rows: NodeRow[], timing = [3000, 1500, 12, 2]): MapDefinition {
  return { id, name, description, tutorial: id.startsWith('L'), aiFirstAt: timing[0]!, aiInterval: timing[1]!, aiMinimum: timing[2]!, aiMargin: timing[3]!,
    roads: roadRows[id].map(([a,z])=>[`${id}-${a}`,`${id}-${z}`] as const),
    camps: rows.map(([suffix, x, y, owner, type, tier, garrison]): CampSeed => ({ id: `${id}-${suffix}`, x, y, owner, type, tier, garrison })) };
}

const legacyA01 = map('A01', '四旗争城', '先扩张，也别空了最后一城。', [
  ['P1',75,430,'P','barracks',1,20], ['E1',285,430,'E1','barracks',1,20], ['E2',75,110,'E2','barracks',1,20], ['E3',285,110,'E3','barracks',1,20],
  ['N1',180,120,null,'barracks',1,8], ['N2',75,270,null,'archery',1,8], ['N3',285,270,null,'archery',1,8], ['N4',180,420,null,'barracks',1,8], ['N5',180,270,null,'fort',1,10],
]);
export const LEGACY_A01_CAMPS: readonly CampSeed[] = legacyA01.camps;
// Keep the original geometry while opening diagonal space between the four fronts.
// One ULP inward avoids a rotated 160 becoming 160.00000000000003 and adding 1 ms to ceil-based travel.
const a01Cos = Math.cos(Math.PI / 20) * (1 - Number.EPSILON);
const a01Sin = Math.sin(Math.PI / 20) * (1 - Number.EPSILON);

export const MAPS: Record<MapId, MapDefinition> = {
  L01: map('L01', '第一次夺城', '拖出半数，抢下营地，守住最后一城。', [
    ['P1',180,430,'P','barracks',1,24], ['N1',110,285,null,'barracks',1,6], ['E1',225,110,'E','barracks',1,8],
  ], [8000,2500,16,4]),
  L02: map('L02', '塔营与升级', '弓兵出征齐射，塔营驻地持续射击。', [
    ['P1',85,425,'P','barracks',1,30], ['E1',275,115,'E','barracks',1,26], ['N1',75,220,null,'archery',1,8],
    ['N2',285,325,null,'fort',1,12], ['N3',180,275,null,'relay',1,8],
  ], [4000,2000,14,3]),
  L03: map('L03', '整编与驰援', '进入骑营自动整编，再次出征获得骑兵速度。', [
    ['P1',90,425,'P','barracks',2,28], ['P2',270,425,'P','archery',1,16], ['E1',270,115,'E','barracks',2,28],
    ['E2',90,115,'E','archery',1,16], ['N1',75,275,null,'relay',2,10], ['N2',285,275,null,'relay',2,10], ['N3',180,270,null,'fort',2,18],
  ]),
  A01: { ...legacyA01, camps: LEGACY_A01_CAMPS.map(c => ({ ...c,
    x: 180 + (c.x - 180) * a01Cos - (c.y - 270) * a01Sin,
    y: 270 + (c.x - 180) * a01Sin + (c.y - 270) * a01Cos,
  })) },
  A02: map('A02', '双骑争先', '争夺高产步兵营，借骑营快速驰援。', [
    ['P1',75,440,'P','barracks',1,22], ['E1',285,440,'E1','barracks',1,22], ['E2',75,100,'E2','barracks',1,22], ['E3',285,100,'E3','barracks',1,22],
    ['N1',180,125,null,'barracks',2,14], ['N2',180,415,null,'barracks',2,14], ['N3',75,270,null,'relay',1,8], ['N4',285,270,null,'relay',1,8], ['N5',180,270,null,'fort',1,10],
  ]),
  A03: map('A03', '重城集结', '塔营守城，步兵营补充产能，骑营整编。', [
    ['P1',75,430,'P','fort',2,30], ['E1',285,430,'E1','fort',2,30], ['E2',75,110,'E2','fort',2,30], ['E3',285,110,'E3','fort',2,30],
    ['N1',180,110,null,'archery',1,6], ['N2',75,270,null,'barracks',1,6], ['N3',285,270,null,'barracks',1,6], ['N4',180,430,null,'archery',1,6], ['N5',180,270,null,'relay',2,10],
  ]),
};

export function neighbors(b: Pick<Battle,'mapId'|'ruleRevision'|'camps'>, id: string): string[] {
  if (!b.camps.some(c=>c.id===id)) return [];
  if (b.ruleRevision==='1.5') return b.camps.filter(c=>c.id!==id).map(c=>c.id);
  return MAPS[b.mapId].roads.flatMap(([a,z])=>a===id?[z]:z===id?[a]:[]);
}

export function connected(b: Pick<Battle,'mapId'|'ruleRevision'|'camps'>, sourceId: string, targetId: string): boolean {
  return sourceId!==targetId && b.camps.some(c=>c.id===targetId) && neighbors(b,sourceId).includes(targetId);
}

export function nextFormalMap(completed: number): MapId {
  if (!Number.isSafeInteger(completed) || completed < 0) throw new RangeError('Invalid completed count');
  return completed < 5 ? (completed === 2 || completed === 4 ? 'A02' : 'A01') : (['A03','A01','A02'] as const)[(completed - 5) % 3]!;
}
