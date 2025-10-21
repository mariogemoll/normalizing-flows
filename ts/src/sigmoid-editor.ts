import { createSigmoidTransformation, type Transformation } from './transformation';
import { getContext } from './web-ui-common/canvas';

export interface SigmoidParams {
  k: number;    // steepness
  x0: number;   // center
}

export interface SigmoidEditor {
  element: HTMLElement;
  getTransformation: () => Transformation;
  getParams: () => SigmoidParams;
}

/**
 * Creates an interactive sigmoid editor on a canvas.
 * Two control points:
 * 1. Center point at (x0, 0.5) - moves horizontally to control x0
 * 2. Steepness point on the curve - moves to control k
 */
export function createSigmoidEditor(
  width: number,
  height: number,
  initialK: number,
  initialX0: number,
  xDomain: [number, number], // Input domain for sigmoid
  yDomain: [number, number], // Output domain (typically [0, 1])
  onChange: () => void
): SigmoidEditor {
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

  // Steepness control points: distance from center on both sides
  const STEEPNESS_DISTANCE = 1;

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
  function fromCanvasX(cx: number): number {
    const t = (cx - MARGIN) / (width - 2 * MARGIN);
    return xDomain[0] + t * (xDomain[1] - xDomain[0]);
  }

  function fromCanvasY(cy: number): number {
    const t = (height - MARGIN - cy) / (height - 2 * MARGIN);
    return yDomain[0] + t * (yDomain[1] - yDomain[0]);
  }

  // Compute y value on sigmoid curve for given x
  function sigmoidY(x: number): number {
    return 1 / (1 + Math.exp(-k * (x - x0)));
  }

  // Compute k from a point (x, y) on the curve, given x0
  function computeK(x: number, y: number): number {
    // y = 1 / (1 + e^(-k(x-x0)))
    // k = ln(y/(1-y)) / (x-x0)
    const dx = x - x0;
    if (Math.abs(dx) < 0.01) {
      return k; // Too close to center, keep current k
    }

    // Clamp y to avoid log(0) or division by zero
    const yClipped = Math.max(0.01, Math.min(0.99, y));
    const computedK = Math.log(yClipped / (1 - yClipped)) / dx;

    // Clamp k to reasonable range
    return Math.max(0.1, Math.min(10.0, computedK));
  }

  function draw(): void {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw the sigmoid curve
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const numPoints = 100;
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = xDomain[0] + t * (xDomain[1] - xDomain[0]);
      const y = sigmoidY(x);

      const cx = toCanvasX(x);
      const cy = toCanvasY(y);

      if (i === 0) {
        ctx.moveTo(cx, cy);
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();

    // Draw center point at (x0, 0.5)
    const centerCx = toCanvasX(x0);
    const centerCy = toCanvasY(0.5);

    ctx.fillStyle = selectedPoint === 'center' ? '#4CAF50' : '#2196F3';
    ctx.beginPath();
    ctx.arc(centerCx, centerCy, POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw left steepness control point
    const steepnessLeftX = x0 - STEEPNESS_DISTANCE;
    const steepnessLeftY = sigmoidY(steepnessLeftX);
    const steepnessLeftCx = toCanvasX(steepnessLeftX);
    const steepnessLeftCy = toCanvasY(steepnessLeftY);

    ctx.fillStyle = selectedPoint === 'steepness-left' ? '#4CAF50' : '#FF9800';
    ctx.beginPath();
    ctx.arc(steepnessLeftCx, steepnessLeftCy, POINT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw right steepness control point
    const steepnessRightX = x0 + STEEPNESS_DISTANCE;
    const steepnessRightY = sigmoidY(steepnessRightX);
    const steepnessRightCx = toCanvasX(steepnessRightX);
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
    const centerCx = toCanvasX(x0);
    const centerCy = toCanvasY(0.5);
    const centerDist = Math.sqrt((cx - centerCx) ** 2 + (cy - centerCy) ** 2);
    if (centerDist <= POINT_RADIUS + 5) {
      return 'center';
    }

    // Check left steepness point
    const steepnessLeftX = x0 - STEEPNESS_DISTANCE;
    const steepnessLeftY = sigmoidY(steepnessLeftX);
    const steepnessLeftCx = toCanvasX(steepnessLeftX);
    const steepnessLeftCy = toCanvasY(steepnessLeftY);
    const steepnessLeftDist = Math.sqrt((cx - steepnessLeftCx) ** 2 + (cy - steepnessLeftCy) ** 2);
    if (steepnessLeftDist <= POINT_RADIUS + 5) {
      return 'steepness-left';
    }

    // Check right steepness point
    const steepnessRightX = x0 + STEEPNESS_DISTANCE;
    const steepnessRightY = sigmoidY(steepnessRightX);
    const steepnessRightCx = toCanvasX(steepnessRightX);
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
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    const x = fromCanvasX(cx);
    const y = fromCanvasY(cy);

    if (selectedPoint === 'center') {
      // Only allow horizontal movement for center point
      // Clamp to domain
      x0 = Math.max(xDomain[0], Math.min(xDomain[1], x));

      // Update k based on current right steepness point position (which moves with center)
      const steepnessX = x0 + STEEPNESS_DISTANCE;
      const steepnessY = sigmoidY(steepnessX);
      k = computeK(steepnessX, steepnessY);
    } else if (selectedPoint === 'steepness-left') {
      // Only allow vertical movement for left steepness point
      const steepnessX = x0 - STEEPNESS_DISTANCE;

      // Clamp y to valid range
      const yClipped = Math.max(0.01, Math.min(0.99, y));

      // Update k to make curve pass through this point
      k = computeK(steepnessX, yClipped);
    } else {
      // Only allow vertical movement for right steepness point
      const steepnessX = x0 + STEEPNESS_DISTANCE;

      // Clamp y to valid range
      const yClipped = Math.max(0.01, Math.min(0.99, y));

      // Update k to make curve pass through this point
      k = computeK(steepnessX, yClipped);
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
      return createSigmoidTransformation(k, x0);
    },
    getParams: (): SigmoidParams => ({ k, x0 })
  };
}
