/**
 * Agent Schedule Data Provider
 *
 * React Query hooks for managing agent schedules.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from 'ranger-data-provider';
import type { UseQueryOptions, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type {
  AgentSchedule,
  ScheduleListResponse,
  ScheduleExecutionListResponse,
  CreateScheduleParams,
  UpdateScheduleParams,
} from 'ranger-data-provider';

/** Query key prefix for schedules */
const SCHEDULE_KEYS = {
  all: ['schedules'] as const,
  byAgent: (agentId: string) => [...SCHEDULE_KEYS.all, agentId] as const,
  single: (agentId: string, scheduleId: string) =>
    [...SCHEDULE_KEYS.byAgent(agentId), scheduleId] as const,
  executions: (agentId: string, scheduleId: string) =>
    [...SCHEDULE_KEYS.single(agentId, scheduleId), 'executions'] as const,
};

/**
 * Hook for fetching all schedules for an agent
 */
export const useAgentSchedulesQuery = (
  agentId: string,
  options?: UseQueryOptions<ScheduleListResponse, Error, ScheduleListResponse>,
) => {
  return useQuery<ScheduleListResponse, Error>(
    SCHEDULE_KEYS.byAgent(agentId),
    () => dataService.getAgentSchedules({ agentId }),
    {
      enabled: !!agentId,
      refetchOnWindowFocus: false,
      ...options,
    },
  );
};

/**
 * Hook for fetching a single schedule
 */
export const useAgentScheduleQuery = (
  agentId: string,
  scheduleId: string,
  options?: UseQueryOptions<AgentSchedule, Error, AgentSchedule>,
) => {
  return useQuery<AgentSchedule, Error>(
    SCHEDULE_KEYS.single(agentId, scheduleId),
    () => dataService.getAgentSchedule({ agentId, scheduleId }),
    {
      enabled: !!agentId && !!scheduleId,
      refetchOnWindowFocus: false,
      ...options,
    },
  );
};

/**
 * Hook for fetching schedule execution history
 */
export const useScheduleExecutionsQuery = (
  agentId: string,
  scheduleId: string,
  options?: {
    limit?: number;
    skip?: number;
  } & UseQueryOptions<ScheduleExecutionListResponse, Error, ScheduleExecutionListResponse>,
) => {
  const { limit = 50, skip = 0, ...queryOptions } = options || {};

  return useQuery<ScheduleExecutionListResponse, Error>(
    SCHEDULE_KEYS.executions(agentId, scheduleId),
    () => dataService.getScheduleExecutions({ agentId, scheduleId, limit, skip }),
    {
      enabled: !!agentId && !!scheduleId,
      refetchOnWindowFocus: false,
      ...queryOptions,
    },
  );
};

/**
 * Hook for creating a new schedule
 */
export const useCreateScheduleMutation = (
  options?: UseMutationOptions<
    AgentSchedule,
    Error,
    { agentId: string; data: CreateScheduleParams }
  >,
): UseMutationResult<AgentSchedule, Error, { agentId: string; data: CreateScheduleParams }> => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ agentId, data }) => dataService.createAgentSchedule({ agentId, data }),
    {
      onSuccess: (schedule, variables) => {
        // Invalidate the schedules list for this agent
        queryClient.invalidateQueries(SCHEDULE_KEYS.byAgent(variables.agentId));
      },
      ...options,
    },
  );
};

/**
 * Hook for updating a schedule
 */
export const useUpdateScheduleMutation = (
  options?: UseMutationOptions<
    AgentSchedule,
    Error,
    { agentId: string; scheduleId: string; data: UpdateScheduleParams }
  >,
): UseMutationResult<
  AgentSchedule,
  Error,
  { agentId: string; scheduleId: string; data: UpdateScheduleParams }
> => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ agentId, scheduleId, data }) =>
      dataService.updateAgentSchedule({ agentId, scheduleId, data }),
    {
      onSuccess: (schedule, variables) => {
        // Update the cache for this schedule
        queryClient.setQueryData(
          SCHEDULE_KEYS.single(variables.agentId, variables.scheduleId),
          schedule,
        );
        // Invalidate the list
        queryClient.invalidateQueries(SCHEDULE_KEYS.byAgent(variables.agentId));
      },
      ...options,
    },
  );
};

/**
 * Hook for deleting a schedule
 */
export const useDeleteScheduleMutation = (
  options?: UseMutationOptions<
    { success: boolean },
    Error,
    { agentId: string; scheduleId: string }
  >,
): UseMutationResult<{ success: boolean }, Error, { agentId: string; scheduleId: string }> => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ agentId, scheduleId }) => dataService.deleteAgentSchedule({ agentId, scheduleId }),
    {
      onSuccess: (_result, variables) => {
        // Remove from cache
        queryClient.removeQueries(SCHEDULE_KEYS.single(variables.agentId, variables.scheduleId));
        // Invalidate the list
        queryClient.invalidateQueries(SCHEDULE_KEYS.byAgent(variables.agentId));
      },
      ...options,
    },
  );
};

/**
 * Hook for toggling schedule enabled state
 */
export const useToggleScheduleMutation = (
  options?: UseMutationOptions<
    AgentSchedule,
    Error,
    { agentId: string; scheduleId: string; enabled: boolean }
  >,
): UseMutationResult<
  AgentSchedule,
  Error,
  { agentId: string; scheduleId: string; enabled: boolean }
> => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ agentId, scheduleId, enabled }) =>
      dataService.updateAgentSchedule({ agentId, scheduleId, data: { enabled } }),
    {
      onSuccess: (schedule, variables) => {
        // Update the cache
        queryClient.setQueryData(
          SCHEDULE_KEYS.single(variables.agentId, variables.scheduleId),
          schedule,
        );
        queryClient.invalidateQueries(SCHEDULE_KEYS.byAgent(variables.agentId));
      },
      ...options,
    },
  );
};
