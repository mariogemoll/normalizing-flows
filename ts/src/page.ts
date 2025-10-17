import { initWidget as initFlowVisualization } from './flow-visualization';
import { initWidget as initLinearTransform } from './linear-transform';
import { initWidget as initLossCurve } from './loss-curve-widget';
import { NormalizingFlow } from './model';
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

  // Loss curve widget
  const lossCurveContainer = el(document, '#loss-curve-widget');
  let lossCurveWidget: ReturnType<typeof initLossCurve> | undefined;
  if (lossCurveContainer instanceof HTMLDivElement) {
    lossCurveWidget = initLossCurve(lossCurveContainer);
  }

  // Create model (match training configuration)
  let flow = new NormalizingFlow(2);
  console.log('Created normalizing flow with 2 coupling layers');

  // Try to load weights from weights.json
  const trainBtn = document.getElementById('train-btn') as HTMLButtonElement;
  const trainStatus = document.getElementById('train-status') as HTMLSpanElement;
  const flowVizContainer = el(document, '#flow-visualization-widget');

  try {
    const success = await flow.loadWeights('model.json');
    if (success) {
      console.log('Loaded weights from model.json');
      trainStatus.textContent = 'Loaded pre-trained weights';
      // Generate and show visualization
      updateVisualization(flow, flowVizContainer);
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

    // Replace the flow model with the trained one
    flow = await trainModel(lossCurveWidget);

    trainStatus.textContent = 'Training complete!';
    trainBtn.disabled = false;

    // Update visualization
    updateVisualization(flow, flowVizContainer);
  });

  function updateVisualization(model: NormalizingFlow, container: Element): void {
    // Sample from standard normal distribution (generation)
    const numSamples = 500;
    const normalSamples = tf.randomNormal([numSamples, 2]) as Tensor2D;

    // Run inverse transform to generate data (from normal to moons)
    const [frames] = model.inverse(normalSamples);

    // The frames are already in generation order: [normal, ..., moons]
    console.log('Generation frames:', frames.length);
    console.log('First frame (should be normal):', frames[0].arraySync().slice(0, 5));
    console.log('Last frame (should be moons):', frames[frames.length - 1].arraySync().slice(0, 5));

    // Initialize flow visualization widget
    if (container instanceof HTMLDivElement) {
      // Clear previous widget
      container.innerHTML = '';
      initFlowVisualization(container, frames);
    }
  }

  // Expose flow globally for console access
  interface WindowWithFlow {
    flow: NormalizingFlow;
  }
  (window as unknown as WindowWithFlow).flow = flow;
  console.log('Flow model available as window.flow');
  console.log('To save weights: copy(flow.saveWeights())');
  console.log('To load weights: flow.loadWeights(pastedJsonString)');
})();
