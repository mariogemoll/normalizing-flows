import { initWidget as initFlowVisualization } from './flow-visualization';
import { loadLossHistory, saveLossHistory } from './loss-history';
import { NormalizingFlow } from './model';
import { initWidget as initMoonsDataset } from './moons-widget';
import { createPageState, type TrainingState } from './page-state';
import type { Tensor2D } from './tf-types';
import { trainModel } from './train';
import { initWidget as initTraining } from './training-widget';

export interface PipelineContainers {
  moonsDataset: HTMLDivElement;
  training: HTMLDivElement;
  flowVisualization: HTMLDivElement;
  trainButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
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
      state.trainingState = 'completed';

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
      'No pre-trained weights found. Click "Train model" to train.';
  }

  // Update button states based on training status
  function updateButtonStates(): void {
    switch (state.trainingState) {
    case 'training':
      containers.trainButton.textContent = 'Pause training';
      containers.trainButton.disabled = false;
      containers.resetButton.disabled = true;
      break;
    case 'paused':
      containers.trainButton.textContent = 'Resume training';
      containers.trainButton.disabled = false;
      containers.resetButton.disabled = false;
      break;
    case 'completed':
      containers.trainButton.textContent = 'Training completed';
      containers.trainButton.disabled = true;
      containers.resetButton.disabled = false;
      break;
    case 'not_started':
      containers.trainButton.textContent = 'Train model';
      containers.trainButton.disabled = false;
      containers.resetButton.disabled = false;
      break;
    }
  }

  // Initial button state
  updateButtonStates();

  // Reset button handler
  containers.resetButton.addEventListener('click', () => {
    // Create new untrained model
    state.model = new NormalizingFlow(state.numLayers);
    state.trainingState = 'not_started';
    console.log('Reset: Created new untrained model');

    // Clear loss history
    trainingWidget.setLossHistory([]);

    // Update status and visualization
    containers.trainStatus.textContent = 'Model reset. Ready to train.';
    updateVisualization(state.model, containers.flowVisualization);
    updateButtonStates();
  });

  // Train/Pause button handler
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  containers.trainButton.addEventListener('click', async() => {
    if (state.trainingState === 'training') {
      // Pause training (will be handled by training loop)
      state.trainingState = 'paused';
      containers.trainStatus.textContent = 'Pausing training...';
    } else if (state.trainingState !== 'completed') {
      // Start or resume training (only if not completed)
      await startTraining();
    }
  });

  async function startTraining(): Promise<void> {
    state.trainingState = 'training';
    updateButtonStates();

    // Show training in progress view
    showTrainingInProgress(containers.flowVisualization);

    containers.trainStatus.textContent = 'Training...';

    // Train and update model in state
    state.model = await trainModel(state, trainingWidget);

    // Store final state before calling other functions (widen type to avoid narrowing issues)
    const finalState = state.trainingState as TrainingState;

    updateButtonStates();

    // Update status based on final state (trainModel may have changed it to 'paused')
    switch (finalState) {
    case 'paused':
      containers.trainStatus.textContent = 'Training paused';
      break;
    case 'completed':
      containers.trainStatus.textContent = 'Training complete!';
      break;
    default:
      // Should not happen, but handle gracefully
      containers.trainStatus.textContent = 'Training finished';
    }

    // Update visualization
    updateVisualization(state.model, containers.flowVisualization);
  }

  function showTrainingInProgress(container: HTMLDivElement): void {
    container.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 400px;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-radius: 4px;
      ">
        <div style="text-align: center; color: #666;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">
            Training in Progress
          </div>
          <div style="font-size: 14px;">
            Visualization will be available when training is paused or completed
          </div>
        </div>
      </div>
    `;
  }

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
      initialSamples: initialNumSamples,
      autoplay: state.trainingState === 'completed' || state.trainingState === 'paused'
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
