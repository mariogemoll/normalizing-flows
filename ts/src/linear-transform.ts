import { defaultMargins } from './constants';
import { drawDistribution } from './distribution-drawing';
import { addFrameUsingScales, getContext } from './web-ui-common/canvas';
import { removePlaceholder } from './web-ui-common/dom';
import type { Scale } from './web-ui-common/types';
import { makeScale } from './web-ui-common/util';

const Z_DOMAIN: [number, number] = [-3, 3];
const X_DOMAIN: [number, number] = [0, 2];

const STROKE = '#555';
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 160;

export interface TransformParams {
  scale: number;
  shift: number;
}

// Normal PDF function
export function normalPdf(x: number): number {
  const coeff = 1 / Math.sqrt(2 * Math.PI);
  const exponent = -(x ** 2) / 2;
  return coeff * Math.exp(exponent);
}

// Create naive and correct PDF functions
export function createNaivePdf(params: TransformParams): (x: number) => number {
  return (x: number) => {
    const z = (x - params.shift) / params.scale;
    return normalPdf(z);
  };
}

export function createCorrectPdf(params: TransformParams): (x: number) => number {
  return (x: number) => {
    const z = (x - params.shift) / params.scale;
    return normalPdf(z) / Math.abs(params.scale);
  };
}

function drawUniform(
  ctx: CanvasRenderingContext2D,
  zScale: Scale,
  xScale: Scale,
  z0: number,
  z1: number,
  x: number
): void {
  // Draw three sides of the rectangle (left, top, right)
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = STROKE;
  ctx.beginPath();
  ctx.moveTo(zScale(z0), xScale(0));
  ctx.lineTo(zScale(z0), xScale(x));
  ctx.lineTo(zScale(z1), xScale(x));
  ctx.lineTo(zScale(z1), xScale(0));
  ctx.stroke();
}

function createSlider(
  label: string,
  min: number,
  max: number,
  value: number,
  step: number
): { container: HTMLDivElement; slider: HTMLInputElement; valueDisplay: HTMLSpanElement } {
  const container = document.createElement('div');
  container.className = 'slider-control';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  container.appendChild(labelEl);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min.toString();
  slider.max = max.toString();
  slider.step = step.toString();
  // Ensure value snaps to nearest step
  const snappedValue = Math.round((value - min) / step) * step + min;
  slider.value = snappedValue.toString();
  container.appendChild(slider);

  const valueDisplay = document.createElement('span');
  valueDisplay.className = 'value-display';
  valueDisplay.textContent = snappedValue.toFixed(2);
  container.appendChild(valueDisplay);

  return { container, slider, valueDisplay };
}

export function initWidget(container: HTMLDivElement): void {
  removePlaceholder(container);

  // Create scales once
  const zScale = makeScale(Z_DOMAIN, [defaultMargins.left, CANVAS_WIDTH - defaultMargins.right]);
  const xScale = makeScale(X_DOMAIN, [CANVAS_HEIGHT - defaultMargins.bottom, defaultMargins.top]);

  // Create sliders
  const initialScale = 1.0;
  const initialShift = 0.0;

  // Scale slider: positive values only, 0.1 to 2.5
  const scaleControl = createSlider('Scale (s)', 0.1, 2.5, initialScale, 0.03);
  // Shift slider: 100 steps between -1.5 and 1.5
  const shiftControl = createSlider('Shift (t)', -1.5, 1.5, initialShift, 0.03);

  // Create table for function info
  const table = document.createElement('table');
  table.className = 'function-table';

  // Create table rows that will be updated dynamically
  const tableCells: HTMLTableCellElement[] = [];
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    row.appendChild(cell);
    table.appendChild(row);
    tableCells.push(cell);
  }
  const [cell1, cell2, cell3, cell4] = tableCells;

  // Create grid container for 3 rows × 4 columns
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  // Create left column with sliders and table (spans all 3 rows)
  const leftColumn = document.createElement('div');
  leftColumn.className = 'left-column';

  leftColumn.appendChild(scaleControl.container);
  leftColumn.appendChild(shiftControl.container);
  leftColumn.appendChild(table);
  gridContainer.appendChild(leftColumn);

  // Create header labels
  const labelsHTML = [
    '<math><msub><mi>p</mi><mi>Z</mi></msub><mo>(</mo><mi>z</mi><mo>)</mo></math>',
    '<math><msub><mi>p</mi><mi>X</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + '<msub><mi>p</mi><mi>Z</mi></msub><mo>(</mo>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>x</mi><mo>)</mo><mo>)</mo></math><br>'
      + '<span style="font-style: italic;">(naive)</span>',
    '<math><msub><mi>p</mi><mi>X</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + '<msub><mi>p</mi><mi>Z</mi></msub><mo>(</mo>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>x</mi><mo>)</mo><mo>)</mo>'
      + '<mrow><mo>|</mo><mfrac><mi>d</mi><mrow><mi>d</mi><mi>x</mi></mrow></mfrac>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>x</mi><mo>)</mo><mo>|</mo></mrow></math><br>'
      + '<span style="font-style: italic;">(correct)</span>'
  ];

  // Add 3 header cells
  for (let i = 0; i < 3; i++) {
    const headerCell = document.createElement('div');
    headerCell.className = 'header-cell';
    headerCell.innerHTML = labelsHTML[i];
    gridContainer.appendChild(headerCell);
  }

  // Create 6 canvases with area displays
  const canvases: HTMLCanvasElement[] = [];
  const contexts: CanvasRenderingContext2D[] = [];
  const areaDisplays: HTMLDivElement[] = [];

  for (let i = 0; i < 6; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    wrapper.appendChild(canvas);
    canvases.push(canvas);
    contexts.push(getContext(canvas));

    // Add area display below canvas
    const areaDisplay = document.createElement('div');
    areaDisplay.className = 'area-display';
    areaDisplay.textContent = 'Area: —';
    wrapper.appendChild(areaDisplay);
    areaDisplays.push(areaDisplay);

    gridContainer.appendChild(wrapper);
  }

  container.appendChild(gridContainer);

  // Update function
  function update(): void {
    const params: TransformParams = {
      scale: Number(scaleControl.slider.value),
      shift: Number(shiftControl.slider.value)
    };

    scaleControl.valueDisplay.textContent = params.scale.toFixed(2);
    shiftControl.valueDisplay.textContent = params.shift.toFixed(2);

    // Update table with current values
    const sStr = params.scale.toFixed(2);
    const tStr = params.shift.toFixed(2);
    const invSStr = (1 / params.scale).toFixed(2);

    cell1.innerHTML = '<math><mi>f</mi><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo>'
      + '<mi>s</mi><mi>z</mi><mo>+</mo><mi>t</mi><mo>=</mo>'
      + `<mn>${sStr}</mn><mi>z</mi><mo>+</mo><mn>${tStr}</mn></math>`;
    cell2.innerHTML = '<math><mfrac><mi>d</mi><mrow><mi>d</mi><mi>z</mi></mrow></mfrac>'
      + '<mi>f</mi><mo>(</mo><mi>z</mi><mo>)</mo><mo>=</mo>'
      + `<mi>s</mi><mo>=</mo><mn>${sStr}</mn></math>`;
    cell3.innerHTML = '<math><msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + '<mfrac><mrow><mi>x</mi><mo>-</mo><mi>t</mi></mrow><mi>s</mi></mfrac>'
      + `<mo>=</mo><mfrac><mrow><mi>x</mi><mo>-</mo><mn>${tStr}</mn></mrow>`
      + `<mn>${sStr}</mn></mfrac></math>`;
    cell4.innerHTML = '<math><mfrac><mi>d</mi><mrow><mi>d</mi><mi>x</mi></mrow></mfrac>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + '<mfrac><mn>1</mn><mi>s</mi></mfrac><mo>=</mo>'
      + `<mfrac><mn>1</mn><mn>${sStr}</mn></mfrac>`
      + `<mo>=</mo><mn>${invSStr}</mn></math>`;

    // Clear all canvases (transparent background)
    contexts.forEach((ctx) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    });

    // Set up clipping for all canvases (but don't draw frames yet)
    contexts.forEach((ctx) => {
      ctx.save();
      // Clip to the drawable area (excluding margins)
      ctx.beginPath();
      ctx.rect(
        defaultMargins.left,
        defaultMargins.top,
        CANVAS_WIDTH - defaultMargins.left - defaultMargins.right,
        CANVAS_HEIGHT - defaultMargins.top - defaultMargins.bottom
      );
      ctx.clip();
    });

    // Calculate uniform distribution boundaries
    const width = Math.abs(params.scale);
    const a = Math.min(params.shift, params.scale + params.shift);
    const b = Math.max(params.shift, params.scale + params.shift);

    // Row 0: Uniform distributions (with clipping)
    drawUniform(contexts[0], zScale, xScale, 0, 1, 1);
    drawUniform(contexts[1], zScale, xScale, a, b, 1);
    drawUniform(contexts[2], zScale, xScale, a, b, 1 / width);

    // Row 1: Normal distributions (with clipping)
    drawDistribution(contexts[3], normalPdf, zScale, xScale);
    drawDistribution(contexts[4], createNaivePdf(params), zScale, xScale);
    drawDistribution(contexts[5], createCorrectPdf(params), zScale, xScale);

    // Restore contexts to remove clipping
    contexts.forEach((ctx) => {
      ctx.restore();
    });

    // Draw frames on top (without clipping)
    contexts.forEach((ctx) => {
      addFrameUsingScales(ctx, zScale, xScale, 5);
    });

    // Update area displays
    areaDisplays[0].textContent = 'Area: 1.000';
    areaDisplays[1].textContent = `Area: ${width.toFixed(3)}`;
    areaDisplays[2].textContent = 'Area: 1.000';
    areaDisplays[3].textContent = 'Area: 1.000';
    areaDisplays[4].textContent = `Area: ${width.toFixed(3)}`;
    areaDisplays[5].textContent = 'Area: 1.000';
  }

  // Add event listeners
  scaleControl.slider.addEventListener('input', update);
  shiftControl.slider.addEventListener('input', update);

  // Initial draw
  update();
}
