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

export interface FlowVisualizationOptions {
  onResample?: (numSamples: number) => Tensor2D[];
  initialSamples?: number;
  autoplay?: boolean;
}

export function initWidget(
  container: HTMLDivElement,
  initialFrames: Tensor2D[],
  options?: FlowVisualizationOptions
): void {
  removePlaceholder(container);

  if (initialFrames.length === 0) {
    container.textContent = 'No frames to display';
    return;
  }

  let frames = initialFrames;

  // Create control panel
  const controlPanel = document.createElement('div');
  controlPanel.className = 'control-panel';
  controlPanel.style.display = 'flex';
  controlPanel.style.alignItems = 'center';
  controlPanel.style.gap = '15px';
  controlPanel.style.marginBottom = '10px';

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

  // Resample control panel (if callback provided)
  let resampleButton: HTMLButtonElement | null = null;
  let sampleInput: HTMLInputElement | null = null;

  if (options?.onResample) {
    const resamplePanel = document.createElement('div');
    resamplePanel.className = 'control-panel';
    resamplePanel.style.display = 'flex';
    resamplePanel.style.alignItems = 'center';
    resamplePanel.style.gap = '15px';
    resamplePanel.style.marginBottom = '10px';

    // Sample size input
    const sampleLabel = document.createElement('label');
    sampleLabel.textContent = 'Samples: ';
    sampleInput = document.createElement('input');
    sampleInput.type = 'number';
    sampleInput.value = (options.initialSamples ?? 500).toString();
    sampleInput.min = '100';
    sampleInput.max = '10000';
    sampleInput.step = '100';
    sampleLabel.appendChild(sampleInput);
    resamplePanel.appendChild(sampleLabel);

    // Resample button
    resampleButton = document.createElement('button');
    resampleButton.textContent = 'Resample';
    resamplePanel.appendChild(resampleButton);

    container.appendChild(resamplePanel);
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.border = '1px solid #ccc';
  canvas.style.marginTop = '10px';
  container.appendChild(canvas);

  const ctx = getContext(canvas);

  // Scales (will be updated by updateBoundsAndScales)
  let xScale: ReturnType<typeof makeScale>;
  let yScale: ReturnType<typeof makeScale>;

  function updateBoundsAndScales(): void {
    // Get bounds for all frames (for consistent scaling)
    const bounds = getAllFramesBounds(frames);
    const xPadding = (bounds.xMax - bounds.xMin) * 0.1;
    const yPadding = (bounds.yMax - bounds.yMin) * 0.1;

    // Create scales
    xScale = makeScale(
      [bounds.xMin - xPadding, bounds.xMax + xPadding],
      [MARGIN, CANVAS_WIDTH - MARGIN]
    );
    yScale = makeScale(
      [bounds.yMin - yPadding, bounds.yMax + yPadding],
      [CANVAS_HEIGHT - MARGIN, MARGIN]
    );
  }

  // Initialize scales
  updateBoundsAndScales();

  // Animation state
  let isPlaying = false;
  let animationId: number | null = null;
  let currentFrame = 0;
  let lastFrameTime = 0;
  let isWaitingAtEnd = false;
  let isWaitingAtStart = false;
  const FRAME_DELAY_MS = 500;
  const END_PAUSE_MS = 1000;
  const START_PAUSE_MS = 1000;

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
    drawScatter(ctx, xScale, yScale, coords, colors, undefined, { radius: 1.5, alpha: 0.3 });

    // Update counter
    frameCounter.textContent = `${frameIndex} / ${frames.length - 1}`;
    frameSlider.value = frameIndex.toString();
  }

  function play(): void {
    if (isPlaying) {return;}

    isPlaying = true;
    playButton.textContent = 'Pause';
    lastFrameTime = performance.now();
    isWaitingAtStart = true; // Start with initial pause

    const animate = (timestamp: number): void => {
      const elapsed = timestamp - lastFrameTime;
      let requiredDelay = FRAME_DELAY_MS;

      if (isWaitingAtStart) {
        requiredDelay = START_PAUSE_MS;
      } else if (isWaitingAtEnd) {
        requiredDelay = END_PAUSE_MS;
      }

      if (elapsed >= requiredDelay) {
        if (isWaitingAtStart) {
          // Start pause is over, begin animation
          isWaitingAtStart = false;
          currentFrame = 1; // Move to second frame
        } else if (isWaitingAtEnd) {
          // End pause is over, restart from beginning
          isWaitingAtEnd = false;
          isWaitingAtStart = true;
          currentFrame = 0;
        } else {
          // Advance to next frame
          currentFrame = currentFrame + 1;

          // Check if we've reached the end
          if (currentFrame >= frames.length) {
            currentFrame = frames.length - 1; // Stay on last frame
            isWaitingAtEnd = true;
          }
        }

        drawFrame(currentFrame);
        lastFrameTime = timestamp;
      }

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

  // Resample handler (set up after functions are defined)
  if (resampleButton && sampleInput && options?.onResample) {
    const onResampleCallback = options.onResample;
    resampleButton.addEventListener('click', () => {
      const numSamples = parseInt(sampleInput.value);

      // Pause animation
      pause();

      // Get new frames
      const newFrames = onResampleCallback(numSamples);

      // Dispose old frames
      for (const frame of frames) {
        frame.dispose();
      }

      frames = newFrames;
      currentFrame = 0;

      // Update UI
      frameSlider.max = (frames.length - 1).toString();

      // Recalculate bounds and scales
      updateBoundsAndScales();

      // Redraw and restart animation
      drawFrame(0);
      play();
    });
  }

  // Initial draw and optionally autostart
  drawFrame(0);
  if (options?.autoplay ?? true) {
    play();
  }
}
