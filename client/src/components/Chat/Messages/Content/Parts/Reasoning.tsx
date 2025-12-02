import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import type { MouseEvent } from 'react';
import { ContentTypes } from 'ranger-data-provider';
import { ThinkingContent, ThinkingButton } from './Thinking';
import { showReasoningAtom } from '~/store/showReasoning';
import { showThinkingAtom } from '~/store/showThinking';
import { useMessageContext } from '~/Providers';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type ReasoningProps = {
  reasoning: string;
  isLast: boolean;
};

/**
 * Reasoning Component (MODERN SYSTEM)
 *
 * Used for structured content parts with ContentTypes.THINK type.
 * This handles modern message format where content is an array of typed parts.
 *
 * Behavior controlled by two settings:
 * 1. showReasoning (Show Reasoning setting):
 *    - OFF (default): Shows "Thinking" shimmer while processing, hides completely when done
 *    - ON: Shows the reasoning component after completion
 *
 * 2. showThinking (Open Thinking Dropdowns by Default):
 *    - Only applies when showReasoning is ON
 *    - Controls whether reasoning content is expanded or collapsed
 */
const Reasoning = memo(({ reasoning, isLast }: ReasoningProps) => {
  const localize = useLocalize();
  const showReasoning = useAtomValue(showReasoningAtom);
  const showThinking = useAtomValue(showThinkingAtom);
  const { isSubmitting, isLatestMessage, nextType } = useMessageContext();

  // Determine if currently thinking (streaming reasoning for this message)
  const isThinking = isLatestMessage && isSubmitting && isLast;

  // Expanded state - controlled by showThinking setting when showReasoning is on
  const [isExpanded, setIsExpanded] = useState(showThinking);

  // Update expanded state when showThinking setting changes
  useEffect(() => {
    setIsExpanded(showThinking);
  }, [showThinking]);

  // Strip <think> tags from the reasoning content (modern format)
  const reasoningText = useMemo(() => {
    return reasoning
      .replace(/^<think>\s*/, '')
      .replace(/\s*<\/think>$/, '')
      .trim();
  }, [reasoning]);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsExpanded((prev) => !prev);
  }, []);

  const label = useMemo(
    () => (isThinking ? localize('com_ui_thinking') : localize('com_ui_thoughts')),
    [isThinking, localize],
  );

  if (!reasoningText) {
    return null;
  }

  // Hide completely when not thinking AND showReasoning setting is OFF
  if (!isThinking && !showReasoning) {
    return null;
  }

  return (
    <div className={cn("group/reasoning", isThinking && "mt-1")}>
      <div className="group/thinking-container">
        <div className="sticky top-0 z-10 bg-presentation pb-2">
          <ThinkingButton
            isExpanded={isExpanded}
            onClick={handleClick}
            label={label}
            content={reasoningText}
            isThinking={isThinking}
          />
        </div>
        {/* Shimmer animation when thinking */}
        {isThinking && (
          <div className="mt-2 space-y-2">
            <div className="animate-pulse">
              <div className="h-3 bg-gray-300 rounded-md w-3/4 mb-2 shimmer"></div>
              <div className="h-3 bg-gray-300 rounded-md w-1/2 mb-2 shimmer"></div>
              <div className="h-3 bg-gray-300 rounded-md w-5/6 shimmer"></div>
            </div>
          </div>
        )}
        {/* Accordion content - only show when not thinking */}
        {!isThinking && (
          <div
            className={cn(
              'grid transition-all duration-300 ease-out',
              nextType !== ContentTypes.THINK && isExpanded && 'mb-4',
            )}
            style={{
              gridTemplateRows: isExpanded ? '1fr' : '0fr',
            }}
          >
            <div className="overflow-hidden text-base">
              <ThinkingContent>{reasoningText}</ThinkingContent>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default Reasoning;
