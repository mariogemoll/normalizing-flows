import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { getContext } from './web-ui-common/canvas';
import { makeScale } from './web-ui-common/util';

const X_DOMAIN: [number, number] = [-3, 3];
const Y_DOMAIN: [number, number] = [0, 0.5];
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 160;
const MARGIN = 10;

export function removePlaceholder(box: HTMLDivElement): void {
  const placeholder = box.querySelector('.placeholder');
  if (placeholder !== null) {
    placeholder.remove();
  }
}

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
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  cells[1][0].appendChild(canvas);

  const ctx = getContext(canvas);
  drawDistribution(ctx, normalPdf, xScale, yScale);
}
