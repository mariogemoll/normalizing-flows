/**
 * Pure functions for logit transformation: y = x0 + (1/k) * log(x / (1-x))
 * This is the inverse of the sigmoid transformation.
 * @param k - steepness parameter (k > 0)
 * @param x0 - vertical shift (center point)
 */

/**
 * Forward logit transformation: y = x0 + (1/k) * log(x / (1-x))
 */
export function f(k: number, x0: number, x: number): number {
  return x0 + (1 / k) * Math.log(x / (1 - x));
}

/**
 * Derivative of logit with respect to x: df/dx = 1 / (k * x * (1-x))
 */
export function df(k: number, x0: number, x: number): number {
  return 1 / (k * x * (1 - x));
}

/**
 * Inverse logit (sigmoid): x = 1 / (1 + e^(-k(y-x0)))
 */
export function fInv(k: number, x0: number, y: number): number {
  return 1 / (1 + Math.exp(-k * (y - x0)));
}

/**
 * Derivative of inverse logit: d(f^{-1})/dy = k * s * (1-s)
 * where s = sigmoid(y)
 */
export function dfInv(k: number, x0: number, y: number): number {
  const s = fInv(k, x0, y);
  return k * s * (1 - s);
}

/**
 * Compute k (steepness) from a point (x, y) on the logit curve, given x0
 * Derived from: y = x0 + (1/k) * log(x / (1-x))
 * Solution: k = log(x / (1-x)) / (y - x0)
 */
export function computeK(x0: number, x: number, y: number): number {
  if (Math.abs(y - x0) < 0.01) {
    throw new Error('y too close to x0, cannot compute k');
  }
  const logOdds = Math.log(x / (1 - x));
  return logOdds / (y - x0);
}
