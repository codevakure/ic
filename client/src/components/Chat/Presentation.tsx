import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue } from 'recoil';
import DragDropWrapper from '~/components/Chat/Input/Files/DragDropWrapper';
import { EditorProvider, ArtifactsProvider, useArtifactsPanelContext } from '~/Providers';
import Artifacts from '~/components/Artifacts/Artifacts';
import store from '~/store';

/**
 * =============================================================================
 * Presentation - Chat View Wrapper with Artifacts Support
 * =============================================================================
 * 
 * This component provides:
 * - Drag and drop file upload support
 * - Background styling
 * - **Artifacts rendering with proper ChatContext access via portal**
 * 
 * ## Architecture
 * 
 * This is a child of ChatView, which provides ChatContext. The ArtifactsProvider
 * here has access to isSubmitting, latestMessage, and conversation - which are
 * required for:
 * - Auto-switching to code tab during streaming
 * - Auto-switching to preview tab after stream ends
 * - Proper artifact detection and panel visibility
 * 
 * Artifacts are rendered via React Portal to the target element provided by
 * SidePanelGroup. This maintains ChatContext access while displaying artifacts
 * in the correct visual position (the resizable artifacts panel).
 * 
 * ```
 * AppLayout (provides ArtifactsPanelProvider)
 * └── SidePanelGroup (registers portal target)
 *     └── Root (ChatLayout)
 *         └── ChatView (provides ChatContext!)
 *             └── Presentation (this file)
 *                 ├── Renders artifacts via portal (maintains ChatContext!)
 *                 └── DragDropWrapper
 *                     └── main (chat content)
 * ```
 * 
 * ## Why Portal?
 * 
 * React Portals maintain the React context chain even when rendering to a
 * different DOM location. This means:
 * - ArtifactsProvider is in the React tree inside ChatContext.Provider
 * - useArtifacts hook can access isSubmitting, latestMessage correctly
 * - Visually, artifacts appear in SidePanelGroup's resizable panel
 * 
 * @see AppLayout - Parent layout that provides ArtifactsPanelProvider
 * @see SidePanelGroup - Provides the portal target element
 * @see useArtifacts - Hook that manages tab switching logic
 */
export default function Presentation({ children }: { children: React.ReactNode }) {
  const artifacts = useRecoilValue(store.artifactsState);
  const artifactsVisibility = useRecoilValue(store.artifactsVisibility);
  const { portalTarget, setHasArtifacts } = useArtifactsPanelContext();

  // Determine if we should show artifacts
  const shouldShowArtifacts = artifactsVisibility === true && Object.keys(artifacts ?? {}).length > 0;

  /**
   * Notify the panel context about artifact visibility.
   * This allows SidePanelGroup to show/hide the artifacts panel.
   */
  useEffect(() => {
    setHasArtifacts(shouldShowArtifacts);
  }, [shouldShowArtifacts, setHasArtifacts]);

  /**
   * Render artifacts via portal to the target element.
   * 
   * The ArtifactsProvider is rendered here (inside ChatContext tree) so it
   * has access to isSubmitting, latestMessage, etc. The portal renders the
   * DOM output to the target element in SidePanelGroup, but the React context
   * chain is preserved.
   * 
   * NOTE: We don't memoize this portal because it needs to properly re-render
   * with the current ChatContext values when conversation state changes.
   */
  const artifactsPortal = shouldShowArtifacts && portalTarget
    ? createPortal(
        <ArtifactsProvider>
          <EditorProvider>
            <Artifacts />
          </EditorProvider>
        </ArtifactsProvider>,
        portalTarget,
      )
    : null;

  return (
    <DragDropWrapper className="relative flex w-full grow overflow-hidden bg-presentation">
      {/* Artifacts rendered via portal - maintains ChatContext access */}
      {artifactsPortal}
      <main className="flex h-full w-full flex-col overflow-y-auto" role="main">
        {children}
      </main>
    </DragDropWrapper>
  );
}
