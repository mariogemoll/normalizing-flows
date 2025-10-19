import { createBSplineTransformation } from './spline';
import type { Transformation } from './transformation';
import { getContext } from './web-ui-common/canvas';

export interface ControlPoint {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

export interface SplineEditor {
  element: HTMLElement;
  getTransformation: () => Transformation;
  getControlPoints: () => ControlPoint[];
}

/**
 * Creates an interactive spline editor on a canvas
 */
export function createSplineEditor(
  width: number,
  height: number,
  initialPoints: ControlPoint[],
  onChange: () => void
): SplineEditor {
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

  const controlPoints: ControlPoint[] = initialPoints.map(p => ({ ...p }));
  let selectedPointIndex: number | null = null;
  let isDragging = false;

  const POINT_RADIUS = 5;
  const activeTempLines: SVGLineElement[] = [];

  // Create SVG overlay for temporary dashed lines
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

  // Convert normalized coordinates to canvas coordinates
  function toCanvasX(x: number): number {
    return x * width;
  }

  function toCanvasY(y: number): number {
    return height - y * height; // Flip Y axis
  }

  // Convert canvas coordinates to normalized coordinates
  function fromCanvasX(cx: number): number {
    return cx / width;
  }

  function fromCanvasY(cy: number): number {
    return (height - cy) / height; // Flip Y axis
  }

  // Display temporary dashed line that fades out
  async function fadeOut(line: SVGLineElement): Promise<void> {
    for (let opacity = 0.9; opacity > 0.1; opacity -= 0.1) {
      line.setAttribute('stroke-opacity', opacity.toString());
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    svg.removeChild(line);
    const index = activeTempLines.indexOf(line);
    if (index > -1) {
      activeTempLines.splice(index, 1);
    }
  }

  function displayTemporaryLine(x1: number, y1: number, x2: number, y2: number): void {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toString());
    line.setAttribute('y1', y1.toString());
    line.setAttribute('x2', x2.toString());
    line.setAttribute('y2', y2.toString());
    line.setAttribute('stroke', '#ccc');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5, 5');
    svg.appendChild(line);
    activeTempLines.push(line);
    void fadeOut(line);
  }

  function displayTemporaryVerticalLine(x: number): void {
    displayTemporaryLine(x, 0, x, height);
  }

  function displayTemporaryHorizontalLine(y: number): void {
    displayTemporaryLine(0, y, width, y);
  }

  function draw(): void {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw control polygon (hull) - thin grey lines connecting control points
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Start from (0, 0)
    ctx.moveTo(toCanvasX(0), toCanvasY(0));

    // Draw lines through all control points
    for (const p of controlPoints) {
      ctx.lineTo(toCanvasX(p.x), toCanvasY(p.y));
    }

    // End at (1, 1)
    ctx.lineTo(toCanvasX(1), toCanvasY(1));
    ctx.stroke();

    // Draw the B-spline curve
    try {
      const transformation = createBSplineTransformation(
        controlPoints.map(p => p.x),
        controlPoints.map(p => p.y)
      );

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const numPoints = 100;
      for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const x = t;
        const y = transformation.f(x);

        const cx = toCanvasX(x);
        const cy = toCanvasY(y);

        if (i === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
    } catch (e) {
      // If spline fails, just draw straight line
      console.warn('B-spline failed:', e);
    }

    // Draw control points (note: curve doesn't pass through these with B-splines)
    for (let i = 0; i < controlPoints.length; i++) {
      const p = controlPoints[i];
      const cx = toCanvasX(p.x);
      const cy = toCanvasY(p.y);

      ctx.fillStyle = selectedPointIndex === i ? '#4CAF50' : '#2196F3';
      ctx.beginPath();
      ctx.arc(cx, cy, POINT_RADIUS, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function findPointAt(cx: number, cy: number): number | null {
    for (let i = 0; i < controlPoints.length; i++) {
      const p = controlPoints[i];
      const px = toCanvasX(p.x);
      const py = toCanvasY(p.y);

      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      if (dist <= POINT_RADIUS + 5) {
        return i;
      }
    }
    return null;
  }

  function handleMouseDown(event: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    const pointIndex = findPointAt(cx, cy);
    if (pointIndex !== null) {
      selectedPointIndex = pointIndex;
      isDragging = true;
      draw();
    }
  }

  function handleMouseMove(event: MouseEvent): void {
    if (!isDragging || selectedPointIndex === null) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    let cx = event.clientX - rect.left;
    let cy = event.clientY - rect.top;

    let constraintViolated = false;

    // Get neighbor positions in canvas coordinates
    const prevPoint = selectedPointIndex > 0 ? controlPoints[selectedPointIndex - 1] : null;
    const nextPoint = selectedPointIndex < controlPoints.length - 1
      ? controlPoints[selectedPointIndex + 1]
      : null;

    const prevCx = prevPoint ? toCanvasX(prevPoint.x) : 0;
    const prevCy = prevPoint ? toCanvasY(prevPoint.y) : height;
    const nextCx = nextPoint ? toCanvasX(nextPoint.x) : width;
    const nextCy = nextPoint ? toCanvasY(nextPoint.y) : 0;

    const MARGIN = 3;

    // Ensure monotonicity in X: x must stay between neighbors
    if (cx < prevCx + MARGIN) {
      cx = prevCx + MARGIN;
      displayTemporaryVerticalLine(prevCx);
      constraintViolated = true;
    }
    if (cx > nextCx - MARGIN) {
      cx = nextCx - MARGIN;
      displayTemporaryVerticalLine(nextCx);
      constraintViolated = true;
    }

    // Ensure monotonicity in Y: y must stay between neighbors
    // Remember: canvas Y increases downward, so prevCy should be >= cy >= nextCy
    if (cy > prevCy - MARGIN) {
      cy = prevCy - MARGIN;
      displayTemporaryHorizontalLine(prevCy);
      constraintViolated = true;
    }
    if (cy < nextCy + MARGIN) {
      cy = nextCy + MARGIN;
      displayTemporaryHorizontalLine(nextCy);
      constraintViolated = true;
    }

    // Convert to normalized coordinates
    const x = fromCanvasX(cx);
    const y = fromCanvasY(cy);

    controlPoints[selectedPointIndex] = { x, y };
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
      return createBSplineTransformation(
        controlPoints.map(p => p.x),
        controlPoints.map(p => p.y)
      );
    },
    getControlPoints: (): ControlPoint[] => controlPoints.map(p => ({ ...p }))
  };
}
