import { createStorageAtom } from './jotai-utils';

const DEFAULT_HIDE_COMPLETED_TOOL_CALLS = true;

/**
 * This atom controls whether completed tool calls are hidden after processing.
 * When true (default): Shows tool calls while processing, hides completely when done.
 * When false: Always shows tool calls (both in-progress and completed).
 */
export const hideCompletedToolCallsAtom = createStorageAtom<boolean>(
  'hideCompletedToolCalls',
  DEFAULT_HIDE_COMPLETED_TOOL_CALLS,
);
