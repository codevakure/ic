import React, { useState, useRef } from 'react';
import { useOnClickOutside } from '@ranger/client';
import ImportConversations from './ImportConversations';
import { RevokeKeys } from './RevokeKeys';
import { DeleteCache } from './DeleteCache';
import { ClearChats } from './ClearChats';

/**
 * Data Controls Tab - Admin Only
 * Contains import, revoke keys, delete cache, and clear chats options.
 * Shared Links has been moved to a separate tab.
 */
function Data() {
  const dataTabRef = useRef(null);
  const [confirmClearConvos, setConfirmClearConvos] = useState(false);
  useOnClickOutside(dataTabRef, () => confirmClearConvos && setConfirmClearConvos(false), []);

  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="pb-3">
        <ImportConversations />
      </div>
      <div className="pb-3">
        <RevokeKeys />
      </div>
      <div className="pb-3">
        <DeleteCache />
      </div>
      <div className="pb-3">
        <ClearChats />
      </div>
    </div>
  );
}

export default React.memo(Data);
