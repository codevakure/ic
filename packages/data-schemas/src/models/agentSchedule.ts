import agentScheduleSchema from '~/schema/agentSchedule';
import type { IAgentSchedule } from '~/types';

/**
 * Creates or returns the AgentSchedule model using the provided mongoose instance and schema
 * 
 * AgentSchedule stores scheduled trigger configurations for agents.
 * Each schedule defines when and how an agent should be automatically triggered.
 */
export function createAgentScheduleModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.AgentSchedule || mongoose.model<IAgentSchedule>('AgentSchedule', agentScheduleSchema);
}
