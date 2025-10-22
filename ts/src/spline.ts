import type { Transformation } from './transformation';

/**
 * B-spline basis function (cubic, degree 3)
 * Cox-de Boor recursion formula
 */
function bsplineBasis(i: number, p: number, u: number, knots: number[]): number {
  // Base case: degree 0
  if (p === 0) {
    return (u >= knots[i] && u < knots[i + 1]) ? 1 : 0;
  }

  // Recursive case
  const left = knots[i + p] - knots[i];
  const right = knots[i + p + 1] - knots[i + 1];

  let term1 = 0;
  let term2 = 0;

  if (left > 0) {
    term1 = ((u - knots[i]) / left) * bsplineBasis(i, p - 1, u, knots);
  }

  if (right > 0) {
    term2 = ((knots[i + p + 1] - u) / right) * bsplineBasis(i + 1, p - 1, u, knots);
  }

  return term1 + term2;
}

/**
 * Derivative of B-spline basis function
 * dN_{i,p}/du = p * (N_{i,p-1} / (t_{i+p} - t_i) - N_{i+1,p-1} / (t_{i+p+1} - t_{i+1}))
 */
function bsplineBasisDerivative(i: number, p: number, u: number, knots: number[]): number {
  if (p === 0) {
    return 0;
  }

  const left = knots[i + p] - knots[i];
  const right = knots[i + p + 1] - knots[i + 1];

  let term1 = 0;
  let term2 = 0;

  if (left > 0) {
    term1 = bsplineBasis(i, p - 1, u, knots) / left;
  }

  if (right > 0) {
    term2 = bsplineBasis(i + 1, p - 1, u, knots) / right;
  }

  return p * (term1 - term2);
}


/**
 * Create a cubic B-spline transformation (C² continuous and monotonic)
 * Control points guide the curve rather than being interpolated
 */
export function createBSplineTransformation(
  innerControlPointsX: number[],
  innerControlPointsY: number[]
): Transformation {
  // Add boundary control points
  const controlPointsX = [0, ...innerControlPointsX, 1];
  const controlPointsY = [0, ...innerControlPointsY, 1];

  const n = controlPointsX.length; // number of control points
  const p = 3; // cubic B-spline (degree 3)

  // Create uniform knot vector (clamped at ends for interpolation of endpoints)
  // For n control points and degree p, we need n+p+1 knots
  const numKnots = n + p + 1;
  const knots: number[] = [];

  // Clamp at start (repeat first knot p+1 times)
  for (let i = 0; i <= p; i++) {
    knots.push(0);
  }

  // Internal knots (uniform spacing)
  const numInternalKnots = numKnots - 2 * (p + 1);
  for (let i = 1; i <= numInternalKnots; i++) {
    knots.push(i / (numInternalKnots + 1));
  }

  // Clamp at end (repeat last knot p+1 times)
  for (let i = 0; i <= p; i++) {
    knots.push(1);
  }

  // Evaluate B-spline curve at parameter u
  const evaluateX = (u: number): number => {
    let x = 0;
    for (let i = 0; i < n; i++) {
      x += controlPointsX[i] * bsplineBasis(i, p, u, knots);
    }
    return x;
  };

  const evaluateY = (u: number): number => {
    let y = 0;
    for (let i = 0; i < n; i++) {
      y += controlPointsY[i] * bsplineBasis(i, p, u, knots);
    }
    return y;
  };

  // Evaluate derivatives with respect to u
  const evaluateXDerivative = (u: number): number => {
    let dxdu = 0;
    for (let i = 0; i < n; i++) {
      dxdu += controlPointsX[i] * bsplineBasisDerivative(i, p, u, knots);
    }
    return dxdu;
  };

  const evaluateYDerivative = (u: number): number => {
    let dydu = 0;
    for (let i = 0; i < n; i++) {
      dydu += controlPointsY[i] * bsplineBasisDerivative(i, p, u, knots);
    }
    return dydu;
  };


  // For transformation, we need to convert from x to u, then from u to y
  // This requires inverting x(u) to get u(x)

  // Find u for a given x using binary search (since x(u) is monotonic if control points are)
  const findU = (targetX: number): number => {
    let uMin = 0;
    let uMax = 1;
    const tolerance = 1e-8;
    const maxIter = 50;

    for (let iter = 0; iter < maxIter; iter++) {
      const uMid = (uMin + uMax) / 2;
      const xMid = evaluateX(uMid);

      if (Math.abs(xMid - targetX) < tolerance) {
        return uMid;
      }

      if (xMid < targetX) {
        uMin = uMid;
      } else {
        uMax = uMid;
      }
    }

    return (uMin + uMax) / 2;
  };


  return {
    f: (x: number): number => {
      const clampedX = Math.max(0, Math.min(1, x));
      const u = findU(clampedX);
      return evaluateY(u);
    },

    df: (x: number): number => {
      // Analytical derivative using chain rule: dy/dx = (dy/du) / (dx/du)
      const clampedX = Math.max(0, Math.min(1, x));
      const u = findU(clampedX);
      const dydu = evaluateYDerivative(u);
      const dxdu = evaluateXDerivative(u);

      if (Math.abs(dxdu) < 1e-10) {
        console.warn(`[BSpline] df: near-zero dx/du at x=${x}, u=${u}`);
        return 0;
      }

      return dydu / dxdu;
    },

    fInv: (y: number): number => {
      // Binary search to find u such that evaluateY(u) = y
      let uMin = 0;
      let uMax = 1;
      const tolerance = 1e-8;
      const maxIter = 50;

      const clampedY = Math.max(0, Math.min(1, y));

      for (let iter = 0; iter < maxIter; iter++) {
        const uMid = (uMin + uMax) / 2;
        const yMid = evaluateY(uMid);

        if (Math.abs(yMid - clampedY) < tolerance) {
          return evaluateX(uMid);
        }

        if (yMid < clampedY) {
          uMin = uMid;
        } else {
          uMax = uMid;
        }
      }

      const uFinal = (uMin + uMax) / 2;
      return evaluateX(uFinal);
    },

    dfInv: (y: number): number => {
      // Numerical derivative of inverse
      const h = 1e-6;
      const clampedY = Math.max(h, Math.min(1 - h, y));

      // Find u values for y - h and y + h
      let uMin1 = 0, uMax1 = 1;
      let uMin2 = 0, uMax2 = 1;
      const tolerance = 1e-8;
      const maxIter = 50;

      // Find u for y - h
      for (let iter = 0; iter < maxIter; iter++) {
        const uMid = (uMin1 + uMax1) / 2;
        const yMid = evaluateY(uMid);
        if (Math.abs(yMid - (clampedY - h)) < tolerance) {
          break;
        }
        if (yMid < clampedY - h) {
          uMin1 = uMid;
        } else {
          uMax1 = uMid;
        }
      }
      const u1 = (uMin1 + uMax1) / 2;
      const x1 = evaluateX(u1);

      // Find u for y + h
      for (let iter = 0; iter < maxIter; iter++) {
        const uMid = (uMin2 + uMax2) / 2;
        const yMid = evaluateY(uMid);
        if (Math.abs(yMid - (clampedY + h)) < tolerance) {
          break;
        }
        if (yMid < clampedY + h) {
          uMin2 = uMid;
        } else {
          uMax2 = uMid;
        }
      }
      const u2 = (uMin2 + uMax2) / 2;
      const x2 = evaluateX(u2);

      return (x2 - x1) / (2 * h);
    }
  };
}
