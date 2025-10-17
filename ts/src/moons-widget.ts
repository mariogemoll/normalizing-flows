import { makeMoons } from './moons-dataset';
import type { TrainDataState } from './page-state';
import type { Tensor2D } from './tf-types';
import { addFrameUsingScales, drawScatter, getContext } from './web-ui-common/canvas';
import type { Pair } from './web-ui-common/types';
import { makeScale } from './web-ui-common/util';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;
const MARGIN = 40;

/**
 * Get data bounds for scaling
 */
function getDataBounds(
  data: Tensor2D
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const min = data.min(0).arraySync() as number[];
  const max = data.max(0).arraySync() as number[];

  return {
    xMin: min[0],
    xMax: max[0],
    yMin: min[1],
    yMax: max[1]
  };
}

export function removePlaceholder(box: HTMLDivElement): void {
  const placeholder = box.querySelector('.placeholder');
  if (placeholder !== null) {
    placeholder.remove();
  }
}

export function initWidget(container: HTMLDivElement, state: TrainDataState): void {
  removePlaceholder(container);

  // Create control panel
  const controlPanel = document.createElement('div');
  controlPanel.className = 'control-panel';

  // Sample size input
  const sampleLabel = document.createElement('label');
  sampleLabel.textContent = 'Samples: ';
  const sampleInput = document.createElement('input');
  sampleInput.type = 'number';
  sampleInput.value = '1000';
  sampleInput.min = '100';
  sampleInput.max = '10000';
  sampleInput.step = '100';
  sampleLabel.appendChild(sampleInput);
  controlPanel.appendChild(sampleLabel);

  // Generate button
  const generateButton = document.createElement('button');
  generateButton.textContent = 'Generate';
  generateButton.style.marginLeft = '15px';
  controlPanel.appendChild(generateButton);

  container.appendChild(controlPanel);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.border = '1px solid #ccc';
  canvas.style.marginTop = '10px';
  container.appendChild(canvas);

  const ctx = getContext(canvas);

  // Current data tensor
  let currentData: Tensor2D | null = null;

  function updateVisualization(): void {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (currentData === null) {
      return;
    }

    // Get data bounds
    const bounds = getDataBounds(currentData);

    // Add some padding to the bounds
    const xPadding = (bounds.xMax - bounds.xMin) * 0.1;
    const yPadding = (bounds.yMax - bounds.yMin) * 0.1;

    // Create scales
    const xScale = makeScale(
      [bounds.xMin - xPadding, bounds.xMax + xPadding],
      [MARGIN, CANVAS_WIDTH - MARGIN]
    );
    const yScale = makeScale(
      [bounds.yMin - yPadding, bounds.yMax + yPadding],
      [CANVAS_HEIGHT - MARGIN, MARGIN]
    );

    // Draw frame with axes
    addFrameUsingScales(ctx, xScale, yScale, 5);

    // Convert tensor data to coords array
    const dataArray = currentData.arraySync();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const coords: Pair<number>[] = (dataArray as number[][]).map(([x, y]) => [x, y]);
    const colors = new Array<string>(coords.length).fill('#4169E1');

    // Draw scatter plot
    drawScatter(ctx, xScale, yScale, coords, colors);
  }

  function generateData(): void {
    // Clean up previous data
    if (currentData !== null) {
      currentData.dispose();
    }
    if (state.trainData !== null) {
      state.trainData.dispose();
    }

    const nSamples = parseInt(sampleInput.value);
    currentData = makeMoons(nSamples, 0.05);

    // Update global state
    state.trainData = currentData;

    updateVisualization();
  }

  // Event listeners
  generateButton.addEventListener('click', generateData);

  // Generate initial data
  generateData();
}
