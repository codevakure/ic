import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QueryKeys, Constants } from 'ranger-data-provider';
import { TooltipAnchor, NewChatIcon, MobileSidebar, Sidebar, Button } from '@ranger/client';
import type { TMessage } from 'ranger-data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import Logo from './Logo';
import store from '~/store';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  headerButtons,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  const navigate = useNavigate();
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }
      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      newConvo();
      navigate('/c/new', { state: { focusChat: true } });
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, navigate, toggleNav, isSmallScreen],
  );

  return (
    <>
      <div className="flex items-center justify-between py-[2px] md:py-2">
        {/* Left side - Logo aligned to left */}
        <div className="flex items-center">
          <Logo className="ml-3" height={36} />
        </div>
        
        {/* Right side - New Chat and Close buttons */}
        <div className="flex items-center gap-1">
          {headerButtons}
          {/* New Chat Button */}
          <TooltipAnchor
            description={localize('com_ui_new_chat')}
            render={
              <Button
                size="icon"
                variant="ghost"
                data-testid="sidebar-new-chat-button"
                aria-label={localize('com_ui_new_chat')}
                className="border-none bg-transparent p-2 hover:bg-surface-hover"
                onClick={clickHandler}
              >
                <NewChatIcon className="h-4 w-4" />
              </Button>
            }
          />
          {/* Close Sidebar Button */}
          <TooltipAnchor
            description={localize('com_nav_close_sidebar')}
            render={
              <Button
                size="icon"
                variant="outline"
                data-testid="close-sidebar-button"
                aria-label={localize('com_nav_close_sidebar')}
                className="rounded-full border-none bg-transparent p-2 hover:bg-surface-hover md:rounded-xl"
                onClick={toggleNav}
              >
                <Sidebar className="max-md:hidden" />
                <MobileSidebar className="m-1 inline-flex size-10 items-center justify-center md:hidden" />
              </Button>
            }
          />
        </div>
      </div>
      {subHeaders != null ? subHeaders : null}
    </>
  );
}
