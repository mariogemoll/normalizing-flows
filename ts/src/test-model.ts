import './tf-types';

import { NormalizingFlow } from './model';
import { makeMoons } from './moons-dataset';

/**
 * Simple test to verify the model works
 */
export function testModel(): void {
  console.log('Testing Normalizing Flow Model...');

  // Create a small batch of moons data
  const data = makeMoons(10, 0.05);
  console.log('Input data shape:', data.shape);
  console.log('Input data:', data.arraySync());

  // Create the model
  const flow = new NormalizingFlow(8);
  console.log('Created flow with 8 coupling layers');

  // Test forward pass
  const [zs, logDet] = flow.forward(data);
  console.log('Forward pass successful!');
  console.log('Number of intermediate outputs:', zs.length);
  console.log('Final z shape:', zs[zs.length - 1].shape);
  console.log('Log determinant shape:', logDet.shape);
  console.log('Final z:', zs[zs.length - 1].arraySync());
  console.log('Log det:', logDet.arraySync());

  // Test loss computation
  const loss = flow.computeLoss(data);
  console.log('Loss:', loss.arraySync());

  // Test inverse pass
  const z = zs[zs.length - 1];
  const [xs] = flow.inverse(z);
  console.log('Inverse pass successful!');
  console.log('Reconstructed x shape:', xs[xs.length - 1].shape);
  console.log('Reconstructed x:', xs[xs.length - 1].arraySync());

  // Check reconstruction error
  const reconstructionError = tf.mean(tf.abs(tf.sub(data, xs[xs.length - 1])));
  console.log('Reconstruction error:', reconstructionError.arraySync());

  // Cleanup
  data.dispose();
  loss.dispose();
  reconstructionError.dispose();

  console.log('All tests passed!');
}

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
  testModel();
}
