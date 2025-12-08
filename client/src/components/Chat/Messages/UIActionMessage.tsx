import React, { memo } from 'react';
import { MousePointerClick } from 'lucide-react';
import type { TMessage, TConversation } from 'ranger-data-provider';
import { cn } from '~/utils';
// eslint-disable-next-line import/no-cycle
import MultiMessage from './MultiMessage';

interface UIActionMessageProps {
  message: TMessage;
  conversation?: TConversation | null;
  currentEditId?: string | number | null;
  setCurrentEditId?: React.Dispatch<React.SetStateAction<string | number | null>>;
}

/**
 * Minimal text indicator for UI action messages.
 * Shows a small right-aligned text with the action description.
 */
const UIActionMessage = memo(({ message, conversation, currentEditId, setCurrentEditId }: UIActionMessageProps) => {
  const metadata = message.metadata as {
    isUIAction?: boolean;
    uiActionType?: string;
    uiActionSummary?: string;
  } | undefined;

  if (!metadata?.isUIAction) {
    return null;
  }

  const { children, messageId = null } = message;

  const getActionLabel = () => {
    // Use the summary if available, otherwise use a generic label
    if (metadata.uiActionSummary) {
      return metadata.uiActionSummary;
    }
    return 'Processing...';
  };

  return (
    <>
      {/* Simple right-aligned text indicator */}
      <div className="relative mx-auto flex w-full justify-end p-4 py-2 md:max-w-[47rem] xl:max-w-[55rem]">
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
            'bg-surface-tertiary/40',
            'text-text-tertiary text-xs italic',
          )}
        >
          <MousePointerClick className="h-3 w-3" />
          <span>{getActionLabel()}</span>
        </div>
      </div>
      {/* Render child messages (assistant response) */}
      <MultiMessage
        key={messageId}
        messageId={messageId}
        conversation={conversation}
        messagesTree={children ?? []}
        currentEditId={currentEditId ?? null}
        setCurrentEditId={setCurrentEditId}
      />
    </>
  );
});

UIActionMessage.displayName = 'UIActionMessage';

export default UIActionMessage;
