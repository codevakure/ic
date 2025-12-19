import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '~/utils';

const ResizablePanelGroup = ({
  className = '',
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className = '',
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-12 w-3.5 items-center justify-center rounded-full border border-border-medium bg-surface-secondary shadow-sm transition-all duration-200 hover:h-16 hover:bg-surface-tertiary hover:shadow-md active:bg-surface-hover">
        <div className="flex flex-col gap-1">
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
        </div>
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

const ResizableHandleAlt = ({
  withHandle,
  className = '',
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      'group relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90',
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="invisible z-10 flex h-12 w-3.5 items-center justify-center rounded-full border border-border-medium bg-surface-secondary shadow-sm transition-all duration-200 group-hover:visible group-hover:h-16 group-hover:bg-surface-tertiary group-hover:shadow-md group-active:visible group-active:bg-surface-hover group-data-[resize-handle-active]:visible">
        <div className="flex flex-col gap-1">
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
          <div className="h-1 w-1 rounded-full bg-text-tertiary" />
        </div>
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle, ResizableHandleAlt };
