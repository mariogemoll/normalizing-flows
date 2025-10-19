import { drawFunction1D } from './web-ui-common/canvas';
import type { Scale } from './web-ui-common/types';

const STROKE = '#555';

export function drawBaseline(
  ctx: CanvasRenderingContext2D,
  xScale: Scale,
  yScale: Scale
): void {
  ctx.strokeStyle = 'rgba(90, 74, 58, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xScale(xScale.domain[0]), yScale(0));
  ctx.lineTo(xScale(xScale.domain[1]), yScale(0));
  ctx.stroke();
}

export function drawDistribution(
  ctx: CanvasRenderingContext2D,
  fn: (x: number) => number,
  xScale: Scale,
  yScale: Scale
): void {
  drawBaseline(ctx, xScale, yScale);

  // Draw distribution - outline only
  drawFunction1D(ctx, xScale, yScale, fn, {
    stroke: STROKE,
    lineWidth: 1.5,
    sampleCount: 400
  });
}
