import { drawDistribution } from './distribution-drawing';
import { normalPdf } from './linear-transform';
import { createLogitEditor, type LogitEditor } from './logit-editor';
import { createSigmoidEditor, type SigmoidEditor } from './sigmoid-editor';
import { createBSplineTransformation } from './spline';
import { createSplineEditor, type SplineEditor } from './spline-editor';
import {
  composeTransformations,
  createLogitTransformation,
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

  // Create grid container for 3 rows × 5 columns (sigmoid + B-spline + B-spline + logit)
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';
  gridContainer.style.display = 'grid';
  gridContainer.style.gridTemplateColumns = 'repeat(5, 160px)';
  gridContainer.style.gridTemplateRows = '80px 160px 160px';
  gridContainer.style.gap = '0';

  // Create 15 empty cells (3 rows × 5 columns), store in 2D array
  const cells: HTMLDivElement[][] = [];
  for (let row = 0; row < 3; row++) {
    cells[row] = [];
    for (let col = 0; col < 5; col++) {
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

  // Create 4 transformations (sigmoid + B-spline + B-spline + logit)
  const NUM_TRANSFORMS = 4;
  const distCanvases: HTMLCanvasElement[] = [];
  const distContexts: CanvasRenderingContext2D[] = [];
  const bsplineEditors: (SplineEditor | null)[] = [];
  let sigmoidEditorRef: SigmoidEditor | null = null;
  let logitEditorRef: LogitEditor | null = null;

  // Create wrapper for update function so spline callback can reference it
  const updateWrapper = (): void => {
    update();
  };

  for (let i = 0; i < NUM_TRANSFORMS; i++) {
    if (i === 0) {
      // Sigmoid transformation: interactive editor
      const editor = createSigmoidEditor(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        1.0,  // initial k (steepness)
        0.0,  // initial x0 (center)
        X_DOMAIN,
        X_DOMAIN_LOGISTIC,
        updateWrapper
      );

      cells[1][i + 1].appendChild(editor.element);
      sigmoidEditorRef = editor;
      bsplineEditors.push(null);
    } else if (i === 1) {
      // B-spline with 3 control points: interactive editor
      const initialPoints = [
        { x: 0.25, y: 0.25 },
        { x: 0.50, y: 0.50 },
        { x: 0.75, y: 0.75 }
      ];

      const editor = createSplineEditor(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        initialPoints,
        updateWrapper
      );

      cells[1][i + 1].appendChild(editor.element);
      bsplineEditors.push(editor);
    } else if (i === 2) {
      // B-spline with 4 control points: interactive editor
      const initialPoints = [
        { x: 0.20, y: 0.20 },
        { x: 0.40, y: 0.40 },
        { x: 0.60, y: 0.60 },
        { x: 0.80, y: 0.80 }
      ];

      const editor = createSplineEditor(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        initialPoints,
        updateWrapper
      );

      cells[1][i + 1].appendChild(editor.element);
      bsplineEditors.push(editor);
    } else if (i === 3) {
      // Logit transformation: interactive editor
      const editor = createLogitEditor(
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        1.0,  // initial k (steepness)
        0.0,  // initial x0 (center)
        X_DOMAIN_LOGISTIC,
        X_DOMAIN,
        updateWrapper
      );

      cells[1][i + 1].appendChild(editor.element);
      logitEditorRef = editor;
      bsplineEditors.push(null);
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
      // All transformations are editors that draw themselves, no manual drawing needed

      // Clear distribution canvas
      distContexts[i].clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Use logistic scales for outputs in (0,1): sigmoid and B-splines
      // Use standard scales for outputs in R: logit
      const currentXScale = (i === 0 || i === 1 || i === 2) ? xScaleLogistic : xScale;
      const currentYScale = (i === 0 || i === 1 || i === 2) ? yScaleLogistic : yScale;

      // Add axes (using appropriate scales)
      addFrameUsingScales(distContexts[i], currentXScale, currentYScale, 5);

      // Compose transformations up to i
      const transforms = [];
      for (let j = 0; j <= i; j++) {
        if (j === 0) {
          // Sigmoid transformation from editor
          if (sigmoidEditorRef) {
            const params = sigmoidEditorRef.getParams();
            transforms.push(createSigmoidTransformation(params.k, params.x0));
          }
        } else if (j === 1 || j === 2) {
          // B-spline transformation
          const editor = bsplineEditors[j];
          if (editor) {
            const controlPoints = editor.getControlPoints();
            transforms.push(
              createBSplineTransformation(
                controlPoints.map(p => p.x),
                controlPoints.map(p => p.y)
              )
            );
          }
        } else if (j === 3) {
          // Logit transformation from editor
          if (logitEditorRef) {
            const params = logitEditorRef.getParams();
            transforms.push(createLogitTransformation(params.k, params.x0));
          }
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

  // All transformations are editors with their own callbacks, no manual event listeners needed

  // Initial draw
  update();
}
