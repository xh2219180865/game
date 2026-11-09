import { armyPosition, distance } from '../src/core/geometry.ts';
import { MAPS } from '../src/core/maps.ts';
import type { BattleEvent, Camp, Point } from '../src/core/types.ts';
import { arrow, building, campPennant, marchingSoldier } from '../src/render/art.ts';
import { drawArt, loadArt } from '../src/render/assets.ts';
import { drawOrderTitle, drawTrialSignal, type TrialSignal } from './strategy-trial-effects.ts';
import { campNames, StrategyTrial, type TrialOrder } from './strategy-trial.ts';

document.body.innerHTML = `<main><header><span>谋定山河 · 独立试玩</span><button id="reset">重置战场</button></header>
<h1>三道军令</h1><canvas width="360" height="305" aria-label="策略试玩战场"></canvas>
<nav aria-label="选择军令">
<button data-order="commit"><b>孤注一掷</b><small>下次派出四分之三</small></button>
<button data-order="recall"><b>鸣金收兵</b><small>点行军队伍折返</small></button>
<button data-order="rally"><b>烽火驰援</b><small>调邻城半数守军</small></button></nav>
<section><p id="hint" role="status"></p><ul id="plan"></ul><button id="confirm" hidden>确认调兵</button> <button id="cancel" hidden>取消</button></section>
<footer><button id="raid">敌军出击前哨</button><span>青旗是己方 · 赤旗是敌方</span></footer></main>`;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const list = document.querySelector<HTMLUListElement>('#plan')!;
const confirm = document.querySelector<HTMLButtonElement>('#confirm')!;
const cancel = document.querySelector<HTMLButtonElement>('#cancel')!;
const raid = document.querySelector<HTMLButtonElement>('#raid')!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-order]')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const initial = '从青旗营地拖向相连的营地，普通派兵出一半。';
const descriptions = {
  commit: '从己营沿道路拖兵。松手后派出四分之三，向下取整。',
  recall: '点一支正在路上的青旗队伍。队伍原路折返，沿途仍可能中箭。',
  rally: '点一座己营查看可调来的援军，然后确认。',
};
let trial = new StrategyTrial();
let order: TrialOrder | null = null;
let destination: Camp | null = null;
let drag: { pointer: number; source: Camp; point: Point } | null = null;
let events: { event: BattleEvent; at: number }[] = [];
let signal: TrialSignal | null = null;
let raided = false;
const camp = (id: string) => trial.battle.camps.find(c => c.id === id);
const seconds = (ms: number) => (ms / 1000).toFixed(1);
function show(message: string) {
  hint.textContent = message;
  buttons.forEach(button => {
    const kind = button.dataset.order as TrialOrder;
    button.disabled = !trial.stock[kind] || trial.battle.status !== 'running';
    button.setAttribute('aria-pressed', String(order === kind));
  });
  list.replaceChildren();
  const plan = destination ? trial.plan(destination) : [];
  for (const row of plan) {
    const item = document.createElement('li');
    item.textContent = `${campNames[row.source]} 派 ${row.count} · 留 ${camp(row.source)!.garrison - row.count} · ${seconds(row.eta)} 秒到`;
    list.append(item);
  }
  confirm.hidden = !plan.length;
  cancel.hidden = !order;
  raid.disabled = raided || trial.battle.status !== 'running';
}
function select(kind: TrialOrder | null, message?: string) {
  order = kind;
  destination = null;
  drag = null;
  show(message ?? (kind ? descriptions[kind] : initial));
}
buttons.forEach(button => button.onclick = () => {
  const kind = button.dataset.order as TrialOrder;
  select(order === kind ? null : kind);
});
cancel.onclick = () => select(null);
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => {
  trial = new StrategyTrial();
  raided = false;
  events = [];
  signal = null;
  select(null);
};
raid.onclick = () => {
  const a = trial.dispatch('A01-E1', 'A01-N4', false, 'E1');
  if (!a) return;
  raided = true;
  select(null, `敌军派出 ${a.remainingCount} 兵攻打前哨，${seconds(a.arrivalAtMs - a.departedAtMs)} 秒到。`);
};
confirm.onclick = () => {
  if (!destination) return;
  const armies = trial.rally(destination);
  signal = { point: destination, at: performance.now(), kind: 'rally',
    sources: armies.map(a => a.from), armies: armies.map(a => a.id) };
  select(null, `${armies.length} 支援军已分别沿道路出发，共 ${armies.reduce((n, a) => n + a.initialCount, 0)} 兵。`);
};

const offset = 195;
function pointer(e: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth,
    y: (e.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight + offset };
}
function campAt(p: Point) {
  return trial.battle.camps.find(c => distance(c, p) <= 29);
}
canvas.onpointerdown = e => {
  if (drag || trial.battle.status !== 'running') return;
  const p = pointer(e);
  const c = campAt(p);
  if (order === 'recall') {
    const b = trial.battle;
    const nearest = b.armies.filter(a => trial.canRecall(a.id))
      .map(a => ({ a, at: armyPosition(a, b.gameMs) }))
      .map(({ a, at }) => ({ a, at, gap: Math.min(distance(p, at), distance(p, { x: at.x, y: at.y - 16 })) }))
      .filter(a => a.gap <= 23).sort((a, z) => a.gap - z.gap)[0];
    const army = nearest && trial.recall(nearest.a.id);
    if (!army) return show('点道路上正在行军的青旗队伍。');
    signal = { point: nearest.at, at: performance.now(), kind: 'recall', armies: [army.id] };
    return select(null, `${army.remainingCount} 兵已折返，预计 ${seconds(army.arrivalAtMs - b.gameMs)} 秒到${campNames[army.targetId]}。`);
  }
  if (order === 'rally') {
    destination = c && trial.plan(c).length ? c : null;
    return show(destination ? `援军将前往${campNames[destination.id]}。确认前战场暂停。` : '请选择有邻城能出兵的己营。');
  }
  if (c?.owner !== 'P') return;
  canvas.setPointerCapture(e.pointerId);
  drag = { pointer: e.pointerId, source: c, point: p };
};
canvas.onpointermove = e => { if (drag?.pointer === e.pointerId) drag.point = pointer(e); };
canvas.onpointercancel = e => { if (drag?.pointer === e.pointerId) drag = null; };
canvas.onlostpointercapture = canvas.onpointercancel;
canvas.onpointerup = e => {
  if (drag?.pointer !== e.pointerId) return;
  const { source } = drag;
  drag = null;
  const target = campAt(pointer(e));
  if (!target || source === target) return;
  const army = trial.dispatch(source.id, target.id, order === 'commit');
  if (!army) return show('请沿相连道路派兵，出发营地至少需要 2 兵。');
  if (order === 'commit') signal = { point: source, at: performance.now(), kind: 'commit', armies: [army.id] };
  select(null, `${campNames[source.id]}派 ${army.remainingCount} · 留 ${source.garrison} · ${seconds(army.arrivalAtMs - army.departedAtMs)} 秒到。`);
};

void loadArt(() => new Image());
let previous: number | null = null;
function frame(now: number) {
  const dt = previous === null ? 0 : Math.min(50, Math.floor(now - previous));
  previous = now;
  const b = trial.battle;
  if (!destination && b.armies.length && !document.hidden) {
    events.push(...trial.advance(dt).filter(e => ['tower-shot', 'arrival', 'capture'].includes(e.type))
      .map(event => ({ event, at: now })));
    if (b.status === 'finished') select(null, '这一轮已结束。重置战场可再试。');
  }
  const ms = b.gameMs;
  events = events.filter(e => now - e.at < 450);
  if (signal && now - signal.at >= 1550) signal = null;
  const elapsed = signal ? Math.max(0, now - signal.at) : 0;
  ctx.fillStyle = '#77654d';
  ctx.fillRect(0, 0, 360, 305);
  drawArt(ctx, 'terrain-plains', 0, 0, 360, 305, 'cover');
  ctx.save();
  ctx.translate(0, -offset);
  const road = (a: Point, z: Point, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(z.x, z.y);
    ctx.stroke();
  };
  for (const [from, to] of MAPS.A01.roads) {
    const a = camp(from), z = camp(to);
    if (!a || !z) continue;
    road(a, z, '#594630', 11);
    road(a, z, '#b69769', 7);
    road(a, z, '#cfb68a', 1);
  }
  if (drag) arrow(ctx, drag.source, drag.point, '#f4d498', 3);
  if (destination) for (const row of trial.plan(destination)) arrow(ctx, camp(row.source)!, destination, '#f2cb75', 3);
  if (signal?.sources) {
    ctx.save();
    ctx.setLineDash([6, 7]);
    ctx.lineDashOffset = reduced.matches ? 0 : -elapsed / 32;
    ctx.globalAlpha = Math.min(1, (1550 - elapsed) / 400);
    for (const from of signal.sources) road(from, signal.point, '#ffe4a0', 2.5);
    ctx.restore();
  }
  for (const c of b.camps) {
    building(ctx, c.x, c.y, 64, c.type, c.tier, c.owner);
    campPennant(ctx, c.x, c.y + 13, c.garrison, c.owner, c === destination, c.tier);
    ctx.font = 'bold 12px "Songti SC", serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#29251d';
    ctx.strokeText(campNames[c.id]!, c.x, c.y + 38);
    ctx.fillStyle = '#fff0cb';
    ctx.fillText(campNames[c.id]!, c.x, c.y + 38);
  }
  for (const a of b.armies) {
    const p = armyPosition(a, ms);
    const facing = a.to.x < a.from.x ? -1 : 1;
    const frame = reduced.matches ? 0 : Math.floor((ms - a.departedAtMs) / 105) % 6;
    if (signal?.armies?.includes(a.id) && !reduced.matches) {
      const tailX = a.from.x - a.to.x, tailY = a.from.y - a.to.y;
      const length = Math.hypot(tailX, tailY);
      for (let i = 1; i <= 3; i++) {
        const trail = 4 + i * 5 + (elapsed % 200) / 44;
        ctx.fillStyle = i === 1 ? '#e1b77e82' : '#e1b77e50';
        ctx.beginPath();
        ctx.ellipse(p.x + tailX * trail / length, p.y + tailY * trail / length, 2 + i, 1 + i / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    marchingSoldier(ctx, p.x, p.y, a.troopType, a.faction, 0.8, 0, 0, facing, frame);
    campPennant(ctx, p.x, p.y - 18, a.remainingCount, a.faction, order === 'recall' && a.faction === 'P');
  }
  for (const { event: e, at } of events) {
    const a = camp(e.sourceId ?? '');
    const z = e.position ?? camp(e.targetId ?? '');
    if (e.type === 'tower-shot' && a && z) road(a, z, '#f8ce81', 1);
    else if (z) {
      ctx.strokeStyle = e.type === 'capture' ? '#ffcf7d' : '#ece4bb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(z.x, z.y, reduced.matches ? 23 : 16 + (now - at) / 22, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (signal) drawTrialSignal(ctx, signal, elapsed, reduced.matches);
  ctx.restore();
  if (signal) drawOrderTitle(ctx, signal.kind, elapsed);
  requestAnimationFrame(frame);
}
select(null);
requestAnimationFrame(frame);
