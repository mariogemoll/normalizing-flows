/**
 * Represents a 1D transformation with its derivatives and inverse.
 * For a transformation y = f(x):
 * - f: the forward transformation
 * - df: derivative of f with respect to x
 * - fInv: the inverse transformation x = f^{-1}(y)
 * - dfInv: derivative of f^{-1} with respect to y
 *
 * The relationship: dfInv(y) = 1 / df(fInv(y))
 */
export interface Transformation {
  /** Forward transformation: y = f(x) */
  f: (x: number) => number;

  /** Derivative of forward transformation: df/dx */
  df: (x: number) => number;

  /** Inverse transformation: x = f^{-1}(y) */
  fInv: (y: number) => number;

  /** Derivative of inverse transformation: d(f^{-1})/dy */
  dfInv: (y: number) => number;
}

/**
 * Creates a linear transformation: y = scale * x + shift
 */
export function createLinearTransformation(scale: number, shift: number): Transformation {
  return {
    f: (x: number): number => scale * x + shift,
    df: (): number => scale,
    fInv: (y: number): number => (y - shift) / scale,
    dfInv: (): number => 1 / scale
  };
}

/**
 * Creates a sigmoid transformation: y = 1 / (1 + e^(-k(x-x0)))
 * @param k - steepness parameter (k > 0)
 * @param x0 - horizontal shift (center point)
 */
export function createSigmoidTransformation(k: number, x0: number): Transformation {
  const sigmoid = (x: number): number => 1 / (1 + Math.exp(-k * (x - x0)));
  const logit = (y: number): number => x0 + (1 / k) * Math.log(y / (1 - y));

  return {
    f: sigmoid,
    df: (x: number): number => {
      const s = sigmoid(x);
      return k * s * (1 - s);
    },
    fInv: logit,
    dfInv: (y: number): number => 1 / (k * y * (1 - y))
  };
}

/**
 * Creates a logit transformation: y = x0 + (1/k) * log(x / (1-x))
 * Inverse of sigmoid - maps (0,1) to R
 * @param k - steepness parameter (k > 0)
 * @param x0 - horizontal shift (center point)
 */
export function createLogitTransformation(k: number, x0: number): Transformation {
  const logit = (p: number): number => x0 + (1 / k) * Math.log(p / (1 - p));
  const sigmoid = (x: number): number => 1 / (1 + Math.exp(-k * (x - x0)));

  return {
    f: logit,
    df: (p: number): number => 1 / (k * p * (1 - p)),
    fInv: sigmoid,
    dfInv: (x: number): number => {
      const s = sigmoid(x);
      return k * s * (1 - s);
    }
  };
}

/**
 * Composes multiple transformations into a single transformation.
 * The transformations are applied in order: f_n ∘ ... ∘ f_1 ∘ f_0
 */
export function composeTransformations(transforms: Transformation[]): Transformation {
  return {
    f: (x: number): number => {
      let result = x;
      for (const transform of transforms) {
        result = transform.f(result);
      }
      return result;
    },

    df: (x: number): number => {
      let result = x;
      let derivative = 1;
      for (const transform of transforms) {
        derivative *= transform.df(result);
        result = transform.f(result);
      }
      return derivative;
    },

    fInv: (y: number): number => {
      let result = y;
      for (let i = transforms.length - 1; i >= 0; i--) {
        result = transforms[i].fInv(result);
      }
      return result;
    },

    dfInv: (y: number): number => {
      let result = y;
      let derivative = 1;
      for (let i = transforms.length - 1; i >= 0; i--) {
        derivative *= transforms[i].dfInv(result);
        result = transforms[i].fInv(result);
      }
      return derivative;
    }
  };
}
