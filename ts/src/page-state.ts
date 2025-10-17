import type { NormalizingFlow } from './model';
import type { Tensor2D } from './tf-types';

export type TrainingState = 'not_started' | 'training' | 'paused' | 'completed';

/**
 * Pipeline state object
 */
export interface PipelineState {
  numLayers: number;
  numEpochs: number;
  trainData: Tensor2D | null;
  model: NormalizingFlow | null;
  trainingState: TrainingState;
}

// Legacy alias for backwards compatibility
export type PageState = PipelineState;

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
 * Create initial pipeline state
 */
export function createPipelineState(numLayers = 8, numEpochs = 100): PipelineState {
  return {
    numLayers,
    numEpochs,
    trainData: null,
    model: null,
    trainingState: 'not_started'
  };
}

// Legacy alias for backwards compatibility
export const createPageState = createPipelineState;
