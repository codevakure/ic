import triggerExecutionSchema from '~/schema/triggerExecution';
import type { ITriggerExecution } from '~/types';

/**
 * Creates or returns the TriggerExecution model using the provided mongoose instance and schema
 * 
 * TriggerExecution stores execution history for scheduled triggers.
 * Each document represents a single execution of a scheduled agent trigger.
 */
export function createTriggerExecutionModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.TriggerExecution || mongoose.model<ITriggerExecution>('TriggerExecution', triggerExecutionSchema);
}
