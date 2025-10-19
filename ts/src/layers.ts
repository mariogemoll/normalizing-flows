import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { createSlider, type SliderElements } from './slider';
import { createBSplineTransformation } from './spline';
import { createSplineEditor, type SplineEditor } from './spline-editor';
import {
  composeTransformations,
  createLinearTransformation,
  createSigmoidTransformation
} from './transformation';
import { addFrameUsingScales, getContext } from './web-ui-common/canvas';
import { removePlaceholder } from './web-ui-common/dom';
import { makeScale } from './web-ui-common/util';

const X_DOMAIN: [number, number] = [-10, 10];
const X_DOMAIN_LOGISTIC: [number, number] = [0, 1];
const Y_DOMAIN: [number, number] = [0, 0.5];
const Y_DOMAIN_LOGISTIC: [number, number] = [0, 3];
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 160;
const MARGIN = 25;

export function initWidget(container: HTMLDivElement): void {
  removePlaceholder(container);

  // Create grid container for 3 rows × 4 columns (linear + sigmoid + B-spline)
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(4, 160px)';
  gridContainer.style.gridTemplateRows = '80px 160px 160px';
  gridContainer.style.gap = '0';

  // Create 12 empty cells (3 rows × 4 columns), store in 2D array
  const cells: HTMLDivElement[][] = [];
  for (let row = 0; row < 3; row++) {
    cells[row] = [];
    for (let col = 0; col < 4; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cells[row][col] = cell;
      gridContainer.appendChild(cell);
    }
  }

  container.appendChild(gridContainer);

  // Create fixed scales
  const xScale = makeScale(X_DOMAIN, [MARGIN, CANVAS_WIDTH - MARGIN]);
  const yScale = makeScale(Y_DOMAIN, [CANVAS_HEIGHT - MARGIN, MARGIN]);
  const transformYScale = makeScale(X_DOMAIN, [CANVAS_HEIGHT - MARGIN, MARGIN]);
  const transformYScaleLogistic = makeScale(X_DOMAIN_LOGISTIC, [CANVAS_HEIGHT - MARGIN, MARGIN]);

  // Special scales for logistic transformation output
  const xScaleLogistic = makeScale(X_DOMAIN_LOGISTIC, [MARGIN, CANVAS_WIDTH - MARGIN]);
  const yScaleLogistic = makeScale(Y_DOMAIN_LOGISTIC, [CANVAS_HEIGHT - MARGIN, MARGIN]);

  // Add standard Gaussian to cell [2, 0]
  const canvas0 = document.createElement('canvas');
  canvas0.width = CANVAS_WIDTH;
  canvas0.height = CANVAS_HEIGHT;
  cells[2][0].appendChild(canvas0);

  const ctx0 = getContext(canvas0);
  addFrameUsingScales(ctx0, xScale, yScale, 5);
  drawDistribution(ctx0, normalPdf, xScale, yScale);

  // Create 3 transformations (linear + sigmoid + B-spline)
  const NUM_TRANSFORMS = 3;
  interface SliderPair {
    scale: SliderElements;
    shift: SliderElements;
  }
  const sliders: SliderPair[] = [];
  const transformCanvases: HTMLCanvasElement[] = [];
  const transformContexts: CanvasRenderingContext2D[] = [];
  const distCanvases: HTMLCanvasElement[] = [];
  const distContexts: CanvasRenderingContext2D[] = [];
  let bsplineEditor: SplineEditor | null = null;

  // Create wrapper for update function so spline callback can reference it
  const updateWrapper = (): void => {
    update();
  };

  for (let i = 0; i < NUM_TRANSFORMS; i++) {
    if (i === 1) {
      // Sigmoid transformation: k (steepness) and x0 (center)
      const kControl = createSlider('k', 0.1, 10.0, 5.0, 0.1);
      const x0Control = createSlider('x₀', -5.0, 5.0, 0.0, 0.1);

      cells[0][i + 1].appendChild(kControl.container);
      cells[0][i + 1].appendChild(x0Control.container);
      sliders.push({ scale: kControl, shift: x0Control });

      // Add canvas for transformation visualization to cell [1, i+1]
      const transformCanvas = document.createElement('canvas');
      transformCanvas.width = CANVAS_WIDTH;
      transformCanvas.height = CANVAS_HEIGHT;
      cells[1][i + 1].appendChild(transformCanvas);
      transformCanvases.push(transformCanvas);
      transformContexts.push(getContext(transformCanvas));
    } else if (i === 2) {
      // B-spline: interactive editor (control points guide the curve)
      const initialPoints = [
        { x: 0.25, y: 0.25 },
        { x: 0.50, y: 0.50 },
        { x: 0.75, y: 0.75 }
      ];

      bsplineEditor = createSplineEditor(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        initialPoints,
        updateWrapper
      );

      cells[1][i + 1].appendChild(bsplineEditor.element);

      // No sliders for spline - push empty placeholders
      const dummySlider = createSlider('', 0, 1, 0, 1);
      sliders.push({ scale: dummySlider, shift: dummySlider });
      const dummyCanvas = document.createElement('canvas');
      transformCanvases.push(dummyCanvas);
      // Spline editor draws itself, so use a dummy context
      transformContexts.push(getContext(dummyCanvas));
    } else {
      // Linear transformation: s (scale) and t (shift)
      const scaleControl = createSlider('s', -0.5, 2.5, 1.0, 0.03);
      const shiftControl = createSlider('t', -1.5, 1.5, 0.0, 0.03);

      cells[0][i + 1].appendChild(scaleControl.container);
      cells[0][i + 1].appendChild(shiftControl.container);
      sliders.push({ scale: scaleControl, shift: shiftControl });

      // Add canvas for transformation visualization to cell [1, i+1]
      const transformCanvas = document.createElement('canvas');
      transformCanvas.width = CANVAS_WIDTH;
      transformCanvas.height = CANVAS_HEIGHT;
      cells[1][i + 1].appendChild(transformCanvas);
      transformCanvases.push(transformCanvas);
      transformContexts.push(getContext(transformCanvas));
    }

    // Add canvas for transformed distribution to cell [2, i+1]
    const distCanvas = document.createElement('canvas');
    distCanvas.width = CANVAS_WIDTH;
    distCanvas.height = CANVAS_HEIGHT;
    cells[2][i + 1].appendChild(distCanvas);
    distCanvases.push(distCanvas);
    distContexts.push(getContext(distCanvas));
  }

  // Update function
  function update(): void {
    for (let i = 0; i < NUM_TRANSFORMS; i++) {
      // Skip transformation visualization for B-spline (it draws itself)
      if (i !== 2) {
        const scaleControl = sliders[i].scale;
        const shiftControl = sliders[i].shift;

        const params = {
          scale: Number(scaleControl.slider.value),
          shift: Number(shiftControl.slider.value)
        };

        scaleControl.valueDisplay.textContent = params.scale.toFixed(2);
        shiftControl.valueDisplay.textContent = params.shift.toFixed(2);

        // Draw transformation visualization in row 1
        transformContexts[i].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        let transform;
        let numPoints;
        let useLogisticScale = false;

        if (i === 1) {
          // Sigmoid transformation
          const k = params.scale; // steepness
          const x0 = params.shift; // center
          transform = createSigmoidTransformation(k, x0);
          numPoints = 100;
          useLogisticScale = true;
        } else {
          // Linear transformation
          transform = createLinearTransformation(params.scale, params.shift);
          numPoints = 2;
        }

        // Draw transformation curve
        transformContexts[i].strokeStyle = '#555';
        transformContexts[i].lineWidth = 2;
        transformContexts[i].beginPath();

        const currentTransformYScale = useLogisticScale ? transformYScaleLogistic : transformYScale;

        for (let p = 0; p < numPoints; p++) {
          const t = p / (numPoints - 1);
          const x = X_DOMAIN[0] + t * (X_DOMAIN[1] - X_DOMAIN[0]);
          const y = transform.f(x);
          if (p === 0) {
            transformContexts[i].moveTo(xScale(x), currentTransformYScale(y));
          } else {
            transformContexts[i].lineTo(xScale(x), currentTransformYScale(y));
          }
        }
        transformContexts[i].stroke();
      }

      // Clear distribution canvas
      distContexts[i].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Use logistic scales for spline and sigmoid outputs
      const currentXScale = (i === 1 || i === 2) ? xScaleLogistic : xScale;
      const currentYScale = (i === 1 || i === 2) ? yScaleLogistic : yScale;

      // Add axes (using appropriate scales)
      addFrameUsingScales(distContexts[i], currentXScale, currentYScale, 5);

      // Compose transformations up to i
      const transforms = [];
      for (let j = 0; j <= i; j++) {
        if (j === 1) {
          // Sigmoid transformation
          const k = Number(sliders[j].scale.slider.value);
          const x0 = Number(sliders[j].shift.slider.value);
          transforms.push(createSigmoidTransformation(k, x0));
        } else if (j === 2) {
          // B-spline transformation
          if (bsplineEditor) {
            const controlPoints = bsplineEditor.getControlPoints();
            transforms.push(
              createBSplineTransformation(
                controlPoints.map(p => p.x),
                controlPoints.map(p => p.y)
              )
            );
          }
        } else {
          // Linear transformation
          const s = Number(sliders[j].scale.slider.value);
          const t = Number(sliders[j].shift.slider.value);
          transforms.push(createLinearTransformation(s, t));
        }
      }
      const composed = composeTransformations(transforms);

      // Compute transformed PDF using the change of variables formula
      const composedPdf = (y: number): number => {
        const x = composed.fInv(y);
        const dfInvVal = composed.dfInv(y);
        const pdfVal = normalPdf(x) * Math.abs(dfInvVal);

        // Log extremely large values
        if (pdfVal > 100 || Math.abs(dfInvVal) > 100) {
          console.warn(
            `[PDF] Large value detected: y=${y}, x=${x}, dfInv=${dfInvVal}, pdf=${pdfVal}`
          );
        }

        return pdfVal;
      };

      // Draw transformed distribution
      drawDistribution(distContexts[i], composedPdf, currentXScale, currentYScale);
    }
  }

  // Add event listeners to all sliders (except B-spline which has its own callback)
  for (let i = 0; i < NUM_TRANSFORMS; i++) {
    if (i !== 2) {
      sliders[i].scale.slider.addEventListener('input', update);
      sliders[i].shift.slider.addEventListener('input', update);
    }
  }

  // Initial draw
  update();
}
