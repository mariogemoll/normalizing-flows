import { initWidget as initFlowVisualization } from './flow-visualization';
import { initWidget as initLinearTransform } from './linear-transform';
import { initWidget as initMoonsDataset } from './moons-widget';
import type { Tensor2D } from './tf-types';
import { trainModel } from './train';
import { el } from './web-ui-common/dom';

void (async(): Promise<void> => {
  // Wait for TensorFlow to be ready before doing anything
  await tf.ready();

  // Linear transform widget
  const linearTransformContainer = el(document, '#linear-transform-widget');
  if (linearTransformContainer instanceof HTMLDivElement) {
    initLinearTransform(linearTransformContainer);
  }

  // Moons dataset widget
  const moonsDatasetContainer = el(document, '#moons-dataset-widget');
  if (moonsDatasetContainer instanceof HTMLDivElement) {
    initMoonsDataset(moonsDatasetContainer);
  }

  // Train model and show flow visualization
  const flow = await trainModel();

  // Sample from standard normal distribution (generation)
  const numSamples = 500;
  const normalSamples = tf.randomNormal([numSamples, 2]) as Tensor2D;

  // Run inverse transform to generate data (from normal to moons)
  const [frames] = flow.inverse(normalSamples);

  // The frames are already in generation order: [normal, ..., moons]
  // Just use them directly
  console.log('Generation frames:', frames.length);
  console.log('First frame (should be normal):', frames[0].arraySync().slice(0, 5));
  console.log('Last frame (should be moons):', frames[frames.length - 1].arraySync().slice(0, 5));

  // Initialize flow visualization widget
  const flowVizContainer = el(document, '#flow-visualization-widget');
  if (flowVizContainer instanceof HTMLDivElement) {
    initFlowVisualization(flowVizContainer, frames);
  }

  // Don't dispose normalSamples since it's in the frames array
  // The frames will be cleaned up by TensorFlow's memory management
})();
