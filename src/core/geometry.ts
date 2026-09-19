import { CAMP_RADIUS, VOLLEY_PREPARATION_MS, VOLLEY_RANGE } from './config.ts';
import type { Army, Point } from './types.ts';

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export function travelTime(source: Point, target: Point, speed: number): number {
  return Math.max(1000, Math.ceil(1000 * Math.max(0, distance(source, target) - 2 * CAMP_RADIUS) / speed));
}
export function volleyOffset(source: Point, target: Point, duration: number): number {
  const d = distance(source, target), length = d - 2 * CAMP_RADIUS;
  if (length <= 0) throw new RangeError('Overlapping camps');
  return Math.max(VOLLEY_PREPARATION_MS, Math.ceil(duration * Math.max(0, d - CAMP_RADIUS - VOLLEY_RANGE) / length));
}
export function armyPosition(army: Army, atMs: number): Point {
  const d = distance(army.from, army.to);
  const progress = Math.max(0, Math.min(1, (atMs - army.departedAtMs) / (army.arrivalAtMs - army.departedAtMs)));
  const offset = (CAMP_RADIUS + (d - 2 * CAMP_RADIUS) * progress) / d;
  return { x: army.from.x + (army.to.x - army.from.x) * offset, y: army.from.y + (army.to.y - army.from.y) * offset };
}
