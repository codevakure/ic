/**
 * useAdminMetrics Hook
 * 
 * Custom hook for fetching and caching admin metrics.
 * Uses Recoil store to cache data and avoid redundant API calls.
 * Fetches summary (fast) and details (slower) separately for progressive loading.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { dashboardApi } from '../services/adminApi';
import {
  agentsSummaryAtom,
  agentsDetailsAtom,
  toolsSummaryAtom,
  toolsDetailsAtom,
  guardrailsSummaryAtom,
  guardrailsDetailsAtom,
  isCacheValid,
  type CachedMetrics,
} from '../store/adminStore';

interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Hook for Agent metrics with caching
 */
export function useAgentMetrics(dateRange: DateRange) {
  const [summary, setSummary] = useRecoilState(agentsSummaryAtom);
  const [details, setDetails] = useRecoilState(agentsDetailsAtom);
  
  // Create stable date key to prevent re-renders when object reference changes but values are same
  const dateKey = `${dateRange.startDate}_${dateRange.endDate}`;
  
  // Use refs to avoid stale closure issues while preventing infinite loops
  const summaryRef = useRef(summary);
  const detailsRef = useRef(details);
  const dateRangeRef = useRef(dateRange);
  summaryRef.current = summary;
  detailsRef.current = details;
  dateRangeRef.current = dateRange;

  const fetchSummary = useCallback(async () => {
    // Check cache first using ref to get current value
    if (isCacheValid(summaryRef.current.fetchedAt, summaryRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setSummary(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getAgentSummary(dateRangeRef.current);
      setSummary({
        data: data.summary,
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setSummary(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agent summary',
      }));
    }
  }, [dateKey, setSummary]);

  const fetchDetails = useCallback(async () => {
    // Check cache first using ref to get current value
    if (isCacheValid(detailsRef.current.fetchedAt, detailsRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setDetails(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getAgentMetrics(dateRangeRef.current);
      setDetails({
        data: { agents: data.agents },
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setDetails(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch agent details',
      }));
    }
  }, [dateKey, setDetails]);

  const refetch = useCallback(() => {
    // Force refresh by clearing cache
    setSummary(prev => ({ ...prev, fetchedAt: null }));
    setDetails(prev => ({ ...prev, fetchedAt: null }));
  }, [setSummary, setDetails]);

  // Auto-fetch on mount and date change
  useEffect(() => {
    fetchSummary();
    fetchDetails();
  }, [fetchSummary, fetchDetails]);

  return {
    summary: summary.data,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,
    agents: details.data?.agents || [],
    detailsLoading: details.isLoading,
    detailsError: details.error,
    refetch,
  };
}

/**
 * Hook for Tool metrics with caching
 */
export function useToolMetrics(dateRange: DateRange) {
  const [summary, setSummary] = useRecoilState(toolsSummaryAtom);
  const [details, setDetails] = useRecoilState(toolsDetailsAtom);
  
  // Create stable date key to prevent re-renders when object reference changes but values are same
  const dateKey = `${dateRange.startDate}_${dateRange.endDate}`;
  
  // Use refs to avoid stale closure issues while preventing infinite loops
  const summaryRef = useRef(summary);
  const detailsRef = useRef(details);
  const dateRangeRef = useRef(dateRange);
  summaryRef.current = summary;
  detailsRef.current = details;
  dateRangeRef.current = dateRange;

  const fetchSummary = useCallback(async () => {
    if (isCacheValid(summaryRef.current.fetchedAt, summaryRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setSummary(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getToolSummary(dateRangeRef.current);
      setSummary({
        data: data.summary,
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setSummary(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tool summary',
      }));
    }
  }, [dateKey, setSummary]);

  const fetchDetails = useCallback(async () => {
    if (isCacheValid(detailsRef.current.fetchedAt, detailsRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setDetails(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getToolMetrics(dateRangeRef.current);
      setDetails({
        data: { tools: data.tools, trend: data.trend },
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setDetails(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tool details',
      }));
    }
  }, [dateKey, setDetails]);

  const refetch = useCallback(() => {
    setSummary(prev => ({ ...prev, fetchedAt: null }));
    setDetails(prev => ({ ...prev, fetchedAt: null }));
  }, [setSummary, setDetails]);

  useEffect(() => {
    fetchSummary();
    fetchDetails();
  }, [fetchSummary, fetchDetails]);

  return {
    summary: summary.data,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,
    tools: details.data?.tools || [],
    trend: details.data?.trend || [],
    detailsLoading: details.isLoading,
    detailsError: details.error,
    refetch,
  };
}

/**
 * Hook for Guardrails metrics with caching
 */
export function useGuardrailsMetrics(dateRange: DateRange) {
  const [summary, setSummary] = useRecoilState(guardrailsSummaryAtom);
  const [details, setDetails] = useRecoilState(guardrailsDetailsAtom);
  
  // Create stable date key to prevent re-renders when object reference changes but values are same
  const dateKey = `${dateRange.startDate}_${dateRange.endDate}`;
  
  // Use refs to avoid stale closure issues while preventing infinite loops
  const summaryRef = useRef(summary);
  const detailsRef = useRef(details);
  const dateRangeRef = useRef(dateRange);
  summaryRef.current = summary;
  detailsRef.current = details;
  dateRangeRef.current = dateRange;

  const fetchSummary = useCallback(async () => {
    if (isCacheValid(summaryRef.current.fetchedAt, summaryRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setSummary(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getGuardrailsSummary(dateRangeRef.current);
      setSummary({
        data: data.summary,
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setSummary(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch guardrails summary',
      }));
    }
  }, [dateKey, setSummary]);

  const fetchDetails = useCallback(async () => {
    if (isCacheValid(detailsRef.current.fetchedAt, detailsRef.current.dateRange, dateRangeRef.current)) {
      return;
    }

    setDetails(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await dashboardApi.getGuardrailsMetrics(dateRangeRef.current);
      setDetails({
        data: {
          violations: data.violations,
          violationBreakdown: data.violationBreakdown || [],
          trend: data.trend,
        },
        dateRange: dateRangeRef.current,
        fetchedAt: Date.now(),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setDetails(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch guardrails details',
      }));
    }
  }, [dateKey, setDetails]);

  const refetch = useCallback(() => {
    setSummary(prev => ({ ...prev, fetchedAt: null }));
    setDetails(prev => ({ ...prev, fetchedAt: null }));
  }, [setSummary, setDetails]);

  useEffect(() => {
    fetchSummary();
    fetchDetails();
  }, [fetchSummary, fetchDetails]);

  return {
    summary: summary.data,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,
    violations: details.data?.violations || [],
    violationBreakdown: details.data?.violationBreakdown || [],
    trend: details.data?.trend || [],
    detailsLoading: details.isLoading,
    detailsError: details.error,
    refetch,
  };
}

/**
 * Hook for fetching all summaries at once (for Dashboard)
 * Fetches all three summaries in parallel for fast initial display
 */
export function useAllSummaries(dateRange: DateRange) {
  const [agentsSummary, setAgentsSummary] = useRecoilState(agentsSummaryAtom);
  const [toolsSummary, setToolsSummary] = useRecoilState(toolsSummaryAtom);
  const [guardrailsSummary, setGuardrailsSummary] = useRecoilState(guardrailsSummaryAtom);
  
  // Create a stable string key for the date range to use as dependency
  const dateKey = `${dateRange.startDate}_${dateRange.endDate}`;
  
  // Use refs to avoid stale closure issues while preventing infinite loops
  const agentsRef = useRef(agentsSummary);
  const toolsRef = useRef(toolsSummary);
  const guardrailsRef = useRef(guardrailsSummary);
  const dateRangeRef = useRef(dateRange);
  agentsRef.current = agentsSummary;
  toolsRef.current = toolsSummary;
  guardrailsRef.current = guardrailsSummary;
  dateRangeRef.current = dateRange;

  const fetchAll = useCallback(async () => {
    const promises: Promise<void>[] = [];

    // Fetch agents summary if not cached
    if (!isCacheValid(agentsRef.current.fetchedAt, agentsRef.current.dateRange, dateRangeRef.current)) {
      setAgentsSummary(prev => ({ ...prev, isLoading: true }));
      promises.push(
        dashboardApi.getAgentSummary(dateRangeRef.current)
          .then(data => {
            setAgentsSummary({
              data: data.summary,
              dateRange: dateRangeRef.current,
              fetchedAt: Date.now(),
              isLoading: false,
              error: null,
            });
          })
          .catch(error => {
            setAgentsSummary(prev => ({
              ...prev,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed',
            }));
          })
      );
    }

    // Fetch tools summary if not cached
    if (!isCacheValid(toolsRef.current.fetchedAt, toolsRef.current.dateRange, dateRangeRef.current)) {
      setToolsSummary(prev => ({ ...prev, isLoading: true }));
      promises.push(
        dashboardApi.getToolSummary(dateRangeRef.current)
          .then(data => {
            setToolsSummary({
              data: data.summary,
              dateRange: dateRangeRef.current,
              fetchedAt: Date.now(),
              isLoading: false,
              error: null,
            });
          })
          .catch(error => {
            setToolsSummary(prev => ({
              ...prev,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed',
            }));
          })
      );
    }

    // Fetch guardrails summary if not cached
    if (!isCacheValid(guardrailsRef.current.fetchedAt, guardrailsRef.current.dateRange, dateRangeRef.current)) {
      setGuardrailsSummary(prev => ({ ...prev, isLoading: true }));
      promises.push(
        dashboardApi.getGuardrailsSummary(dateRangeRef.current)
          .then(data => {
            setGuardrailsSummary({
              data: data.summary,
              dateRange: dateRangeRef.current,
              fetchedAt: Date.now(),
              isLoading: false,
              error: null,
            });
          })
          .catch(error => {
            setGuardrailsSummary(prev => ({
              ...prev,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed',
            }));
          })
      );
    }

    await Promise.allSettled(promises);
  }, [
    dateKey,
    setAgentsSummary,
    setToolsSummary,
    setGuardrailsSummary,
  ]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    agents: agentsSummary.data,
    agentsLoading: agentsSummary.isLoading,
    tools: toolsSummary.data,
    toolsLoading: toolsSummary.isLoading,
    guardrails: guardrailsSummary.data,
    guardrailsLoading: guardrailsSummary.isLoading,
    allLoaded: !agentsSummary.isLoading && !toolsSummary.isLoading && !guardrailsSummary.isLoading,
    refetch: fetchAll,
  };
}
