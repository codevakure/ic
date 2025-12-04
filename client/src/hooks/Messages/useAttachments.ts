import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import type { TAttachment } from 'librechat-data-provider';
import { useSearchResultsByTurn } from './useSearchResultsByTurn';
import store from '~/store';

export default function useAttachments({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments?: TAttachment[];
}) {
  const messageAttachmentsMap = useRecoilValue(store.messageAttachmentsMap);
  const messageAttachments = useMemo(() => {
    const propsAttachments = attachments ?? [];
    const mapAttachments = messageAttachmentsMap[messageId ?? ''] ?? [];

    // Prefer whichever source has more data to handle the case where
    // streaming attachments are in messageAttachmentsMap but final message
    // may have empty or partial attachments array
    if (propsAttachments.length >= mapAttachments.length) {
      return propsAttachments;
    }
    return mapAttachments;
  }, [attachments, messageAttachmentsMap, messageId]);

  const searchResults = useSearchResultsByTurn(messageAttachments);

  return {
    attachments: messageAttachments,
    searchResults,
  };
}
