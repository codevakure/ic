import React, { memo, useMemo } from 'react';
import {
  SandpackPreview,
  SandpackProvider,
  SandpackProviderProps,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react';
import type { TStartupConfig } from 'ranger-data-provider';
import type { ArtifactFiles } from '~/common';
import { sharedFiles, TAILWIND_CDN, DEFAULT_BUNDLER_URL } from '~/utils/artifacts';
import ArtifactLoader from './ArtifactLoader';
import { cn } from '~/utils';

/** 
 * CSS to hide Sandpack's default loading cube overlay
 * The cube is rendered inside .sp-loading class
 */
const hideSandpackLoadingStyles = `
  .sp-preview-container .sp-loading,
  .sp-preview-container .sp-cube-wrapper,
  .sp-overlay.sp-loading,
  .sp-cube-wrapper,
  .sp-cube,
  .sp-overlay,
  div[class*="sp-cube"],
  div[class*="sp-loading"] {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

/** Custom loading overlay that shows our branded loader */
const CustomLoadingOverlay = memo(function CustomLoadingOverlay() {
  const { sandpack, listen } = useSandpack();
  const [showLoader, setShowLoader] = React.useState(true);
  
  React.useEffect(() => {
    // Listen for sandpack messages
    const unsubscribe = listen((message) => {
      if (message.type === 'done') {
        // Wait for content to fully render before hiding loader
        setTimeout(() => setShowLoader(false), 1800);
      }
      if (message.type === 'start') {
        setShowLoader(true);
      }
    });
    
    return () => unsubscribe();
  }, [listen]);

  // Also track status changes as backup
  React.useEffect(() => {
    if (sandpack.status === 'running') {
      // Longer delay to ensure iframe content is fully loaded
      const timer = setTimeout(() => setShowLoader(false), 2500);
      return () => clearTimeout(timer);
    } else if (sandpack.status === 'initial' || sandpack.status === 'idle') {
      setShowLoader(true);
    }
  }, [sandpack.status]);

  if (!showLoader) {
    return null;
  }

  return (
    <div 
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        'bg-surface-primary-alt',
      )}
    >
      <ArtifactLoader size="lg" />
    </div>
  );
});

/** Preview wrapper that includes the custom loading overlay */
const PreviewWithLoader = memo(function PreviewWithLoader({
  previewRef,
}: {
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
}) {
  return (
    <div className="relative h-full w-full bg-surface-primary-alt">
      {/* Inject CSS to hide Sandpack's default loader */}
      <style>{hideSandpackLoadingStyles}</style>
      
      <CustomLoadingOverlay />
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={false}
        tabIndex={0}
        ref={previewRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0',
        }}
      />
    </div>
  );
});

export const ArtifactPreview = memo(function ({
  files,
  fileKey,
  template,
  sharedProps,
  previewRef,
  currentCode,
  startupConfig,
}: {
  files: ArtifactFiles;
  fileKey: string;
  template: SandpackProviderProps['template'];
  sharedProps: Partial<SandpackProviderProps>;
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
  currentCode?: string;
  startupConfig?: TStartupConfig;
}) {
  const artifactFiles = useMemo(() => {
    if (Object.keys(files).length === 0) {
      return files;
    }
    const code = currentCode ?? '';
    if (!code) {
      return files;
    }
    return {
      ...files,
      [fileKey]: {
        code,
      },
    };
  }, [currentCode, files, fileKey]);

  if (Object.keys(artifactFiles).length === 0) {
    return null;
  }

  // For static HTML templates - minimal config, no dependencies, no external resources
  if (template === 'static') {
    return (
      <SandpackProvider
        files={artifactFiles as any}
        template="static"
      >
        <PreviewWithLoader previewRef={previewRef} />
      </SandpackProvider>
    );
  }

  // For React/Mermaid templates - full config with Tailwind CSS via externalResources
  const sandpackFiles = { ...artifactFiles, ...sharedFiles };
  const bundlerURL = startupConfig?.bundlerURL || DEFAULT_BUNDLER_URL;


  return (
    <SandpackProvider
      files={sandpackFiles as any}
      template={template}
      options={{
        externalResources: [TAILWIND_CDN],
        bundlerURL,
      }}
      customSetup={sharedProps.customSetup}
    >
      <PreviewWithLoader previewRef={previewRef} />
    </SandpackProvider>
  );
});