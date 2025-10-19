import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { createSlider, type SliderElements } from './slider';
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

  // Create grid container for 3 rows × 3 columns
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(3, 160px)';
  gridContainer.style.gridTemplateRows = '80px 160px 160px';
  gridContainer.style.gap = '0';

  // Create 9 empty cells (3 rows × 3 columns), store in 2D array
  const cells: HTMLDivElement[][] = [];
  for (let row = 0; row < 3; row++) {
    cells[row] = [];
    for (let col = 0; col < 3; col++) {
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

  // Create 2 transformations
  const NUM_TRANSFORMS = 2;
  interface SliderPair {
    scale: SliderElements;
    shift: SliderElements;
  }
  const sliders: SliderPair[] = [];
  const transformCanvases: HTMLCanvasElement[] = [];
  const transformContexts: CanvasRenderingContext2D[] = [];
  const distCanvases: HTMLCanvasElement[] = [];
  const distContexts: CanvasRenderingContext2D[] = [];

  for (let i = 0; i < NUM_TRANSFORMS; i++) {
    // Add sliders to cell [0, i+1]
    let scaleControl: SliderElements;
    let shiftControl: SliderElements;

    if (i === 1) {
      // Sigmoid transformation: k (steepness) and x0 (shift)
      scaleControl = createSlider('k', 0.1, 3.0, 1.0, 0.1);
      shiftControl = createSlider('x0', -5.0, 5.0, 0.0, 0.1);
    } else {
      // Linear transformation: s (scale) and t (shift)
      scaleControl = createSlider('s', -0.5, 2.5, 1.0, 0.03);
      shiftControl = createSlider('t', -1.5, 1.5, 0.0, 0.03);
    }

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

      // Create transformation based on index
      const transform = i === 1
        ? createSigmoidTransformation(params.scale, params.shift)
        : createLinearTransformation(params.scale, params.shift);

      // Use appropriate Y scale for transformation visualization
      const currentTransformYScale = i === 1 ? transformYScaleLogistic : transformYScale;

      // Draw transformation curve
      transformContexts[i].strokeStyle = '#555';
      transformContexts[i].lineWidth = 2;
      transformContexts[i].beginPath();

      // For non-linear transformations, draw a curve with multiple segments
      const numPoints = i === 1 ? 100 : 2;
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

      // Clear distribution canvas
      distContexts[i].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Use appropriate scales for this column
      const currentXScale = i === 1 ? xScaleLogistic : xScale;
      const currentYScale = i === 1 ? yScaleLogistic : yScale;

      // Add axes (using appropriate scales)
      addFrameUsingScales(distContexts[i], currentXScale, currentYScale, 5);

      // Compose transformations up to i
      const transforms = [];
      for (let j = 0; j <= i; j++) {
        const s = Number(sliders[j].scale.slider.value);
        const t = Number(sliders[j].shift.slider.value);

        if (j === 1) {
          // For sigmoid: s is k (steepness), t is x0 (shift)
          transforms.push(createSigmoidTransformation(s, t));
        } else {
          // For linear: s is scale, t is shift
          transforms.push(createLinearTransformation(s, t));
        }
      }
      const composed = composeTransformations(transforms);

      // Compute transformed PDF using the change of variables formula
      const composedPdf = (y: number): number => {
        const x = composed.fInv(y);
        return normalPdf(x) * Math.abs(composed.dfInv(y));
      };

      // Draw transformed distribution
      drawDistribution(distContexts[i], composedPdf, currentXScale, currentYScale);
    }
  }

  // Add event listeners to all sliders
  for (let i = 0; i < NUM_TRANSFORMS; i++) {
    sliders[i].scale.slider.addEventListener('input', update);
    sliders[i].shift.slider.addEventListener('input', update);
  }

  // Initial draw
  update();
}
