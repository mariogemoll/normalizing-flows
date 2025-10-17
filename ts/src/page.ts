import { initWidget as initLinearTransform } from './linear-transform';
import { initPipeline } from './pipeline';
import { el } from './web-ui-common/dom';

void (async(): Promise<void> => {
  // Wait for TensorFlow to be ready before doing anything
  await tf.ready();

  // Linear transform widget
  const linearTransformContainer = el(document, '#linear-transform-widget');
  if (linearTransformContainer instanceof HTMLDivElement) {
    initLinearTransform(linearTransformContainer);
  }

  // Initialize the normalizing flow training pipeline
  await initPipeline({
    moonsDataset: el(document, '#moons-dataset-widget') as HTMLDivElement,
    training: el(document, '#training-widget') as HTMLDivElement,
    flowVisualization: el(document, '#flow-visualization-widget') as HTMLDivElement
  });
})();
