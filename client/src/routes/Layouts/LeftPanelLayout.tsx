import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthContext } from '~/hooks';
import { LeftPanel } from '~/components/LeftPanel';

/**
 * Layout for pages that only need the left icon panel (no conversation sidebar)
 * Used for standalone pages like Placeholder, etc.
 */
export default function LeftPanelLayout() {
  const { isAuthenticated } = useAuthContext();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-dvh w-full bg-presentation">
      <LeftPanel />
      <div className="relative flex h-full flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
