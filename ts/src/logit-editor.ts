import { createLogitTransformation, type Transformation } from './transformation';
import { getContext } from './web-ui-common/canvas';

export interface LogitParams {
  k: number;    // steepness
  x0: number;   // center
}

export interface LogitEditor {
  element: HTMLElement;
  getTransformation: () => Transformation;
  getParams: () => LogitParams;
}

/**
 * Creates an interactive logit editor on a canvas.
 * Two control points:
 * 1. Center point at (0.5, x0) - moves vertically to control x0
 * 2. Steepness point on the curve - moves to control k
 */
export function createLogitEditor(
  width: number,
  height: number,
  initialK: number,
  initialX0: number,
  xDomain: [number, number], // Input domain for logit (typically [0, 1])
  yDomain: [number, number], // Output domain (typically R, like [-10, 10])
  onChange: () => void
): LogitEditor {
  // Create wrapper container for canvas and SVG overlay
  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cursor = 'pointer';
  canvas.style.display = 'block';

  const ctx = getContext(canvas);

  let k = initialK;
  let x0 = initialX0;

  // Steepness control points: fixed X positions on both sides of center
  const STEEPNESS_LEFT_X = 0.25;
  const STEEPNESS_RIGHT_X = 0.75;

  let selectedPoint: 'center' | 'steepness-left' | 'steepness-right' | null = null;
  let isDragging = false;

  const POINT_RADIUS = 5;

  // Create SVG overlay for temporary dashed lines (optional, for constraints)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.pointerEvents = 'none';

  // Append both to wrapper
  wrapper.appendChild(canvas);
  wrapper.appendChild(svg);

  const MARGIN = 25;

  // Convert domain coordinates to canvas coordinates
  function toCanvasX(x: number): number {
    const t = (x - xDomain[0]) / (xDomain[1] - xDomain[0]);
    return MARGIN + t * (width - 2 * MARGIN);
  }

  function toCanvasY(y: number): number {
    const t = (y - yDomain[0]) / (yDomain[1] - yDomain[0]);
    return height - MARGIN - t * (height - 2 * MARGIN);
  }

  // Convert canvas coordinates to domain coordinates
  function fromCanvasY(cy: number): number {
    const t = (height - MARGIN - cy) / (height - 2 * MARGIN);
    return yDomain[0] + t * (yDomain[1] - yDomain[0]);
  }

  // Compute y value on logit curve for given x
  // y = x0 + (1/k) * log(x / (1-x))
  function logitY(x: number): number {
    const xClipped = Math.max(0.01, Math.min(0.99, x));
    return x0 + (1 / k) * Math.log(xClipped / (1 - xClipped));
  }

  // Compute k from a point (x, y) on the curve, given x0
  function computeK(x: number, y: number): number {
    // y = x0 + (1/k) * log(x / (1-x))
    // k = log(x/(1-x)) / (y - x0)
    const dy = y - x0;
    if (Math.abs(dy) < 0.01) {
      return k; // Too close to center, keep current k
    }

    // Clamp x to avoid log(0)
    const xClipped = Math.max(0.01, Math.min(0.99, x));
    const computedK = Math.log(xClipped / (1 - xClipped)) / dy;

    // Clamp k to reasonable range
    return Math.max(0.1, Math.min(10.0, computedK));
  }

  function draw(): void {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw the logit curve
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const numPoints = 100;
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Sample more densely in the middle, avoid extremes
      const x = 0.01 + t * 0.98;
      const y = logitY(x);

      const cx = toCanvasX(x);
      const cy = toCanvasY(y);

      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();

    // Draw center point at (0.5, x0)
    const centerCx = toCanvasX(0.5);
    const centerCy = toCanvasY(x0);

    ctx.fillStyle = selectedPoint === 'center' ? '#4CAF50' : '#2196F3';
    ctx.beginPath();
    ctx.arc(centerCx, centerCy, POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw left steepness control point
    const steepnessLeftY = logitY(STEEPNESS_LEFT_X);
    const steepnessLeftCx = toCanvasX(STEEPNESS_LEFT_X);
    const steepnessLeftCy = toCanvasY(steepnessLeftY);

    ctx.fillStyle = selectedPoint === 'steepness-left' ? '#4CAF50' : '#FF9800';
    ctx.beginPath();
    ctx.arc(steepnessLeftCx, steepnessLeftCy, POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw right steepness control point
    const steepnessRightY = logitY(STEEPNESS_RIGHT_X);
    const steepnessRightCx = toCanvasX(STEEPNESS_RIGHT_X);
    const steepnessRightCy = toCanvasY(steepnessRightY);

    ctx.fillStyle = selectedPoint === 'steepness-right' ? '#4CAF50' : '#FF9800';
    ctx.beginPath();
    ctx.arc(steepnessRightCx, steepnessRightCy, POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function findPointAt(
    cx: number,
    cy: number
  ): 'center' | 'steepness-left' | 'steepness-right' | null {
    // Check center point
    const centerCx = toCanvasX(0.5);
    const centerCy = toCanvasY(x0);
    const centerDist = Math.sqrt((cx - centerCx) ** 2 + (cy - centerCy) ** 2);
    if (centerDist <= POINT_RADIUS + 5) {
      return 'center';
    }

    // Check left steepness point
    const steepnessLeftY = logitY(STEEPNESS_LEFT_X);
    const steepnessLeftCx = toCanvasX(STEEPNESS_LEFT_X);
    const steepnessLeftCy = toCanvasY(steepnessLeftY);
    const steepnessLeftDist = Math.sqrt((cx - steepnessLeftCx) ** 2 + (cy - steepnessLeftCy) ** 2);
    if (steepnessLeftDist <= POINT_RADIUS + 5) {
      return 'steepness-left';
    }

    // Check right steepness point
    const steepnessRightY = logitY(STEEPNESS_RIGHT_X);
    const steepnessRightCx = toCanvasX(STEEPNESS_RIGHT_X);
    const steepnessRightCy = toCanvasY(steepnessRightY);
    const steepnessRightDist = Math.sqrt(
      (cx - steepnessRightCx) ** 2 + (cy - steepnessRightCy) ** 2
    );
    if (steepnessRightDist <= POINT_RADIUS + 5) {
      return 'steepness-right';
    }

    return null;
  }

  function handleMouseDown(event: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    const point = findPointAt(cx, cy);
    if (point !== null) {
      selectedPoint = point;
      isDragging = true;
      draw();
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!isDragging || selectedPoint === null) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const cy = event.clientY - rect.top;

    const y = fromCanvasY(cy);

    if (selectedPoint === 'center') {
      // Only allow vertical movement for center point
      // Clamp to domain
      x0 = Math.max(yDomain[0], Math.min(yDomain[1], y));

      // Update k based on current right steepness point position
      const steepnessY = logitY(STEEPNESS_RIGHT_X);
      k = computeK(STEEPNESS_RIGHT_X, steepnessY);
    } else if (selectedPoint === 'steepness-left') {
      // Only allow vertical movement for left steepness point
      // Clamp y to output domain
      const yClipped = Math.max(yDomain[0], Math.min(yDomain[1], y));

      // Update k to make curve pass through this point
      k = computeK(STEEPNESS_LEFT_X, yClipped);
    } else {
      // Only allow vertical movement for right steepness point
      // Clamp y to output domain
      const yClipped = Math.max(yDomain[0], Math.min(yDomain[1], y));

      // Update k to make curve pass through this point
      k = computeK(STEEPNESS_RIGHT_X, yClipped);
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

  canvas.addEventListener('mousedown', (e): void => {
    handleMouseDown(e);
  });
  canvas.addEventListener('mousemove', (e): void => {
    handleMouseMove(e);
  });
  canvas.addEventListener('mouseup', (): void => {
    handleMouseUp();
  });
  canvas.addEventListener('mouseleave', (): void => {
    handleMouseUp();
  });

  // Initial draw
  draw();

  return {
    element: wrapper,
    getTransformation: (): Transformation => {
      return createLogitTransformation(k, x0);
    },
    getParams: (): LogitParams => ({ k, x0 })
  };
}
