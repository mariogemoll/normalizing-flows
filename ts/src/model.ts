import type * as tfjs from '@tensorflow/tfjs';

import type { LayerVariable,Tensor1D, Tensor2D } from './tf-types';

export class MLP {
  private model: tfjs.Sequential;

  constructor(hiddenDims: number) {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [1], units: hiddenDims, activation: 'relu' }),
        tf.layers.dense({ units: hiddenDims, activation: 'relu' }),
        tf.layers.dense({ units: 1, kernelInitializer: 'zeros', biasInitializer: 'zeros' })
      ]
    });
  }

  predict(x: tfjs.Tensor): tfjs.Tensor {
    return this.model.predict(x) as tfjs.Tensor;
  }

  getModel(): tfjs.Sequential {
    return this.model;
  }
}

export class CouplingLayer {
  private flip: boolean;
  private scaleNet: MLP;
  private shiftNet: MLP;

  constructor(flip: boolean, hiddenDims = 24) {
    this.flip = flip;
    this.scaleNet = new MLP(hiddenDims);
    this.shiftNet = new MLP(hiddenDims);
  }

  forward(x: Tensor2D): [Tensor2D, Tensor1D] {
    // Split input into two parts
    let [x1, x2] = tf.split(x, 2, 1) as [Tensor2D, Tensor2D];

    if (this.flip) {
      [x1, x2] = [x2, x1];
    }

    // Compute scale and shift
    const s = tf.tanh(this.scaleNet.predict(x1) as Tensor2D);
    const t = this.shiftNet.predict(x1) as Tensor2D;

    // Apply transformation
    const y1 = x1;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const y2 = tf.add(tf.mul(tf.exp(s), x2), t) as Tensor2D;

    // Compute log determinant
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const logDet = tf.sum(s, 1) as Tensor1D;

    // Concatenate output
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const y = (this.flip
      ? tf.concat([y2, y1], 1)
      : tf.concat([y1, y2], 1)) as Tensor2D;

    return [y, logDet];
  }

  inverse(y: Tensor2D): [Tensor2D, Tensor1D] {
    // Split input into two parts
    let [y1, y2] = tf.split(y, 2, 1) as [Tensor2D, Tensor2D];

    if (this.flip) {
      [y1, y2] = [y2, y1];
    }

    // Compute scale and shift
    const s = tf.tanh(this.scaleNet.predict(y1) as Tensor2D);
    const t = this.shiftNet.predict(y1) as Tensor2D;

    // Apply inverse transformation
    const x1 = y1;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const x2 = tf.mul(tf.sub(y2, t), tf.exp(tf.neg(s))) as Tensor2D;

    // Compute log determinant
    const logDet = tf.neg(tf.sum(s, 1)) as Tensor1D;

    // Concatenate output
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const x = (this.flip
      ? tf.concat([x2, x1], 1)
      : tf.concat([x1, x2], 1)) as Tensor2D;

    return [x, logDet];
  }

  getTrainableWeights(): LayerVariable[] {
    return [
      ...this.scaleNet.getModel().trainableWeights,
      ...this.shiftNet.getModel().trainableWeights
    ];
  }

  getScaleNet(): MLP {
    return this.scaleNet;
  }

  getShiftNet(): MLP {
    return this.shiftNet;
  }
}

export class NormalizingFlow {
  private layers: CouplingLayer[];

  constructor(numLayers: number) {
    this.layers = [];
    for (let i = 0; i < numLayers; i++) {
      this.layers.push(new CouplingLayer(i % 2 === 0));
    }
  }

  forward(x: Tensor2D): [Tensor2D[], Tensor1D] {
    return tf.tidy(() => {
      const m = x.shape[0];
      let logDet = tf.zeros([m]) as Tensor1D;
      const zs: Tensor2D[] = [x];
      let current = x;

      for (const layer of this.layers) {
        const [z, layerLogDet] = layer.forward(current);
        logDet = tf.add(logDet, layerLogDet);
        zs.push(z);
        current = z;
      }

      return [zs, logDet];
    });
  }

  inverse(z: Tensor2D): [Tensor2D[], Tensor1D] {
    return tf.tidy(() => {
      const m = z.shape[0];
      let logDet = tf.zeros([m]) as Tensor1D;
      const xs: Tensor2D[] = [z];
      let current = z;

      for (let i = this.layers.length - 1; i >= 0; i--) {
        const [x, layerLogDet] = this.layers[i].inverse(current);
        logDet = tf.add(logDet, layerLogDet);
        xs.push(x);
        current = x;
      }

      return [xs, logDet];
    });
  }

  computeLoss(x: Tensor2D): tfjs.Scalar {
    return tf.tidy(() => {
      const [zs, logDet] = this.forward(x);
      const z = zs[zs.length - 1];

      // Prior: standard normal
      const prior = tf.mul(0.5, tf.sum(tf.square(z), 1));

      // Negative log likelihood
      const loss = tf.sub(prior, logDet);

      return tf.mean(loss);
    });
  }

  getTrainableWeights(): LayerVariable[] {
    const weights: LayerVariable[] = [];
    for (const layer of this.layers) {
      weights.push(...layer.getTrainableWeights());
    }
    return weights;
  }

  /**
   * Save model weights using TensorFlow.js format
   * Downloads weights as model.json and binary files
   * Usage from console: await flow.saveWeights()
   */
  async saveWeights(): Promise<void> {
    console.log('Saving model weights in TensorFlow.js format...');

    // Create a container model that holds all layers
    const containerModel = tf.sequential();

    for (const layer of this.layers) {
      // Add scale and shift networks to container
      const scaleModel = layer.getScaleNet().getModel();
      const shiftModel = layer.getShiftNet().getModel();

      for (const tfLayer of scaleModel.layers) {
        containerModel.add(tfLayer);
      }
      for (const tfLayer of shiftModel.layers) {
        containerModel.add(tfLayer);
      }
    }

    // Save to downloads folder
    // Note: TensorFlow.js standard format uses two files:
    //   - model.json (architecture + metadata)
    //   - model.weights.bin (binary weights)
    // This is the recommended format for portability and caching
    await containerModel.save('downloads://model');
    console.log('Model weights saved! Check your downloads folder for:');
    console.log('  - model.json');
    console.log('  - model.weights.bin');
    console.log('Move both files to the ts/ directory to load on startup.');
  }

  /**
   * Load model weights from TensorFlow.js format
   * Usage: await flow.loadWeights('path/to/model.json')
   */
  async loadWeights(modelPath: string): Promise<boolean> {
    console.log('Loading model weights from TensorFlow.js format...');

    try {
      const loadedModel = await tf.loadLayersModel(modelPath) as tfjs.Sequential;

      // Extract weights from loaded model and distribute to our layers
      const allWeights = loadedModel.getWeights();
      let weightIdx = 0;

      for (const layer of this.layers) {
        const scaleModel = layer.getScaleNet().getModel();
        const shiftModel = layer.getShiftNet().getModel();

        // Set scale network weights
        const scaleWeightCount = scaleModel.getWeights().length;
        const scaleWeights = allWeights.slice(weightIdx, weightIdx + scaleWeightCount);
        scaleModel.setWeights(scaleWeights);
        weightIdx += scaleWeightCount;

        // Set shift network weights
        const shiftWeightCount = shiftModel.getWeights().length;
        const shiftWeights = allWeights.slice(weightIdx, weightIdx + shiftWeightCount);
        shiftModel.setWeights(shiftWeights);
        weightIdx += shiftWeightCount;
      }

      console.log('Model weights loaded successfully from TensorFlow.js format');
      return true;
    } catch (error) {
      console.error('Failed to load weights:', error);
      return false;
    }
  }
}
