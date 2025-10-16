import { initWidget as initFlowVisualization } from './flow-visualization';
import { initWidget as initLinearTransform } from './linear-transform';
import { makeMoons } from './moons-dataset';
import { initWidget as initMoonsDataset } from './moons-widget';
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

  // Generate sample data for visualization
  const sampleData = makeMoons(500, 0.05);
  const [frames] = flow.forward(sampleData);

  // Initialize flow visualization widget
  const flowVizContainer = el(document, '#flow-visualization-widget');
  if (flowVizContainer instanceof HTMLDivElement) {
    initFlowVisualization(flowVizContainer, frames);
  }
})();
