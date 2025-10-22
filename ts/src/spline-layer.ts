import { defaultMargins } from './constants';
import { createBSplineTransformation } from './spline';
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

interface ControlPoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

/**
 * Initializes a B-spline layer with interactive control points
 * Sets up an interactive editor with draggable control points and returns the transformation
 */
export function initSplineLayer(
  container: HTMLElement,
  onChange: () => void,
  initialPoints: ControlPoint[] = [
    { x: 0.33, y: 0.33 },
    { x: 0.67, y: 0.67 }
  ],
  width = 160,
  height = 160,
  xDomain: [number, number] = [0, 1],
  yDomain: [number, number] = [0, 1],
  margins: Margins = defaultMargins
): Transformation {
  const controlPoints: ControlPoint[] = initialPoints.map(p => ({ ...p }));

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

  let selectedPointIndex: number | null = null;
  let isDragging = false;

  const POINT_RADIUS = 5;

  // Track constraint lines for fading animation
  interface ConstraintLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    opacity: number;
  }
  const constraintLines: ConstraintLine[] = [];

  // Create scales using provided margins
  const xScale = makeScale(xDomain, [margins.left, width - margins.right]);
  const yScale = makeScale(yDomain, [height - margins.bottom, margins.top]);

  // Cache the transformation and recompute only when control points change
  let cachedTransformation: Transformation = createBSplineTransformation(
    controlPoints.map(p => p.x),
    controlPoints.map(p => p.y)
  );

  function updateTransformation(): void {
    cachedTransformation = createBSplineTransformation(
      controlPoints.map(p => p.x),
      controlPoints.map(p => p.y)
    );
  }

  // Add a constraint line that will fade out
  function addConstraintLine(x1: number, y1: number, x2: number, y2: number): void {
    constraintLines.push({ x1, y1, x2, y2, opacity: 0.9 });
  }

  function displayTemporaryVerticalLine(cx: number): void {
    addConstraintLine(cx, 0, cx, height);
  }

  function displayTemporaryHorizontalLine(cy: number): void {
    addConstraintLine(0, cy, width, cy);
  }

  // Animation loop to fade out constraint lines
  function animateConstraintLines(): void {
    let needsRedraw = false;

    for (let i = constraintLines.length - 1; i >= 0; i--) {
      const line = constraintLines[i];
      line.opacity -= 0.05;

      if (line.opacity <= 0) {
        constraintLines.splice(i, 1);
      }
      needsRedraw = true;
    }

    if (needsRedraw) {
      draw();
      requestAnimationFrame(animateConstraintLines);
    }
  }

  // Draw the spline curve and control points
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

    // Draw control polygon (hull) - thin grey lines connecting control points
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Start from (0, 0)
    ctx.moveTo(xScale(0), yScale(0));

    // Draw lines through all control points
    for (const p of controlPoints) {
      ctx.lineTo(xScale(p.x), yScale(p.y));
    }

    // End at (1, 1)
    ctx.lineTo(xScale(1), yScale(1));
    ctx.stroke();

    // Draw the B-spline curve using drawFunction1D
    try {
      drawFunction1D(ctx, xScale, yScale, (x: number) => cachedTransformation.f(x), {
        stroke: '#555',
        lineWidth: 2,
        sampleCount: 100
      });
    } catch (e) {
      console.warn('B-spline failed:', e);
    }

    ctx.restore();

    // Draw constraint lines (dashed, fading)
    if (constraintLines.length > 0) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;

      for (const line of constraintLines) {
        ctx.strokeStyle = `rgba(204, 204, 204, ${line.opacity})`;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Draw control points (note: curve doesn't pass through these with B-splines)
    for (let i = 0; i < controlPoints.length; i++) {
      const p = controlPoints[i];
      const cx = xScale(p.x);
      const cy = yScale(p.y);

      const color = selectedPointIndex === i ? '#4CAF50' : '#2196F3';
      addDot(ctx, cx, cy, POINT_RADIUS, color);

      // Add white border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, POINT_RADIUS, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  // Find which point is at the given canvas coordinates
  function findPointAt(cx: number, cy: number): number | null {
    for (let i = 0; i < controlPoints.length; i++) {
      const p = controlPoints[i];
      const px = xScale(p.x);
      const py = yScale(p.y);

      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      if (dist <= POINT_RADIUS + 5) {
        return i;
      }
    }
    return null;
  }

  // Mouse event handlers
  function handleMouseDown(e: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    selectedPointIndex = findPointAt(cx, cy);
    if (selectedPointIndex !== null) {
      isDragging = true;
      draw();
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isDragging || selectedPointIndex === null) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    let x = xScale.inverse(cx);
    let y = yScale.inverse(cy);

    // Get neighbor positions
    const prevPoint =
      selectedPointIndex > 0 ? controlPoints[selectedPointIndex - 1] : null;
    const nextPoint =
      selectedPointIndex < controlPoints.length - 1
        ? controlPoints[selectedPointIndex + 1]
        : null;

    const MARGIN = 0.02;
    let constraintViolated = false;

    // Ensure monotonicity in X: x must stay between neighbors
    if (prevPoint && x < prevPoint.x + MARGIN) {
      x = prevPoint.x + MARGIN;
      if (constraintLines.length === 0) {
        displayTemporaryVerticalLine(xScale(prevPoint.x));
        requestAnimationFrame(animateConstraintLines);
      }
      constraintViolated = true;
    }
    if (nextPoint && x > nextPoint.x - MARGIN) {
      x = nextPoint.x - MARGIN;
      if (constraintLines.length === 0) {
        displayTemporaryVerticalLine(xScale(nextPoint.x));
        requestAnimationFrame(animateConstraintLines);
      }
      constraintViolated = true;
    }

    // Ensure monotonicity in Y: y must stay between neighbors
    if (prevPoint && y < prevPoint.y + MARGIN) {
      y = prevPoint.y + MARGIN;
      if (constraintLines.length === 0) {
        displayTemporaryHorizontalLine(yScale(prevPoint.y));
        requestAnimationFrame(animateConstraintLines);
      }
      constraintViolated = true;
    }
    if (nextPoint && y > nextPoint.y - MARGIN) {
      y = nextPoint.y - MARGIN;
      if (constraintLines.length === 0) {
        displayTemporaryHorizontalLine(yScale(nextPoint.y));
        requestAnimationFrame(animateConstraintLines);
      }
      constraintViolated = true;
    }

    // Clamp to domain
    x = Math.max(xDomain[0], Math.min(xDomain[1], x));
    y = Math.max(yDomain[0], Math.min(yDomain[1], y));

    controlPoints[selectedPointIndex] = { x, y };
    updateTransformation();
    draw();
    if (!constraintViolated) {
      onChange();
    }
  }

  function handleMouseUp(): void {
    if (isDragging) {
      isDragging = false;
      selectedPointIndex = null;
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

  // Return the transformation that uses the cached transformation
  return {
    f: (x: number): number => cachedTransformation.f(x),
    df: (x: number): number => cachedTransformation.df(x),
    fInv: (y: number): number => cachedTransformation.fInv(y),
    dfInv: (y: number): number => cachedTransformation.dfInv(y)
  };
}
