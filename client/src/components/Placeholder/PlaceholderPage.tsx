import { memo } from 'react';
import { LayoutGrid } from 'lucide-react';

/**
 * Placeholder Page
 * 
 * This is a placeholder page that can be customized for future features.
 */
const PlaceholderPage = memo(() => {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-presentation p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-full bg-surface-secondary p-6">
          <LayoutGrid className="h-12 w-12 text-text-secondary" />
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">
          Placeholder Page
        </h1>
        <p className="max-w-md text-text-secondary">
          This page is a placeholder for future features. 
          You can customize this to add new functionality.
        </p>
      </div>
    </div>
  );
});

PlaceholderPage.displayName = 'PlaceholderPage';

export default PlaceholderPage;
