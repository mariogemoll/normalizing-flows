import type { Generative } from 'flow-models-common/model-interface';
import { initPipeline, type VisualizationCallbacks } from 'flow-models-common/pipeline';
import type { Tensor2D } from 'flow-models-common/tf-types';

import { initWidget as initFlowVisualization } from './flow-visualization';
import { NormalizingFlow } from './model';

export async function initNormalizingFlowPipeline(
  moonsDatasetContainer: HTMLDivElement,
  trainingContainer: HTMLDivElement,
  flowVisualizationContainer: HTMLDivElement,
  modelUrl: string,
  lossHistoryUrl: string,
  numEpochs = 1000
): Promise<void> {
  // Create visualization callbacks for normalizing flow
  const visualizationCallbacks: VisualizationCallbacks = {
    updateVisualization: (model: Generative, container: HTMLDivElement) => {
      const initialNumSamples = 500;

      // Function to generate frames for a given number of samples
      function generateFrames(numSamples: number): Tensor2D[] {
        // Sample from standard normal distribution (generation)
        const normalSamples = tf.randomNormal([numSamples, 2]) as Tensor2D;

        // Run generation to generate data (from normal to moons)
        const [frames] = model.generate(normalSamples);

        // Note: normalSamples is the first frame in the frames array,
        // so we don't dispose it here. It will be disposed when the frames are disposed.

        return frames;
      }

      // Generate initial frames
      const frames = generateFrames(initialNumSamples);

      // Initialize flow visualization widget
      // Clear previous widget
      container.innerHTML = '';

      // Get training state from the window object (exposed by pipeline)
      const windowWithState = window as unknown as { state?: { trainingState: string } };
      const autoplay = windowWithState.state?.trainingState === 'completed' ||
                      windowWithState.state?.trainingState === 'paused';

      initFlowVisualization(container, frames, {
        onResample: generateFrames,
        initialSamples: initialNumSamples,
        autoplay
      });
    }
  };

  // Initialize the normalizing flow training pipeline
  // Model factory creates a NormalizingFlow with 8 coupling layers
  await initPipeline(
    moonsDatasetContainer,
    trainingContainer,
    flowVisualizationContainer,
    () => new NormalizingFlow(8), // Model factory function
    modelUrl,
    lossHistoryUrl,
    visualizationCallbacks,
    numEpochs
  );
}
