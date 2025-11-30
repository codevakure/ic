import React, { forwardRef, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { useRecoilState } from 'recoil';
import { Search, X } from 'lucide-react';
import { QueryKeys, PermissionTypes, Permissions } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookmarkFilledIcon, BookmarkIcon } from '@radix-ui/react-icons';
import { TooltipAnchor } from '@librechat/client';
import { Menu, MenuButton, MenuItems } from '@headlessui/react';
import { useLocalize, useNewConvo, useHasAccess } from '~/hooks';
import { useGetConversationTags } from '~/data-provider';
import { BookmarkContext } from '~/Providers/BookmarkContext';
import BookmarkNavItems from './Bookmarks/BookmarkNavItems';
import { cn } from '~/utils';
import store from '~/store';

type SearchBarProps = {
  isSmallScreen?: boolean;
  tags?: string[];
  setTags?: (tags: string[]) => void;
};

const SearchBar = forwardRef((props: SearchBarProps, ref: React.Ref<HTMLDivElement>) => {
  const localize = useLocalize();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isSmallScreen, tags = [], setTags } = props;

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const { data: bookmarkData } = useGetConversationTags();

  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [showClearIcon, setShowClearIcon] = useState(false);

  const { newConversation: newConvo } = useNewConvo();
  const [search, setSearchState] = useRecoilState(store.search);

  const bookmarkLabel = useMemo(
    () => (tags.length > 0 ? tags.join(', ') : localize('com_ui_bookmarks')),
    [tags, localize],
  );

  const clearSearch = useCallback(
    (pathname?: string) => {
      if (pathname?.includes('/search') || pathname === '/c/new') {
        queryClient.removeQueries([QueryKeys.messages]);
        newConvo({ disableFocus: true });
        navigate('/c/new');
      }
    },
    [newConvo, navigate, queryClient],
  );

  const clearText = useCallback(
    (pathname?: string) => {
      setShowClearIcon(false);
      setText('');
      setSearchState((prev) => ({
        ...prev,
        query: '',
        debouncedQuery: '',
        isTyping: false,
      }));
      clearSearch(pathname);
      inputRef.current?.focus();
    },
    [setSearchState, clearSearch],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const { value } = e.target as HTMLInputElement;
      if (e.key === 'Backspace' && value === '') {
        clearText(location.pathname);
      }
    },
    [clearText, location.pathname],
  );

  const sendRequest = useCallback(
    (value: string) => {
      if (!value) {
        return;
      }
      queryClient.invalidateQueries([QueryKeys.messages]);
    },
    [queryClient],
  );

  const debouncedSetDebouncedQuery = useMemo(
    () =>
      debounce((value: string) => {
        setSearchState((prev) => ({ ...prev, debouncedQuery: value, isTyping: false }));
        sendRequest(value);
      }, 500),
    [setSearchState, sendRequest],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setShowClearIcon(value.length > 0);
    setText(value);
    setSearchState((prev) => ({
      ...prev,
      query: value,
      isTyping: true,
    }));
    debouncedSetDebouncedQuery(value);
    if (value.length > 0 && location.pathname !== '/search') {
      navigate('/search', { replace: true });
    }
  };

  // Automatically set isTyping to false when loading is done and debouncedQuery matches query
  // (prevents stuck loading state if input is still focused)
  useEffect(() => {
    if (search.isTyping && !search.isSearching && search.debouncedQuery === search.query) {
      setSearchState((prev) => ({ ...prev, isTyping: false }));
    }
  }, [search.isTyping, search.isSearching, search.debouncedQuery, search.query, setSearchState]);

  return (
    <div className={cn('space-y-1', isSmallScreen === true ? 'mb-1' : 'mt-1')}>
      {/* Search Bar Row */}
      <div className="flex items-center gap-2">
        {/* Search Bar */}
        <div
          ref={ref}
          className={cn(
            'group relative flex h-10 flex-1 cursor-pointer items-center gap-3 rounded-lg border-border-medium px-3 py-2 text-text-primary transition-colors duration-200 focus-within:bg-surface-hover hover:bg-surface-hover',
            isSmallScreen === true ? 'h-14 rounded-xl' : '',
          )}
        >
          <Search className="absolute left-3 h-4 w-4 text-text-secondary group-focus-within:text-text-primary group-hover:text-text-primary" />
          <input
            type="text"
            ref={inputRef}
            className="m-0 mr-0 w-full border-none bg-transparent p-0 pl-7 text-sm leading-tight placeholder-text-secondary placeholder-opacity-100 focus-visible:outline-none group-focus-within:placeholder-text-primary group-hover:placeholder-text-primary"
            value={text}
            onChange={onChange}
            onKeyDown={(e) => {
              e.code === 'Space' ? e.stopPropagation() : null;
            }}
            aria-label={localize('com_nav_search_placeholder')}
            placeholder={localize('com_nav_search_placeholder')}
            onKeyUp={handleKeyUp}
            onFocus={() => setSearchState((prev) => ({ ...prev, isSearching: true }))}
            onBlur={() => setSearchState((prev) => ({ ...prev, isSearching: false }))}
            autoComplete="off"
            dir="auto"
          />
          <button
            type="button"
            aria-label={`${localize('com_ui_clear')} ${localize('com_ui_search')}`}
            className={cn(
              'absolute right-[7px] flex h-5 w-5 items-center justify-center rounded-full border-none bg-transparent p-0 transition-opacity duration-200',
              showClearIcon ? 'opacity-100' : 'opacity-0',
              isSmallScreen === true ? 'right-[16px]' : '',
            )}
            onClick={() => clearText(location.pathname)}
            tabIndex={showClearIcon ? 0 : -1}
            disabled={!showClearIcon}
          >
            <X className="h-5 w-5 cursor-pointer" />
          </button>
        </div>

        {/* Bookmark Icon */}
        {hasAccessToBookmarks && setTags && (
          <Menu as="div" className="relative">
            {({ open }) => (
              <>
                <TooltipAnchor
                  description={bookmarkLabel}
                  render={
                    <MenuButton
                      id="bookmark-menu-button"
                      aria-label={localize('com_ui_bookmarks')}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg p-2 text-text-primary transition-colors duration-200 hover:bg-surface-hover',
                        isSmallScreen === true ? 'h-14 w-14 rounded-xl' : '',
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
                  {bookmarkData && (
                    <BookmarkContext.Provider value={{ bookmarks: bookmarkData.filter((tag) => tag.count > 0) }}>
                      <BookmarkNavItems
                        tags={tags}
                        setTags={setTags}
                      />
                    </BookmarkContext.Provider>
                  )}
                </MenuItems>
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  );
});

export default SearchBar;
