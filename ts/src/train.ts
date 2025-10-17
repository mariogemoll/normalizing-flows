import type { LossCurveWidget } from './loss-curve-widget';
import { NormalizingFlow } from './model';
import { makeMoons } from './moons-dataset';
import type { Variable } from './tf-types';
import type { Pair } from './web-ui-common/types';

/**
 * Train the normalizing flow model
 * Returns the trained model
 */
export async function trainModel(
  lossCurveWidget?: LossCurveWidget
): Promise<NormalizingFlow> {
  console.log('Starting training...');

  // Try WebGPU first (fastest), fall back to WebGL
  try {
    await tf.setBackend('webgpu');
    await tf.ready();
    console.log('Using WebGPU backend (fastest)');
  } catch {
    console.log('WebGPU not available, falling back to WebGL');
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('Using WebGL backend');

    // Enable WebGL performance optimizations
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  }

  console.log('Active backend:', tf.getBackend());

  // Create model (simplified for faster testing)
  const flow = new NormalizingFlow(2);
  console.log('Created normalizing flow with 2 coupling layers');

  // Create optimizer
  const optimizer = tf.train.adam(0.001);

  // Training parameters (reduced for faster testing)
  const numEpochs = 100;
  const batchSize = 256;

  // Set max epochs for loss curve widget
  if (lossCurveWidget) {
    lossCurveWidget.setMaxEpochs(numEpochs);
  }

  // Get trainable weights as Variables
  const weights = flow.getTrainableWeights().map(w => w.read() as Variable);

  // Track timing for ETA
  const startTime = Date.now();
  let lastLogTime = startTime;
  const timings: number[] = [];

  // Track loss history for visualization
  const lossHistory: Pair<number>[] = [];

  // Training loop
  for (let epoch = 0; epoch < numEpochs; epoch++) {
    // Generate batch of moons data
    const x = makeMoons(batchSize, 0.05);

    // Compute loss and gradients
    const loss = optimizer.minimize(() => {
      return flow.computeLoss(x);
    }, true, weights);

    if (loss === null) {
      throw new Error('Optimizer returned null loss');
    }

    // Get loss value for every epoch
    const lossValue = await loss.data();

    // Add to loss history every epoch
    lossHistory.push([epoch, lossValue[0]]);

    // Update visualization every epoch
    if (lossCurveWidget) {
      lossCurveWidget.update(lossHistory);
    }

    // Log progress every 10 epochs
    if (epoch % 10 === 0) {
      const now = Date.now();
      const epochTime = (now - lastLogTime) / 10; // ms per epoch
      timings.push(epochTime);

      // Calculate ETA
      const remainingEpochs = numEpochs - epoch;
      const avgEpochTime = timings.reduce((a, b) => a + b, 0) / timings.length;
      const etaSeconds = (remainingEpochs * avgEpochTime) / 1000;
      const etaMinutes = Math.floor(etaSeconds / 60);
      const etaSecondsRemainder = Math.floor(etaSeconds % 60);

      const progress = ((epoch / numEpochs) * 100).toFixed(1);
      console.log(
        `Epoch ${epoch}/${numEpochs} (${progress}%) - ` +
        `Loss: ${lossValue[0].toFixed(4)} - ` +
        `${epochTime.toFixed(1)}ms/epoch - ` +
        `ETA: ${etaMinutes}m ${etaSecondsRemainder}s`
      );

      lastLogTime = now;

      // Keep only last 5 timings for moving average
      if (timings.length > 5) {
        timings.shift();
      }
    }

    // Cleanup
    x.dispose();
    loss.dispose();

    // Yield to browser every epoch for smooth visualization
    await tf.nextFrame();
  }

  console.log('Training complete!');

  // Test the trained model
  console.log('\nTesting trained model...');
  const testData = makeMoons(100, 0.05);
  const [zs] = flow.forward(testData);
  const z = zs[zs.length - 1];

  console.log('Original data (first 5 samples):');
  console.log(testData.slice([0, 0], [5, 2]).arraySync());
  console.log('\nTransformed data (first 5 samples):');
  console.log(z.slice([0, 0], [5, 2]).arraySync());

  // Test inverse
  const [xs] = flow.inverse(z);
  const reconstructed = xs[xs.length - 1];
  const reconstructionError = tf.mean(tf.abs(tf.sub(testData, reconstructed)));
  console.log('\nReconstruction error:', (await reconstructionError.data())[0]);

  // Cleanup
  testData.dispose();
  reconstructionError.dispose();

  return flow;
}
