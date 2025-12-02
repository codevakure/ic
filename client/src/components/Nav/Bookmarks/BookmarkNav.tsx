import { useMemo } from 'react';
import type { FC } from 'react';
import { TooltipAnchor } from '@ranger/client';
import { Menu, MenuButton, MenuItems } from '@headlessui/react';
import { BookmarkFilledIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { BookmarkContext } from '~/Providers/BookmarkContext';
import { useGetConversationTags } from '~/data-provider';
import BookmarkNavItems from './BookmarkNavItems';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type BookmarkNavProps = {
  tags: string[];
  setTags: (tags: string[]) => void;
  isSmallScreen: boolean;
};

const BookmarkNav: FC<BookmarkNavProps> = ({ tags, setTags, isSmallScreen }: BookmarkNavProps) => {
  const localize = useLocalize();
  const { data } = useGetConversationTags();
  const label = useMemo(
    () => (tags.length > 0 ? tags.join(', ') : localize('com_ui_bookmarks')),
    [tags, localize],
  );

  return (
    <Menu as="div" className="relative">
      {({ open }) => (
        <>
          <TooltipAnchor
            description={label}
            render={
              <MenuButton
                id="bookmark-menu-button"
                aria-label={localize('com_ui_bookmarks')}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg p-2 text-text-primary transition-colors duration-200 hover:bg-surface-hover',
                  isSmallScreen ? 'h-14 w-14 rounded-xl' : '',
                  open ? 'bg-surface-hover' : '',
                )}
                data-testid="bookmark-menu"
              >
                {tags.length > 0 ? (
                  <BookmarkFilledIcon className="h-4 w-4 text-text-primary" aria-hidden="true" />
                ) : (
                  <BookmarkIcon className="h-4 w-4 text-text-primary" aria-hidden="true" />
                )}
              </MenuButton>
            }
          />
          <MenuItems
            anchor="bottom"
            className="absolute left-0 top-full z-[100] mt-1 w-60 translate-y-0 overflow-hidden rounded-lg bg-surface-secondary p-1.5 shadow-lg outline-none"
          >
            {data && (
              <BookmarkContext.Provider value={{ bookmarks: data.filter((tag) => tag.count > 0) }}>
                <BookmarkNavItems
                  // List of selected tags(string)
                  tags={tags}
                  // When a user selects a tag, this `setTags` function is called to refetch the list of conversations for the selected tag
                  setTags={setTags}
                />
              </BookmarkContext.Provider>
            )}
          </MenuItems>
        </>
      )}
    </Menu>
  );
};

export default BookmarkNav;
