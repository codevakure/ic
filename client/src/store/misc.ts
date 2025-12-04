import { atom, selectorFamily } from 'recoil';
import { TAttachment } from 'ranger-data-provider';
import { atomWithLocalStorage } from './utils';
import { BadgeItem } from '~/common';

const hideBannerHint = atomWithLocalStorage('hideBannerHint', [] as string[]);

const messageAttachmentsMap = atom<Record<string, TAttachment[] | undefined>>({
  key: 'messageAttachmentsMap',
  default: {},
});

/**
 * Selector to get attachments for a specific conversation.
 */
const conversationAttachmentsSelector = selectorFamily<
  Record<string, TAttachment[]>,
  string | undefined
>({
  key: 'conversationAttachments',
  get:
    (conversationId) =>
    ({ get }) => {
      if (!conversationId) {
        return {};
      }

      const attachmentsMap = get(messageAttachmentsMap);
      const result: Record<string, TAttachment[]> = {};

      // Filter to only include attachments for this conversation
      Object.entries(attachmentsMap).forEach(([messageId, attachments]) => {
        if (!attachments) {
          return;
        }

        const relevantAttachments = attachments.filter(
          (attachment) => attachment.conversationId === conversationId,
        );

        if (relevantAttachments.length > 0) {
          result[messageId] = relevantAttachments;
        }
      });

      return result;
    },
});

const queriesEnabled = atom<boolean>({
  key: 'queriesEnabled',
  default: true,
});

const isEditingBadges = atom<boolean>({
  key: 'isEditingBadges',
  default: false,
});

const chatBadges = atomWithLocalStorage<Pick<BadgeItem, 'id'>[]>('chatBadges', [
  // When adding new badges, make sure to add them to useChatBadges.ts as well and add them as last item
  // DO NOT CHANGE THE ORDER OF THE BADGES ALREADY IN THE ARRAY
  { id: '1' },
  // { id: '2' },
]);

/**
 * State for the sources side panel
 */
export type SourcesPanelMode = 'push' | 'overlay';

export interface SourcesPanelState {
  isOpen: boolean;
  title: string;
  content: React.ReactNode | null;
  mode: SourcesPanelMode;
  headerActions?: React.ReactNode | null;
  /** Panel width as percentage (0-100). Default: 30 for push mode, ignored for overlay */
  width?: number;
}

const sourcesPanelState = atom<SourcesPanelState>({
  key: 'sourcesPanelState',
  default: {
    isOpen: false,
    title: '',
    content: null,
    mode: 'overlay',
    headerActions: null,
    width: 30,
  },
});

export default {
  hideBannerHint,
  messageAttachmentsMap,
  conversationAttachmentsSelector,
  queriesEnabled,
  isEditingBadges,
  chatBadges,
  sourcesPanelState,
};
