import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { initSigmoidLayer } from './sigmoid-layer';
import { composeTransformations, type Transformation } from './transformation';
import { addFrameUsingScales, getContext } from './web-ui-common/canvas';
import { removePlaceholder } from './web-ui-common/dom';
import { makeScale } from './web-ui-common/util';

type LayerInitFn = (
  container: HTMLElement,
  onChange: () => void,
  ...params: unknown[]
) => Transformation;

const X_DOMAIN: [number, number] = [-10, 10];
const Y_DOMAIN: [number, number] = [0, 0.5];
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 160;
const MARGIN = 25;

export function initWidget(container: HTMLDivElement): void {
  removePlaceholder(container);

  // Define layer configurations: [initFunction, parameters]
  const layerConfigs: [LayerInitFn, unknown[]][] = [
    [initSigmoidLayer as LayerInitFn, [1.0, 0.0]]
  ];

  const numLayers = layerConfigs.length;

  // Create 2×(n+1) grid with equal row heights
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = `repeat(${numLayers + 1}, ${CANVAS_WIDTH}px)`;
  gridContainer.style.gridTemplateRows = `${CANVAS_HEIGHT}px ${CANVAS_HEIGHT}px`;
  gridContainer.style.gap = '0';

  // Create cells array
  const cells: HTMLDivElement[][] = [];
  for (let row = 0; row < 2; row++) {
    cells[row] = [];
    for (let col = 0; col < numLayers + 1; col++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cells[row][col] = cell;
      gridContainer.appendChild(cell);
    }
  }

  container.appendChild(gridContainer);

  // Create scales
  const xScale = makeScale(X_DOMAIN, [MARGIN, CANVAS_WIDTH - MARGIN]);
  const yScale = makeScale(Y_DOMAIN, [CANVAS_HEIGHT - MARGIN, MARGIN]);

  // First column: empty cell in row 0, initial distribution in row 1
  const initialCanvas = document.createElement('canvas');
  initialCanvas.width = CANVAS_WIDTH;
  initialCanvas.height = CANVAS_HEIGHT;
  cells[1][0].appendChild(initialCanvas);

  const initialCtx = getContext(initialCanvas);
  addFrameUsingScales(initialCtx, xScale, yScale, 5);
  drawDistribution(initialCtx, normalPdf, xScale, yScale);

  // Create canvases for each layer
  const distributionCanvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < numLayers; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    cells[1][i + 1].appendChild(canvas);
    distributionCanvases.push(canvas);
  }

  // Initialize layers and collect transformations
  const layers: Transformation[] = [];

  // Function to redraw distributions from a given layer index onwards
  function redrawFrom(startIndex: number): void {
    for (let i = startIndex; i < numLayers; i++) {
      const canvas = distributionCanvases[i];
      const ctx = getContext(canvas);
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      addFrameUsingScales(ctx, xScale, yScale, 5);

      // Compose transformations up to and including this layer
      const transforms = layers.slice(0, i + 1);
      const composed = composeTransformations(transforms);

      // Transform the PDF
      const transformedPdf = (x: number): number => {
        const y = composed.f(x);
        return normalPdf(y) * Math.abs(composed.df(y));
      };

      drawDistribution(ctx, transformedPdf, xScale, yScale);
    }
  }

  // Initialize each layer with its editor
  for (let i = 0; i < numLayers; i++) {
    const [initFn, params] = layerConfigs[i];
    const editorCell = cells[0][i + 1];

    // Call the init function which sets up the editor and returns the transformation
    const transformation = initFn(
      editorCell,
      () => {
        redrawFrom(i);
      },
      ...params
    );
    layers.push(transformation);
  }

  // Initial draw of all distributions
  redrawFrom(0);
}
