import { initWidget as initLinearTransform } from './linear-transform';
import { initWidget as initMoonsDataset } from './moons-widget';
import { testModel } from './test-model';
import { el } from './web-ui-common/dom';

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

// Run model test
testModel();
