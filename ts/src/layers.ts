import { drawDistribution } from './distribution-drawing';
import { createCorrectPdf, normalPdf } from './linear-transform';
import { createSlider } from './slider';
import { getContext } from './web-ui-common/canvas';
import { removePlaceholder } from './web-ui-common/dom';
import { makeScale } from './web-ui-common/util';

const X_DOMAIN: [number, number] = [-3, 3];
const Y_DOMAIN: [number, number] = [0, 0.5];
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 160;
const MARGIN = 10;

export function initWidget(container: HTMLDivElement): void {
  removePlaceholder(container);

  // Create grid container for 3 rows × 7 columns
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(7, 160px)';
  gridContainer.style.gridTemplateRows = '80px 160px 160px';
  gridContainer.style.gap = '0';

  // Create 21 empty cells (3 rows × 7 columns), store in 2D array
  const cells: HTMLDivElement[][] = [];
  for (let row = 0; row < 3; row++) {
    cells[row] = [];
    for (let col = 0; col < 7; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.style.border = '1px solid #ddd';
      cells[row][col] = cell;
      gridContainer.appendChild(cell);
    }
  }

  container.appendChild(gridContainer);

  // Create scales
  const xScale = makeScale(X_DOMAIN, [MARGIN, CANVAS_WIDTH - MARGIN]);
  const yScale = makeScale(Y_DOMAIN, [CANVAS_HEIGHT - MARGIN, MARGIN]);

  // Add standard Gaussian to cell [1, 0]
  const canvas0 = document.createElement('canvas');
  canvas0.width = CANVAS_WIDTH;
  canvas0.height = CANVAS_HEIGHT;
  cells[1][0].appendChild(canvas0);

  const ctx0 = getContext(canvas0);
  drawDistribution(ctx0, normalPdf, xScale, yScale);

  // Add sliders to cell [0, 1]
  const scaleControl = createSlider('s', -0.5, 2.5, 1.0, 0.03);
  const shiftControl = createSlider('t', -1.5, 1.5, 0.0, 0.03);
  cells[0][1].appendChild(scaleControl.container);
  cells[0][1].appendChild(shiftControl.container);

  // Add canvas for transformed distribution to cell [1, 1]
  const canvas1 = document.createElement('canvas');
  canvas1.width = CANVAS_WIDTH;
  canvas1.height = CANVAS_HEIGHT;
  cells[1][1].appendChild(canvas1);

  const ctx1 = getContext(canvas1);

  // Update function
  function update(): void {
    const params = {
      scale: Number(scaleControl.slider.value),
      shift: Number(shiftControl.slider.value)
    };

    scaleControl.valueDisplay.textContent = params.scale.toFixed(2);
    shiftControl.valueDisplay.textContent = params.shift.toFixed(2);

    // Clear canvas
    ctx1.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw transformed distribution
    drawDistribution(ctx1, createCorrectPdf(params), xScale, yScale);
  }

  // Add event listeners
  scaleControl.slider.addEventListener('input', update);
  shiftControl.slider.addEventListener('input', update);

  // Initial draw
  update();
}
