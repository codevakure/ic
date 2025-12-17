import React, { memo, useMemo, useState, useEffect } from 'react';
import {
  SandpackPreview,
  SandpackProvider,
  SandpackProviderProps,
  useSandpack,
} from '@codesandbox/sandpack-react';
import type { SandpackPreviewRef } from '@codesandbox/sandpack-react';
import type { TStartupConfig } from 'librechat-data-provider';
import type { ArtifactFiles } from '~/common';
import { sharedFiles, TAILWIND_CDN, DEFAULT_BUNDLER_URL } from '~/utils/artifacts';
import ArtifactLoader from './ArtifactLoader';

/** Custom loading overlay that shows our branded loader */
const LoadingOverlay = memo(function LoadingOverlay() {
  const { sandpack, listen } = useSandpack();
  const [showLoader, setShowLoader] = useState(true);
  
  useEffect(() => {
    // Listen for sandpack messages
    const unsubscribe = listen((message) => {
      if (message.type === 'done') {
        // Wait for content to fully render before hiding loader
        setTimeout(() => setShowLoader(false), 2800);
      }
      if (message.type === 'start') {
        setShowLoader(true);
      }
    });
    
    return () => unsubscribe();
  }, [listen]);

  // Also track status changes as backup
  useEffect(() => {
    if (sandpack.status === 'running') {
      // Longer delay to ensure iframe content is fully loaded
      const timer = setTimeout(() => setShowLoader(false), 3500);
      return () => clearTimeout(timer);
    } else if (sandpack.status === 'initial' || sandpack.status === 'idle') {
      setShowLoader(true);
    }
  }, [sandpack.status]);

  if (!showLoader) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-primary-alt">
      <ArtifactLoader size="lg" />
    </div>
  );
});

/** Preview wrapper with loading overlay */
const PreviewWithLoader = memo(function PreviewWithLoader({
  previewRef,
}: {
  previewRef: React.MutableRefObject<SandpackPreviewRef>;
}) {
  return (
    <div className="relative h-full w-full">
      <LoadingOverlay />
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