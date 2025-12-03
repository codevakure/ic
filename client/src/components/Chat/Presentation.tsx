import DragDropWrapper from '~/components/Chat/Input/Files/DragDropWrapper';

/**
 * =============================================================================
 * Presentation - Chat View Wrapper
 * =============================================================================
 * 
 * Lightweight wrapper for the chat view that provides:
 * - Drag and drop file upload support
 * - Background styling
 * 
 * ## Architecture
 * 
 * This is a child of AppLayout (via Root), which provides:
 * - SidePanelGroup (shared resizable panel infrastructure)
 * - GlobalSourcesPanel (overlay and mobile bottom sheet)
 * - Artifacts panel support
 * 
 * ```
 * AppLayout (provides SidePanelGroup + GlobalSourcesPanel + Artifacts)
 * └── Root (ChatLayout - provides Nav, MobileNav, LeftPanel)
 *     └── ChatView
 *         └── Presentation (this file)
 *             └── DragDropWrapper
 *                 └── main (chat content)
 * ```
 * 
 * ## Previous vs Current Architecture
 * 
 * Previously, Presentation contained:
 * - SidePanelGroup (now in AppLayout)
 * - GlobalSourcesPanel (now in AppLayout)
 * - Artifacts rendering (now in AppLayout)
 * - File cleanup logic (now in AppLayout)
 * 
 * This caused duplicate panels and inconsistent behavior.
 * 
 * Now, Presentation is just a simple wrapper that:
 * - Provides drag-drop file upload
 * - Sets the chat presentation background
 * 
 * ## Using Panels from Chat
 * 
 * ```tsx
 * const { openPanel, closePanel } = useSourcesPanel();
 * openPanel('Sources', <SourcesContent />, 'push');
 * ```
 * 
 * @see AppLayout - Parent layout providing shared panel infrastructure
 * @see DragDropWrapper - Handles file drag and drop
 */
export default function Presentation({ children }: { children: React.ReactNode }) {
  return (
    <DragDropWrapper className="relative flex w-full grow overflow-hidden bg-presentation">
      <main className="flex h-full w-full flex-col overflow-y-auto" role="main">
        {children}
      </main>
    </DragDropWrapper>
  );
}
