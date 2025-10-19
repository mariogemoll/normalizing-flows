import { initWidget as initLayers } from './layers';
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

  // Layers widget
  const layersContainer = el(document, '#layers-widget');
  if (layersContainer instanceof HTMLDivElement) {
    initLayers(layersContainer);
  }

  // Initialize the normalizing flow training pipeline
  await initPipeline(
    el(document, '#moons-dataset-widget') as HTMLDivElement,
    el(document, '#training-widget') as HTMLDivElement,
    el(document, '#flow-visualization-widget') as HTMLDivElement,
    'model.json',
    'loss-history.bin'
  );
})();
