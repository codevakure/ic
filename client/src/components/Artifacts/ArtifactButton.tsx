import { useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { useLocation } from 'react-router-dom';
import { useRecoilState, useSetRecoilState, useResetRecoilState } from 'recoil';
import type { Artifact } from '~/common';
import { Watermark } from '~/components/ui/Watermark';
import { logger, isArtifactRoute } from '~/utils';
import { useLocalize } from '~/hooks';
import store from '~/store';

const ArtifactButton = ({ artifact }: { artifact: Artifact | null }) => {
  const localize = useLocalize();
  const location = useLocation();
  const setVisible = useSetRecoilState(store.artifactsVisibility);
  const setSourcesPanelState = useSetRecoilState(store.sourcesPanelState);
  const [artifacts, setArtifacts] = useRecoilState(store.artifactsState);
  const [currentArtifactId, setCurrentArtifactId] = useRecoilState(store.currentArtifactId);
  const resetCurrentArtifactId = useResetRecoilState(store.currentArtifactId);
  const [visibleArtifacts, setVisibleArtifacts] = useRecoilState(store.visibleArtifacts);

  const debouncedSetVisibleRef = useRef(
    debounce((artifactToSet: Artifact) => {
      logger.log(
        'artifacts_visibility',
        'Setting artifact to visible state from Artifact button',
        artifactToSet,
      );
      setVisibleArtifacts((prev) => ({
        ...prev,
        [artifactToSet.id]: artifactToSet,
      }));
    }, 750),
  );

  useEffect(() => {
    if (artifact == null || artifact?.id == null || artifact.id === '') {
      return;
    }

    if (!isArtifactRoute(location.pathname)) {
      return;
    }

    const debouncedSetVisible = debouncedSetVisibleRef.current;
    debouncedSetVisible(artifact);
    return () => {
      debouncedSetVisible.cancel();
    };
  }, [artifact, location.pathname]);

  if (artifact === null || artifact === undefined) {
    return null;
  }

  return (
    <div className="group relative my-4 rounded-xl text-sm text-text-primary max-w-xs">
      <button
        type="button"
        onClick={() => {
          if (!isArtifactRoute(location.pathname)) {
            return;
          }

          if (artifact.id === currentArtifactId) {
            resetCurrentArtifactId();
            setVisible(false);
            return;
          }

          // Close sources panel when opening artifacts
          setSourcesPanelState((prev) => ({ ...prev, isOpen: false }));

          resetCurrentArtifactId();
          setVisible(true);

          if (artifacts?.[artifact.id] == null) {
            setArtifacts(visibleArtifacts);
          }

          setTimeout(() => {
            setCurrentArtifactId(artifact.id);
          }, 15);
        }}
        className="w-full relative overflow-hidden rounded-xl border border-border-medium transition-all duration-300 hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-white/10 bg-transparent"
      >
        <div className="w-full p-4 pr-20 relative">
          <div className="flex flex-row items-center justify-between gap-4 relative">
            {/* Left section with icon and content */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {/* Code snippet icon */}
                <svg 
                  width="32" 
                  height="32" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-text-secondary"
                >
                  <path 
                    d="M16 18l6-6-6-6" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d="M8 6l-6 6 6 6" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              
              <div className="flex-1 overflow-hidden text-left">
                <div className="truncate font-semibold text-text-primary">{artifact.title}</div>
                <div className="truncate text-text-secondary text-sm">
                  {artifact.id === currentArtifactId
                    ? localize('com_ui_click_to_close')
                    : localize('com_ui_artifact_click')}
                </div>
              </div>
            </div>
            
            {/* Watermark logo on the right */}
            <div className="absolute -right-16 top-[70%] -translate-y-[30%]">
              <Watermark 
                width={80} 
                height={80} 
                className="opacity-50 group-hover:opacity-80 transition-all duration-300 group-hover:scale-110"
              />
            </div>
          </div>
        </div>
      </button>
      <br />
    </div>
  );
};

export default ArtifactButton;
