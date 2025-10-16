import type { Tensor2D } from './tf-types';
import { addFrameUsingScales, drawScatter, getContext } from './web-ui-common/canvas';
import type { Pair } from './web-ui-common/types';
import { makeScale } from './web-ui-common/util';

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;
const MARGIN = 40;

/**
 * Get data bounds for scaling across all frames
 */
function getAllFramesBounds(frames: Tensor2D[]): {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
} {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  for (const frame of frames) {
    const min = frame.min(0).arraySync() as number[];
    const max = frame.max(0).arraySync() as number[];

    xMin = Math.min(xMin, min[0]);
    xMax = Math.max(xMax, max[0]);
    yMin = Math.min(yMin, min[1]);
    yMax = Math.max(yMax, max[1]);
  }

  return { xMin, xMax, yMin, yMax };
}

export function removePlaceholder(box: HTMLDivElement): void {
  const placeholder = box.querySelector('.placeholder');
  if (placeholder !== null) {
    placeholder.remove();
  }
}

export function initWidget(container: HTMLDivElement, frames: Tensor2D[]): void {
  removePlaceholder(container);

  if (frames.length === 0) {
    container.textContent = 'No frames to display';
    return;
  }

  // Create control panel
  const controlPanel = document.createElement('div');
  controlPanel.className = 'control-panel';
  controlPanel.style.display = 'flex';
  controlPanel.style.alignItems = 'center';
  controlPanel.style.gap = '15px';

  // Play/Pause button
  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.style.minWidth = '80px';
  controlPanel.appendChild(playButton);

  // Frame label
  const frameLabel = document.createElement('label');
  frameLabel.textContent = 'Frame: ';
  controlPanel.appendChild(frameLabel);

  // Frame slider
  const frameSlider = document.createElement('input');
  frameSlider.type = 'range';
  frameSlider.min = '0';
  frameSlider.max = (frames.length - 1).toString();
  frameSlider.value = '0';
  frameSlider.style.flex = '1';
  controlPanel.appendChild(frameSlider);

  // Frame counter
  const frameCounter = document.createElement('span');
  frameCounter.textContent = `0 / ${frames.length - 1}`;
  frameCounter.style.minWidth = '60px';
  controlPanel.appendChild(frameCounter);

  container.appendChild(controlPanel);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.border = '1px solid #ccc';
  canvas.style.marginTop = '10px';
  container.appendChild(canvas);

  const ctx = getContext(canvas);

  // Get bounds for all frames (for consistent scaling)
  const bounds = getAllFramesBounds(frames);
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

  // Animation state
  let isPlaying = false;
  let animationId: number | null = null;
  let currentFrame = 0;

  function drawFrame(frameIndex: number): void {
    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw frame with axes
    addFrameUsingScales(ctx, xScale, yScale, 5);

    // Convert tensor data to coords array
    const dataArray = frames[frameIndex].arraySync();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const coords: Pair<number>[] = (dataArray as number[][]).map(([x, y]) => [x, y]);
    const colors = new Array<string>(coords.length).fill('#4169E1');

    // Draw scatter plot
    drawScatter(ctx, xScale, yScale, coords, colors);

    // Update counter
    frameCounter.textContent = `${frameIndex} / ${frames.length - 1}`;
    frameSlider.value = frameIndex.toString();
  }

  function play(): void {
    if (isPlaying) {return;}

    isPlaying = true;
    playButton.textContent = 'Pause';

    const animate = (): void => {
      currentFrame = (currentFrame + 1) % frames.length;
      drawFrame(currentFrame);

      if (isPlaying) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
  }

  function pause(): void {
    isPlaying = false;
    playButton.textContent = 'Play';

    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // Event listeners
  playButton.addEventListener('click', () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  });

  frameSlider.addEventListener('input', () => {
    pause();
    currentFrame = parseInt(frameSlider.value);
    drawFrame(currentFrame);
  });

  // Initial draw
  drawFrame(0);
}
