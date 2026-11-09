import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armyPosition, distance } from '../src/core/geometry.ts';
import { StrategyTrial } from './strategy-trial.ts';

const front = 'A01-P1', outpost = 'A01-N4', archers = 'A01-N2', fort = 'A01-N5';

test('孤注一掷 only consumes on a legal dispatch, sending 30 and retaining 10', () => {
  const t = new StrategyTrial();
  assert.equal(t.dispatch(front, fort, true), null);
  assert.equal(t.stock.commit, 1);
  assert.equal(t.dispatch(front, outpost, true)?.remainingCount, 30);
  assert.equal(t.battle.camps.find(c => c.id === front)?.garrison, 10);
  assert.equal(t.stock.commit, 0);
  assert.equal(t.dispatch(front, outpost)?.remainingCount, 5);
});

test('鸣金收兵 reverses without teleporting and still takes tower fire', () => {
  const t = new StrategyTrial();
  const army = t.dispatch(archers, fort)!;
  assert.equal(t.recall(army.id), null);
  t.advance(2700);
  const before = armyPosition(army, t.battle.gameMs);
  assert.equal(t.recall(army.id), army);
  assert.ok(distance(before, armyPosition(army, t.battle.gameMs)) < 1e-9);
  assert.equal(army.targetId, archers);
  assert.equal(army.arrivalAtMs, 5400);
  const events = t.advance(2700);
  assert.ok(events.some(e => e.type === 'army-loss' && e.targetId === army.id));
  assert.ok(events.some(e => e.type === 'arrival' && e.targetId === archers && e.reason === 'friendly'));
  assert.equal(t.stock.recall, 0);
});

test('recalled troops arriving at a lost camp resolve as attackers', () => {
  const t = new StrategyTrial();
  const army = t.dispatch(front, outpost)!;
  t.advance(1000);
  t.recall(army.id);
  const origin = t.battle.camps.find(c => c.id === front)!;
  origin.owner = 'E1';
  origin.garrison = 2;
  assert.ok(t.advance(1000).some(e => e.type === 'capture' && e.targetId === front));
  assert.equal(origin.owner, 'P');
});

test('烽火驰援 previews different ETAs and only sends from connected friendly camps', () => {
  const t = new StrategyTrial();
  const target = t.battle.camps.find(c => c.id === front)!;
  const enemy = t.battle.camps.find(c => c.id === fort)!;
  assert.deepEqual(t.rally(enemy), []);
  const plan = t.plan(target);
  assert.deepEqual(plan.map(r => [r.source, r.count]), [[archers, 16], [outpost, 5]]);
  assert.ok(plan[0]!.eta > plan[1]!.eta);
  assert.equal(t.stock.rally, 1);
  assert.equal(target.garrison, 40);
  const armies = t.rally(target);
  assert.deepEqual(armies.map(a => a.arrivalAtMs), plan.map(r => r.eta));
  assert.equal(t.battle.camps.find(c => c.id === archers)?.garrison, 16);
  assert.equal(t.battle.camps.find(c => c.id === outpost)?.garrison, 5);
  assert.equal(t.stock.rally, 0);
});
