import { initWidget as initFlowVisualization } from './flow-visualization';
import { loadLossHistory, saveLossHistory } from './loss-history';
import { NormalizingFlow } from './model';
import { initWidget as initMoonsDataset } from './moons-widget';
import { createPageState } from './page-state';
import type { Tensor2D } from './tf-types';
import { trainModel } from './train';
import { initWidget as initTraining } from './training-widget';

export interface PipelineContainers {
  moonsDataset: HTMLDivElement;
  training: HTMLDivElement;
  flowVisualization: HTMLDivElement;
  trainButton: HTMLButtonElement;
  trainStatus: HTMLSpanElement;
}

export async function initPipeline(containers: PipelineContainers): Promise<void> {
  // Wait for TensorFlow to be ready before doing anything
  await tf.ready();

  // Create page-wide state
  const state = createPageState(8, 1000); // 8 layers, 1000 epochs

  // Moons dataset widget
  initMoonsDataset(containers.moonsDataset, state);

  // Training widget
  const trainingWidget = initTraining(containers.training);
  trainingWidget.setMaxEpochs(state.numEpochs);

  // Create model using state configuration
  state.model = new NormalizingFlow(state.numLayers);
  console.log(`Created normalizing flow with ${state.numLayers} coupling layers`);

  try {
    const success = await state.model.loadWeights('model.json');
    if (success) {
      console.log('Loaded weights from model.json');
      containers.trainStatus.textContent = 'Loaded pre-trained weights';

      // Try to load loss history
      const lossHistory = await loadLossHistory('loss-history.bin');
      if (lossHistory) {
        trainingWidget.setLossHistory(lossHistory);
      }

      // Generate and show visualization
      updateVisualization(state.model, containers.flowVisualization);
    } else {
      containers.trainStatus.textContent = 'Failed to load weights';
    }
  } catch (error) {
    console.log('Could not load model.json:', error);
    containers.trainStatus.textContent =
      'No pre-trained weights found. Click "Train Model" to train.';
  }

  // Train button handler
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  containers.trainButton.addEventListener('click', async() => {
    containers.trainButton.disabled = true;
    containers.trainStatus.textContent = 'Training...';

    // Train and update model in state
    state.model = await trainModel(state, trainingWidget);

    containers.trainStatus.textContent = 'Training complete!';
    containers.trainButton.disabled = false;

    // Update visualization
    updateVisualization(state.model, containers.flowVisualization);
  });

  function updateVisualization(model: NormalizingFlow, container: HTMLDivElement): void {
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
    // Clear previous widget
    container.innerHTML = '';
    initFlowVisualization(container, frames, {
      onResample: generateFrames,
      initialSamples: initialNumSamples
    });
  }

  // Expose state and utilities globally for console access
  interface WindowWithState {
    state: typeof state;
    saveLossHistory: typeof saveLossHistory;
  }
  const windowWithState = window as unknown as WindowWithState;
  windowWithState.state = state;
  windowWithState.saveLossHistory = (): void => {
    saveLossHistory(trainingWidget.getLossHistory());
  };

  console.log('Page state available as window.state');
  console.log('To save model weights: await state.model.saveWeights()');
  console.log('To save loss history: saveLossHistory()');
}
