import type { NormalizingFlow } from './model';
import type { Tensor2D } from './tf-types';

export type TrainingState = 'not_started' | 'training' | 'paused' | 'completed';

/**
 * Page-wide state object
 */
export interface PageState {
  numLayers: number;
  numEpochs: number;
  trainData: Tensor2D | null;
  model: NormalizingFlow | null;
  trainingState: TrainingState;
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
 * Interface for widgets that need training configuration
 */
export interface TrainingConfigState {
  numLayers: number;
  numEpochs: number;
}

/**
 * Create initial page state
 */
export function createPageState(numLayers = 8, numEpochs = 100): PageState {
  return {
    numLayers,
    numEpochs,
    trainData: null,
    model: null,
    trainingState: 'not_started'
  };
}
