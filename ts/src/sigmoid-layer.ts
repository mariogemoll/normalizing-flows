import * as sigmoid from './sigmoid';
import type { Transformation } from './transformation';
import { addDot, drawFunction1D, getContext } from './web-ui-common/canvas';
import { addCanvas, addDiv } from './web-ui-common/dom';
import { makeScale } from './web-ui-common/util';

/**
 * Initializes a sigmoid layer: y = 1 / (1 + e^(-k(x-x0)))
 * Sets up an interactive editor with control points and returns the transformation
 */
export function initSigmoidLayer(
  container: HTMLElement,
  onChange: () => void,
  initialK = 1.0,
  initialX0 = 0.0,
  width = 160,
  height = 160,
  xDomain: [number, number] = [-10, 10],
  yDomain: [number, number] = [0, 1]
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

  // Steepness control points: distance from center on both sides
  const STEEPNESS_DISTANCE = 1;

  let selectedPoint: 'center' | 'steepness-left' | 'steepness-right' | null = null;
  let isDragging = false;

  const POINT_RADIUS = 5;
  const MARGIN = 25;

  // Create scales
  const xScale = makeScale(xDomain, [MARGIN, width - MARGIN]);
  const yScale = makeScale(yDomain, [height - MARGIN, MARGIN]);

  // Draw the sigmoid curve and control points
  function draw(): void {
    ctx.clearRect(0, 0, width, height);

    // Draw frame
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(MARGIN, MARGIN, width - 2 * MARGIN, height - 2 * MARGIN);

    // Clip to margin area to prevent drawing outside
    ctx.save();
    ctx.beginPath();
    ctx.rect(MARGIN, MARGIN, width - 2 * MARGIN, height - 2 * MARGIN);
    ctx.clip();

    // Draw sigmoid curve using drawFunction1D
    drawFunction1D(ctx, xScale, yScale, (x: number) => sigmoid.f(k, x0, x), {
      stroke: '#555',
      lineWidth: 2,
      sampleCount: 100
    });

    ctx.restore();

    // Draw center control point at (x0, 0.5)
    const centerCx = xScale(x0);
    const centerCy = yScale(0.5);
    const centerColor = selectedPoint === 'center' ? '#4CAF50' : '#2196F3';
    addDot(ctx, centerCx, centerCy, POINT_RADIUS, centerColor);

    // Draw left steepness control point
    const steepnessLeftX = x0 - STEEPNESS_DISTANCE;
    const steepnessLeftY = sigmoid.f(k, x0, steepnessLeftX);
    const steepnessLeftCx = xScale(steepnessLeftX);
    const steepnessLeftCy = yScale(steepnessLeftY);
    const leftColor = selectedPoint === 'steepness-left' ? '#4CAF50' : '#FF9800';
    addDot(ctx, steepnessLeftCx, steepnessLeftCy, POINT_RADIUS, leftColor);

    // Draw right steepness control point
    const steepnessRightX = x0 + STEEPNESS_DISTANCE;
    const steepnessRightY = sigmoid.f(k, x0, steepnessRightX);
    const steepnessRightCx = xScale(steepnessRightX);
    const steepnessRightCy = yScale(steepnessRightY);
    const rightColor = selectedPoint === 'steepness-right' ? '#4CAF50' : '#FF9800';
    addDot(ctx, steepnessRightCx, steepnessRightCy, POINT_RADIUS, rightColor);
  }

  // Find which point is at the given canvas coordinates
  function findPointAt(
    cx: number,
    cy: number
  ): 'center' | 'steepness-left' | 'steepness-right' | null {
    const centerCx = xScale(x0);
    const centerCy = yScale(0.5);
    const distCenter = Math.sqrt((cx - centerCx) ** 2 + (cy - centerCy) ** 2);

    const steepnessLeftX = x0 - STEEPNESS_DISTANCE;
    const steepnessLeftY = sigmoid.f(k, x0, steepnessLeftX);
    const steepnessLeftCx = xScale(steepnessLeftX);
    const steepnessLeftCy = yScale(steepnessLeftY);
    const distLeft = Math.sqrt((cx - steepnessLeftCx) ** 2 + (cy - steepnessLeftCy) ** 2);

    const steepnessRightX = x0 + STEEPNESS_DISTANCE;
    const steepnessRightY = sigmoid.f(k, x0, steepnessRightX);
    const steepnessRightCx = xScale(steepnessRightX);
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
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const x = xScale.inverse(cx);
    const y = yScale.inverse(cy);

    if (selectedPoint === 'center') {
      // Only allow horizontal movement for center point
      x0 = Math.max(xDomain[0], Math.min(xDomain[1], x));
      const steepnessX = x0 + STEEPNESS_DISTANCE;
      const steepnessY = sigmoid.f(k, x0, steepnessX);
      try {
        k = sigmoid.computeK(x0, steepnessX, steepnessY);
      } catch {
        // Keep previous k if computation fails
      }
    } else if (selectedPoint === 'steepness-left') {
      // Only allow vertical movement for left steepness point
      const steepnessX = x0 - STEEPNESS_DISTANCE;
      const yClipped = Math.max(0.01, Math.min(0.99, y));
      try {
        k = sigmoid.computeK(x0, steepnessX, yClipped);
      } catch {
        // Keep previous k if computation fails
      }
    } else {
      // Only allow vertical movement for right steepness point
      const steepnessX = x0 + STEEPNESS_DISTANCE;
      const yClipped = Math.max(0.01, Math.min(0.99, y));
      try {
        k = sigmoid.computeK(x0, steepnessX, yClipped);
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
    f: (x: number): number => sigmoid.f(k, x0, x),
    df: (x: number): number => sigmoid.df(k, x0, x),
    fInv: (y: number): number => sigmoid.fInv(k, x0, y),
    dfInv: (y: number): number => sigmoid.dfInv(k, x0, y)
  };
}
