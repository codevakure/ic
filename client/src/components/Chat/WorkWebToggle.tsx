/**
 * ============================================================================
 * WorkWebToggle Component - FUTURE FEATURE (Currently Disabled)
 * ============================================================================
 * 
 * This component provides a toggle to switch between "Web" and "Work" modes:
 * - Web Mode: General web search, excludes enterprise/M365 integrations
 * - Work Mode: Includes Microsoft 365 integrations (Outlook, SharePoint, etc.)
 * 
 * CURRENT STATUS: Component exists but is commented out in Header.tsx
 * 
 * TO ENABLE THIS FEATURE:
 * 1. Uncomment the import and JSX in Header.tsx
 * 2. In useMCPServerManager.ts:
 *    - Import: import { useRecoilValue } from 'recoil'; and import store from '~/store';
 *    - Add: const searchMode = useRecoilValue(store.searchMode);
 *    - Filter configuredServers to exclude 'ms365-mcp' when searchMode === 'web'
 *    - Filter mcpValues to exclude 'ms365-mcp' when searchMode === 'web'
 * 3. In useChatFunctions.ts:
 *    - Filter ephemeralAgent.mcp to exclude 'ms365-mcp' when searchMode === 'web'
 * 
 * State is persisted to localStorage via the searchMode atom in store/misc.ts
 * ============================================================================
 */
import { memo } from 'react';
import { useRecoilState } from 'recoil';
import { motion } from 'framer-motion';
import { cn } from '~/utils';
import store from '~/store';

interface WorkWebToggleProps {
  className?: string;
}

const WorkWebToggle = memo(({ className }: WorkWebToggleProps) => {
  const [searchMode, setSearchMode] = useRecoilState(store.searchMode);

  return (
    <div
      className={cn(
        'relative flex h-9 items-center rounded-full bg-surface-tertiary p-0.5 shadow-lg',
        className,
      )}
    >
      {/* Sliding background indicator - blue like the connector */}
      <motion.div
        className="absolute h-7 rounded-full border border-blue-600/50 bg-blue-500/10"
        initial={false}
        animate={{
          x: searchMode === 'web' ? 2 : 'calc(100% + 2px)',
          width: 'calc(50% - 4px)',
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 35,
        }}
      />

      {/* Web button */}
      <button
        type="button"
        onClick={() => setSearchMode('web')}
        className={cn(
          'relative z-10 flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all duration-200',
          searchMode === 'web'
            ? 'text-text-primary'
            : 'text-text-secondary hover:text-text-primary',
        )}
        aria-pressed={searchMode === 'web'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        Web
      </button>

      {/* Work button */}
      <button
        type="button"
        onClick={() => setSearchMode('work')}
        className={cn(
          'relative z-10 flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-all duration-200',
          searchMode === 'work'
            ? 'text-text-primary'
            : 'text-text-secondary hover:text-text-primary',
        )}
        aria-pressed={searchMode === 'work'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
        Work
      </button>
    </div>
  );
});

WorkWebToggle.displayName = 'WorkWebToggle';

export default WorkWebToggle;
