import { defaultMargins } from './constants';
import * as logit from './logit';
import type { Transformation } from './transformation';
import type { Margins } from './types';
import {
  addDot,
  addFrameUsingScales,
  drawFunction1D,
  getContext
} from './web-ui-common/canvas';
import { addCanvas, addDiv } from './web-ui-common/dom';
import { makeScale } from './web-ui-common/util';

/**
 * Initializes a logit layer: y = x0 + (1/k) * log(x / (1-x))
 * Sets up an interactive editor with control points and returns the transformation
 */
export function initLogitLayer(
  container: HTMLElement,
  onChange: () => void,
  initialK = 1.0,
  initialX0 = 0.0,
  width = 160,
  height = 160,
  xDomain: [number, number] = [0, 1],
  yDomain: [number, number] = [-8, 8],
  margins: Margins = defaultMargins
): Transformation {
  let k = initialK;
  let x0 = initialX0;

  // Create wrapper container for canvas
  const wrapper = addDiv(
    container,
    {},
    { position: 'relative', width: `${width}px`, height: `${height}px` }
  );

  const canvas = addCanvas(
    wrapper,
    { width: `${width}`, height: `${height}` },
    { cursor: 'pointer', display: 'block' }
  );

  const ctx = getContext(canvas);

  // Steepness control points: fixed X positions
  const STEEPNESS_LEFT_X = 0.25;
  const STEEPNESS_RIGHT_X = 0.75;

  let selectedPoint: 'center' | 'steepness-left' | 'steepness-right' | null = null;
  let isDragging = false;

  const POINT_RADIUS = 5;

  // Create scales using provided margins
  const xScale = makeScale(xDomain, [margins.left, width - margins.right]);
  const yScale = makeScale(yDomain, [height - margins.bottom, margins.top]);

  // Draw the logit curve and control points
  function draw(): void {
    ctx.clearRect(0, 0, width, height);

    // Draw frame with axes
    addFrameUsingScales(ctx, xScale, yScale, 0);

    // Clip to margin area to prevent drawing outside
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      margins.left,
      margins.top,
      width - margins.left - margins.right,
      height - margins.top - margins.bottom
    );
    ctx.clip();

    // Draw logit curve using drawFunction1D
    drawFunction1D(ctx, xScale, yScale, (x: number) => logit.f(k, x0, x), {
      stroke: '#555',
      lineWidth: 2,
      sampleCount: 100
    });

    ctx.restore();

    // Draw center control point at (0.5, x0)
    const centerCx = xScale(0.5);
    const centerCy = yScale(x0);
    const centerColor = selectedPoint === 'center' ? '#4CAF50' : '#2196F3';
    addDot(ctx, centerCx, centerCy, POINT_RADIUS, centerColor);

    // Draw left steepness control point
    const steepnessLeftY = logit.f(k, x0, STEEPNESS_LEFT_X);
    const steepnessLeftCx = xScale(STEEPNESS_LEFT_X);
    const steepnessLeftCy = yScale(steepnessLeftY);
    const leftColor = selectedPoint === 'steepness-left' ? '#4CAF50' : '#FF9800';
    addDot(ctx, steepnessLeftCx, steepnessLeftCy, POINT_RADIUS, leftColor);

    // Draw right steepness control point
    const steepnessRightY = logit.f(k, x0, STEEPNESS_RIGHT_X);
    const steepnessRightCx = xScale(STEEPNESS_RIGHT_X);
    const steepnessRightCy = yScale(steepnessRightY);
    const rightColor = selectedPoint === 'steepness-right' ? '#4CAF50' : '#FF9800';
    addDot(ctx, steepnessRightCx, steepnessRightCy, POINT_RADIUS, rightColor);
  }

  // Find which point is at the given canvas coordinates
  function findPointAt(
    cx: number,
    cy: number
  ): 'center' | 'steepness-left' | 'steepness-right' | null {
    const centerCx = xScale(0.5);
    const centerCy = yScale(x0);
    const distCenter = Math.sqrt((cx - centerCx) ** 2 + (cy - centerCy) ** 2);

    const steepnessLeftY = logit.f(k, x0, STEEPNESS_LEFT_X);
    const steepnessLeftCx = xScale(STEEPNESS_LEFT_X);
    const steepnessLeftCy = yScale(steepnessLeftY);
    const distLeft = Math.sqrt((cx - steepnessLeftCx) ** 2 + (cy - steepnessLeftCy) ** 2);

    const steepnessRightY = logit.f(k, x0, STEEPNESS_RIGHT_X);
    const steepnessRightCx = xScale(STEEPNESS_RIGHT_X);
    const steepnessRightCy = yScale(steepnessRightY);
    const distRight = Math.sqrt((cx - steepnessRightCx) ** 2 + (cy - steepnessRightCy) ** 2);

    const threshold = POINT_RADIUS + 5;

    if (distCenter < threshold) {return 'center';}
    if (distLeft < threshold) {return 'steepness-left';}
    if (distRight < threshold) {return 'steepness-right';}
    return null;
  }

  // Mouse event handlers
  function handleMouseDown(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    selectedPoint = findPointAt(cx, cy);
    if (selectedPoint) {
      isDragging = true;
      draw();
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging || !selectedPoint) {return;}

    const rect = canvas.getBoundingClientRect();
    const cy = e.clientY - rect.top;

    const y = yScale.inverse(cy);

    if (selectedPoint === 'center') {
      // Only allow vertical movement for center point
      x0 = Math.max(yDomain[0], Math.min(yDomain[1], y));
      const steepnessY = logit.f(k, x0, STEEPNESS_RIGHT_X);
      try {
        k = logit.computeK(x0, STEEPNESS_RIGHT_X, steepnessY);
      } catch {
        // Keep previous k if computation fails
      }
    } else if (selectedPoint === 'steepness-left') {
      // Only allow vertical movement for left steepness point
      const yClipped = Math.max(yDomain[0], Math.min(yDomain[1], y));
      try {
        k = logit.computeK(x0, STEEPNESS_LEFT_X, yClipped);
      } catch {
        // Keep previous k if computation fails
      }
    } else {
      // Only allow vertical movement for right steepness point
      const yClipped = Math.max(yDomain[0], Math.min(yDomain[1], y));
      try {
        k = logit.computeK(x0, STEEPNESS_RIGHT_X, yClipped);
      } catch {
        // Keep previous k if computation fails
      }
    }

    draw();
    onChange();
  }

  function handleMouseUp(): void {
    if (isDragging) {
      isDragging = false;
      selectedPoint = null;
      draw();
    }
  }

  function handleMouseLeave(): void {
    handleMouseUp();
  }

  // Attach event listeners
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseLeave);

  // Initial draw
  draw();

  // Return the transformation that uses the mutable state
  return {
    f: (x: number): number => logit.f(k, x0, x),
    df: (x: number): number => logit.df(k, x0, x),
    fInv: (y: number): number => logit.fInv(k, x0, y),
    dfInv: (y: number): number => logit.dfInv(k, x0, y)
  };
}
