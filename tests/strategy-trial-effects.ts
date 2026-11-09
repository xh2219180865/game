import type { Point } from '../src/core/types.ts';
import { flag } from '../src/render/art.ts';
import type { TrialOrder } from './strategy-trial.ts';

export const orderNames: Record<TrialOrder, string> = {
  commit: '孤注一掷', recall: '鸣金收兵', rally: '烽火驰援',
};

export interface TrialSignal {
  point: Point;
  at: number;
  kind: TrialOrder;
  sources?: Point[];
  armies?: string[];
}

export function drawTrialSignal(ctx: CanvasRenderingContext2D, signal: TrialSignal, elapsed: number, reduced: boolean) {
  const { point, kind } = signal;
  const t = reduced ? .34 : elapsed / 1550;
  const fade = Math.min(1, (1 - elapsed / 1550) * 4);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(point.x, point.y);

  if (kind === 'commit') {
    const lift = Math.min(1, t * 5);
    ctx.translate(-14, -11 - 34 * lift);
    ctx.strokeStyle = '#372719';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, -15); ctx.lineTo(-9, 27); ctx.stroke();
    ctx.rotate(Math.sin(t * 15) * .09);
    flag(ctx, 1, -5, 12, 'P');
  } else if (kind === 'recall') {
    ctx.translate(0, -36);
    ctx.strokeStyle = '#4b3220';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-16, 15); ctx.lineTo(-16, -13); ctx.lineTo(16, -13); ctx.lineTo(16, 15); ctx.stroke();
    ctx.fillStyle = '#a77741';
    ctx.strokeStyle = '#f6d49c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#efc58c';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      const radius = 13 + 13 * t;
      ctx.arc(0, 0, radius, side === 1 ? -.5 : Math.PI - .5, side === 1 ? .5 : Math.PI + .5);
      ctx.stroke();
    }
  } else {
    ctx.translate(16, -20);
    const glow = ctx.createRadialGradient(0, -10, 1, 0, -10, 27);
    glow.addColorStop(0, '#ffac5388');
    glow.addColorStop(1, '#ffac5300');
    ctx.fillStyle = glow;
    ctx.fillRect(-28, -38, 56, 56);
    for (let i = 4; i >= 0; i--) {
      const rise = i * 7 + t * 12;
      const drift = Math.sin(i + t * 4) * 4 + i * 1.8;
      ctx.fillStyle = i < 2 ? '#68513c9c' : '#3d383482';
      ctx.beginPath(); ctx.ellipse(drift, -14 - rise, 5 + i * 1.5, 4 + i, -.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#463225';
    ctx.fillRect(-8, 0, 16, 4);
    ctx.fillRect(-5, 4, 3, 8);
    ctx.fillRect(3, 4, 3, 8);
    for (const [color, width, height] of [['#a73e20', 8, 22], ['#ef873e', 6, 17], ['#ffe2a1', 3, 10]] as const) {
      const lean = Math.sin(t * 19 + width) * 3;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-width, 0);
      ctx.quadraticCurveTo(-width - 2, -6, lean, -height);
      ctx.quadraticCurveTo(width + 3, -7, width, 0);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawOrderTitle(ctx: CanvasRenderingContext2D, kind: TrialOrder, elapsed: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, (1550 - elapsed) / 330);
  ctx.fillStyle = '#32261dee';
  ctx.fillRect(222, 12, 124, 39);
  ctx.fillStyle = '#973e29';
  ctx.fillRect(222, 12, 4, 39);
  ctx.strokeStyle = '#b69360';
  ctx.strokeRect(226.5, 14.5, 116, 34);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe7b3';
  ctx.font = 'bold 18px "Kaiti SC", "Songti SC", serif';
  ctx.fillText(orderNames[kind], 285, 32);
  ctx.restore();
}
