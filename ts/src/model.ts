import * as tf from '@tensorflow/tfjs';

export class MLP {
  private model: tf.Sequential;

  constructor(hiddenDims: number) {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [1], units: hiddenDims, activation: 'relu' }),
        tf.layers.dense({ units: hiddenDims, activation: 'relu' }),
        tf.layers.dense({ units: 1, kernelInitializer: 'zeros', biasInitializer: 'zeros' })
      ]
    });
  }

  predict(x: tf.Tensor): tf.Tensor {
    return this.model.predict(x) as tf.Tensor;
  }

  getModel(): tf.Sequential {
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

  forward(x: tf.Tensor2D): [tf.Tensor2D, tf.Tensor1D] {
    // Split input into two parts
    let [x1, x2] = tf.split(x, 2, 1) as [tf.Tensor2D, tf.Tensor2D];

    if (this.flip) {
      [x1, x2] = [x2, x1];
    }

    // Compute scale and shift
    const s = tf.tanh(this.scaleNet.predict(x1) as tf.Tensor2D);
    const t = this.shiftNet.predict(x1) as tf.Tensor2D;

    // Apply transformation
    const y1 = x1;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const y2 = tf.add(tf.mul(tf.exp(s), x2), t) as tf.Tensor2D;

    // Compute log determinant
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const logDet = tf.sum(s, 1) as tf.Tensor1D;

    // Concatenate output
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const y = (this.flip
      ? tf.concat([y2, y1], 1)
      : tf.concat([y1, y2], 1)) as tf.Tensor2D;

    return [y, logDet];
  }

  inverse(y: tf.Tensor2D): [tf.Tensor2D, tf.Tensor1D] {
    // Split input into two parts
    let [y1, y2] = tf.split(y, 2, 1) as [tf.Tensor2D, tf.Tensor2D];

    if (this.flip) {
      [y1, y2] = [y2, y1];
    }

    // Compute scale and shift
    const s = tf.tanh(this.scaleNet.predict(y1) as tf.Tensor2D);
    const t = this.shiftNet.predict(y1) as tf.Tensor2D;

    // Apply inverse transformation
    const x1 = y1;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const x2 = tf.mul(tf.sub(y2, t), tf.exp(tf.neg(s))) as tf.Tensor2D;

    // Compute log determinant
    const logDet = tf.neg(tf.sum(s, 1)) as tf.Tensor1D;

    // Concatenate output
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const x = (this.flip
      ? tf.concat([x2, x1], 1)
      : tf.concat([x1, x2], 1)) as tf.Tensor2D;

    return [x, logDet];
  }

  getTrainableWeights(): tf.LayerVariable[] {
    return [
      ...this.scaleNet.getModel().trainableWeights,
      ...this.shiftNet.getModel().trainableWeights
    ];
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

  forward(x: tf.Tensor2D): [tf.Tensor2D[], tf.Tensor1D] {
    return tf.tidy(() => {
      const m = x.shape[0];
      let logDet = tf.zeros([m]) as tf.Tensor1D;
      const zs: tf.Tensor2D[] = [x];
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

  inverse(z: tf.Tensor2D): [tf.Tensor2D[], tf.Tensor1D] {
    return tf.tidy(() => {
      const m = z.shape[0];
      let logDet = tf.zeros([m]) as tf.Tensor1D;
      const xs: tf.Tensor2D[] = [z];
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

  computeLoss(x: tf.Tensor2D): tf.Scalar {
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

  getTrainableWeights(): tf.LayerVariable[] {
    const weights: tf.LayerVariable[] = [];
    for (const layer of this.layers) {
      weights.push(...layer.getTrainableWeights());
    }
    return weights;
  }
}
