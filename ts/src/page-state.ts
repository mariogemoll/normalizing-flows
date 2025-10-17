import type { NormalizingFlow } from './model';
import type { Tensor2D } from './tf-types';

/**
 * Page-wide state object
 */
export interface PageState {
  numLayers: number;
  trainData: Tensor2D | null;
  model: NormalizingFlow | null;
}

/**
 * Interface for widgets that need model access
 */
export interface ModelState {
  model: NormalizingFlow | null;
}

/**
 * Interface for widgets that need training data access
 */
export interface TrainDataState {
  trainData: Tensor2D | null;
}

/**
 * Interface for widgets that need layer configuration
 */
export interface LayerConfigState {
  numLayers: number;
}

/**
 * Create initial page state
 */
export function createPageState(numLayers = 8): PageState {
  return {
    numLayers,
    trainData: null,
    model: null
  };
}
