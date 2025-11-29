import { createStorageAtom } from './jotai-utils';

const DEFAULT_SHOW_REASONING = false;

/**
 * This atom controls whether AI reasoning/thinking content is shown after completion.
 * When false (default): Shows "Thinking" shimmer while processing, hides completely when done.
 * When true: Always shows the reasoning content (collapsed or expanded based on showThinking setting).
 */
export const showReasoningAtom = createStorageAtom<boolean>('showReasoning', DEFAULT_SHOW_REASONING);
