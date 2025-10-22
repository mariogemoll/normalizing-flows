/**
 * Pure functions for sigmoid transformation: y = 1 / (1 + e^(-k(x-x0)))
 * @param k - steepness parameter (k > 0)
 * @param x0 - horizontal shift (center point)
 */

/**
 * Forward sigmoid transformation: y = 1 / (1 + e^(-k(x-x0)))
 */
export function f(k: number, x0: number, x: number): number {
  return 1 / (1 + Math.exp(-k * (x - x0)));
}

/**
 * Derivative of sigmoid with respect to x: df/dx = k * s * (1 - s)
 * where s = sigmoid(x)
 */
export function df(k: number, x0: number, x: number): number {
  const s = f(k, x0, x);
  return k * s * (1 - s);
}

/**
 * Inverse sigmoid (logit): x = x0 + (1/k) * log(y / (1-y))
 */
export function fInv(k: number, x0: number, y: number): number {
  return x0 + (1 / k) * Math.log(y / (1 - y));
}

/**
 * Derivative of inverse sigmoid: d(f^{-1})/dy = 1 / (k * y * (1-y))
 */
export function dfInv(k: number, x0: number, y: number): number {
  return 1 / (k * y * (1 - y));
}

/**
 * Compute k (steepness) from a point (x, y) on the sigmoid curve, given x0
 * Derived from: y = 1 / (1 + e^(-k(x-x0)))
 * Solution: k = ln(y/(1-y)) / (x-x0)
 */
export function computeK(x0: number, x: number, y: number): number {
  if (Math.abs(x - x0) < 0.01) {
    throw new Error('x too close to x0, cannot compute k');
  }
  const logOdds = Math.log(y / (1 - y));
  return logOdds / (x - x0);
}
