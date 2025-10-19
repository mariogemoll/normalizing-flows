import { drawBaseline, drawDistribution } from './distribution-drawing';
import { getContext } from './web-ui-common/canvas';
import type { Scale } from './web-ui-common/types';
import { makeScale } from './web-ui-common/util';

const X_DOMAIN: [number, number] = [-3, 3];
const Y_DOMAIN_STANDARD: [number, number] = [0, 2];
const Y_DOMAIN_TALL: [number, number] = [0, 20];

const STROKE = '#555';
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT_STANDARD = 120;
const CANVAS_HEIGHT_TALL = 1020;
const MARGIN = 10;

export function removePlaceholder(box: HTMLDivElement): void {
  const placeholder = box.querySelector('.placeholder');
  if (placeholder !== null) {
    placeholder.remove();
  }
}

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
export function createNaivePdf(params: TransformParams): (y: number) => number {
  return (y: number) => {
    const x = (y - params.shift) / params.scale;
    return normalPdf(x);
  };
}

export function createCorrectPdf(params: TransformParams): (y: number) => number {
  return (y: number) => {
    const x = (y - params.shift) / params.scale;
    return normalPdf(x) / Math.abs(params.scale);
  };
}

function drawUniform(
  ctx: CanvasRenderingContext2D,
  xScale: Scale,
  yScale: Scale,
  x0: number,
  x1: number,
  y: number
): void {
  drawBaseline(ctx, xScale, yScale);

  // Draw three sides of the rectangle (left, top, right)
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = STROKE;
  ctx.beginPath();
  ctx.moveTo(xScale(x0), yScale(0));
  ctx.lineTo(xScale(x0), yScale(y));
  ctx.lineTo(xScale(x1), yScale(y));
  ctx.lineTo(xScale(x1), yScale(0));
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

  // Create scales once - one x scale and two y scales (standard and tall)
  const xScale = makeScale(X_DOMAIN, [MARGIN, CANVAS_WIDTH - MARGIN]);
  const yScaleStandard = makeScale(Y_DOMAIN_STANDARD, [CANVAS_HEIGHT_STANDARD - MARGIN, MARGIN]);
  const yScaleTall = makeScale(Y_DOMAIN_TALL, [CANVAS_HEIGHT_TALL - MARGIN, MARGIN]);

  // Create sliders
  const initialScale = 1.0;
  const initialShift = 0.0;

  // Scale slider: 100 steps of 0.03 between -0.5 and 2.5
  const scaleControl = createSlider('Scale (s)', -0.5, 2.5, initialScale, 0.03);
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

  // Create grid container for 2 rows × 4 columns (controls + 3 canvases)
  const gridContainer = document.createElement('div');
  gridContainer.className = 'grid-container';

  // Create left column with sliders and table
  const leftColumn = document.createElement('div');
  leftColumn.className = 'left-column';

  leftColumn.appendChild(scaleControl.container);
  leftColumn.appendChild(shiftControl.container);
  leftColumn.appendChild(table);
  gridContainer.appendChild(leftColumn);

  // Create 6 canvases with area displays
  const canvases: HTMLCanvasElement[] = [];
  const contexts: CanvasRenderingContext2D[] = [];
  const areaDisplays: HTMLDivElement[] = [];

  const labelsHTML = [
    '<math><msub><mi>p</mi><mi>X</mi></msub><mo>(</mo><mi>x</mi><mo>)</mo></math>',
    '<math><msub><mi>p</mi><mi>Y</mi></msub><mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo>'
      + '<msub><mi>p</mi><mi>X</mi></msub><mo>(</mo>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>y</mi><mo>)</mo><mo>)</mo></math><br>'
      + '<span style="font-style: italic;">(naive)</span>',
    '<math><msub><mi>p</mi><mi>Y</mi></msub><mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo>'
      + '<msub><mi>p</mi><mi>X</mi></msub><mo>(</mo>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>y</mi><mo>)</mo><mo>)</mo>'
      + '<mrow><mo>|</mo><mfrac><mi>d</mi><mrow><mi>d</mi><mi>y</mi></mrow></mfrac>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>y</mi><mo>)</mo><mo>|</mo></mrow></math><br>'
      + '<span style="font-style: italic;">(correct)</span>'
  ];

  for (let i = 0; i < 6; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';

    // Add label on top of first row canvases
    if (i < 3) {
      const labelEl = document.createElement('div');
      labelEl.className = 'canvas-label';
      labelEl.innerHTML = labelsHTML[i];
      wrapper.appendChild(labelEl);
    }

    const canvas = document.createElement('canvas');
    // Only rightmost canvases (2, 5) are tall
    const isTall = i === 2 || i === 5;
    canvas.width = CANVAS_WIDTH;
    canvas.height = isTall ? CANVAS_HEIGHT_TALL : CANVAS_HEIGHT_STANDARD;

    if (isTall) {
      // Shift up to keep bottom aligned, accounting for first row margin
      const firstRowMargin = i === 2 ? 30 : 0;
      const marginTop = CANVAS_HEIGHT_TALL - CANVAS_HEIGHT_STANDARD - firstRowMargin;
      canvas.style.cssText = `margin-top: -${marginTop}px;`;
    } else if (i < 3) {
      // First row canvases get top margin
      canvas.className = 'first-row-canvas';
    }

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

    cell1.innerHTML = '<math><mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + '<mi>s</mi><mi>x</mi><mo>+</mo><mi>t</mi><mo>=</mo>'
      + `<mn>${sStr}</mn><mi>x</mi><mo>+</mo><mn>${tStr}</mn></math>`;
    cell2.innerHTML = '<math><mfrac><mi>d</mi><mrow><mi>d</mi><mi>x</mi></mrow></mfrac>'
      + '<mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>=</mo>'
      + `<mi>s</mi><mo>=</mo><mn>${sStr}</mn></math>`;
    cell3.innerHTML = '<math><msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo>'
      + '<mfrac><mrow><mi>y</mi><mo>-</mo><mi>t</mi></mrow><mi>s</mi></mfrac>'
      + `<mo>=</mo><mfrac><mrow><mi>y</mi><mo>-</mo><mn>${tStr}</mn></mrow>`
      + `<mn>${sStr}</mn></mfrac></math>`;
    cell4.innerHTML = '<math><mfrac><mi>d</mi><mrow><mi>d</mi><mi>y</mi></mrow></mfrac>'
      + '<msup><mi>f</mi><mrow><mo>-</mo><mn>1</mn></mrow></msup>'
      + '<mo>(</mo><mi>y</mi><mo>)</mo><mo>=</mo>'
      + '<mfrac><mn>1</mn><mi>s</mi></mfrac><mo>=</mo>'
      + `<mfrac><mn>1</mn><mn>${sStr}</mn></mfrac>`
      + `<mo>=</mo><mn>${invSStr}</mn></math>`;

    // Clear all canvases (transparent background)
    contexts.forEach((ctx, i) => {
      const isTall = i === 2 || i === 5;
      const height = isTall ? CANVAS_HEIGHT_TALL : CANVAS_HEIGHT_STANDARD;
      ctx.clearRect(0, 0, CANVAS_WIDTH, height);
    });

    // Calculate uniform distribution boundaries
    const width = Math.abs(params.scale);
    const a = Math.min(params.shift, params.scale + params.shift);
    const b = Math.max(params.shift, params.scale + params.shift);

    // Row 0: Uniform distributions
    drawUniform(contexts[0], xScale, yScaleStandard, 0, 1, 1);
    drawUniform(contexts[1], xScale, yScaleStandard, a, b, 1);
    drawUniform(contexts[2], xScale, yScaleTall, a, b, 1 / width);

    // Row 1: Normal distributions
    drawDistribution(contexts[3], normalPdf, xScale, yScaleStandard);
    drawDistribution(contexts[4], createNaivePdf(params), xScale, yScaleStandard);
    drawDistribution(contexts[5], createCorrectPdf(params), xScale, yScaleTall);

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
