import { initWidget as initFlowVisualization } from './flow-visualization';
import { initWidget as initLinearTransform } from './linear-transform';
import { loadLossHistory, saveLossHistory } from './loss-history';
import { NormalizingFlow } from './model';
import { initWidget as initMoonsDataset } from './moons-widget';
import { createPageState } from './page-state';
import type { Tensor2D } from './tf-types';
import { trainModel } from './train';
import { initWidget as initTraining } from './training-widget';
import { el } from './web-ui-common/dom';

void (async(): Promise<void> => {
  // Wait for TensorFlow to be ready before doing anything
  await tf.ready();

  // Create page-wide state
  const state = createPageState(8, 1000); // 8 layers, 1000 epochs

  // Linear transform widget
  const linearTransformContainer = el(document, '#linear-transform-widget');
  if (linearTransformContainer instanceof HTMLDivElement) {
    initLinearTransform(linearTransformContainer);
  }

  // Moons dataset widget
  const moonsDatasetContainer = el(document, '#moons-dataset-widget');
  if (moonsDatasetContainer instanceof HTMLDivElement) {
    initMoonsDataset(moonsDatasetContainer, state);
  }

  // Training widget
  const trainingContainer = el(document, '#training-widget');
  let trainingWidget: ReturnType<typeof initTraining> | undefined;
  if (trainingContainer instanceof HTMLDivElement) {
    trainingWidget = initTraining(trainingContainer);
    trainingWidget.setMaxEpochs(state.numEpochs);
  }

  // Create model using state configuration
  state.model = new NormalizingFlow(state.numLayers);
  console.log(`Created normalizing flow with ${state.numLayers} coupling layers`);

  // Try to load weights from model.json
  const trainBtn = document.getElementById('train-btn') as HTMLButtonElement;
  const trainStatus = document.getElementById('train-status') as HTMLSpanElement;
  const flowVizContainer = el(document, '#flow-visualization-widget');

  try {
    const success = await state.model.loadWeights('model.json');
    if (success) {
      console.log('Loaded weights from model.json');
      trainStatus.textContent = 'Loaded pre-trained weights';

      // Try to load loss history
      if (trainingWidget) {
        const lossHistory = await loadLossHistory('loss-history.bin');
        if (lossHistory) {
          trainingWidget.setLossHistory(lossHistory);
        }
      }

      // Generate and show visualization
      updateVisualization(state.model, flowVizContainer);
    } else {
      trainStatus.textContent = 'Failed to load weights';
    }
  } catch (error) {
    console.log('Could not load model.json:', error);
    trainStatus.textContent = 'No pre-trained weights found. Click "Train Model" to train.';
  }

  // Train button handler
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  trainBtn.addEventListener('click', async() => {
    trainBtn.disabled = true;
    trainStatus.textContent = 'Training...';

    // Train and update model in state
    state.model = await trainModel(state, trainingWidget);

    trainStatus.textContent = 'Training complete!';
    trainBtn.disabled = false;

    // Update visualization
    updateVisualization(state.model, flowVizContainer);
  });

  function updateVisualization(model: NormalizingFlow, container: Element): void {
    const initialNumSamples = 500;

    // Function to generate frames for a given number of samples
    function generateFrames(numSamples: number): Tensor2D[] {
      // Sample from standard normal distribution (generation)
      const normalSamples = tf.randomNormal([numSamples, 2]) as Tensor2D;

      // Run inverse transform to generate data (from normal to moons)
      const [frames] = model.inverse(normalSamples);

      // Note: normalSamples is the first frame in the frames array,
      // so we don't dispose it here. It will be disposed when the frames are disposed.

      return frames;
    }

    // Generate initial frames
    const frames = generateFrames(initialNumSamples);

    // The frames are already in generation order: [normal, ..., moons]
    console.log('Generation frames:', frames.length);
    console.log('First frame (should be normal):', frames[0].arraySync().slice(0, 5));
    console.log('Last frame (should be moons):', frames[frames.length - 1].arraySync().slice(0, 5));

    // Initialize flow visualization widget
    if (container instanceof HTMLDivElement) {
      // Clear previous widget
      container.innerHTML = '';
      initFlowVisualization(container, frames, {
        onResample: generateFrames,
        initialSamples: initialNumSamples
      });
    }
  }

  // Expose state and utilities globally for console access
  interface WindowWithState {
    state: typeof state;
    saveLossHistory: typeof saveLossHistory;
  }
  const windowWithState = window as unknown as WindowWithState;
  windowWithState.state = state;
  windowWithState.saveLossHistory = (): void => {
    if (trainingWidget) {
      saveLossHistory(trainingWidget.getLossHistory());
    } else {
      console.error('Training widget not available');
    }
  };

  console.log('Page state available as window.state');
  console.log('To save model weights: await state.model.saveWeights()');
  console.log('To save loss history: saveLossHistory()');
})();
