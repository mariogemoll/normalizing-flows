import { defaultMargins } from './constants';
import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { initLogitLayer } from './logit-layer';
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

const X_DOMAIN_SMALL: [number, number] = [0, 1];
const X_DOMAIN_LARGE: [number, number] = [-10, 10];
const Y_DOMAIN_SMALL: [number, number] = [0, 0.5];
const Y_DOMAIN_LARGE: [number, number] = [0, 5];
const CANVAS_WIDTH = 160;
const CANVAS_HEIGHT = 160;

export function initWidget(container: HTMLDivElement): void {
  removePlaceholder(container);

  // Define layer configurations: [initFunction, parameters, outputDomain, yDomain]
  // outputDomain specifies the x-domain for the distribution after this layer
  // yDomain specifies the y-domain (probability density range) for the distribution
  const layerConfigs: [LayerInitFn, unknown[], [number, number], [number, number]][] = [
    [initSigmoidLayer as LayerInitFn, [1.0, 0.0], X_DOMAIN_SMALL, Y_DOMAIN_LARGE],
    [initLogitLayer as LayerInitFn, [1.0, 0.0], X_DOMAIN_LARGE, Y_DOMAIN_SMALL]
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

  // Create scales using default margins
  const xScale = makeScale(
    X_DOMAIN_LARGE,
    [defaultMargins.left, CANVAS_WIDTH - defaultMargins.right]
  );
  const yScale = makeScale(
    Y_DOMAIN_SMALL,
    [CANVAS_HEIGHT - defaultMargins.bottom, defaultMargins.top]
  );

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

      // Get the output domain and y domain for this layer
      const [, , outputDomain, yDomain] = layerConfigs[i];
      const xScale = makeScale(
        outputDomain, [defaultMargins.left, CANVAS_WIDTH - defaultMargins.right]
      );
      const currentYScale = makeScale(
        yDomain, [CANVAS_HEIGHT - defaultMargins.bottom, defaultMargins.top]
      );

      addFrameUsingScales(ctx, xScale, currentYScale, 5);

      // Compose transformations up to and including this layer
      const transforms = layers.slice(0, i + 1);
      const composed = composeTransformations(transforms);

      // Transform the PDF
      // For a point x in the transformed space, we need to find the original point
      // and apply the change of variables formula: p_X(x) = p_Y(f^{-1}(x)) * |df^{-1}/dx|
      const transformedPdf = (x: number): number => {
        const y = composed.fInv(x);
        return normalPdf(y) * Math.abs(composed.dfInv(x));
      };

      drawDistribution(ctx, transformedPdf, xScale, currentYScale);
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
