import { TooltipAnchor, Button, Sidebar } from '@ranger/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function OpenSidebar({
  setNavVisible,
  className,
}: {
  setNavVisible: React.Dispatch<React.SetStateAction<boolean>>;
  className?: string;
}) {
  const localize = useLocalize();
  return (
    <TooltipAnchor
      description={localize('com_nav_open_sidebar')}
      render={
        <Button
          size="icon"
          variant="outline"
          data-testid="open-sidebar-button"
          aria-label={localize('com_nav_open_sidebar')}
          className={cn(
            'rounded-lg border border-border-light bg-surface-secondary p-1.5 hover:bg-surface-hover',
            className,
          )}
          onClick={() =>
            setNavVisible((prev) => {
              localStorage.setItem('navVisible', JSON.stringify(!prev));
              return !prev;
            })
          }
        >
          <Sidebar />
        </Button>
      }
    />
  );
}
