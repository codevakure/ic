import executionTraceSchema from '~/schema/executionTrace';
import type { IExecutionTrace } from '~/types';

/**
 * Creates or returns the ExecutionTrace model using the provided mongoose instance and schema
 *
 * ExecutionTrace stores step-by-step trace data for scheduled agent executions.
 * Used to build tree view visualizations of what happened during an execution.
 */
export function createExecutionTraceModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.ExecutionTrace || mongoose.model<IExecutionTrace>('ExecutionTrace', executionTraceSchema);
}
