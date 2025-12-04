/**
 * Agent Execution Data Provider
 *
 * React Query hooks for viewing agent execution history and traces.
 * Used for the Camunda-style tree view visualization.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from 'ranger-data-provider';
import type { UseQueryOptions, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type {
  ExecutionListResponse,
  ExecutionSummary,
  ExecutionTraceTree,
  DeleteExecutionsResponse,
} from 'ranger-data-provider';

/** Query key prefix for executions */
export const EXECUTION_KEYS = {
  all: ['executions'] as const,
  byAgent: (agentId: string) => [...EXECUTION_KEYS.all, agentId] as const,
  single: (agentId: string, executionId: string) =>
    [...EXECUTION_KEYS.byAgent(agentId), executionId] as const,
  trace: (agentId: string, executionId: string) =>
    [...EXECUTION_KEYS.single(agentId, executionId), 'trace'] as const,
};

/**
 * Hook for fetching execution history for an agent
 */
export const useAgentExecutionsQuery = (
  agentId: string,
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
    scheduleId?: string;
  } & Omit<UseQueryOptions<ExecutionListResponse, Error, ExecutionListResponse>, 'queryKey' | 'queryFn'>,
) => {
  const { limit = 20, offset = 0, status, scheduleId, ...queryOptions } = options || {};

  return useQuery<ExecutionListResponse, Error>({
    queryKey: [...EXECUTION_KEYS.byAgent(agentId), { limit, offset, status, scheduleId }],
    queryFn: () => dataService.getAgentExecutions({ agentId, limit, offset, status, scheduleId }),
    enabled: !!agentId,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};

/**
 * Hook for fetching a single execution summary
 */
export const useAgentExecutionQuery = (
  agentId: string,
  executionId: string,
  options?: Omit<UseQueryOptions<ExecutionSummary, Error, ExecutionSummary>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery<ExecutionSummary, Error>({
    queryKey: EXECUTION_KEYS.single(agentId, executionId),
    queryFn: () => dataService.getAgentExecution({ agentId, executionId }),
    enabled: !!agentId && !!executionId,
    refetchOnWindowFocus: false,
    ...options,
  });
};

/**
 * Hook for fetching an execution trace tree
 * This is used for the tree view visualization
 */
export const useExecutionTraceQuery = (
  agentId: string,
  executionId: string,
  options?: Omit<UseQueryOptions<ExecutionTraceTree, Error, ExecutionTraceTree>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery<ExecutionTraceTree, Error>({
    queryKey: EXECUTION_KEYS.trace(agentId, executionId),
    queryFn: () => dataService.getExecutionTrace({ agentId, executionId }),
    enabled: !!agentId && !!executionId,
    refetchOnWindowFocus: false,
    ...options,
  });
};

/**
 * Hook for deleting a single execution
 */
export const useDeleteExecutionMutation = (
  options?: UseMutationOptions<
    { success: boolean; deleted: string },
    Error,
    { agentId: string; executionId: string }
  >,
): UseMutationResult<
  { success: boolean; deleted: string },
  Error,
  { agentId: string; executionId: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, executionId }) =>
      dataService.deleteAgentExecution({ agentId, executionId }),
    onSuccess: (_, variables) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: EXECUTION_KEYS.single(variables.agentId, variables.executionId),
      });
      // Invalidate the list
      queryClient.invalidateQueries({
        queryKey: EXECUTION_KEYS.byAgent(variables.agentId),
      });
    },
    ...options,
  });
};

/**
 * Hook for deleting multiple executions
 */
export const useDeleteExecutionsMutation = (
  options?: UseMutationOptions<
    DeleteExecutionsResponse,
    Error,
    { agentId: string; status?: string; scheduleId?: string; olderThan?: string }
  >,
): UseMutationResult<
  DeleteExecutionsResponse,
  Error,
  { agentId: string; status?: string; scheduleId?: string; olderThan?: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, status, scheduleId, olderThan }) =>
      dataService.deleteAgentExecutions({ agentId, status, scheduleId, olderThan }),
    onSuccess: (_, variables) => {
      // Invalidate all executions for this agent
      queryClient.invalidateQueries({
        queryKey: EXECUTION_KEYS.byAgent(variables.agentId),
      });
    },
    ...options,
  });
};
